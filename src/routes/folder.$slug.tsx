import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, FolderOpenIcon, Edit02Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { getFolder, updateFolder, deleteFolder } from "@/lib/server/folders"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AssetGrid } from "@/components/AssetGrid"
import { Skeleton } from "@/components/ui/skeleton"
import type { Asset, PaginatedResponse } from "@/lib/types"

export const Route = createFileRoute("/folder/$slug")({
  component: FolderPage,
  loader: async ({ params }) => {
    return getFolder({ data: { slug: params.slug } })
  },
  pendingComponent: FolderSkeleton,
  errorComponent: FolderError,
})

function FolderSkeleton() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-64" />
      </div>
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
    </div>
  )
}

function FolderError({ error }: { error: Error }) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-2xl font-bold mb-2">Folder Not Found</h2>
        <p className="text-muted-foreground mb-4">{error.message}</p>
        <Button asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

function FolderPage() {
  const folder = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newName, setNewName] = useState(folder.name)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error("Please enter a folder name")
      return
    }

    setIsSubmitting(true)
    try {
      const updated = await updateFolder({ data: { id: folder.id, name: newName.trim() } })
      toast.success("Folder renamed")
      setShowRenameDialog(false)
      // Navigate to new slug
      navigate({ to: "/folder/$slug", params: { slug: updated.slug } })
    } catch (error) {
      toast.error("Failed to rename folder")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    try {
      await deleteFolder({ data: { id: folder.id } })
      toast.success("Folder deleted")
      navigate({ to: "/" })
    } catch (error) {
      toast.error("Failed to delete folder")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Convert folder assets to PaginatedResponse format for AssetGrid
  const assetsResponse: PaginatedResponse<Asset & { url: string }> = {
    data: folder.assets,
    pagination: {
      page: 1,
      limit: folder.assets.length,
      total: folder.assets.length,
      totalPages: 1,
    },
  }

  const hasAssets = folder.assets.length > 0
  const hasSubfolders = folder.subfolders.length > 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={folder.parent ? "/folder/$slug" : "/"} params={folder.parent ? { slug: folder.parent.slug } : undefined}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" strokeWidth={2} />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={FolderOpenIcon} className="h-6 w-6 text-muted-foreground" strokeWidth={2} />
            <h1 className="text-2xl font-bold">{folder.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowRenameDialog(true)}>
            <HugeiconsIcon icon={Edit02Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
            Rename
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <HugeiconsIcon icon={Delete02Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
            Delete
          </Button>
        </div>
      </div>

      {/* Breadcrumbs */}
      {folder.parent && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">
            All Assets
          </Link>
          <span>/</span>
          <Link to="/folder/$slug" params={{ slug: folder.parent.slug }} className="hover:underline">
            {folder.parent.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">{folder.name}</span>
        </div>
      )}

      {/* Subfolders */}
      {hasSubfolders && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Subfolders</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {folder.subfolders.map((subfolder) => (
              <Link
                key={subfolder.id}
                to="/folder/$slug"
                params={{ slug: subfolder.slug }}
                className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <HugeiconsIcon icon={FolderOpenIcon} className="h-10 w-10 text-muted-foreground mb-2" strokeWidth={1.5} />
                <span className="text-sm font-medium text-center truncate w-full">
                  {subfolder.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Assets */}
      {hasAssets ? (
        <>
          <h2 className="text-lg font-semibold mb-4">Assets ({folder.assets.length})</h2>
          <AssetGrid assets={assetsResponse} />
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <HugeiconsIcon icon={FolderOpenIcon} className="h-8 w-8 text-muted-foreground" strokeWidth={2} />
            </div>
            <CardTitle className="mb-2">No assets in this folder</CardTitle>
            <CardDescription className="text-center mb-4 max-w-sm">
              Move assets to this folder from the asset detail page, or upload new assets directly.
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Folder Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isSubmitting || !newName.trim()}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{folder.name}"? Assets in this folder will be moved to "Unfiled".
              {hasSubfolders && " Subfolders will also be deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
