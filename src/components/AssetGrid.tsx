import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon } from "@hugeicons/core-free-icons"

import { AssetCard } from "@/components/AssetCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { Asset, PaginatedResponse } from "@/lib/types"

interface AssetGridProps {
  assets: PaginatedResponse<Asset & { url: string }> | null
  isLoading?: boolean
  selectedIds?: Set<string>
  onSelect?: (id: string, selected: boolean) => void
  selectionMode?: boolean
  onLoadMore?: () => void
}

export function AssetGrid({
  assets,
  isLoading = false,
  selectedIds = new Set(),
  onSelect,
  selectionMode = false,
  onLoadMore,
}: AssetGridProps) {
  // Loading state
  if (isLoading && !assets) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card overflow-hidden">
            <Skeleton className="aspect-square" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (!assets || assets.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <HugeiconsIcon
            icon={Image01Icon}
            className="h-8 w-8 text-muted-foreground"
            strokeWidth={2}
          />
        </div>
        <h3 className="text-lg font-medium mb-1">No assets found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Upload some assets to get started, or try adjusting your filters.
        </p>
      </div>
    )
  }

  const { data, pagination } = assets
  const hasMore = pagination.page < pagination.totalPages

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {data.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            selected={selectedIds.has(asset.id)}
            onSelect={onSelect}
            selectionMode={selectionMode}
          />
        ))}
      </div>

      {/* Pagination */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="text-center text-sm text-muted-foreground">
        Showing {data.length} of {pagination.total} assets
      </div>
    </div>
  )
}
