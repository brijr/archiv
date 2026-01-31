import { describe, it, expect, beforeEach } from 'vitest'
import { resetMocks } from '../../mocks/cloudflare'
import { env } from 'cloudflare:workers'
import { getDb } from '@/lib/db'
import { assets, folders, shareLinks, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

import {
  createShareLink,
  getShareByToken,
  listShareLinks,
  deleteShareLink,
} from '@/lib/server/share'

describe('Share Server Functions', () => {
  beforeEach(() => {
    resetMocks()
  })

  // Helper to create test asset
  async function createTestAsset(id = 'test-asset') {
    const db = getDb(env.DB)
    await db.insert(assets).values({
      id,
      filename: 'test.png',
      r2Key: `test/${id}.png`,
      mimeType: 'image/png',
      size: 1024,
      organizationId: 'test-org',
      embeddingStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return id
  }

  // Helper to create test folder
  async function createTestFolder(id = 'test-folder') {
    const db = getDb(env.DB)
    await db.insert(folders).values({
      id,
      name: 'Test Folder',
      slug: 'test-folder',
      organizationId: 'test-org',
      createdAt: new Date(),
    })
    return id
  }

  describe('createShareLink', () => {
    it('should create share link for asset', async () => {
      const assetId = await createTestAsset()

      const result = await createShareLink({
        data: { assetId },
      })

      expect(result.id).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.token.length).toBe(21) // nanoid length
      expect(result.shareUrl).toContain('/s/')
      expect(result.assetId).toBe(assetId)
      expect(result.folderId).toBeNull()
    })

    it('should create share link for folder', async () => {
      const folderId = await createTestFolder()

      const result = await createShareLink({
        data: { folderId },
      })

      expect(result.id).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.folderId).toBe(folderId)
      expect(result.assetId).toBeNull()
    })

    it('should set expiration date when expiresInDays provided', async () => {
      const assetId = await createTestAsset()

      const result = await createShareLink({
        data: { assetId, expiresInDays: 7 },
      })

      expect(result.expiresAt).toBeDefined()
      expect(result.expiresAt).not.toBeNull()

      // Check it's roughly 7 days from now
      const expiresAt = new Date(result.expiresAt!)
      const now = new Date()
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(6.9)
      expect(diffDays).toBeLessThan(7.1)
    })

    it('should allow null expiration (never expires)', async () => {
      const assetId = await createTestAsset()

      const result = await createShareLink({
        data: { assetId, expiresInDays: null },
      })

      expect(result.expiresAt).toBeNull()
    })

    it('should set allowDownload and maxViews', async () => {
      const assetId = await createTestAsset()

      const result = await createShareLink({
        data: { assetId, allowDownload: false, maxViews: 10 },
      })

      expect(result.allowDownload).toBe(false)
      expect(result.maxViews).toBe(10)
    })

    it('should throw when neither assetId nor folderId provided', async () => {
      await expect(
        createShareLink({ data: {} })
      ).rejects.toThrow('Either assetId or folderId must be provided')
    })

    it('should throw when both assetId and folderId provided', async () => {
      const assetId = await createTestAsset()
      const folderId = await createTestFolder()

      await expect(
        createShareLink({ data: { assetId, folderId } })
      ).rejects.toThrow('Only one of assetId or folderId should be provided')
    })

    it('should throw when asset not found', async () => {
      await expect(
        createShareLink({ data: { assetId: 'nonexistent' } })
      ).rejects.toThrow('Asset not found')
    })

    it('should throw when folder not found', async () => {
      await expect(
        createShareLink({ data: { folderId: 'nonexistent' } })
      ).rejects.toThrow('Folder not found')
    })
  })

  describe('getShareByToken', () => {
    it('should return share link with asset data', async () => {
      const assetId = await createTestAsset()
      const db = getDb(env.DB)

      // Create share link directly in DB
      await db.insert(shareLinks).values({
        id: 'share-1',
        token: 'valid-token-123',
        assetId,
        organizationId: 'test-org',
        allowDownload: true,
        viewCount: 0,
        createdById: 'test-user',
        createdAt: new Date(),
      })

      const result = await getShareByToken({ data: { token: 'valid-token-123' } })

      expect(result.token).toBe('valid-token-123')
      expect(result.asset).not.toBeNull()
      expect(result.asset?.filename).toBe('test.png')
      expect(result.asset?.url).toContain('test-cdn.example.com')
      expect(result.folder).toBeNull()
    })

    it('should return share link with folder and assets', async () => {
      const folderId = await createTestFolder()
      const assetId = await createTestAsset('folder-asset')
      const db = getDb(env.DB)

      // Associate asset with folder
      await db.update(assets)
        .set({ folderId })
        .where(eq(assets.id, assetId))

      // Create share link
      await db.insert(shareLinks).values({
        id: 'share-folder',
        token: 'folder-token-123',
        folderId,
        organizationId: 'test-org',
        allowDownload: true,
        viewCount: 0,
        createdById: 'test-user',
        createdAt: new Date(),
      })

      const result = await getShareByToken({ data: { token: 'folder-token-123' } })

      expect(result.folder).not.toBeNull()
      expect(result.folder?.name).toBe('Test Folder')
      expect(result.folder?.assets).toBeDefined()
      expect(result.folder?.assets.length).toBe(1)
      expect(result.folder?.assets[0].filename).toBe('test.png')
    })

    it('should increment view count', async () => {
      const assetId = await createTestAsset()
      const db = getDb(env.DB)

      await db.insert(shareLinks).values({
        id: 'share-count',
        token: 'count-token',
        assetId,
        organizationId: 'test-org',
        viewCount: 5,
        createdById: 'test-user',
        createdAt: new Date(),
      })

      const result = await getShareByToken({ data: { token: 'count-token' } })

      // Result includes this view
      expect(result.viewCount).toBe(6)

      // Verify DB was updated
      const dbLink = await db.query.shareLinks.findFirst({
        where: eq(shareLinks.token, 'count-token'),
      })
      expect(dbLink?.viewCount).toBe(6)
    })

    it('should throw when token not found', async () => {
      await expect(
        getShareByToken({ data: { token: 'nonexistent' } })
      ).rejects.toThrow('Share link not found')
    })

    it('should throw when link expired', async () => {
      const assetId = await createTestAsset()
      const db = getDb(env.DB)

      // Create expired link
      await db.insert(shareLinks).values({
        id: 'share-expired',
        token: 'expired-token',
        assetId,
        organizationId: 'test-org',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        createdById: 'test-user',
        createdAt: new Date(),
      })

      await expect(
        getShareByToken({ data: { token: 'expired-token' } })
      ).rejects.toThrow('Share link has expired')
    })

    it('should throw when max views reached', async () => {
      const assetId = await createTestAsset()
      const db = getDb(env.DB)

      await db.insert(shareLinks).values({
        id: 'share-maxed',
        token: 'maxed-token',
        assetId,
        organizationId: 'test-org',
        viewCount: 10,
        maxViews: 10,
        createdById: 'test-user',
        createdAt: new Date(),
      })

      await expect(
        getShareByToken({ data: { token: 'maxed-token' } })
      ).rejects.toThrow('Share link view limit reached')
    })
  })

  describe('listShareLinks', () => {
    it('should return all share links for organization', async () => {
      const assetId = await createTestAsset()
      const db = getDb(env.DB)

      await db.insert(shareLinks).values([
        {
          id: 'share-1',
          token: 'token-1',
          assetId,
          organizationId: 'test-org',
          createdById: 'test-user',
          createdAt: new Date(),
        },
        {
          id: 'share-2',
          token: 'token-2',
          assetId,
          organizationId: 'test-org',
          createdById: 'test-user',
          createdAt: new Date(),
        },
      ])

      const result = await listShareLinks()

      expect(result.length).toBe(2)
    })

    it('should include asset info', async () => {
      const assetId = await createTestAsset()
      const db = getDb(env.DB)

      await db.insert(shareLinks).values({
        id: 'share-1',
        token: 'token-1',
        assetId,
        organizationId: 'test-org',
        createdById: 'test-user',
        createdAt: new Date(),
      })

      const result = await listShareLinks()

      expect(result[0].asset).not.toBeNull()
      expect(result[0].asset?.filename).toBe('test.png')
    })

    it('should include folder info', async () => {
      const folderId = await createTestFolder()
      const db = getDb(env.DB)

      await db.insert(shareLinks).values({
        id: 'share-1',
        token: 'token-1',
        folderId,
        organizationId: 'test-org',
        createdById: 'test-user',
        createdAt: new Date(),
      })

      const result = await listShareLinks()

      expect(result[0].folder).not.toBeNull()
      expect(result[0].folder?.name).toBe('Test Folder')
    })
  })

  describe('deleteShareLink', () => {
    it('should delete share link', async () => {
      const assetId = await createTestAsset()
      const db = getDb(env.DB)

      await db.insert(shareLinks).values({
        id: 'share-delete',
        token: 'delete-token',
        assetId,
        organizationId: 'test-org',
        createdById: 'test-user',
        createdAt: new Date(),
      })

      const result = await deleteShareLink({ data: { id: 'share-delete' } })

      expect(result.success).toBe(true)

      // Verify deleted
      const dbLink = await db.query.shareLinks.findFirst({
        where: eq(shareLinks.id, 'share-delete'),
      })
      expect(dbLink).toBeUndefined()
    })

    it('should throw when link not found', async () => {
      await expect(
        deleteShareLink({ data: { id: 'nonexistent' } })
      ).rejects.toThrow('Share link not found')
    })
  })
})
