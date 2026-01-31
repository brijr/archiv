import { createServerFn } from "@tanstack/react-start"
import { eq, and, gt, or, isNull, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { getCdnUrl } from "@/lib/r2"
import { shareLinks, assets, folders, organizations } from "@/db/schema"
import { getAuthContext } from "./auth-helpers"

// Generate a secure random token for share links
function generateShareToken(): string {
  return nanoid(21) // 21 chars = ~126 bits of entropy
}

export interface CreateShareLinkInput {
  assetId?: string
  folderId?: string
  expiresInDays?: number | null // null = never expires
  allowDownload?: boolean
  maxViews?: number | null // null = unlimited
}

export interface ShareLinkWithAsset {
  id: string
  token: string
  expiresAt: Date | null
  allowDownload: boolean
  viewCount: number
  maxViews: number | null
  createdAt: Date
  asset: {
    id: string
    filename: string
    mimeType: string
    size: number
    width: number | null
    height: number | null
    altText: string | null
    description: string | null
    url: string
  } | null
  folder: {
    id: string
    name: string
    slug: string
    assets: {
      id: string
      filename: string
      mimeType: string
      size: number
      width: number | null
      height: number | null
      altText: string | null
      url: string
    }[]
  } | null
  organization: {
    id: string
    name: string
    slug: string
  }
}

// Create a share link for an asset or folder
export const createShareLink = createServerFn({ method: "POST" })
  .inputValidator((d: CreateShareLinkInput) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const db = getDb(env.DB)

    const { assetId, folderId, expiresInDays, allowDownload = true, maxViews } = data

    if (!assetId && !folderId) {
      throw new Error("Either assetId or folderId must be provided")
    }

    if (assetId && folderId) {
      throw new Error("Only one of assetId or folderId should be provided")
    }

    // Verify asset/folder belongs to organization
    if (assetId) {
      const asset = await db.query.assets.findFirst({
        where: and(eq(assets.id, assetId), eq(assets.organizationId, auth.organizationId)),
      })
      if (!asset) {
        throw new Error("Asset not found or does not belong to organization")
      }
    }

    if (folderId) {
      const folder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.organizationId, auth.organizationId)),
      })
      if (!folder) {
        throw new Error("Folder not found or does not belong to organization")
      }
    }

    const id = nanoid(12)
    const token = generateShareToken()
    const now = new Date()
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const [shareLink] = await db
      .insert(shareLinks)
      .values({
        id,
        token,
        assetId: assetId || null,
        folderId: folderId || null,
        organizationId: auth.organizationId,
        expiresAt,
        allowDownload,
        maxViews: maxViews || null,
        createdById: auth.userId,
        createdAt: now,
      })
      .returning()

    return {
      ...shareLink,
      shareUrl: `${env.BETTER_AUTH_URL}/s/${token}`,
    }
  })

// Get share link by token (PUBLIC - no auth required)
export const getShareByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const db = getDb(env.DB)
    const { token } = data

    // Find share link
    const shareLink = await db.query.shareLinks.findFirst({
      where: eq(shareLinks.token, token),
    })

    if (!shareLink) {
      throw new Error("Share link not found")
    }

    // Check expiration
    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      throw new Error("Share link has expired")
    }

    // Check view count
    if (shareLink.maxViews && shareLink.viewCount >= shareLink.maxViews) {
      throw new Error("Share link view limit reached")
    }

    // Increment view count
    await db
      .update(shareLinks)
      .set({ viewCount: sql`${shareLinks.viewCount} + 1` })
      .where(eq(shareLinks.id, shareLink.id))

    // Get asset or folder data
    let assetData = null
    let folderData = null

    if (shareLink.assetId) {
      const asset = await db.query.assets.findFirst({
        where: eq(assets.id, shareLink.assetId),
      })
      if (asset) {
        assetData = {
          id: asset.id,
          filename: asset.filename,
          mimeType: asset.mimeType,
          size: asset.size,
          width: asset.width,
          height: asset.height,
          altText: asset.altText,
          description: asset.description,
          url: getCdnUrl(asset.r2Key, env.CDN_DOMAIN),
        }
      }
    }

    if (shareLink.folderId) {
      const folder = await db.query.folders.findFirst({
        where: eq(folders.id, shareLink.folderId),
      })
      if (folder) {
        // Fetch folder assets
        const folderAssets = await db.query.assets.findMany({
          where: and(
            eq(assets.folderId, folder.id),
            eq(assets.organizationId, shareLink.organizationId)
          ),
          orderBy: (assets, { desc }) => [desc(assets.createdAt)],
        })

        folderData = {
          id: folder.id,
          name: folder.name,
          slug: folder.slug,
          assets: folderAssets.map(asset => ({
            id: asset.id,
            filename: asset.filename,
            mimeType: asset.mimeType,
            size: asset.size,
            width: asset.width,
            height: asset.height,
            altText: asset.altText,
            url: getCdnUrl(asset.r2Key, env.CDN_DOMAIN),
          })),
        }
      }
    }

    // Get organization info
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, shareLink.organizationId),
    })

    if (!org) {
      throw new Error("Organization not found")
    }

    const result: ShareLinkWithAsset = {
      id: shareLink.id,
      token: shareLink.token,
      expiresAt: shareLink.expiresAt,
      allowDownload: shareLink.allowDownload ?? true,
      viewCount: (shareLink.viewCount ?? 0) + 1, // Include this view
      maxViews: shareLink.maxViews,
      createdAt: shareLink.createdAt!,
      asset: assetData,
      folder: folderData,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    }

    return result
  })

// List share links for the current organization
export const listShareLinks = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await getAuthContext()
    const db = getDb(env.DB)

    const links = await db.query.shareLinks.findMany({
      where: eq(shareLinks.organizationId, auth.organizationId),
      orderBy: (shareLinks, { desc }) => [desc(shareLinks.createdAt)],
    })

    // Get asset info for each link
    const result = await Promise.all(
      links.map(async (link) => {
        let assetInfo = null
        let folderInfo = null

        if (link.assetId) {
          const asset = await db.query.assets.findFirst({
            where: eq(assets.id, link.assetId),
          })
          if (asset) {
            assetInfo = {
              id: asset.id,
              filename: asset.filename,
              mimeType: asset.mimeType,
            }
          }
        }

        if (link.folderId) {
          const folder = await db.query.folders.findFirst({
            where: eq(folders.id, link.folderId),
          })
          if (folder) {
            folderInfo = {
              id: folder.id,
              name: folder.name,
              slug: folder.slug,
            }
          }
        }

        return {
          ...link,
          asset: assetInfo,
          folder: folderInfo,
          shareUrl: `${env.BETTER_AUTH_URL}/s/${link.token}`,
        }
      })
    )

    return result
  })

// Delete a share link
export const deleteShareLink = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const db = getDb(env.DB)

    const shareLink = await db.query.shareLinks.findFirst({
      where: and(
        eq(shareLinks.id, data.id),
        eq(shareLinks.organizationId, auth.organizationId)
      ),
    })

    if (!shareLink) {
      throw new Error("Share link not found")
    }

    await db.delete(shareLinks).where(eq(shareLinks.id, data.id))

    return { success: true }
  })
