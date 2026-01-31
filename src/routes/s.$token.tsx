import { createFileRoute, Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Download04Icon,
  ArrowUpRight01Icon,
  Image01Icon,
  Video01Icon,
  FileIcon,
  Pdf01Icon,
  FolderOpenIcon,
} from "@hugeicons/core-free-icons"

import { getShareByToken, type ShareLinkWithAsset } from "@/lib/server/share"
import { isImage, isVideo } from "@/lib/r2"
import { formatBytes } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const Route = createFileRoute("/s/$token")({
  loader: async ({ params }) => {
    return getShareByToken({ data: { token: params.token } })
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Not Found - Archiv" }],
      }
    }

    const share = loaderData as ShareLinkWithAsset
    const asset = share.asset
    const folder = share.folder

    if (asset) {
      const isImg = asset.mimeType.startsWith("image/")
      const isVid = asset.mimeType.startsWith("video/")

      return {
        meta: [
          { title: `${asset.filename} - Shared via Archiv` },
          { name: "description", content: asset.description || `Shared from ${share.organization.name} via Archiv` },
          // OpenGraph
          { property: "og:title", content: asset.filename },
          { property: "og:description", content: asset.description || `Shared from ${share.organization.name}` },
          { property: "og:type", content: isImg ? "image" : "website" },
          { property: "og:site_name", content: "Archiv" },
          ...(isImg ? [
            { property: "og:image", content: asset.url },
            { property: "og:image:type", content: asset.mimeType },
            ...(asset.width ? [{ property: "og:image:width", content: String(asset.width) }] : []),
            ...(asset.height ? [{ property: "og:image:height", content: String(asset.height) }] : []),
          ] : []),
          // Twitter Card
          { name: "twitter:card", content: isImg ? "summary_large_image" : "summary" },
          { name: "twitter:title", content: asset.filename },
          { name: "twitter:description", content: asset.description || `Shared from ${share.organization.name}` },
          ...(isImg ? [{ name: "twitter:image", content: asset.url }] : []),
        ],
        links: [
          // oEmbed discovery for Notion and other apps
          {
            rel: "alternate",
            type: "application/json+oembed",
            href: `/api/v1/oembed?url=${encodeURIComponent(`/s/${share.token}`)}`,
          },
        ],
      }
    }

    if (folder) {
      const folderAssets = folder.assets || []
      const assetCount = folderAssets.length
      const firstImageAsset = folderAssets.find(a => a.mimeType.startsWith("image/"))
      const description = `${assetCount} asset${assetCount !== 1 ? "s" : ""} shared from ${share.organization.name}`

      return {
        meta: [
          { title: `${folder.name} - Shared Folder via Archiv` },
          { name: "description", content: description },
          { property: "og:title", content: folder.name },
          { property: "og:description", content: description },
          { property: "og:type", content: "website" },
          { property: "og:site_name", content: "Archiv" },
          ...(firstImageAsset ? [
            { property: "og:image", content: firstImageAsset.url },
            { property: "og:image:type", content: firstImageAsset.mimeType },
            ...(firstImageAsset.width ? [{ property: "og:image:width", content: String(firstImageAsset.width) }] : []),
            ...(firstImageAsset.height ? [{ property: "og:image:height", content: String(firstImageAsset.height) }] : []),
          ] : []),
          { name: "twitter:card", content: firstImageAsset ? "summary_large_image" : "summary" },
          { name: "twitter:title", content: folder.name },
          { name: "twitter:description", content: description },
          ...(firstImageAsset ? [{ name: "twitter:image", content: firstImageAsset.url }] : []),
        ],
        links: [
          // oEmbed discovery for Notion and other apps
          {
            rel: "alternate",
            type: "application/json+oembed",
            href: `/api/v1/oembed?url=${encodeURIComponent(`/s/${share.token}`)}`,
          },
        ],
      }
    }

    return {
      meta: [{ title: "Shared Content - Archiv" }],
    }
  },
  component: SharePage,
  errorComponent: ShareError,
})

function ShareError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <HugeiconsIcon icon={FileIcon} className="h-8 w-8 text-destructive" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Link Not Available</h1>
          <p className="text-muted-foreground mb-6">
            {error.message === "Share link not found"
              ? "This share link doesn't exist or has been deleted."
              : error.message === "Share link has expired"
              ? "This share link has expired."
              : error.message === "Share link view limit reached"
              ? "This share link has reached its view limit."
              : "Unable to load this shared content."}
          </p>
          <Button asChild variant="outline">
            <a href="https://archiv.xyz">Learn about Archiv</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function getFileIcon(mimeType: string) {
  if (isImage(mimeType)) return Image01Icon
  if (isVideo(mimeType)) return Video01Icon
  if (mimeType === "application/pdf") return Pdf01Icon
  return FileIcon
}

function SharePage() {
  const share = Route.useLoaderData() as ShareLinkWithAsset
  const asset = share.asset
  const folder = share.folder

  if (asset) {
    const showImagePreview = isImage(asset.mimeType)
    const showVideoPreview = isVideo(asset.mimeType)
    const FileIconComponent = getFileIcon(asset.mimeType)

    return (
      <div className="min-h-screen bg-muted/30 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">A</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Shared by {share.organization.name}
              </span>
            </div>
          </div>

          {/* Main Content */}
          <Card className="overflow-hidden">
            {/* Preview */}
            <div className="bg-muted aspect-video flex items-center justify-center">
              {showImagePreview ? (
                <img
                  src={asset.url}
                  alt={asset.altText || asset.filename}
                  className="max-h-full max-w-full object-contain"
                />
              ) : showVideoPreview ? (
                <video
                  src={asset.url}
                  controls
                  className="max-h-full max-w-full"
                  poster=""
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <HugeiconsIcon
                    icon={FileIconComponent}
                    className="h-20 w-20 text-muted-foreground"
                    strokeWidth={1}
                  />
                  <span className="text-muted-foreground">{asset.mimeType}</span>
                </div>
              )}
            </div>

            {/* Info & Actions */}
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-semibold truncate">{asset.filename}</h1>
                  {asset.description && (
                    <p className="text-muted-foreground mt-1">{asset.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span>{formatBytes(asset.size)}</span>
                    {asset.width && asset.height && (
                      <span>{asset.width} x {asset.height}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild>
                    <a href={asset.url} target="_blank" rel="noopener noreferrer">
                      <HugeiconsIcon icon={ArrowUpRight01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
                      Open
                    </a>
                  </Button>
                  {share.allowDownload && (
                    <Button asChild>
                      <a href={asset.url} download={asset.filename}>
                        <HugeiconsIcon icon={Download04Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <a href="https://archiv.xyz" className="hover:underline" target="_blank" rel="noopener noreferrer">
              Powered by Archiv
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (folder) {
    const folderAssets = folder.assets || []

    return (
      <div className="min-h-screen bg-muted/30 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">A</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Shared by {share.organization.name}
              </span>
            </div>
          </div>

          {/* Folder Header */}
          <Card className="mb-6">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-muted p-3">
                <HugeiconsIcon icon={FolderOpenIcon} className="h-6 w-6 text-muted-foreground" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{folder.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {folderAssets.length} asset{folderAssets.length !== 1 ? "s" : ""}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Assets Grid */}
          {folderAssets.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {folderAssets.map((folderAsset) => {
                const showImage = isImage(folderAsset.mimeType)
                const showVideo = isVideo(folderAsset.mimeType)
                const FileIcon = getFileIcon(folderAsset.mimeType)

                return (
                  <Card key={folderAsset.id} className="overflow-hidden group">
                    {/* Thumbnail */}
                    <div className="aspect-square bg-muted flex items-center justify-center relative">
                      {showImage ? (
                        <img
                          src={folderAsset.url}
                          alt={folderAsset.altText || folderAsset.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : showVideo ? (
                        <video
                          src={folderAsset.url}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <HugeiconsIcon
                          icon={FileIcon}
                          className="h-12 w-12 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                      )}
                      {/* Hover overlay with actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary" asChild>
                          <a href={folderAsset.url} target="_blank" rel="noopener noreferrer">
                            <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-4 w-4" strokeWidth={2} />
                          </a>
                        </Button>
                        {share.allowDownload && (
                          <Button size="sm" variant="secondary" asChild>
                            <a href={folderAsset.url} download={folderAsset.filename}>
                              <HugeiconsIcon icon={Download04Icon} className="h-4 w-4" strokeWidth={2} />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Info */}
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate" title={folderAsset.filename}>
                        {folderAsset.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(folderAsset.size)}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <HugeiconsIcon icon={FolderOpenIcon} className="h-8 w-8 text-muted-foreground" strokeWidth={2} />
                </div>
                <p className="text-muted-foreground">This folder is empty.</p>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <a href="https://archiv.xyz" className="hover:underline" target="_blank" rel="noopener noreferrer">
              Powered by Archiv
            </a>
          </div>
        </div>
      </div>
    )
  }

  return null
}
