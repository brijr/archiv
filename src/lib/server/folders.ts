import { createServerFn } from "@tanstack/react-start"
import { eq, isNull, and, desc, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { folders, assets } from "@/db/schema"
import { slugify } from "@/lib/utils"
import type { Folder, FolderWithChildren, CreateFolderInput, UpdateFolderInput } from "@/lib/types"

// Get all folders (flat list)
export const getFolders = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb(env.DB)

    const folderList = await db
      .select()
      .from(folders)
      .orderBy(folders.name)

    return folderList
  })

// Get folders as tree structure
export const getFolderTree = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb(env.DB)

    const folderList = await db
      .select()
      .from(folders)
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
  .handler(async ({ data }: { data: { slug: string } }) => {
    const { slug } = data
    const db = getDb(env.DB)

    const folder = await db.query.folders.findFirst({
      where: eq(folders.slug, slug),
    })

    if (!folder) {
      throw new Error("Folder not found")
    }

    // Get assets in this folder
    const folderAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.folderId, folder.id))
      .orderBy(desc(assets.createdAt))

    // Get subfolders
    const subfolders = await db
      .select()
      .from(folders)
      .where(eq(folders.parentId, folder.id))
      .orderBy(folders.name)

    // Get parent folder for breadcrumbs
    let parent = null
    if (folder.parentId) {
      parent = await db.query.folders.findFirst({
        where: eq(folders.id, folder.parentId),
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
  .handler(async ({ data }: { data: CreateFolderInput }) => {
    const { name, parentId } = data
    const db = getDb(env.DB)

    const id = nanoid(12)
    let slug = slugify(name)

    // Ensure slug is unique
    const existing = await db.query.folders.findFirst({
      where: eq(folders.slug, slug),
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
        createdAt: new Date(),
      })
      .returning()

    return folder
  })

// Update folder
export const updateFolder = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: UpdateFolderInput }) => {
    const { id, name } = data
    const db = getDb(env.DB)

    let slug = slugify(name)

    // Ensure slug is unique (excluding current folder)
    const existing = await db.query.folders.findFirst({
      where: and(eq(folders.slug, slug), sql`${folders.id} != ${id}`),
    })
    if (existing) {
      slug = `${slug}-${nanoid(4)}`
    }

    const [updated] = await db
      .update(folders)
      .set({ name, slug })
      .where(eq(folders.id, id))
      .returning()

    if (!updated) {
      throw new Error("Folder not found")
    }

    return updated
  })

// Delete folder
export const deleteFolder = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string } }) => {
    const { id } = data
    const db = getDb(env.DB)

    // Assets in this folder will have folderId set to null due to ON DELETE SET NULL
    // Subfolders will be deleted due to ON DELETE CASCADE
    await db.delete(folders).where(eq(folders.id, id))

    return { success: true, id }
  })

// Get folder counts for sidebar
export const getFolderCounts = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb(env.DB)

    const counts = await db
      .select({
        folderId: assets.folderId,
        count: sql<number>`count(*)`,
      })
      .from(assets)
      .groupBy(assets.folderId)

    // Add unfiled count
    const unfiledResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(isNull(assets.folderId))

    return {
      counts: Object.fromEntries(
        counts
          .filter((c) => c.folderId !== null)
          .map((c) => [c.folderId, c.count])
      ),
      unfiled: unfiledResult[0]?.count || 0,
    }
  })
