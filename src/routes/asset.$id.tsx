import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowUpRight01Icon,
  Delete02Icon,
  Download04Icon,
  FileIcon,
  Video01Icon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { getAsset, updateAsset, deleteAsset } from "@/lib/server/assets"
import { isImage, isVideo } from "@/lib/r2"
import { formatBytes, formatDate } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CopyButton } from "@/components/CopyButton"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/asset/$id")({
  component: AssetDetailPage,
  loader: async ({ params }) => {
    return getAsset({ data: { id: params.id } })
  },
  pendingComponent: AssetDetailSkeleton,
  errorComponent: AssetDetailError,
})

function AssetDetailSkeleton() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="aspect-square rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  )
}

function AssetDetailError({ error }: { error: Error }) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-2xl font-bold mb-2">Asset Not Found</h2>
        <p className="text-muted-foreground mb-4">{error.message}</p>
        <Button asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

function AssetDetailPage() {
  const asset = Route.useLoaderData()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    altText: asset.altText || "",
    description: asset.description || "",
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateAsset({
        data: {
          id: asset.id,
          altText: formData.altText || undefined,
          description: formData.description || undefined,
        },
      })
      toast.success("Asset updated")
    } catch (error) {
      toast.error("Failed to update asset")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteAsset({ data: { id: asset.id } })
      toast.success("Asset deleted")
      navigate({ to: "/" })
    } catch (error) {
      toast.error("Failed to delete asset")
      setIsDeleting(false)
    }
  }

  const showImagePreview = isImage(asset.mimeType)
  const showVideoPreview = isVideo(asset.mimeType)

  function getFileIcon(mimeType: string) {
    if (isVideo(mimeType)) return Video01Icon
    if (mimeType === "application/pdf") return Pdf01Icon
    return FileIcon
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" strokeWidth={2} />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold truncate max-w-md">{asset.filename}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href={asset.url} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
              Open Original
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={asset.url} download={asset.filename}>
              <HugeiconsIcon icon={Download04Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
              Download
            </a>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preview */}
        <Card>
          <CardContent className="p-0">
            <div className="aspect-square bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
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
                />
              ) : (
                <HugeiconsIcon
                  icon={getFileIcon(asset.mimeType)}
                  className="h-24 w-24 text-muted-foreground"
                  strokeWidth={1}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="space-y-6">
          {/* CDN URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">CDN URL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={asset.url}
                  readOnly
                  className="font-mono text-sm"
                />
                <CopyButton value={asset.url} label="Copy" />
              </div>
            </CardContent>
          </Card>

          {/* Metadata Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="altText">Alt Text</Label>
                <Input
                  id="altText"
                  value={formData.altText}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, altText: e.target.value }))
                  }
                  placeholder="Describe this image for accessibility"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Add notes or description"
                  rows={3}
                />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* File Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">File Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Filename</dt>
                  <dd className="font-medium">{asset.filename}</dd>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{asset.mimeType}</dd>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="font-medium">{formatBytes(asset.size)}</dd>
                </div>
                {asset.width && asset.height && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Dimensions</dt>
                      <dd className="font-medium">
                        {asset.width} x {asset.height}
                      </dd>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Uploaded</dt>
                  <dd className="font-medium">
                    {asset.createdAt ? formatDate(asset.createdAt) : "Unknown"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{asset.filename}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
