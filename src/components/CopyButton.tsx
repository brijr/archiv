import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm"
}

export function CopyButton({
  value,
  label,
  className,
  variant = "outline",
  size = "default",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={handleCopy}
    >
      <HugeiconsIcon
        icon={copied ? CheckmarkCircle02Icon : Copy01Icon}
        className={cn("h-4 w-4", label && "mr-2")}
        strokeWidth={2}
      />
      {label && <span>{copied ? "Copied!" : label}</span>}
    </Button>
  )
}
