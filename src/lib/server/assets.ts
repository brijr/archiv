import { createServerFn } from "@tanstack/react-start"
import { eq, desc, and, like, sql, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"

import { getDb } from "@/lib/db"
import { generateR2Key, getCdnUrl, deleteR2Object, uploadToR2, getContentType } from "@/lib/r2"
import { assets, assetTags, tags } from "@/db/schema"
import type { Asset, AssetWithTags, PaginatedResponse, AssetFilters, CreateAssetInput, UpdateAssetInput } from "@/lib/types"

// Upload a file to R2 and create asset record
export const uploadAsset = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data, context }) => {
    const file = data.get("file") as File
    const folderId = data.get("folderId") as string | null

    if (!file) {
      throw new Error("No file provided")
    }

    const env = context.cloudflare.env
    const db = getDb(env.DB)

    // Generate unique ID and R2 key
    const id = nanoid(12)
    const r2Key = generateR2Key(file.name)

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer()
    await uploadToR2(env.BUCKET, r2Key, arrayBuffer, file.type || getContentType(file.name))

    // Create asset record
    const now = new Date()
    const [asset] = await db
      .insert(assets)
      .values({
        id,
        filename: file.name,
        r2Key,
        mimeType: file.type || getContentType(file.name),
        size: file.size,
        folderId: folderId || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return {
      ...asset,
      url: getCdnUrl(r2Key, env.CDN_DOMAIN),
    }
  })

// Get paginated assets
export const getAssets = createServerFn({ method: "GET" })
  .validator((data: { page?: number; limit?: number; folderId?: string; tagId?: string; search?: string }) => data)
  .handler(async ({ data, context }) => {
    const { page = 1, limit = 50, folderId, tagId, search } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const offset = (page - 1) * limit
    const conditions = []

    if (folderId) {
      conditions.push(eq(assets.folderId, folderId))
    }

    if (search) {
      conditions.push(
        sql`(${assets.filename} LIKE ${`%${search}%`} OR ${assets.altText} LIKE ${`%${search}%`} OR ${assets.description} LIKE ${`%${search}%`})`
      )
    }

    // Base query
    let query = db.select().from(assets)

    if (tagId) {
      // Join with asset_tags if filtering by tag
      query = db
        .select({
          id: assets.id,
          filename: assets.filename,
          r2Key: assets.r2Key,
          mimeType: assets.mimeType,
          size: assets.size,
          width: assets.width,
          height: assets.height,
          altText: assets.altText,
          description: assets.description,
          folderId: assets.folderId,
          createdAt: assets.createdAt,
          updatedAt: assets.updatedAt,
        })
        .from(assets)
        .innerJoin(assetTags, eq(assets.id, assetTags.assetId))
        .where(conditions.length > 0 ? and(eq(assetTags.tagId, tagId), ...conditions) : eq(assetTags.tagId, tagId)) as any
    } else if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    const [assetList, countResult] = await Promise.all([
      query.orderBy(desc(assets.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(assets).where(conditions.length > 0 ? and(...conditions) : undefined),
    ])

    const total = countResult[0]?.count || 0

    return {
      data: assetList.map((asset: Asset) => ({
        ...asset,
        url: getCdnUrl(asset.r2Key, env.CDN_DOMAIN),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    } as PaginatedResponse<Asset & { url: string }>
  })

// Get single asset with tags
export const getAsset = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { id } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, id),
    })

    if (!asset) {
      throw new Error("Asset not found")
    }

    // Get tags for this asset
    const assetTagRecords = await db
      .select({ tag: tags })
      .from(assetTags)
      .innerJoin(tags, eq(assetTags.tagId, tags.id))
      .where(eq(assetTags.assetId, id))

    return {
      ...asset,
      url: getCdnUrl(asset.r2Key, env.CDN_DOMAIN),
      tags: assetTagRecords.map((r) => r.tag),
    } as AssetWithTags & { url: string }
  })

// Update asset metadata
export const updateAsset = createServerFn({ method: "POST" })
  .validator((data: UpdateAssetInput) => data)
  .handler(async ({ data, context }) => {
    const { id, altText, description, folderId } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const [updated] = await db
      .update(assets)
      .set({
        altText,
        description,
        folderId,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, id))
      .returning()

    if (!updated) {
      throw new Error("Asset not found")
    }

    return {
      ...updated,
      url: getCdnUrl(updated.r2Key, env.CDN_DOMAIN),
    }
  })

// Delete single asset
export const deleteAsset = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { id } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    // Get asset to find R2 key
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, id),
    })

    if (!asset) {
      throw new Error("Asset not found")
    }

    // Delete from R2
    await deleteR2Object(env.BUCKET, asset.r2Key)

    // Delete from database (asset_tags will cascade)
    await db.delete(assets).where(eq(assets.id, id))

    return { success: true, id }
  })

// Bulk delete assets
export const deleteAssets = createServerFn({ method: "POST" })
  .validator((data: { ids: string[] }) => data)
  .handler(async ({ data, context }) => {
    const { ids } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    // Get all assets to find R2 keys
    const assetsToDelete = await db
      .select()
      .from(assets)
      .where(inArray(assets.id, ids))

    // Delete from R2
    await Promise.all(
      assetsToDelete.map((asset) => deleteR2Object(env.BUCKET, asset.r2Key))
    )

    // Delete from database
    await db.delete(assets).where(inArray(assets.id, ids))

    return { success: true, count: assetsToDelete.length }
  })

// Move assets to folder
export const moveAssets = createServerFn({ method: "POST" })
  .validator((data: { ids: string[]; folderId: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { ids, folderId } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    await db
      .update(assets)
      .set({ folderId, updatedAt: new Date() })
      .where(inArray(assets.id, ids))

    return { success: true, count: ids.length }
  })

// Set tags for an asset (replaces all existing tags)
export const setAssetTags = createServerFn({ method: "POST" })
  .validator((data: { assetId: string; tagIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    const { assetId, tagIds } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    // Remove existing tags
    await db.delete(assetTags).where(eq(assetTags.assetId, assetId))

    // Add new tags
    if (tagIds.length > 0) {
      await db.insert(assetTags).values(
        tagIds.map((tagId) => ({
          assetId,
          tagId,
        }))
      )
    }

    // Update asset timestamp
    await db
      .update(assets)
      .set({ updatedAt: new Date() })
      .where(eq(assets.id, assetId))

    return { success: true }
  })

// Bulk add tag to assets
export const tagAssets = createServerFn({ method: "POST" })
  .validator((data: { ids: string[]; tagId: string }) => data)
  .handler(async ({ data, context }) => {
    const { ids, tagId } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    // Insert tag for each asset (ignore duplicates)
    for (const assetId of ids) {
      try {
        await db.insert(assetTags).values({ assetId, tagId })
      } catch {
        // Ignore duplicate key errors
      }
    }

    return { success: true, count: ids.length }
  })

// Get dashboard stats
export const getDashboardStats = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const [assetCount, folderCount, tagCount, storageResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(assets),
      db.select({ count: sql<number>`count(*)` }).from(await import("@/db/schema").then(m => m.folders)),
      db.select({ count: sql<number>`count(*)` }).from(tags),
      db.select({ total: sql<number>`COALESCE(SUM(size), 0)` }).from(assets),
    ])

    return {
      totalAssets: assetCount[0]?.count || 0,
      totalFolders: folderCount[0]?.count || 0,
      totalTags: tagCount[0]?.count || 0,
      storageUsed: storageResult[0]?.total || 0,
    }
  })
