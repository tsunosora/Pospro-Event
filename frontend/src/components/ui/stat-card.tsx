import * as React from "react"
import { cn } from "@/lib/utils"

// Kartu statistik/KPI terpusat — glass + ikon berbingkai + nilai tabular.
// Mengangkat pola StatCard/RabKpiCard dari dashboard jadi reusable.
type StatTone = "neutral" | "primary" | "success" | "warning" | "info" | "destructive"

const toneMap: Record<StatTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/15 text-primary border-primary/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  info: "bg-info/15 text-info border-info/30",
  destructive: "bg-destructive/12 text-destructive border-destructive/30",
}

interface StatCardProps {
  label: React.ReactNode
  value: React.ReactNode
  subtext?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  tone?: StatTone
  className?: string
}

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  tone = "neutral",
  className,
}: StatCardProps) {
  return (
    <div className={cn("glass rounded-xl p-4 sm:p-5", className)}>
      {Icon && (
        <div className={cn("inline-flex rounded-lg border p-2", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="mt-3 text-xs sm:text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl sm:text-3xl font-bold text-foreground nums break-words">
        {value}
      </p>
      {subtext && (
        <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtext}</p>
      )}
    </div>
  )
}
