import * as React from "react"
import { cn } from "@/lib/utils"

// Header halaman terpusat & responsif — judul + deskripsi di kiri, actions di kanan.
// Di mobile actions turun ke bawah (flex-col) supaya tidak ada tombol terpotong.
// Menggantikan pola "flex justify-between" yang di-copy manual tiap halaman.
interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Ikon lucide opsional di samping judul. */
  icon?: React.ComponentType<{ className?: string }>
  /** Tombol / kontrol aksi di kanan (desktop) atau bawah (mobile). */
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {Icon && <Icon className="h-6 w-6 shrink-0 text-primary" />}
          <span className="truncate">{title}</span>
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
