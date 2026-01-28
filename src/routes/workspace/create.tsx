import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { organization } from "@/lib/auth-client"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/workspace/create")({
  component: CreateWorkspacePage,
})

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function CreateWorkspacePage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [manualSlug, setManualSlug] = useState(false)

  const handleNameChange = (value: string) => {
    setName(value)
    if (!manualSlug) {
      setSlug(slugify(value))
    }
  }

  const handleSlugChange = (value: string) => {
    setSlug(slugify(value))
    setManualSlug(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Workspace name is required")
      return
    }

    if (!slug.trim()) {
      toast.error("Workspace URL slug is required")
      return
    }

    setIsLoading(true)

    try {
      const result = await organization.create({
        name: name.trim(),
        slug: slug.trim(),
      })

      if (result.error) {
        toast.error(result.error.message || "Failed to create workspace")
        setIsLoading(false)
        return
      }

      // Set as active organization
      if (result.data?.id) {
        await organization.setActive({
          organizationId: result.data.id,
        })
      }

      toast.success("Workspace created successfully")
      navigate({ to: "/" })
    } catch (error) {
      toast.error("Something went wrong")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create a workspace</CardTitle>
          <CardDescription>
            Workspaces help you organize your assets and collaborate with your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input
                id="name"
                type="text"
                placeholder="My Company"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">archiv.xyz/</span>
                <Input
                  id="slug"
                  type="text"
                  placeholder="my-company"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will be used in your workspace URL
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating workspace..." : "Create workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
