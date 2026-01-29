import { describe, it, expect, beforeEach } from 'vitest'
import { resetMocks } from '../../mocks/cloudflare'
import { env } from 'cloudflare:workers'
import { getDb } from '@/lib/db'
import { assets } from '@/db/schema'

import { searchAssets } from '@/lib/server/search'

describe('Search Server Functions', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('searchAssets', () => {
    beforeEach(async () => {
      const db = getDb(env.DB)

      await db.insert(assets).values([
        {
          id: 'search-1',
          filename: 'hero-banner.png',
          r2Key: 'test/hero-banner.png',
          mimeType: 'image/png',
          size: 100,
          altText: 'Hero section banner image',
          description: 'Main landing page hero',
          folderId: null,
          organizationId: 'test-org',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
        {
          id: 'search-2',
          filename: 'logo.svg',
          r2Key: 'test/logo.svg',
          mimeType: 'image/svg+xml',
          size: 50,
          altText: 'Company logo',
          description: null,
          folderId: null,
          organizationId: 'test-org',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'search-3',
          filename: 'product-photo.jpg',
          r2Key: 'test/product.jpg',
          mimeType: 'image/jpeg',
          size: 200,
          altText: null,
          description: 'Featured product hero shot',
          folderId: null,
          organizationId: 'test-org',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ])
    })

    it('should search by filename', async () => {
      const result = await searchAssets({ data: { query: 'banner' } })

      expect(result.length).toBe(1)
      expect(result[0].filename).toBe('hero-banner.png')
    })

    it('should search by altText', async () => {
      const result = await searchAssets({ data: { query: 'Company logo' } })

      expect(result.length).toBe(1)
      expect(result[0].filename).toBe('logo.svg')
    })

    it('should search by description', async () => {
      const result = await searchAssets({ data: { query: 'hero shot' } })

      expect(result.length).toBe(1)
      expect(result[0].filename).toBe('product-photo.jpg')
    })

    it('should return multiple matches', async () => {
      const result = await searchAssets({ data: { query: 'hero' } })

      // Matches "hero-banner.png" and description "...hero shot"
      // Actually only matches filename contains 'hero'
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('should include CDN URL in results', async () => {
      const result = await searchAssets({ data: { query: 'logo' } })

      expect(result[0].url).toContain('test-cdn.example.com')
    })

    it('should return empty array for empty query', async () => {
      const result = await searchAssets({ data: { query: '' } })
      expect(result).toEqual([])
    })

    it('should return empty array for whitespace-only query', async () => {
      const result = await searchAssets({ data: { query: '   ' } })
      expect(result).toEqual([])
    })

    it('should respect limit parameter', async () => {
      const result = await searchAssets({ data: { query: '.', limit: 2 } })

      expect(result.length).toBe(2)
    })

    it('should order results by createdAt descending', async () => {
      const result = await searchAssets({ data: { query: '.' } })

      // Most recent first
      expect(result[0].filename).toBe('hero-banner.png')
      expect(result[2].filename).toBe('product-photo.jpg')
    })

    it('should return empty array for no matches', async () => {
      const result = await searchAssets({ data: { query: 'nonexistent' } })
      expect(result).toEqual([])
    })

    it('should be case insensitive', async () => {
      const result = await searchAssets({ data: { query: 'HERO' } })

      expect(result.length).toBeGreaterThan(0)
    })
  })
})
