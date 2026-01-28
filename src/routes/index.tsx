import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload04Icon, Image01Icon, FolderOpenIcon, Tag01Icon } from "@hugeicons/core-free-icons"

import { getAssets, getDashboardStats } from "@/lib/server/assets"
import { formatBytes } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AssetGrid } from "@/components/AssetGrid"
import type { Asset, PaginatedResponse } from "@/lib/types"

export const Route = createFileRoute("/")({
  component: Dashboard,
  loader: async () => {
    const [assets, stats] = await Promise.all([
      getAssets({ data: { page: 1, limit: 50 } }),
      getDashboardStats(),
    ])
    return { assets, stats }
  },
})

function Dashboard() {
  const { assets: initialAssets, stats } = Route.useLoaderData()
  const [assets, setAssets] = useState<PaginatedResponse<Asset & { url: string }>>(initialAssets)
  const [isLoading, setIsLoading] = useState(false)

  const loadMore = async () => {
    if (isLoading || assets.pagination.page >= assets.pagination.totalPages) return

    setIsLoading(true)
    try {
      const nextPage = await getAssets({ data: { page: assets.pagination.page + 1, limit: 50 } })
      setAssets((prev) => ({
        data: [...prev.data, ...nextPage.data],
        pagination: nextPage.pagination,
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const hasAssets = assets.data.length > 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your digital assets
          </p>
        </div>
        <Button asChild>
          <Link to="/upload">
            <HugeiconsIcon icon={Upload04Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
            Upload
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <HugeiconsIcon icon={Image01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssets}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalAssets === 0 ? "No assets uploaded yet" : "assets in library"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Folders</CardTitle>
            <HugeiconsIcon icon={FolderOpenIcon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFolders}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalFolders === 0 ? "No folders created" : "folders for organization"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <HugeiconsIcon icon={Tag01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTags}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTags === 0 ? "No tags defined" : "tags for categorization"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HugeiconsIcon icon={Image01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.storageUsed)}</div>
            <p className="text-xs text-muted-foreground">R2 bucket storage</p>
          </CardContent>
        </Card>
      </div>

      {/* Assets */}
      {hasAssets ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Assets</h2>
          </div>
          <AssetGrid
            assets={assets}
            isLoading={isLoading}
            onLoadMore={loadMore}
          />
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <HugeiconsIcon icon={Image01Icon} className="h-8 w-8 text-muted-foreground" strokeWidth={2} />
            </div>
            <CardTitle className="mb-2">No assets yet</CardTitle>
            <CardDescription className="text-center mb-4 max-w-sm">
              Get started by uploading your first asset. You can upload images, videos, PDFs, and more.
            </CardDescription>
            <Button asChild>
              <Link to="/upload">
                <HugeiconsIcon icon={Upload04Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
                Upload Assets
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
