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
  return shortenPassage(text, max, 40)
}

export function passageExcerpt(text: string, max = 420) {
  return shortenPassage(text, max, 80)
}

function shortenPassage(text: string, max: number, minBreak: number) {
  const line = text.replace(/\s+/g, " ").trim()
  if (line.length <= max) return line
  const cut = line.slice(0, max)
  const space = cut.lastIndexOf(" ")
  const shortened = (space > minBreak ? cut.slice(0, space) : cut).trimEnd()
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
