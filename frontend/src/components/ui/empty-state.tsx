import * as React from "react"
import { cn } from "@/lib/utils"

// Empty state terpusat — ikon + judul + pesan + aksi opsional.
// Menggantikan pola EmptyHint yang berulang, dan memenuhi UX guideline
// "empty-states" (pesan membantu + aksi, bukan layar kosong).
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  /** compact = varian kecil di dalam kartu/list. */
  compact?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border text-center text-muted-foreground",
        compact ? "gap-1.5 p-6" : "gap-2 p-10",
        className
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "opacity-40",
            compact ? "h-7 w-7" : "h-10 w-10"
          )}
        />
      )}
      {title && (
        <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
      )}
      {description && (
        <p className={cn("text-pretty", compact ? "text-xs" : "text-sm")}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
