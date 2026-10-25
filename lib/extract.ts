import "server-only"

import { load } from "cheerio"
import { extractText } from "unpdf"
import { MAX_SOURCE_CHARS, MAX_UPLOAD_BYTES } from "@/lib/constants"
import { UserInputError } from "@/lib/errors"

export async function extractUploadText(file: File) {
  if (file.size <= 0) throw new UserInputError("That file is empty.")
  if (file.size > MAX_UPLOAD_BYTES) throw new UserInputError("Files must be 10 MB or smaller.")

  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf"
  const isText =
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    file.type.startsWith("text/")

  if (isPdf) {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true })
    const text = Array.isArray(result.text) ? result.text.join("\n") : result.text
    return cleanupText(text)
  }

  if (isText) return cleanupText(buffer.toString("utf8"))
  throw new UserInputError("Upload a PDF, TXT, or Markdown file.")
}

export function assertPublicHttpUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UserInputError("Enter a valid website URL.")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserInputError("Only http and https links can be imported.")
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    isPrivateIp(host)
  ) {
    throw new UserInputError("That address can't be imported.")
  }

  return url.toString()
}

export async function extractWebsiteText(raw: string) {
  let current = assertPublicHttpUrl(raw)
  let response: Response | null = null

  for (let hop = 0; hop < 4; hop += 1) {
    response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": "AIBookBot/1.0",
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
      },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) throw new UserInputError("That page redirected without a destination.")
      current = assertPublicHttpUrl(new URL(location, current).toString())
      continue
    }
    break
  }

  if (!response || !response.ok) {
    throw new UserInputError("That page could not be fetched.")
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("pdf")) {
    throw new UserInputError("That link is a PDF. Upload the file instead.")
  }

  const html = (await response.text()).slice(0, 1_500_000)
  const text = cleanupText(htmlToText(html))
  if (!text) throw new UserInputError("That page didn't include any readable text.")
  return { url: current, text }
}

function htmlToText(html: string) {
  const $ = load(html)
  $("script, style, noscript, svg, iframe, canvas, nav, footer").remove()
  return $("article").text() || $("main").text() || $("body").text() || $.root().text()
}

function cleanupText(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_SOURCE_CHARS)
}

function isPrivateIp(host: string) {
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true
  const mapped = host.startsWith("::ffff:") ? host.slice(7) : host
  if (/^127\./.test(mapped)) return true
  if (/^10\./.test(mapped)) return true
  if (/^192\.168\./.test(mapped)) return true
  if (/^169\.254\./.test(mapped)) return true
  const match = /^172\.(\d+)\./.exec(mapped)
  if (!match) return false
  const second = Number(match[1])
  return second >= 16 && second <= 31
}
