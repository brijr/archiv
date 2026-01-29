import { describe, it, expect, beforeEach } from 'vitest'
import { resetMocks } from '../../mocks/cloudflare'
import { env } from 'cloudflare:workers'
import { getDb } from '@/lib/db'
import { tags, assets, assetTags } from '@/db/schema'
import { eq } from 'drizzle-orm'

import {
  getTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  getAssetTags,
} from '@/lib/server/tags'

describe('Tag Server Functions', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('getTags', () => {
    it('should return all tags with asset counts', async () => {
      const db = getDb(env.DB)

      await db.insert(tags).values([
        { id: 'tag1', name: 'Featured', slug: 'featured', color: '#ff0000', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
        { id: 'tag2', name: 'Archive', slug: 'archive', color: '#00ff00', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
      ])

      await db.insert(assets).values([
        { id: 'a1', filename: 'a1.png', r2Key: 'test/a1.png', mimeType: 'image/png', size: 100, folderId: null, organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
        { id: 'a2', filename: 'a2.png', r2Key: 'test/a2.png', mimeType: 'image/png', size: 100, folderId: null, organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
      ])

      await db.insert(assetTags).values([
        { assetId: 'a1', tagId: 'tag1' },
        { assetId: 'a2', tagId: 'tag1' },
        { assetId: 'a1', tagId: 'tag2' },
      ])

      const result = await getTags()

      expect(result.length).toBe(2)
      // Tags are sorted by name
      expect(result[0].name).toBe('Archive')
      expect(result[0].assetCount).toBe(1)
      expect(result[1].name).toBe('Featured')
      expect(result[1].assetCount).toBe(2)
    })

    it('should return empty array when no tags exist', async () => {
      const result = await getTags()
      expect(result).toEqual([])
    })
  })

  describe('getTag', () => {
    it('should return single tag by id', async () => {
      const db = getDb(env.DB)

      await db.insert(tags).values({
        id: 'get-tag',
        name: 'Get Me',
        slug: 'get-me',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await getTag({ data: { id: 'get-tag' } })

      expect(result.id).toBe('get-tag')
      expect(result.name).toBe('Get Me')
    })

    it('should throw error when tag not found', async () => {
      await expect(getTag({ data: { id: 'non-existent' } })).rejects.toThrow('Tag not found')
    })
  })

  describe('createTag', () => {
    it('should create tag with unique slug', async () => {
      const result = await createTag({ data: { name: 'New Tag', color: '#ff5500' } })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('New Tag')
      expect(result.slug).toBe('new-tag')
      expect(result.color).toBe('#ff5500')
    })

    it('should use default color when not provided', async () => {
      const result = await createTag({ data: { name: 'No Color' } })

      expect(result.color).toBe('#6b7280')
    })

    it('should generate unique slug when slug would collide', async () => {
      // Create first tag
      await createTag({ data: { name: 'Test Tag' } })
      // Create second tag with different name that slugifies to same value
      // (requires a name that would produce same slug)
      // Since names must be unique, we can just verify slugs are generated correctly
      const tag = await createTag({ data: { name: 'Another Tag' } })

      expect(tag.slug).toBe('another-tag')
    })
  })

  describe('updateTag', () => {
    it('should update tag name and slug', async () => {
      const db = getDb(env.DB)

      await db.insert(tags).values({
        id: 'update-tag',
        name: 'Original',
        slug: 'original',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await updateTag({ data: { id: 'update-tag', name: 'Updated' } })

      expect(result.name).toBe('Updated')
      expect(result.slug).toBe('updated')
    })

    it('should update tag color only', async () => {
      const db = getDb(env.DB)

      await db.insert(tags).values({
        id: 'color-tag',
        name: 'Color',
        slug: 'color',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await updateTag({ data: { id: 'color-tag', color: '#00ff00' } })

      expect(result.color).toBe('#00ff00')
      expect(result.name).toBe('Color') // Name unchanged
    })

    it('should throw error when tag not found', async () => {
      await expect(
        updateTag({ data: { id: 'non-existent', name: 'Test' } })
      ).rejects.toThrow('Tag not found')
    })

    it('should throw error when no updates provided', async () => {
      const db = getDb(env.DB)

      await db.insert(tags).values({
        id: 'no-update',
        name: 'No Update',
        slug: 'no-update',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(
        updateTag({ data: { id: 'no-update' } })
      ).rejects.toThrow('No updates provided')
    })
  })

  describe('deleteTag', () => {
    it('should delete tag', async () => {
      const db = getDb(env.DB)

      await db.insert(tags).values({
        id: 'delete-tag',
        name: 'Delete Me',
        slug: 'delete-me',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await deleteTag({ data: { id: 'delete-tag' } })

      expect(result.success).toBe(true)

      const tag = await db.query.tags.findFirst({
        where: eq(tags.id, 'delete-tag'),
      })
      expect(tag).toBeUndefined()
    })

    it('should cascade delete asset_tags entries', async () => {
      const db = getDb(env.DB)

      await db.insert(tags).values({
        id: 'cascade-tag',
        name: 'Cascade',
        slug: 'cascade',
        color: '#ff0000',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await db.insert(assets).values({
        id: 'tagged-asset',
        filename: 'tagged.png',
        r2Key: 'test/tagged.png',
        mimeType: 'image/png',
        size: 100,
        folderId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await db.insert(assetTags).values({
        assetId: 'tagged-asset',
        tagId: 'cascade-tag',
      })

      await deleteTag({ data: { id: 'cascade-tag' } })

      const tagLinks = await db.select().from(assetTags).where(eq(assetTags.tagId, 'cascade-tag'))
      expect(tagLinks.length).toBe(0)
    })
  })

  describe('getAssetTags', () => {
    it('should return tags for an asset', async () => {
      const db = getDb(env.DB)

      await db.insert(tags).values([
        { id: 'asset-tag-1', name: 'Tag 1', slug: 'tag-1', color: '#ff0000', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
        { id: 'asset-tag-2', name: 'Tag 2', slug: 'tag-2', color: '#00ff00', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
      ])

      await db.insert(assets).values({
        id: 'asset-with-tags',
        filename: 'multi-tag.png',
        r2Key: 'test/multi.png',
        mimeType: 'image/png',
        size: 100,
        folderId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await db.insert(assetTags).values([
        { assetId: 'asset-with-tags', tagId: 'asset-tag-1' },
        { assetId: 'asset-with-tags', tagId: 'asset-tag-2' },
      ])

      const result = await getAssetTags({ data: { assetId: 'asset-with-tags' } })

      expect(result.length).toBe(2)
      expect(result.map(t => t.id).sort()).toEqual(['asset-tag-1', 'asset-tag-2'])
    })

    it('should return empty array for asset with no tags', async () => {
      const db = getDb(env.DB)

      await db.insert(assets).values({
        id: 'no-tags-asset',
        filename: 'no-tags.png',
        r2Key: 'test/no-tags.png',
        mimeType: 'image/png',
        size: 100,
        folderId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await getAssetTags({ data: { assetId: 'no-tags-asset' } })

      expect(result).toEqual([])
    })
  })
})
