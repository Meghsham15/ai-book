import { BookOpen } from "lucide-react"

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`grid h-9 w-9 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-sm ${className}`}>
      <BookOpen className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}
