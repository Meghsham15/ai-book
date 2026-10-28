import { BookOpen } from "lucide-react"

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`relative grid h-9 w-7 place-items-center bg-accent text-accent-foreground shadow-[0_8px_20px_-12px_rgba(61,79,255,0.9)] ${className}`}>
      <BookOpen className="h-4 w-4" aria-hidden="true" />
      <span className="absolute inset-x-0 bottom-0 h-1.5 bg-copper" />
    </span>
  )
}
