import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Tag } from "@/lib/types"

interface TagBadgeProps {
  tag: Tag
  className?: string
  onClick?: () => void
  onRemove?: () => void
}

export function TagBadge({ tag, className, onClick, onRemove }: TagBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "cursor-default",
        onClick && "cursor-pointer hover:bg-secondary/80",
        className
      )}
      style={{
        backgroundColor: tag.color ? `${tag.color}20` : undefined,
        borderColor: tag.color || undefined,
        color: tag.color || undefined,
      }}
      onClick={onClick}
    >
      <span
        className="mr-1.5 h-2 w-2 rounded-full"
        style={{ backgroundColor: tag.color || "#6b7280" }}
      />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          className="ml-1 rounded-full hover:bg-black/10 p-0.5"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </Badge>
  )
}
