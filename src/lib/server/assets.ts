import { createServerFn } from "@tanstack/react-start"
import { eq, desc, and, sql, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { generateR2Key, getCdnUrl, deleteR2Object, uploadToR2, getContentType } from "@/lib/r2"
import { assets, assetTags, tags, folders } from "@/db/schema"
import type { Asset, AssetWithTags, PaginatedResponse, UpdateAssetInput } from "@/lib/types"
import { getAuthContext } from "./auth-helpers"

// Upload a file to R2 and create asset record
export const uploadAsset = createServerFn({ method: "POST" })
  .inputValidator((d: FormData) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const file = data.get("file") as File
    const folderId = data.get("folderId") as string | null

    if (!file) {
      throw new Error("No file provided")
    }

    const db = getDb(env.DB)

    // Verify folder belongs to organization if specified
    if (folderId) {
      const folder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.organizationId, auth.organizationId)),
      })
      if (!folder) {
        throw new Error("Folder not found or does not belong to organization")
      }
    }

    // Generate unique ID and R2 key (scoped by organization)
    const id = nanoid(12)
    const r2Key = generateR2Key(file.name, auth.organizationId)

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
        organizationId: auth.organizationId,
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
  .inputValidator((d: { page?: number; limit?: number; folderId?: string; tagId?: string; search?: string } | undefined) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { page = 1, limit = 50, folderId, tagId, search } = data || {}
    const db = getDb(env.DB)

    const offset = (page - 1) * limit
    const conditions = [eq(assets.organizationId, auth.organizationId)]

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
          organizationId: assets.organizationId,
          createdAt: assets.createdAt,
          updatedAt: assets.updatedAt,
        })
        .from(assets)
        .innerJoin(assetTags, eq(assets.id, assetTags.assetId))
        .where(and(eq(assetTags.tagId, tagId), ...conditions)) as any
    } else {
      query = query.where(and(...conditions)) as any
    }

    const [assetList, countResult] = await Promise.all([
      query.orderBy(desc(assets.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(assets).where(and(...conditions)),
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
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { id } = data
    const db = getDb(env.DB)

    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, id), eq(assets.organizationId, auth.organizationId)),
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
  .inputValidator((d: UpdateAssetInput) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { id, altText, description, folderId } = data
    const db = getDb(env.DB)

    // Verify asset belongs to organization
    const existing = await db.query.assets.findFirst({
      where: and(eq(assets.id, id), eq(assets.organizationId, auth.organizationId)),
    })

    if (!existing) {
      throw new Error("Asset not found")
    }

    // Verify folder belongs to organization if specified
    if (folderId) {
      const folder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.organizationId, auth.organizationId)),
      })
      if (!folder) {
        throw new Error("Folder not found or does not belong to organization")
      }
    }

    const [updated] = await db
      .update(assets)
      .set({
        altText,
        description,
        folderId,
        updatedAt: new Date(),
      })
      .where(and(eq(assets.id, id), eq(assets.organizationId, auth.organizationId)))
      .returning()

    return {
      ...updated,
      url: getCdnUrl(updated.r2Key, env.CDN_DOMAIN),
    }
  })

// Delete single asset
export const deleteAsset = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { id } = data
    const db = getDb(env.DB)

    // Get asset to find R2 key (verify ownership)
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, id), eq(assets.organizationId, auth.organizationId)),
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
  .inputValidator((d: { ids: string[] }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { ids } = data
    const db = getDb(env.DB)

    // Get all assets to find R2 keys (verify ownership)
    const assetsToDelete = await db
      .select()
      .from(assets)
      .where(and(inArray(assets.id, ids), eq(assets.organizationId, auth.organizationId)))

    // Delete from R2
    await Promise.all(
      assetsToDelete.map((asset) => deleteR2Object(env.BUCKET, asset.r2Key))
    )

    // Delete from database
    await db.delete(assets).where(
      and(inArray(assets.id, ids), eq(assets.organizationId, auth.organizationId))
    )

    return { success: true, count: assetsToDelete.length }
  })

// Move assets to folder
export const moveAssets = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: string[]; folderId: string | null }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { ids, folderId } = data
    const db = getDb(env.DB)

    // Verify folder belongs to organization if specified
    if (folderId) {
      const folder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.organizationId, auth.organizationId)),
      })
      if (!folder) {
        throw new Error("Folder not found or does not belong to organization")
      }
    }

    await db
      .update(assets)
      .set({ folderId, updatedAt: new Date() })
      .where(and(inArray(assets.id, ids), eq(assets.organizationId, auth.organizationId)))

    return { success: true, count: ids.length }
  })

// Set tags for an asset (replaces all existing tags)
export const setAssetTags = createServerFn({ method: "POST" })
  .inputValidator((d: { assetId: string; tagIds: string[] }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { assetId, tagIds } = data
    const db = getDb(env.DB)

    // Verify asset belongs to organization
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.organizationId, auth.organizationId)),
    })

    if (!asset) {
      throw new Error("Asset not found")
    }

    // Verify all tags belong to organization
    if (tagIds.length > 0) {
      const orgTags = await db
        .select()
        .from(tags)
        .where(and(inArray(tags.id, tagIds), eq(tags.organizationId, auth.organizationId)))

      if (orgTags.length !== tagIds.length) {
        throw new Error("One or more tags not found or do not belong to organization")
      }
    }

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
  .inputValidator((d: { ids: string[]; tagId: string }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { ids, tagId } = data
    const db = getDb(env.DB)

    // Verify tag belongs to organization
    const tag = await db.query.tags.findFirst({
      where: and(eq(tags.id, tagId), eq(tags.organizationId, auth.organizationId)),
    })

    if (!tag) {
      throw new Error("Tag not found or does not belong to organization")
    }

    // Verify all assets belong to organization
    const orgAssets = await db
      .select()
      .from(assets)
      .where(and(inArray(assets.id, ids), eq(assets.organizationId, auth.organizationId)))

    // Insert tag for each verified asset (ignore duplicates)
    for (const asset of orgAssets) {
      try {
        await db.insert(assetTags).values({ assetId: asset.id, tagId })
      } catch {
        // Ignore duplicate key errors
      }
    }

    return { success: true, count: orgAssets.length }
  })

// Get dashboard stats
export const getDashboardStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = getAuthContext()
    const db = getDb(env.DB)

    const [assetCount, folderCount, tagCount, storageResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.organizationId, auth.organizationId)),
      db.select({ count: sql<number>`count(*)` }).from(folders).where(eq(folders.organizationId, auth.organizationId)),
      db.select({ count: sql<number>`count(*)` }).from(tags).where(eq(tags.organizationId, auth.organizationId)),
      db.select({ total: sql<number>`COALESCE(SUM(size), 0)` }).from(assets).where(eq(assets.organizationId, auth.organizationId)),
    ])

    return {
      totalAssets: assetCount[0]?.count || 0,
      totalFolders: folderCount[0]?.count || 0,
      totalTags: tagCount[0]?.count || 0,
      storageUsed: storageResult[0]?.total || 0,
    }
  })
