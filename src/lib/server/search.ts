import { createServerFn } from "@tanstack/react-start"
import { sql, desc } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { assets } from "@/db/schema"
import { getCdnUrl } from "@/lib/r2"
import type { Asset } from "@/lib/types"

// Search assets by filename, alt text, and description
export const searchAssets = createServerFn({ method: "GET" })
  .validator((data: { query: string; limit?: number }) => data)
  .handler(async ({ data, context }) => {
    const { query, limit = 50 } = data
    const env = context.cloudflare.env
    const db = getDb(env.DB)

    if (!query.trim()) {
      return []
    }

    const searchTerm = `%${query.trim()}%`

    const results = await db
      .select()
      .from(assets)
      .where(
        sql`(
          ${assets.filename} LIKE ${searchTerm}
          OR ${assets.altText} LIKE ${searchTerm}
          OR ${assets.description} LIKE ${searchTerm}
        )`
      )
      .orderBy(desc(assets.createdAt))
      .limit(limit)

    return results.map((asset) => ({
      ...asset,
      url: getCdnUrl(asset.r2Key, env.CDN_DOMAIN),
    }))
  })
