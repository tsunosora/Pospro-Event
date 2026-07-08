import * as React from "react"
import { cn } from "@/lib/utils"

// Skeleton loader — placeholder shimmer untuk loading >300ms (UX: progressive-loading).
// Pakai token muted supaya konsisten light/dark. animate-pulse otomatis mati saat
// prefers-reduced-motion (diatur global di globals.css).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted/70", className)}
      {...props}
    />
  )
}

export { Skeleton }
