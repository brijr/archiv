import { createServerFn } from "@tanstack/react-start"
import { sql, desc, and, eq } from "drizzle-orm"
import { env } from "cloudflare:workers"

import { getDb } from "@/lib/db"
import { assets } from "@/db/schema"
import { getCdnUrl } from "@/lib/r2"
import { getAuthContext } from "./auth-helpers"

// Search assets by filename, alt text, and description
export const searchAssets = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    const auth = getAuthContext()
    const { query, limit = 50 } = data
    const db = getDb(env.DB)

    if (!query.trim()) {
      return []
    }

    const searchTerm = `%${query.trim()}%`

    const results = await db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.organizationId, auth.organizationId),
          sql`(
            ${assets.filename} LIKE ${searchTerm}
            OR ${assets.altText} LIKE ${searchTerm}
            OR ${assets.description} LIKE ${searchTerm}
          )`
        )
      )
      .orderBy(desc(assets.createdAt))
      .limit(limit)

    return results.map((asset) => ({
      ...asset,
      url: getCdnUrl(asset.r2Key, env.CDN_DOMAIN),
    }))
  })
