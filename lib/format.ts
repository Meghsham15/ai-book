export function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export function titleFromFilename(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "Untitled"
  return (
    base
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim()
      .slice(0, 120) || "Untitled"
  )
}
