export function sourceQuestion(text: string, title: string) {
  const token = `@${title}`
  const trimmed = text.trim()
  if (trimmed === token) return ""
  if (trimmed.startsWith(`${token} `)) return trimmed.slice(token.length).trim()
  const middle = ` ${token} `
  const at = trimmed.indexOf(middle)
  if (at >= 0) return `${trimmed.slice(0, at)} ${trimmed.slice(at + middle.length)}`.replace(/\s+/g, " ").trim()
  if (trimmed.endsWith(` ${token}`)) return trimmed.slice(0, -token.length).trim()
  return trimmed
}

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

export function sourcePlaces(
  chunks: { chunkIndex: number; text: string }[],
  kind: "file" | "website" | "text",
) {
  const labels = new Map<number, string>()
  const sorted = [...chunks].sort((left, right) => left.chunkIndex - right.chunkIndex)
  if (kind === "website") {
    for (const chunk of sorted) labels.set(chunk.chunkIndex, "Web page")
    return labels
  }

  const paged = kind === "file" && sorted.some((chunk) => pageMarkers(chunk.text).length > 0)
  let page = 1
  let nextLine = 1
  let previousLines: string[] = []

  for (const chunk of sorted) {
    const lines = contentLines(chunk.text)
    const overlap = sharedTail(previousLines, lines)
    let pageCursor = page
    let lineCursor = Math.max(1, nextLine - overlap)
    let startPage = pageCursor
    let startLine = lineCursor
    let endPage = pageCursor
    let started = false
    let endedOnMarker = false
    let lineOnPreviousPage = lineCursor

    for (const row of chunk.text.split("\n")) {
      const marker = /^Page (\d+)\s*$/.exec(row.trim())
      if (marker) {
        lineOnPreviousPage = lineCursor
        pageCursor = Number(marker[1])
        lineCursor = 1
        endedOnMarker = true
        continue
      }
      if (!row.trim()) continue
      endedOnMarker = false
      if (!started) {
        startPage = pageCursor
        startLine = lineCursor
        started = true
      }
      endPage = pageCursor
      lineCursor += 1
    }

    if (paged) {
      const pages = startPage === endPage ? `Page ${startPage}` : `Pages ${startPage}–${endPage}`
      labels.set(chunk.chunkIndex, `${pages}, line ${startLine}`)
    } else {
      labels.set(chunk.chunkIndex, `Line ${startLine}`)
    }

    page = endPage
    nextLine = endedOnMarker ? lineOnPreviousPage : lineCursor
    previousLines = lines
  }

  return labels
}

export function citationDetail(excerpt: string) {
  const text = excerpt.trim()
  if (/^(Page |Pages |Line |Web page)/.test(text) && text.length <= 48) return text
  const pages = [...text.matchAll(/Page (\d+)/g)].map((match) => Number(match[1]))
  if (!pages.length) return ""
  const start = pages[0]
  const end = pages[pages.length - 1]
  return start === end ? `Page ${start}` : `Pages ${start}–${end}`
}

function pageMarkers(text: string) {
  return [...text.matchAll(/^Page (\d+)\s*$/gm)].map((match) => Number(match[1]))
}

function contentLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^Page \d+$/.test(line))
}

function sharedTail(previous: string[], current: string[]) {
  const max = Math.min(previous.length, current.length)
  for (let size = max; size > 0; size -= 1) {
    let same = true
    for (let index = 0; index < size; index += 1) {
      if (previous[previous.length - size + index] !== current[index]) {
        same = false
        break
      }
    }
    if (same) return size
  }
  return 0
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
