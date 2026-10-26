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

export function citationLine(text: string, max = 96) {
  const line = text.replace(/\s+/g, " ").trim()
  if (line.length <= max) return line
  const cut = line.slice(0, max)
  const space = cut.lastIndexOf(" ")
  const shortened = (space > 40 ? cut.slice(0, space) : cut).trimEnd()
  return `${shortened}…`
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
