import { createServerFn } from "@tanstack/react-start"
import { eq, and, sql } from "drizzle-orm"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { assets } from "@/db/schema"
import { queueEmbedding } from "./embeddings"
import { getAuthContext } from "./auth-helpers"
import type { BackfillStatus } from "@/lib/types"

// Get backfill status for an organization
export const getBackfillStatus = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuthContext()
  const db = getDb(env.DB)

  const [total, pending, processing, completed, failed] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(eq(assets.organizationId, auth.organizationId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(eq(assets.organizationId, auth.organizationId), eq(assets.embeddingStatus, "pending"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(eq(assets.organizationId, auth.organizationId), eq(assets.embeddingStatus, "processing"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(eq(assets.organizationId, auth.organizationId), eq(assets.embeddingStatus, "completed"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(eq(assets.organizationId, auth.organizationId), eq(assets.embeddingStatus, "failed"))),
  ])

  return {
    total: total[0]?.count || 0,
    pending: pending[0]?.count || 0,
    processing: processing[0]?.count || 0,
    completed: completed[0]?.count || 0,
    failed: failed[0]?.count || 0,
  } as BackfillStatus
})

// Start backfill for pending assets (batch by batch)
export const startBackfill = createServerFn({ method: "POST" })
  .inputValidator((d: { batchSize?: number }) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const { batchSize = 50 } = data
    const db = getDb(env.DB)

    // Get pending assets
    const pendingAssets = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.organizationId, auth.organizationId), eq(assets.embeddingStatus, "pending")))
      .limit(batchSize)

    // Queue each for embedding
    for (const asset of pendingAssets) {
      try {
        await queueEmbedding(asset.id)
      } catch (error) {
        console.error(`Failed to queue embedding for ${asset.id}:`, error)
      }
    }

    return { queued: pendingAssets.length }
  })

// Retry failed embeddings
export const retryFailedEmbeddings = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await getAuthContext()
  const db = getDb(env.DB)

  // Reset failed to pending
  await db
    .update(assets)
    .set({
      embeddingStatus: "pending",
      embeddingError: null,
    })
    .where(and(eq(assets.organizationId, auth.organizationId), eq(assets.embeddingStatus, "failed")))

  return { reset: true }
})
