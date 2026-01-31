import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { getCdnUrl } from "@/lib/r2"
import { shareLinks, assets, organizations } from "@/db/schema"

interface OEmbedResponse {
  version: string
  type: "photo" | "video" | "link" | "rich"
  title: string
  provider_name: string
  provider_url: string
  author_name?: string
  width?: number
  height?: number
  url?: string // For photo type
  html?: string // For video/rich type
  thumbnail_url?: string
  thumbnail_width?: number
  thumbnail_height?: number
}

export async function handleOEmbed(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get("url")
  const format = url.searchParams.get("format") || "json"
  const maxWidth = parseInt(url.searchParams.get("maxwidth") || "800", 10)
  const maxHeight = parseInt(url.searchParams.get("maxheight") || "600", 10)

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Extract token from URL - supports both /s/{token} and full URLs
  const tokenMatch = targetUrl.match(/\/s\/([a-zA-Z0-9_-]+)/)
  if (!tokenMatch) {
    return new Response(JSON.stringify({ error: "Invalid URL format. Expected /s/{token}" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const token = tokenMatch[1]
  const db = getDb(env.DB)

  // Find share link
  const shareLink = await db.query.shareLinks.findFirst({
    where: eq(shareLinks.token, token),
  })

  if (!shareLink) {
    return new Response(JSON.stringify({ error: "Share link not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Check expiration
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    return new Response(JSON.stringify({ error: "Share link has expired" }), {
      status: 410,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Get asset data
  if (!shareLink.assetId) {
    return new Response(JSON.stringify({ error: "Folder oEmbed not supported" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, shareLink.assetId),
  })

  if (!asset) {
    return new Response(JSON.stringify({ error: "Asset not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Get organization
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, shareLink.organizationId),
  })

  const assetUrl = getCdnUrl(asset.r2Key, env.CDN_DOMAIN)
  const isImage = asset.mimeType.startsWith("image/")
  const isVideo = asset.mimeType.startsWith("video/")
  const baseUrl = env.BETTER_AUTH_URL || "https://archiv.xyz"

  // Calculate dimensions respecting max constraints
  let width = asset.width || 800
  let height = asset.height || 600

  if (width > maxWidth) {
    const ratio = maxWidth / width
    width = maxWidth
    height = Math.round(height * ratio)
  }

  if (height > maxHeight) {
    const ratio = maxHeight / height
    height = maxHeight
    width = Math.round(width * ratio)
  }

  let response: OEmbedResponse

  if (isImage) {
    response = {
      version: "1.0",
      type: "photo",
      title: asset.filename,
      provider_name: "Archiv",
      provider_url: baseUrl,
      author_name: org?.name,
      url: assetUrl,
      width,
      height,
    }
  } else if (isVideo) {
    response = {
      version: "1.0",
      type: "video",
      title: asset.filename,
      provider_name: "Archiv",
      provider_url: baseUrl,
      author_name: org?.name,
      html: `<iframe src="${baseUrl}/embed/${token}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`,
      width,
      height,
      thumbnail_url: assetUrl,
    }
  } else {
    response = {
      version: "1.0",
      type: "link",
      title: asset.filename,
      provider_name: "Archiv",
      provider_url: baseUrl,
      author_name: org?.name,
    }
  }

  // Handle XML format if requested
  if (format === "xml") {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<oembed>
  <version>${response.version}</version>
  <type>${response.type}</type>
  <title>${escapeXml(response.title)}</title>
  <provider_name>${escapeXml(response.provider_name)}</provider_name>
  <provider_url>${escapeXml(response.provider_url)}</provider_url>
  ${response.author_name ? `<author_name>${escapeXml(response.author_name)}</author_name>` : ""}
  ${response.url ? `<url>${escapeXml(response.url)}</url>` : ""}
  ${response.html ? `<html>${escapeXml(response.html)}</html>` : ""}
  ${response.width ? `<width>${response.width}</width>` : ""}
  ${response.height ? `<height>${response.height}</height>` : ""}
  ${response.thumbnail_url ? `<thumbnail_url>${escapeXml(response.thumbnail_url)}</thumbnail_url>` : ""}
</oembed>`

    return new Response(xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    })
  }

  return new Response(JSON.stringify(response), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
