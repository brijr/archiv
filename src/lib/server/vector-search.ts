import { createServerFn } from "@tanstack/react-start"
import { eq, and, inArray, sql } from "drizzle-orm"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { assets } from "@/db/schema"
import { getCdnUrl } from "@/lib/r2"
import { getAuthContext } from "./auth-helpers"
import type { VectorSearchInput, VectorSearchResult } from "@/lib/types"

// Pure semantic vector search with optional filters
export const vectorSearch = createServerFn({ method: "GET" })
  .inputValidator((d: VectorSearchInput) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const { query, limit = 50, folderId, tagIds, mimeTypePrefix, minScore = 0.3 } = data
    const db = getDb(env.DB)

    if (!query.trim()) {
      return []
    }

    // Generate query embedding
    const embedResult = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: [query],
    }) as { data: number[][] }
    const queryEmbedding = embedResult.data[0]

    // Build Vectorize filter - organizationId is REQUIRED for multi-tenancy
    const filter: VectorizeVectorMetadataFilter = {
      organizationId: auth.organizationId,
    }

    if (folderId) {
      filter.folderId = folderId
    }

    // Note: Vectorize doesn't support prefix matching, so mimeTypePrefix
    // filtering is done client-side after the query

    // Query Vectorize (max topK is 50 when returnMetadata=true)
    const vectorResults = await env.VECTORIZE.query(queryEmbedding, {
      topK: Math.min(limit * 2, 50),
      filter,
      returnMetadata: true,
    })

    // Filter by tags and mimeType (Vectorize doesn't support array contains or prefix matching)
    let matchingIds = vectorResults.matches
      .filter((m: VectorizeMatch) => m.score >= minScore)
      .filter((m: VectorizeMatch) => {
        // Filter by mimeType prefix if specified
        if (mimeTypePrefix) {
          const mimeType = (m.metadata?.mimeType as string) || ""
          if (!mimeType.startsWith(mimeTypePrefix)) return false
        }
        // Filter by tags
        if (!tagIds || tagIds.length === 0) return true
        const assetTagIdsStr = (m.metadata?.tagIds as string) || "[]"
        const assetTagIds = JSON.parse(assetTagIdsStr) as string[]
        return tagIds.some((tid: string) => assetTagIds.includes(tid))
      })
      .slice(0, limit)
      .map((m: VectorizeMatch) => ({ id: m.id, score: m.score as number }))

    if (matchingIds.length === 0) {
      return []
    }

    // Fetch full asset data from D1
    const assetIds = matchingIds.map((m) => m.id)
    const scoreMap = new Map(matchingIds.map((m) => [m.id, m.score]))

    const assetList = await db
      .select()
      .from(assets)
      .where(and(inArray(assets.id, assetIds), eq(assets.organizationId, auth.organizationId)))

    // Sort by score and add URL
    const results: VectorSearchResult[] = assetList
      .map((asset) => ({
        asset: {
          ...asset,
          url: getCdnUrl(asset.r2Key, env.CDN_DOMAIN),
        },
        score: (scoreMap.get(asset.id) || 0) as number,
        matchType: "semantic" as const,
      }))
      .sort((a, b) => (b.score as number) - (a.score as number))

    return results
  })

// Hybrid search: combines vector similarity with keyword matching
export const hybridSearch = createServerFn({ method: "GET" })
  .inputValidator((d: VectorSearchInput & { keywordBoost?: number }) => d)
  .handler(async ({ data }) => {
    const auth = await getAuthContext()
    const {
      query,
      limit = 50,
      folderId,
      tagIds,
      mimeTypePrefix,
      minScore = 0.2,
      keywordBoost = 0.3,
    } = data
    const db = getDb(env.DB)

    if (!query.trim()) {
      return []
    }

    // Run vector search and keyword search in parallel
    const [vectorResultsRaw, keywordResults] = await Promise.all([
      // Vector search
      (async () => {
        const embedResult = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
          text: [query],
        }) as { data: number[][] }
        const queryEmbedding = embedResult.data[0]

        const filter: VectorizeVectorMetadataFilter = {
          organizationId: auth.organizationId,
        }
        if (folderId) filter.folderId = folderId
        // mimeTypePrefix filtering done client-side

        return env.VECTORIZE.query(queryEmbedding, {
          topK: Math.min(limit, 50), // max 50 when returnMetadata=true
          filter,
          returnMetadata: true,
        })
      })(),

      // Keyword search (existing D1 LIKE query)
      (async () => {
        const searchTerm = `%${query.trim()}%`
        const conditions = [
          eq(assets.organizationId, auth.organizationId),
          sql`(
            ${assets.filename} LIKE ${searchTerm}
            OR ${assets.altText} LIKE ${searchTerm}
            OR ${assets.description} LIKE ${searchTerm}
          )`,
        ]

        if (folderId) {
          conditions.push(eq(assets.folderId, folderId))
        }

        return db
          .select()
          .from(assets)
          .where(and(...conditions))
          .limit(limit)
      })(),
    ])

    // Build score map from vector results
    const scoreMap = new Map<string, { vectorScore: number; keywordMatch: boolean }>()

    for (const match of vectorResultsRaw.matches) {
      if ((match.score as number) >= minScore) {
        // mimeType prefix filtering
        if (mimeTypePrefix) {
          const mimeType = (match.metadata?.mimeType as string) || ""
          if (!mimeType.startsWith(mimeTypePrefix)) continue
        }
        // Tag filtering
        if (tagIds && tagIds.length > 0) {
          const assetTagIdsStr = (match.metadata?.tagIds as string) || "[]"
          const assetTagIds = JSON.parse(assetTagIdsStr) as string[]
          if (!tagIds.some((tid: string) => assetTagIds.includes(tid))) continue
        }
        scoreMap.set(match.id, { vectorScore: match.score as number, keywordMatch: false })
      }
    }

    // Add keyword matches
    for (const asset of keywordResults) {
      const existing = scoreMap.get(asset.id)
      if (existing) {
        existing.keywordMatch = true
      } else {
        scoreMap.set(asset.id, { vectorScore: 0, keywordMatch: true })
      }
    }

    // Calculate combined scores
    const scoredIds = Array.from(scoreMap.entries())
      .map(([id, { vectorScore, keywordMatch }]) => ({
        id,
        score: vectorScore + (keywordMatch ? keywordBoost : 0),
        matchType:
          vectorScore > 0 && keywordMatch
            ? ("both" as const)
            : keywordMatch
              ? ("keyword" as const)
              : ("semantic" as const),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    if (scoredIds.length === 0) {
      return []
    }

    // Fetch full asset data
    const assetList = await db
      .select()
      .from(assets)
      .where(
        and(
          inArray(
            assets.id,
            scoredIds.map((s) => s.id)
          ),
          eq(assets.organizationId, auth.organizationId)
        )
      )

    const assetMap = new Map(assetList.map((a) => [a.id, a]))

    const results: VectorSearchResult[] = scoredIds
      .map(({ id, score, matchType }) => {
        const asset = assetMap.get(id)
        if (!asset) return null
        return {
          asset: {
            ...asset,
            url: getCdnUrl(asset.r2Key, env.CDN_DOMAIN),
          },
          score,
          matchType,
        }
      })
      .filter((r): r is VectorSearchResult => r !== null)

    return results
  })
