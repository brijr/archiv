import { useState, useCallback, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload04Icon, Cancel01Icon, CheckmarkCircle02Icon, Loading03Icon, FileIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { uploadAsset } from "@/lib/server/assets"

interface UploadFile {
  id: string
  file: File
  status: "pending" | "uploading" | "success" | "error"
  progress: number
  error?: string
}

interface UploadDropzoneProps {
  folderId?: string
  onUploadComplete?: (assets: any[]) => void
  accept?: string
  maxSize?: number // in bytes
}

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
]

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export function UploadDropzone({
  folderId,
  onUploadComplete,
  accept = ACCEPTED_TYPES.join(","),
  maxSize = MAX_FILE_SIZE,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return `File type ${file.type || "unknown"} is not supported`
      }
      if (file.size > maxSize) {
        return `File size exceeds ${formatBytes(maxSize)}`
      }
      return null
    },
    [maxSize]
  )

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const filesToAdd: UploadFile[] = []

      Array.from(newFiles).forEach((file) => {
        const error = validateFile(file)
        filesToAdd.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          status: error ? "error" : "pending",
          progress: 0,
          error: error || undefined,
        })
      })

      setFiles((prev) => [...prev, ...filesToAdd])
    },
    [validateFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files)
      }
      // Reset input to allow selecting the same file again
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    },
    [addFiles]
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const uploadFiles = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === "pending")
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    const uploadedAssets: any[] = []

    for (const uploadFile of pendingFiles) {
      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "uploading" as const, progress: 10 } : f
        )
      )

      try {
        const formData = new FormData()
        formData.append("file", uploadFile.file)
        if (folderId) {
          formData.append("folderId", folderId)
        }

        // Simulate progress
        const progressInterval = setInterval(() => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id && f.progress < 90
                ? { ...f, progress: f.progress + 10 }
                : f
            )
          )
        }, 200)

        const result = await uploadAsset({ data: formData })

        clearInterval(progressInterval)

        // Update status to success
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "success" as const, progress: 100 } : f
          )
        )

        uploadedAssets.push(result)
        toast.success(`Uploaded ${uploadFile.file.name}`)
      } catch (error) {
        // Update status to error
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "error" as const, error: "Upload failed" }
              : f
          )
        )
        toast.error(`Failed to upload ${uploadFile.file.name}`)
      }
    }

    setIsUploading(false)

    if (uploadedAssets.length > 0 && onUploadComplete) {
      onUploadComplete(uploadedAssets)
    }
  }, [files, folderId, onUploadComplete])

  const pendingCount = files.filter((f) => f.status === "pending").length
  const hasFiles = files.length > 0

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          hasFiles && "py-8"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="rounded-full bg-muted p-4 mb-4">
          <HugeiconsIcon
            icon={Upload04Icon}
            className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground")}
            strokeWidth={2}
          />
        </div>

        <p className="text-lg font-medium mb-1">
          {isDragging ? "Drop files here" : "Drag and drop files here"}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          or click to select files
        </p>
        <p className="text-xs text-muted-foreground">
          Supports images, videos, and PDFs up to {formatBytes(maxSize)}
        </p>
      </div>

      {/* File List */}
      {hasFiles && (
        <div className="space-y-2">
          {files.map((uploadFile) => (
            <div
              key={uploadFile.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                {uploadFile.file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(uploadFile.file)}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <HugeiconsIcon icon={FileIcon} className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(uploadFile.file.size)}
                </p>
                {uploadFile.status === "uploading" && (
                  <Progress value={uploadFile.progress} className="h-1 mt-1" />
                )}
                {uploadFile.error && (
                  <p className="text-xs text-destructive mt-1">{uploadFile.error}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {uploadFile.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(uploadFile.id)
                    }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" strokeWidth={2} />
                  </Button>
                )}
                {uploadFile.status === "uploading" && (
                  <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={2} />
                )}
                {uploadFile.status === "success" && (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-5 w-5 text-green-500" strokeWidth={2} />
                )}
                {uploadFile.status === "error" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(uploadFile.id)
                    }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-destructive" strokeWidth={2} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {pendingCount > 0 && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setFiles([])}
            disabled={isUploading}
          >
            Clear All
          </Button>
          <Button onClick={uploadFiles} disabled={isUploading}>
            {isUploading ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" strokeWidth={2} />
                Uploading...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={Upload04Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
                Upload {pendingCount} {pendingCount === 1 ? "file" : "files"}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
