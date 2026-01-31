import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { FileIcon, Video01Icon, Pdf01Icon, Image01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/utils"
import { isImage, isVideo } from "@/lib/r2"
import { Checkbox } from "@/components/ui/checkbox"
import { CopyButton } from "@/components/CopyButton"
import type { Asset } from "@/lib/types"

interface AssetCardProps {
  asset: Asset & { url: string }
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  selectionMode?: boolean
}

function getFileIcon(mimeType: string) {
  if (isImage(mimeType)) return Image01Icon
  if (isVideo(mimeType)) return Video01Icon
  if (mimeType === "application/pdf") return Pdf01Icon
  return FileIcon
}

export function AssetCard({
  asset,
  selected = false,
  onSelect,
  selectionMode = false,
}: AssetCardProps) {
  const showThumbnail = isImage(asset.mimeType)
  const FileIconComponent = getFileIcon(asset.mimeType)

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card overflow-hidden transition-all hover:shadow-md",
        selected && "ring-2 ring-primary"
      )}
    >
      {/* Checkbox for selection */}
      {(selectionMode || selected) && (
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect?.(asset.id, !!checked)}
            className="bg-background"
          />
        </div>
      )}

      {/* Copy URL button */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton value={asset.url} variant="secondary" size="icon-sm" />
      </div>

      {/* Thumbnail / Preview */}
      <Link
        to="/asset/$id"
        params={{ id: asset.id }}
        className="block aspect-square bg-muted"
        draggable="true"
        onDragStart={(e) => {
          // Set data for Figma and other apps that accept dropped URLs
          e.dataTransfer.setData("text/uri-list", asset.url)
          e.dataTransfer.setData("text/plain", asset.url)
          // Set data for internal folder moves
          e.dataTransfer.setData("application/x-archiv-asset", JSON.stringify({
            id: asset.id,
            filename: asset.filename,
          }))
          e.dataTransfer.effectAllowed = "copyMove"
        }}
      >
        {showThumbnail ? (
          <img
            src={asset.url}
            alt={asset.altText || asset.filename}
            className="h-full w-full object-cover"
            loading="lazy"
            draggable="false"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <HugeiconsIcon
              icon={FileIconComponent}
              className="h-12 w-12 text-muted-foreground"
              strokeWidth={1.5}
            />
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-3">
        <Link
          to="/asset/$id"
          params={{ id: asset.id }}
          className="block"
        >
          <p className="text-sm font-medium truncate hover:underline">
            {asset.filename}
          </p>
        </Link>
        <p className="text-xs text-muted-foreground mt-1">
          {formatBytes(asset.size)}
        </p>
      </div>
    </div>
  )
}
