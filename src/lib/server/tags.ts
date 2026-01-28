import { createServerFn } from "@tanstack/react-start"
import { eq, and, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { tags, assetTags, assets } from "@/db/schema"
import { slugify } from "@/lib/utils"
import type { Tag, CreateTagInput, UpdateTagInput } from "@/lib/types"
import { getAuthContext } from "./auth-helpers"

// Get all tags with asset counts
export const getTags = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = getAuthContext()
    const db = getDb(env.DB)

    const tagList = await db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        color: tags.color,
        organizationId: tags.organizationId,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        assetCount: sql<number>`(
          SELECT COUNT(*) FROM asset_tags WHERE tag_id = ${tags.id}
        )`,
      })
      .from(tags)
      .where(eq(tags.organizationId, auth.organizationId))
      .orderBy(tags.name)

    return tagList
  })

// Get single tag
export const getTag = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { id } = data
    const db = getDb(env.DB)

    const tag = await db.query.tags.findFirst({
      where: and(eq(tags.id, id), eq(tags.organizationId, auth.organizationId)),
    })

    if (!tag) {
      throw new Error("Tag not found")
    }

    return tag
  })

// Create tag
export const createTag = createServerFn({ method: "POST" })
  .inputValidator((d: CreateTagInput) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { name, color } = data
    const db = getDb(env.DB)

    const id = nanoid(12)
    let slug = slugify(name)

    // Ensure slug is unique within organization
    const existing = await db.query.tags.findFirst({
      where: and(eq(tags.slug, slug), eq(tags.organizationId, auth.organizationId)),
    })
    if (existing) {
      slug = `${slug}-${nanoid(4)}`
    }

    const now = new Date()
    const [tag] = await db
      .insert(tags)
      .values({
        id,
        name,
        slug,
        color: color || "#6b7280", // gray-500 default
        organizationId: auth.organizationId,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return tag
  })

// Update tag
export const updateTag = createServerFn({ method: "POST" })
  .inputValidator((d: UpdateTagInput) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { id, name, color } = data
    const db = getDb(env.DB)

    // Verify tag belongs to organization
    const existing = await db.query.tags.findFirst({
      where: and(eq(tags.id, id), eq(tags.organizationId, auth.organizationId)),
    })

    if (!existing) {
      throw new Error("Tag not found")
    }

    const updates: Partial<Tag> & { updatedAt: Date } = { updatedAt: new Date() }

    if (name !== undefined) {
      let slug = slugify(name)
      // Ensure slug is unique within organization (excluding current tag)
      const slugConflict = await db.query.tags.findFirst({
        where: and(
          eq(tags.slug, slug),
          eq(tags.organizationId, auth.organizationId),
          sql`${tags.id} != ${id}`
        ),
      })
      if (slugConflict) {
        slug = `${slug}-${nanoid(4)}`
      }
      updates.name = name
      updates.slug = slug
    }

    if (color !== undefined) {
      updates.color = color
    }

    if (Object.keys(updates).length === 1) {
      // Only updatedAt was set
      throw new Error("No updates provided")
    }

    const [updated] = await db
      .update(tags)
      .set(updates)
      .where(and(eq(tags.id, id), eq(tags.organizationId, auth.organizationId)))
      .returning()

    return updated
  })

// Delete tag
export const deleteTag = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { id } = data
    const db = getDb(env.DB)

    // Verify tag belongs to organization
    const existing = await db.query.tags.findFirst({
      where: and(eq(tags.id, id), eq(tags.organizationId, auth.organizationId)),
    })

    if (!existing) {
      throw new Error("Tag not found")
    }

    // asset_tags entries will be deleted due to ON DELETE CASCADE
    await db.delete(tags).where(and(eq(tags.id, id), eq(tags.organizationId, auth.organizationId)))

    return { success: true, id }
  })

// Get tags for an asset
export const getAssetTags = createServerFn({ method: "GET" })
  .inputValidator((d: { assetId: string }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { assetId } = data
    const db = getDb(env.DB)

    // Verify asset belongs to organization
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.organizationId, auth.organizationId)),
    })

    if (!asset) {
      throw new Error("Asset not found")
    }

    const assetTagRecords = await db
      .select({ tag: tags })
      .from(assetTags)
      .innerJoin(tags, eq(assetTags.tagId, tags.id))
      .where(eq(assetTags.assetId, assetId))

    return assetTagRecords.map((r) => r.tag)
  })
