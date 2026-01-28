import { createServerFn } from "@tanstack/react-start"
import { eq, isNull, and, desc, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { folders, assets } from "@/db/schema"
import { slugify } from "@/lib/utils"
import type { FolderWithChildren, CreateFolderInput, UpdateFolderInput } from "@/lib/types"
import { getAuthContext } from "./auth-helpers"

// Get all folders (flat list)
export const getFolders = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await getAuthContext()
    const db = getDb(env.DB)

    const folderList = await db
      .select()
      .from(folders)
      .where(eq(folders.organizationId, auth.organizationId))
      .orderBy(folders.name)

    return folderList
  })

// Get folders as tree structure
export const getFolderTree = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await getAuthContext()
    const db = getDb(env.DB)

    const folderList = await db
      .select()
      .from(folders)
      .where(eq(folders.organizationId, auth.organizationId))
      .orderBy(folders.name)

    // Build tree structure
    const folderMap = new Map<string, FolderWithChildren>()
    const rootFolders: FolderWithChildren[] = []

    // First pass: create all folder objects
    for (const folder of folderList) {
      folderMap.set(folder.id, { ...folder, children: [] })
    }

    // Second pass: build tree
    for (const folder of folderList) {
      const folderWithChildren = folderMap.get(folder.id)!
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId)
        if (parent) {
          parent.children.push(folderWithChildren)
        }
      } else {
        rootFolders.push(folderWithChildren)
      }
    }

    return rootFolders
  })

// Get single folder by slug with assets
export const getFolder = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const { slug } = data
    const db = getDb(env.DB)

    const folder = await db.query.folders.findFirst({
      where: and(eq(folders.slug, slug), eq(folders.organizationId, auth.organizationId)),
    })

    if (!folder) {
      throw new Error("Folder not found")
    }

    // Get assets in this folder
    const folderAssets = await db
      .select()
      .from(assets)
      .where(and(eq(assets.folderId, folder.id), eq(assets.organizationId, auth.organizationId)))
      .orderBy(desc(assets.createdAt))

    // Get subfolders
    const subfolders = await db
      .select()
      .from(folders)
      .where(and(eq(folders.parentId, folder.id), eq(folders.organizationId, auth.organizationId)))
      .orderBy(folders.name)

    // Get parent folder for breadcrumbs
    let parent = null
    if (folder.parentId) {
      parent = await db.query.folders.findFirst({
        where: and(eq(folders.id, folder.parentId), eq(folders.organizationId, auth.organizationId)),
      })
    }

    return {
      ...folder,
      assets: folderAssets.map((asset) => ({
        ...asset,
        url: `https://${env.CDN_DOMAIN}/${asset.r2Key}`,
      })),
      subfolders,
      parent,
    }
  })

// Create folder
export const createFolder = createServerFn({ method: "POST" })
  .inputValidator((d: CreateFolderInput) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const { name, parentId } = data
    const db = getDb(env.DB)

    // Verify parent folder belongs to organization if specified
    if (parentId) {
      const parent = await db.query.folders.findFirst({
        where: and(eq(folders.id, parentId), eq(folders.organizationId, auth.organizationId)),
      })
      if (!parent) {
        throw new Error("Parent folder not found or does not belong to organization")
      }
    }

    const id = nanoid(12)
    let slug = slugify(name)

    // Ensure slug is unique within organization
    const existing = await db.query.folders.findFirst({
      where: and(eq(folders.slug, slug), eq(folders.organizationId, auth.organizationId)),
    })
    if (existing) {
      slug = `${slug}-${nanoid(4)}`
    }

    const [folder] = await db
      .insert(folders)
      .values({
        id,
        name,
        slug,
        parentId: parentId || null,
        organizationId: auth.organizationId,
        createdAt: new Date(),
      })
      .returning()

    return folder
  })

// Update folder
export const updateFolder = createServerFn({ method: "POST" })
  .inputValidator((d: UpdateFolderInput) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const { id, name } = data
    const db = getDb(env.DB)

    // Verify folder belongs to organization
    const existing = await db.query.folders.findFirst({
      where: and(eq(folders.id, id), eq(folders.organizationId, auth.organizationId)),
    })

    if (!existing) {
      throw new Error("Folder not found")
    }

    let slug = slugify(name)

    // Ensure slug is unique within organization (excluding current folder)
    const slugConflict = await db.query.folders.findFirst({
      where: and(
        eq(folders.slug, slug),
        eq(folders.organizationId, auth.organizationId),
        sql`${folders.id} != ${id}`
      ),
    })
    if (slugConflict) {
      slug = `${slug}-${nanoid(4)}`
    }

    const [updated] = await db
      .update(folders)
      .set({ name, slug })
      .where(and(eq(folders.id, id), eq(folders.organizationId, auth.organizationId)))
      .returning()

    return updated
  })

// Delete folder
export const deleteFolder = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const { id } = data
    const db = getDb(env.DB)

    // Verify folder belongs to organization
    const existing = await db.query.folders.findFirst({
      where: and(eq(folders.id, id), eq(folders.organizationId, auth.organizationId)),
    })

    if (!existing) {
      throw new Error("Folder not found")
    }

    // Assets in this folder will have folderId set to null due to ON DELETE SET NULL
    // Subfolders will be deleted due to ON DELETE CASCADE
    await db.delete(folders).where(and(eq(folders.id, id), eq(folders.organizationId, auth.organizationId)))

    return { success: true, id }
  })

// Get folder counts for sidebar
export const getFolderCounts = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await getAuthContext()
    const db = getDb(env.DB)

    const counts = await db
      .select({
        folderId: assets.folderId,
        count: sql<number>`count(*)`,
      })
      .from(assets)
      .where(eq(assets.organizationId, auth.organizationId))
      .groupBy(assets.folderId)

    // Add unfiled count
    const unfiledResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(isNull(assets.folderId), eq(assets.organizationId, auth.organizationId)))

    return {
      counts: Object.fromEntries(
        counts
          .filter((c) => c.folderId !== null)
          .map((c) => [c.folderId, c.count])
      ),
      unfiled: unfiledResult[0]?.count || 0,
    }
  })
