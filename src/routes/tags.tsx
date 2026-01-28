import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tag01Icon, Add01Icon, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { getTags, createTag, updateTag, deleteTag } from "@/lib/server/tags"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { TagBadge } from "@/components/TagBadge"
import type { Tag } from "@/lib/types"

export const Route = createFileRoute("/tags")({
  component: TagsPage,
  loader: async () => {
    return getTags()
  },
})

const TAG_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#6b7280", // gray
]

function TagsPage() {
  const initialTags = Route.useLoaderData()
  const [tags, setTags] = useState(initialTags)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "", color: "#6b7280" })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const refreshTags = async () => {
    const newTags = await getTags()
    setTags(newTags)
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a tag name")
      return
    }

    setIsSubmitting(true)
    try {
      await createTag({ data: { name: formData.name.trim(), color: formData.color } })
      toast.success("Tag created")
      setFormData({ name: "", color: "#6b7280" })
      setIsCreating(false)
      refreshTags()
    } catch (error) {
      toast.error("Failed to create tag")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingTag || !formData.name.trim()) {
      toast.error("Please enter a tag name")
      return
    }

    setIsSubmitting(true)
    try {
      await updateTag({ data: { id: editingTag.id, name: formData.name.trim(), color: formData.color } })
      toast.success("Tag updated")
      setEditingTag(null)
      refreshTags()
    } catch (error) {
      toast.error("Failed to update tag")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTagId) return

    setIsSubmitting(true)
    try {
      await deleteTag({ data: { id: deleteTagId } })
      toast.success("Tag deleted")
      setDeleteTagId(null)
      refreshTags()
    } catch (error) {
      toast.error("Failed to delete tag")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = (tag: Tag) => {
    setFormData({ name: tag.name, color: tag.color || "#6b7280" })
    setEditingTag(tag)
  }

  const openCreate = () => {
    setFormData({ name: "", color: "#6b7280" })
    setIsCreating(true)
  }

  const hasTags = tags.length > 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
          <p className="text-muted-foreground mt-1">
            Manage tags for organizing your assets
          </p>
        </div>
        <Button onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
          Create Tag
        </Button>
      </div>

      {hasTags ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag: Tag & { assetCount: number }) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <TagBadge tag={tag} />
                  </TableCell>
                  <TableCell>{tag.assetCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(tag)}
                      >
                        <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" strokeWidth={2} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTagId(tag.id)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" strokeWidth={2} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <HugeiconsIcon icon={Tag01Icon} className="h-8 w-8 text-muted-foreground" strokeWidth={2} />
            </div>
            <CardTitle className="mb-2">No tags yet</CardTitle>
            <CardDescription className="text-center mb-4 max-w-sm">
              Create tags to organize and categorize your assets.
            </CardDescription>
            <Button onClick={openCreate}>
              <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
              Create Tag
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreating || editingTag !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false)
            setEditingTag(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Edit Tag" : "Create Tag"}</DialogTitle>
            <DialogDescription>
              {editingTag ? "Update the tag details." : "Create a new tag to organize your assets."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Tag name"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      formData.color === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Label>Preview</Label>
              <div className="mt-2">
                <TagBadge
                  tag={{ id: "preview", name: formData.name || "Tag Name", slug: "", color: formData.color, createdAt: null, updatedAt: null, organizationId: "default-org" }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false)
                setEditingTag(null)
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={editingTag ? handleUpdate : handleCreate}
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting ? "Saving..." : editingTag ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteTagId !== null} onOpenChange={(open) => !open && setDeleteTagId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tag? Assets with this tag will have the tag removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTagId(null)}
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
