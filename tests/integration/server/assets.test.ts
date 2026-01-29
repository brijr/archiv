import { describe, it, expect, beforeEach } from 'vitest'
import { resetMocks } from '../../mocks/cloudflare'
import { env } from 'cloudflare:workers'
import { getDb } from '@/lib/db'
import { assets, tags, assetTags, folders } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Import the server functions to test
import {
  uploadAsset,
  getAssets,
  getAsset,
  updateAsset,
  deleteAsset,
  deleteAssets,
  moveAssets,
  setAssetTags,
  tagAssets,
  getDashboardStats,
} from '@/lib/server/assets'

describe('Asset Server Functions', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('uploadAsset', () => {
    it('should upload file to R2 and create asset record', async () => {
      const file = new File(['test content'], 'test-image.png', { type: 'image/png' })
      const formData = new FormData()
      formData.append('file', file)

      const result = await uploadAsset({ data: formData })

      expect(result.id).toBeDefined()
      expect(result.filename).toBe('test-image.png')
      expect(result.mimeType).toBe('image/png')
      expect(result.size).toBe(12) // "test content".length
      expect(result.url).toContain('test-cdn.example.com')
      expect(result.r2Key).toBeDefined()

      // Verify file was uploaded to R2
      const r2Object = await env.BUCKET.get(result.r2Key)
      expect(r2Object).not.toBeNull()
    })

    it('should associate asset with folderId', async () => {
      const db = getDb(env.DB)

      // Create a folder first
      await db.insert(folders).values({
        id: 'folder-1',
        name: 'Test Folder',
        slug: 'test-folder',
        parentId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
      })

      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folderId', 'folder-1')

      const result = await uploadAsset({ data: formData })

      expect(result.folderId).toBe('folder-1')
    })

    it('should throw error when no file provided', async () => {
      const formData = new FormData()

      await expect(uploadAsset({ data: formData })).rejects.toThrow('No file provided')
    })
  })

  describe('getAssets', () => {
    it('should return paginated assets', async () => {
      const db = getDb(env.DB)

      // Create test assets
      await db.insert(assets).values([
        {
          id: 'page-asset-1',
          filename: 'page1.png',
          r2Key: 'test/page1.png',
          mimeType: 'image/png',
          size: 100,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'page-asset-2',
          filename: 'page2.png',
          r2Key: 'test/page2.png',
          mimeType: 'image/png',
          size: 200,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await getAssets({ data: { page: 1, limit: 10 } })

      expect(result.data).toBeDefined()
      expect(result.pagination).toBeDefined()
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should include URL for each asset', async () => {
      const result = await getAssets({ data: {} })

      if (result.data.length > 0) {
        expect(result.data[0].url).toContain('test-cdn.example.com')
      }
    })

    it('should filter by folderId', async () => {
      // Create assets in different folders
      const db = getDb(env.DB)

      await db.insert(folders).values({
        id: 'filter-folder',
        name: 'Filter Folder',
        slug: 'filter-folder',
        parentId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
      })

      await db.insert(assets).values({
        id: 'asset-in-folder',
        filename: 'folder-asset.png',
        r2Key: 'test/folder-asset.png',
        mimeType: 'image/png',
        size: 100,
        folderId: 'filter-folder',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await getAssets({ data: { folderId: 'filter-folder' } })

      expect(result.data.every(a => a.folderId === 'filter-folder')).toBe(true)
    })

    it('should search by filename', async () => {
      const db = getDb(env.DB)

      await db.insert(assets).values({
        id: 'searchable-asset',
        filename: 'unique-searchable-image.png',
        r2Key: 'test/searchable.png',
        mimeType: 'image/png',
        size: 100,
        folderId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await getAssets({ data: { search: 'unique-searchable' } })

      expect(result.data.some(a => a.filename === 'unique-searchable-image.png')).toBe(true)
    })
  })

  describe('getAsset', () => {
    it('should return single asset with tags', async () => {
      const db = getDb(env.DB)

      // Create asset and tags
      await db.insert(assets).values({
        id: 'test-asset-1',
        filename: 'test.png',
        r2Key: 'test/test.png',
        mimeType: 'image/png',
        size: 100,
        folderId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await db.insert(tags).values({
        id: 'tag-1',
        name: 'Test Tag',
        slug: 'test-tag',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await db.insert(assetTags).values({
        assetId: 'test-asset-1',
        tagId: 'tag-1',
      })

      const result = await getAsset({ data: { id: 'test-asset-1' } })

      expect(result.id).toBe('test-asset-1')
      expect(result.filename).toBe('test.png')
      expect(result.url).toContain('test-cdn.example.com')
      expect(result.tags).toBeDefined()
      expect(result.tags.length).toBe(1)
      expect(result.tags[0].name).toBe('Test Tag')
    })

    it('should throw error when asset not found', async () => {
      await expect(getAsset({ data: { id: 'non-existent' } })).rejects.toThrow('Asset not found')
    })
  })

  describe('updateAsset', () => {
    it('should update asset metadata', async () => {
      const db = getDb(env.DB)

      await db.insert(assets).values({
        id: 'update-asset',
        filename: 'update-test.png',
        r2Key: 'test/update.png',
        mimeType: 'image/png',
        size: 100,
        folderId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await updateAsset({
        data: {
          id: 'update-asset',
          altText: 'Updated alt text',
          description: 'Updated description',
        },
      })

      expect(result.altText).toBe('Updated alt text')
      expect(result.description).toBe('Updated description')
    })

    it('should throw error when asset not found', async () => {
      await expect(
        updateAsset({ data: { id: 'non-existent', altText: 'test' } })
      ).rejects.toThrow('Asset not found')
    })
  })

  describe('deleteAsset', () => {
    it('should delete asset from DB and R2', async () => {
      const db = getDb(env.DB)

      // Create asset with R2 object
      const r2Key = 'test/delete-test.png'
      await env.BUCKET.put(r2Key, 'test content')

      await db.insert(assets).values({
        id: 'delete-asset',
        filename: 'delete-test.png',
        r2Key,
        mimeType: 'image/png',
        size: 100,
        folderId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await deleteAsset({ data: { id: 'delete-asset' } })

      expect(result.success).toBe(true)
      expect(result.id).toBe('delete-asset')

      // Verify deleted from DB
      const asset = await db.query.assets.findFirst({
        where: eq(assets.id, 'delete-asset'),
      })
      expect(asset).toBeUndefined()

      // Verify deleted from R2
      const r2Object = await env.BUCKET.get(r2Key)
      expect(r2Object).toBeNull()
    })

    it('should throw error when asset not found', async () => {
      await expect(deleteAsset({ data: { id: 'non-existent' } })).rejects.toThrow('Asset not found')
    })
  })

  describe('deleteAssets', () => {
    it('should bulk delete assets', async () => {
      const db = getDb(env.DB)

      // Create multiple assets
      await db.insert(assets).values([
        {
          id: 'bulk-1',
          filename: 'bulk1.png',
          r2Key: 'test/bulk1.png',
          mimeType: 'image/png',
          size: 100,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'bulk-2',
          filename: 'bulk2.png',
          r2Key: 'test/bulk2.png',
          mimeType: 'image/png',
          size: 100,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      await env.BUCKET.put('test/bulk1.png', 'content')
      await env.BUCKET.put('test/bulk2.png', 'content')

      const result = await deleteAssets({ data: { ids: ['bulk-1', 'bulk-2'] } })

      expect(result.success).toBe(true)
      expect(result.count).toBe(2)
    })
  })

  describe('moveAssets', () => {
    it('should move assets to folder', async () => {
      const db = getDb(env.DB)

      // Create folder and assets
      await db.insert(folders).values({
        id: 'target-folder',
        name: 'Target',
        slug: 'target',
        parentId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
      })

      await db.insert(assets).values([
        {
          id: 'move-1',
          filename: 'move1.png',
          r2Key: 'test/move1.png',
          mimeType: 'image/png',
          size: 100,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'move-2',
          filename: 'move2.png',
          r2Key: 'test/move2.png',
          mimeType: 'image/png',
          size: 100,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await moveAssets({ data: { ids: ['move-1', 'move-2'], folderId: 'target-folder' } })

      expect(result.success).toBe(true)
      expect(result.count).toBe(2)

      // Verify assets moved
      const movedAssets = await db.select().from(assets).where(eq(assets.folderId, 'target-folder'))
      expect(movedAssets.length).toBe(2)
    })
  })

  describe('setAssetTags', () => {
    it('should replace all tags for an asset', async () => {
      const db = getDb(env.DB)

      // Create asset and tags
      await db.insert(assets).values({
        id: 'tag-asset',
        filename: 'tagged.png',
        r2Key: 'test/tagged.png',
        mimeType: 'image/png',
        size: 100,
        folderId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await db.insert(tags).values([
        { id: 'tag-a', name: 'Tag A', slug: 'tag-a', color: '#ff0000', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
        { id: 'tag-b', name: 'Tag B', slug: 'tag-b', color: '#00ff00', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
        { id: 'tag-c', name: 'Tag C', slug: 'tag-c', color: '#0000ff', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
      ])

      // Add initial tag
      await db.insert(assetTags).values({ assetId: 'tag-asset', tagId: 'tag-a' })

      // Replace with new tags
      await setAssetTags({ data: { assetId: 'tag-asset', tagIds: ['tag-b', 'tag-c'] } })

      // Verify tags replaced
      const newTags = await db.select().from(assetTags).where(eq(assetTags.assetId, 'tag-asset'))
      expect(newTags.length).toBe(2)
      expect(newTags.map(t => t.tagId).sort()).toEqual(['tag-b', 'tag-c'])
    })
  })

  describe('tagAssets', () => {
    it('should add tag to multiple assets', async () => {
      const db = getDb(env.DB)

      // Create assets and tag
      await db.insert(assets).values([
        {
          id: 'bulk-tag-1',
          filename: 'bt1.png',
          r2Key: 'test/bt1.png',
          mimeType: 'image/png',
          size: 100,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'bulk-tag-2',
          filename: 'bt2.png',
          r2Key: 'test/bt2.png',
          mimeType: 'image/png',
          size: 100,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      await db.insert(tags).values({
        id: 'bulk-tag',
        name: 'Bulk Tag',
        slug: 'bulk-tag',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await tagAssets({ data: { ids: ['bulk-tag-1', 'bulk-tag-2'], tagId: 'bulk-tag' } })

      expect(result.success).toBe(true)
      expect(result.count).toBe(2)

      // Verify tags added
      const taggedAssets = await db.select().from(assetTags).where(eq(assetTags.tagId, 'bulk-tag'))
      expect(taggedAssets.length).toBe(2)
    })
  })

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      const db = getDb(env.DB)

      // Create test data
      await db.insert(assets).values([
        {
          id: 'stat-1',
          filename: 's1.png',
          r2Key: 'test/s1.png',
          mimeType: 'image/png',
          size: 1000,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'stat-2',
          filename: 's2.png',
          r2Key: 'test/s2.png',
          mimeType: 'image/png',
          size: 2000,
          folderId: null,
          organizationId: 'test-org',
        createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      await db.insert(folders).values({
        id: 'stat-folder',
        name: 'Stats',
        slug: 'stats',
        parentId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
      })

      await db.insert(tags).values({
        id: 'stat-tag',
        name: 'Stats',
        slug: 'stats',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await getDashboardStats()

      expect(result.totalAssets).toBe(2)
      expect(result.totalFolders).toBe(1)
      expect(result.totalTags).toBe(1)
      expect(result.storageUsed).toBe(3000)
    })
  })
})
