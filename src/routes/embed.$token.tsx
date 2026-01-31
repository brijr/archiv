import { createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon, FileIcon, Video01Icon, Pdf01Icon, Image01Icon } from "@hugeicons/core-free-icons"

import { getShareByToken, type ShareLinkWithAsset } from "@/lib/server/share"
import { isImage, isVideo } from "@/lib/r2"
import { formatBytes } from "@/lib/utils"

export const Route = createFileRoute("/embed/$token")({
  loader: async ({ params }) => {
    return getShareByToken({ data: { token: params.token } })
  },
  head: ({ loaderData }) => {
    const share = loaderData as ShareLinkWithAsset | undefined
    return {
      meta: [
        { title: share?.asset?.filename || "Archiv Embed" },
      ],
    }
  },
  component: EmbedPage,
  errorComponent: EmbedError,
})

function EmbedError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {error.message === "Share link not found"
            ? "This embed is no longer available."
            : error.message === "Share link has expired"
            ? "This embed has expired."
            : "Unable to load embed."}
        </p>
      </div>
    </div>
  )
}

function getFileIcon(mimeType: string) {
  if (isImage(mimeType)) return Image01Icon
  if (isVideo(mimeType)) return Video01Icon
  if (mimeType === "application/pdf") return Pdf01Icon
  return FileIcon
}

function EmbedPage() {
  const share = Route.useLoaderData() as ShareLinkWithAsset
  const asset = share.asset

  if (!asset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">Folder embeds are not yet supported.</p>
      </div>
    )
  }

  const showImagePreview = isImage(asset.mimeType)
  const showVideoPreview = isVideo(asset.mimeType)
  const FileIconComponent = getFileIcon(asset.mimeType)

  // Full-bleed image/video for visual content
  if (showImagePreview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <img
          src={asset.url}
          alt={asset.altText || asset.filename}
          className="max-h-screen max-w-full object-contain"
        />
      </div>
    )
  }

  if (showVideoPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <video
          src={asset.url}
          controls
          autoPlay
          muted
          className="max-h-screen max-w-full"
        />
      </div>
    )
  }

  // File preview card for non-visual content
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="bg-background rounded-lg border p-6 max-w-sm w-full text-center">
        <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-4">
          <HugeiconsIcon
            icon={FileIconComponent}
            className="h-8 w-8 text-muted-foreground"
            strokeWidth={1.5}
          />
        </div>
        <h3 className="font-medium truncate mb-1">{asset.filename}</h3>
        <p className="text-sm text-muted-foreground mb-4">{formatBytes(asset.size)}</p>
        {share.allowDownload && (
          <a
            href={asset.url}
            download={asset.filename}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <HugeiconsIcon icon={Download04Icon} className="h-4 w-4" strokeWidth={2} />
            Download
          </a>
        )}
      </div>
    </div>
  )
}
