import { createServerFn } from "@tanstack/react-start"
import { eq, and, sql } from "drizzle-orm"
import { nanoid } from "nanoid"

import { getDb } from "@/lib/db"
import { tags, assetTags } from "@/db/schema"
import { slugify } from "@/lib/utils"
import type { Tag, CreateTagInput, UpdateTagInput } from "@/lib/types"

// Get all tags with asset counts
export const getTags = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const tagList = await db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        color: tags.color,
        createdAt: tags.createdAt,
        assetCount: sql<number>`(
          SELECT COUNT(*) FROM asset_tags WHERE tag_id = ${tags.id}
        )`,
      })
      .from(tags)
      .orderBy(tags.name)

    return tagList
  })

// Get single tag
export const getTag = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { id } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const tag = await db.query.tags.findFirst({
      where: eq(tags.id, id),
    })

    if (!tag) {
      throw new Error("Tag not found")
    }

    return tag
  })

// Create tag
export const createTag = createServerFn({ method: "POST" })
  .validator((data: CreateTagInput) => data)
  .handler(async ({ data, context }) => {
    const { name, color } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const id = nanoid(12)
    let slug = slugify(name)

    // Ensure slug is unique
    const existing = await db.query.tags.findFirst({
      where: eq(tags.slug, slug),
    })
    if (existing) {
      slug = `${slug}-${nanoid(4)}`
    }

    const [tag] = await db
      .insert(tags)
      .values({
        id,
        name,
        slug,
        color: color || "#6b7280", // gray-500 default
        createdAt: new Date(),
      })
      .returning()

    return tag
  })

// Update tag
export const updateTag = createServerFn({ method: "POST" })
  .validator((data: UpdateTagInput) => data)
  .handler(async ({ data, context }) => {
    const { id, name, color } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const updates: Partial<Tag> = {}

    if (name !== undefined) {
      let slug = slugify(name)
      // Ensure slug is unique (excluding current tag)
      const existing = await db.query.tags.findFirst({
        where: and(eq(tags.slug, slug), sql`${tags.id} != ${id}`),
      })
      if (existing) {
        slug = `${slug}-${nanoid(4)}`
      }
      updates.name = name
      updates.slug = slug
    }

    if (color !== undefined) {
      updates.color = color
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("No updates provided")
    }

    const [updated] = await db
      .update(tags)
      .set(updates)
      .where(eq(tags.id, id))
      .returning()

    if (!updated) {
      throw new Error("Tag not found")
    }

    return updated
  })

// Delete tag
export const deleteTag = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { id } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    // asset_tags entries will be deleted due to ON DELETE CASCADE
    await db.delete(tags).where(eq(tags.id, id))

    return { success: true, id }
  })

// Get tags for an asset
export const getAssetTags = createServerFn({ method: "GET" })
  .validator((data: { assetId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assetId } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    const assetTagRecords = await db
      .select({ tag: tags })
      .from(assetTags)
      .innerJoin(tags, eq(assetTags.tagId, tags.id))
      .where(eq(assetTags.assetId, assetId))

    return assetTagRecords.map((r) => r.tag)
  })
