import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { UploadDropzone } from "@/components/UploadDropzone"

export const Route = createFileRoute("/upload")({
  component: UploadPage,
})

function UploadPage() {
  const navigate = useNavigate()

  const handleUploadComplete = (assets: any[]) => {
    if (assets.length === 1) {
      // Navigate to the single asset
      navigate({ to: "/asset/$id", params: { id: assets[0].id } })
    } else {
      // Navigate to dashboard to see all assets
      toast.success(`Successfully uploaded ${assets.length} files`)
      navigate({ to: "/" })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Upload Assets</h1>
        <p className="text-muted-foreground mt-1">
          Upload images, videos, and documents to your library
        </p>
      </div>

      <div className="max-w-2xl">
        <UploadDropzone onUploadComplete={handleUploadComplete} />
      </div>
    </div>
  )
}
