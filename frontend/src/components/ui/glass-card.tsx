import * as React from "react"
import { cn } from "@/lib/utils"

// Panel glass terpusat dengan header (judul + ikon + aksi) opsional.
// Menstandarkan pola ".glass rounded-xl p-5" + judul yang berulang di banyak
// halaman (dashboard, laporan, dll) supaya spacing & tipografi seragam.
interface GlassCardProps extends Omit<React.ComponentProps<"section">, "title"> {
  title?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  description?: React.ReactNode
  action?: React.ReactNode
  /** Padding lebih rapat untuk kartu kecil. */
  compact?: boolean
}

export function GlassCard({
  title,
  icon: Icon,
  description,
  action,
  compact,
  className,
  children,
  ...props
}: GlassCardProps) {
  const hasHeader = title || action || description
  return (
    <section
      className={cn("glass rounded-xl", compact ? "p-4" : "p-5 sm:p-6", className)}
      {...props}
    >
      {hasHeader && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                {Icon && <Icon className="h-5 w-5 shrink-0 text-primary" />}
                <span className="truncate">{title}</span>
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground text-pretty">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
