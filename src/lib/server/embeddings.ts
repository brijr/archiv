import { createServerFn } from "@tanstack/react-start"
import { eq, and } from "drizzle-orm"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { assets, assetTags, tags } from "@/db/schema"
import { getAuthContext } from "./auth-helpers"
import { generateCaption, isCaptionable } from "./captioning"

// Compose text for embedding from asset fields
export function composeEmbeddingText(
  filename: string,
  altText: string | null,
  description: string | null,
  aiCaption: string | null,
  tagNames: string[]
): string {
  // Clean filename: remove extension, replace separators with spaces
  const cleanFilename = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
  const parts = [cleanFilename, altText, description, aiCaption, tagNames.join(" ")].filter(Boolean)
  return parts.join(" | ")
}

// Generate embedding for a single asset (called by queue consumer)
export async function generateAssetEmbedding(assetId: string): Promise<void> {
  const db = getDb(env.DB)

  // Get asset
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
  })

  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  let aiCaption: string | null = asset.aiCaption

  // Generate AI caption for images that don't have one yet
  if (!aiCaption && isCaptionable(asset.mimeType)) {
    try {
      // Fetch image from R2
      const r2Object = await env.BUCKET.get(asset.r2Key)
      if (!r2Object) {
        throw new Error(`R2 object not found: ${asset.r2Key}`)
      }

      const imageData = await r2Object.arrayBuffer()
      const result = await generateCaption(imageData)

      aiCaption = result.caption

      // Save caption to database immediately
      await db
        .update(assets)
        .set({
          aiCaption: result.caption,
          aiCaptionModel: result.model,
          updatedAt: new Date(),
        })
        .where(eq(assets.id, assetId))
    } catch (captionError) {
      // Log but don't fail - proceed with embedding without caption
      console.error(`Caption generation failed for ${assetId}:`, captionError)
      // aiCaption remains null, embedding proceeds
    }
  }

  // Get tag names for this asset
  const assetTagRecords = await db
    .select({ name: tags.name, id: tags.id })
    .from(assetTags)
    .innerJoin(tags, eq(assetTags.tagId, tags.id))
    .where(eq(assetTags.assetId, assetId))

  const tagNames = assetTagRecords.map((t) => t.name)
  const tagIds = assetTagRecords.map((t) => t.id)

  // Compose text and generate embedding (including AI caption if available)
  const text = composeEmbeddingText(asset.filename, asset.altText, asset.description, aiCaption, tagNames)

  // Generate embedding using Workers AI
  const embedResult = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
    text: [text],
  }) as { data: number[][] }

  const embedding = embedResult.data[0]

  // Upsert vector to Vectorize
  await env.VECTORIZE.upsert([
    {
      id: assetId,
      values: embedding,
      metadata: {
        organizationId: asset.organizationId,
        folderId: asset.folderId || "",
        mimeType: asset.mimeType,
        createdAt: asset.createdAt?.getTime() || Date.now(),
        tagIds: JSON.stringify(tagIds),
      },
    },
  ])

  // Update embedding status in D1
  await db
    .update(assets)
    .set({
      embeddingStatus: "completed",
      embeddedAt: new Date(),
      embeddingError: null,
    })
    .where(eq(assets.id, assetId))
}

// Queue an asset for embedding
export async function queueEmbedding(assetId: string): Promise<void> {
  await env.EMBEDDING_QUEUE.send({
    type: "embed_asset",
    assetId,
    timestamp: Date.now(),
  })

  // Mark as processing
  const db = getDb(env.DB)
  await db.update(assets).set({ embeddingStatus: "processing" }).where(eq(assets.id, assetId))
}

// Re-embed an asset (e.g., after metadata update)
export const reembedAsset = createServerFn({ method: "POST" })
  .inputValidator((d: { assetId: string }) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const { assetId } = data
    const db = getDb(env.DB)

    // Verify asset belongs to organization
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.organizationId, auth.organizationId)),
    })

    if (!asset) {
      throw new Error("Asset not found")
    }

    await queueEmbedding(assetId)
    return { success: true }
  })

// Delete vector when asset is deleted
export async function deleteAssetVector(assetId: string): Promise<void> {
  await env.VECTORIZE.deleteByIds([assetId])
}

// Bulk delete vectors
export async function deleteAssetVectors(assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) return
  await env.VECTORIZE.deleteByIds(assetIds)
}

// Mark embedding as failed (used by queue consumer on error)
export async function markEmbeddingFailed(assetId: string, error: string): Promise<void> {
  const db = getDb(env.DB)
  await db
    .update(assets)
    .set({
      embeddingStatus: "failed",
      embeddingError: error,
    })
    .where(eq(assets.id, assetId))
}
