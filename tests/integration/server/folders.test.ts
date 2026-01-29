import { describe, it, expect, beforeEach } from 'vitest'
import { resetMocks } from '../../mocks/cloudflare'
import { env } from 'cloudflare:workers'
import { getDb } from '@/lib/db'
import { folders, assets } from '@/db/schema'
import { eq } from 'drizzle-orm'

import {
  getFolders,
  getFolderTree,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderCounts,
} from '@/lib/server/folders'

describe('Folder Server Functions', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('getFolders', () => {
    it('should return all folders sorted by name', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values([
        { id: 'f1', name: 'Zebra', slug: 'zebra', parentId: null, organizationId: 'test-org', createdAt: new Date() },
        { id: 'f2', name: 'Alpha', slug: 'alpha', parentId: null, organizationId: 'test-org', createdAt: new Date() },
        { id: 'f3', name: 'Beta', slug: 'beta', parentId: null, organizationId: 'test-org', createdAt: new Date() },
      ])

      const result = await getFolders()

      expect(result.length).toBe(3)
      expect(result[0].name).toBe('Alpha')
      expect(result[1].name).toBe('Beta')
      expect(result[2].name).toBe('Zebra')
    })

    it('should return empty array when no folders exist', async () => {
      const result = await getFolders()
      expect(result).toEqual([])
    })
  })

  describe('getFolderTree', () => {
    it('should return folders as tree structure', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values([
        { id: 'root1', name: 'Root 1', slug: 'root-1', parentId: null, organizationId: 'test-org', createdAt: new Date() },
        { id: 'root2', name: 'Root 2', slug: 'root-2', parentId: null, organizationId: 'test-org', createdAt: new Date() },
        { id: 'child1', name: 'Child 1', slug: 'child-1', parentId: 'root1', organizationId: 'test-org', createdAt: new Date() },
        { id: 'grandchild', name: 'Grandchild', slug: 'grandchild', parentId: 'child1', organizationId: 'test-org', createdAt: new Date() },
      ])

      const result = await getFolderTree()

      expect(result.length).toBe(2) // Two root folders
      const root1 = result.find(f => f.id === 'root1')!
      expect(root1.children.length).toBe(1)
      expect(root1.children[0].id).toBe('child1')
      expect(root1.children[0].children.length).toBe(1)
      expect(root1.children[0].children[0].id).toBe('grandchild')
    })
  })

  describe('getFolder', () => {
    it('should return folder with assets and subfolders', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values([
        { id: 'main', name: 'Main', slug: 'main', parentId: null, organizationId: 'test-org', createdAt: new Date() },
        { id: 'sub', name: 'Subfolder', slug: 'subfolder', parentId: 'main', organizationId: 'test-org', createdAt: new Date() },
      ])

      await db.insert(assets).values({
        id: 'asset1',
        filename: 'test.png',
        r2Key: 'test/test.png',
        mimeType: 'image/png',
        size: 100,
        folderId: 'main',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await getFolder({ data: { slug: 'main' } })

      expect(result.id).toBe('main')
      expect(result.assets.length).toBe(1)
      expect(result.assets[0].url).toContain('test.png')
      expect(result.subfolders.length).toBe(1)
      expect(result.subfolders[0].id).toBe('sub')
      expect(result.parent).toBeNull()
    })

    it('should return parent folder for breadcrumbs', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values([
        { id: 'parent', name: 'Parent', slug: 'parent', parentId: null, organizationId: 'test-org', createdAt: new Date() },
        { id: 'child', name: 'Child', slug: 'child', parentId: 'parent', organizationId: 'test-org', createdAt: new Date() },
      ])

      const result = await getFolder({ data: { slug: 'child' } })

      expect(result.parent).not.toBeNull()
      expect(result.parent!.id).toBe('parent')
    })

    it('should throw error when folder not found', async () => {
      await expect(getFolder({ data: { slug: 'non-existent' } })).rejects.toThrow('Folder not found')
    })
  })

  describe('createFolder', () => {
    it('should create folder with unique slug', async () => {
      const result = await createFolder({ data: { name: 'My New Folder' } })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('My New Folder')
      expect(result.slug).toBe('my-new-folder')
    })

    it('should create subfolder with parentId', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values({
        id: 'parent-folder',
        name: 'Parent',
        slug: 'parent',
        parentId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
      })

      const result = await createFolder({ data: { name: 'Child', parentId: 'parent-folder' } })

      expect(result.parentId).toBe('parent-folder')
    })

    it('should generate unique slug for duplicate names', async () => {
      await createFolder({ data: { name: 'Duplicate' } })
      const second = await createFolder({ data: { name: 'Duplicate' } })

      expect(second.slug).not.toBe('duplicate')
      expect(second.slug).toContain('duplicate-')
    })
  })

  describe('updateFolder', () => {
    it('should update folder name and slug', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values({
        id: 'update-folder',
        name: 'Original',
        slug: 'original',
        parentId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
      })

      const result = await updateFolder({ data: { id: 'update-folder', name: 'Updated Name' } })

      expect(result.name).toBe('Updated Name')
      expect(result.slug).toBe('updated-name')
    })

    it('should throw error when folder not found', async () => {
      await expect(
        updateFolder({ data: { id: 'non-existent', name: 'Test' } })
      ).rejects.toThrow('Folder not found')
    })
  })

  describe('deleteFolder', () => {
    it('should delete folder', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values({
        id: 'delete-folder',
        name: 'Delete Me',
        slug: 'delete-me',
        parentId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
      })

      const result = await deleteFolder({ data: { id: 'delete-folder' } })

      expect(result.success).toBe(true)

      const folder = await db.query.folders.findFirst({
        where: eq(folders.id, 'delete-folder'),
      })
      expect(folder).toBeUndefined()
    })

    it('should set assets folderId to null on cascade', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values({
        id: 'cascade-folder',
        name: 'Cascade',
        slug: 'cascade',
        parentId: null,
        organizationId: 'test-org',
        createdAt: new Date(),
      })

      await db.insert(assets).values({
        id: 'cascade-asset',
        filename: 'cascade.png',
        r2Key: 'test/cascade.png',
        mimeType: 'image/png',
        size: 100,
        folderId: 'cascade-folder',
        organizationId: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await deleteFolder({ data: { id: 'cascade-folder' } })

      const asset = await db.query.assets.findFirst({
        where: eq(assets.id, 'cascade-asset'),
      })
      expect(asset).toBeDefined()
      expect(asset!.folderId).toBeNull()
    })
  })

  describe('getFolderCounts', () => {
    it('should return asset counts per folder', async () => {
      const db = getDb(env.DB)

      await db.insert(folders).values([
        { id: 'count-1', name: 'Folder 1', slug: 'folder-1', parentId: null, organizationId: 'test-org', createdAt: new Date() },
        { id: 'count-2', name: 'Folder 2', slug: 'folder-2', parentId: null, organizationId: 'test-org', createdAt: new Date() },
      ])

      await db.insert(assets).values([
        { id: 'a1', filename: 'a1.png', r2Key: 'test/a1.png', mimeType: 'image/png', size: 100, folderId: 'count-1', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
        { id: 'a2', filename: 'a2.png', r2Key: 'test/a2.png', mimeType: 'image/png', size: 100, folderId: 'count-1', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
        { id: 'a3', filename: 'a3.png', r2Key: 'test/a3.png', mimeType: 'image/png', size: 100, folderId: 'count-2', organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
        { id: 'a4', filename: 'a4.png', r2Key: 'test/a4.png', mimeType: 'image/png', size: 100, folderId: null, organizationId: 'test-org', createdAt: new Date(), updatedAt: new Date() },
      ])

      const result = await getFolderCounts()

      expect(result.counts['count-1']).toBe(2)
      expect(result.counts['count-2']).toBe(1)
      expect(result.unfiled).toBe(1)
    })
  })
})
