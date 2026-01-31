import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, FolderOpenIcon, Edit02Icon, Delete02Icon, Share01Icon, Link01Icon, Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { getFolder, updateFolder, deleteFolder } from "@/lib/server/folders"
import { moveAssets } from "@/lib/server/assets"
import { createShareLink } from "@/lib/server/share"
import { cn } from "@/lib/utils"

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
import { Switch } from "@/components/ui/switch"
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
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [newName, setNewName] = useState(folder.name)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Share dialog state
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareExpiresDays, setShareExpiresDays] = useState<number | null>(null)
  const [shareAllowDownload, setShareAllowDownload] = useState(true)
  const [copied, setCopied] = useState(false)

  // Drop target state
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-archiv-asset")) {
      e.preventDefault()
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only trigger if leaving the container, not entering children
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const data = e.dataTransfer.getData("application/x-archiv-asset")
    if (data) {
      try {
        const asset = JSON.parse(data)
        await moveAssets({ data: { ids: [asset.id], folderId: folder.id } })
        toast.success(`Moved "${asset.filename}" to ${folder.name}`)
        // Reload the page to show the new asset
        window.location.reload()
      } catch {
        toast.error("Failed to move asset")
      }
    }
  }

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

  const handleCreateShare = async () => {
    setShareLoading(true)
    try {
      const result = await createShareLink({
        data: {
          folderId: folder.id,
          expiresInDays: shareExpiresDays,
          allowDownload: shareAllowDownload,
        },
      })
      setShareUrl(result.shareUrl)
      toast.success("Share link created")
    } catch (error) {
      toast.error("Failed to create share link")
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
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
    <div
      className={cn("p-6 min-h-full", isDragOver && "ring-2 ring-primary ring-inset bg-primary/5")}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
          <Button variant="outline" onClick={() => { setShareUrl(null); setShowShareDialog(true) }}>
            <HugeiconsIcon icon={Share01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
            Share
          </Button>
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

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Folder</DialogTitle>
            <DialogDescription>
              Create a public link to share this folder with anyone.
            </DialogDescription>
          </DialogHeader>
          {shareUrl ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="flex-1" />
                <Button size="icon" variant="outline" onClick={handleCopyShareUrl}>
                  <HugeiconsIcon icon={copied ? Tick01Icon : Copy01Icon} className="h-4 w-4" strokeWidth={2} />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Anyone with this link can view the {folder.assets.length} asset{folder.assets.length !== 1 ? "s" : ""} in this folder.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="expires">Link Expiration</Label>
                <select
                  id="expires"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={shareExpiresDays ?? "never"}
                  onChange={(e) =>
                    setShareExpiresDays(e.target.value === "never" ? null : Number(e.target.value))
                  }
                >
                  <option value="never">Never expires</option>
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-download">Allow downloads</Label>
                <Switch
                  id="allow-download"
                  checked={shareAllowDownload}
                  onCheckedChange={setShareAllowDownload}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {shareUrl ? (
              <Button onClick={() => setShowShareDialog(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowShareDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateShare} disabled={shareLoading}>
                  <HugeiconsIcon icon={Link01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
                  {shareLoading ? "Creating..." : "Create Link"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
