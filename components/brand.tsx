export function BrandMark({ className = "", lockup = false }: { className?: string; lockup?: boolean }) {
  const light = lockup ? "/logo-light.png" : "/logo-mark-light.png"
  const dark = lockup ? "/logo-dark.png" : "/logo-mark-dark.png"
  const size = lockup ? "h-24 w-auto sm:h-28" : "h-9 w-auto"
  const alt = lockup ? "AI Book" : ""

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <img src={light} alt={alt} className={`${size} dark:hidden`} />
      <img src={dark} alt={alt} className={`${size} hidden dark:block`} />
    </span>
  )
}
