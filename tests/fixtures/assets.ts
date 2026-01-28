import { nanoid } from 'nanoid'
import type { Asset, AssetWithTags, Tag } from '@/lib/types'

export function createAsset(overrides: Partial<Asset> = {}): Asset {
  const id = overrides.id || nanoid(12)
  return {
    id,
    filename: `test-image-${id.slice(0, 6)}.png`,
    r2Key: `${id}-test-image.png`,
    mimeType: 'image/png',
    size: 1024 * 50, // 50KB
    width: 800,
    height: 600,
    altText: null,
    description: null,
    folderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createAssetWithUrl(overrides: Partial<Asset> = {}): Asset & { url: string } {
  const asset = createAsset(overrides)
  return {
    ...asset,
    url: `https://test-cdn.example.com/${asset.r2Key}`,
  }
}

export function createAssetWithTags(
  overrides: Partial<AssetWithTags> = {},
  tags: Tag[] = []
): AssetWithTags & { url: string } {
  const asset = createAssetWithUrl(overrides)
  return {
    ...asset,
    tags,
  }
}

// Helper to create multiple assets
export function createAssets(count: number, overrides: Partial<Asset> = {}): Asset[] {
  return Array.from({ length: count }, () => createAsset(overrides))
}

// Create a video asset
export function createVideoAsset(overrides: Partial<Asset> = {}): Asset {
  return createAsset({
    filename: 'test-video.mp4',
    mimeType: 'video/mp4',
    r2Key: `${nanoid(12)}-test-video.mp4`,
    width: 1920,
    height: 1080,
    ...overrides,
  })
}

// Create a PDF asset
export function createPdfAsset(overrides: Partial<Asset> = {}): Asset {
  return createAsset({
    filename: 'document.pdf',
    mimeType: 'application/pdf',
    r2Key: `${nanoid(12)}-document.pdf`,
    width: null,
    height: null,
    ...overrides,
  })
}
