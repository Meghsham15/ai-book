import "server-only"

import { fileTooLargeMessage, MAX_UPLOAD_BYTES } from "@/lib/constants"
import { UserInputError } from "@/lib/errors"
import { assertPublicHttpUrl } from "@/lib/website-text"
import {
  googleDownloadConfirm,
  isAccessWall,
  isPublishedGoogleDoc,
  resolveSharedFileUrl,
  textFromHtmlDocument,
} from "@/lib/shared-file-url"

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const PRIVATE_LINK =
  "That link did not return a file. Share it so anyone with the link can open it, without signing in. A normal web page belongs in the Website tab."

export async function downloadSharedFile(raw: string) {
  const sourceUrl = assertPublicHttpUrl(raw)
  const target = resolveSharedFileUrl(sourceUrl)
  const published = isPublishedGoogleDoc(sourceUrl)
  const jar = new Map<string, string>()
  let fetched = await fetchFile(target, jar)

  if (isHtml(fetched.type, fetched.buffer) && !published) {
    const next = googleDownloadConfirm(fetched.buffer.toString("utf8"), fetched.url)
    if (next) fetched = await fetchFile(next, jar)
  }

  if (isHtml(fetched.type, fetched.buffer)) {
    const html = fetched.buffer.toString("utf8")
    if (isAccessWall(html, fetched.url) || !published) throw new UserInputError(PRIVATE_LINK, "SHARED_LINK_PRIVATE")
    const page = textFromHtmlDocument(html)
    if (page.text.length < 40) throw new UserInputError(PRIVATE_LINK, "SHARED_LINK_PRIVATE")
    const name = page.title ? `${page.title}.txt` : "shared-file.txt"
    return {
      buffer: Buffer.from(page.text, "utf8"),
      name: safeName(name, "shared-file.txt"),
      type: "text/plain",
      sourceUrl,
    }
  }

  return {
    buffer: fetched.buffer,
    name: filenameFrom(fetched.disposition, fetched.type, fetched.url),
    type: fetched.type,
    sourceUrl,
  }
}

async function fetchFile(start: string, jar: Map<string, string>) {
  let current = assertPublicHttpUrl(start)

  for (let hop = 0; hop < 6; hop += 1) {
    let response: Response
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "*/*",
          "Accept-Language": "en",
          ...(jar.size > 0 ? { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; ") } : {}),
        },
      })
    } catch (error) {
      if (error instanceof UserInputError) throw error
      throw new UserInputError("That file could not be downloaded. Check that anyone with the link can open it, then try again.", "SHARED_LINK_DOWNLOAD_FAILED")
    }

    rememberCookies(jar, response.headers)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) throw new UserInputError("That link redirected without a destination.", "SHARED_LINK_REDIRECT")
      current = assertPublicHttpUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) throw new UserInputError(PRIVATE_LINK, "SHARED_LINK_PRIVATE")

    const declared = Number(response.headers.get("content-length") || "0")
    if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) throw new UserInputError(fileTooLargeMessage(), "FILE_TOO_LARGE")
    const buffer = await readCapped(response)
    return {
      url: current,
      buffer,
      type: response.headers.get("content-type") ?? "",
      disposition: response.headers.get("content-disposition") ?? "",
    }
  }

  throw new UserInputError("That link redirected too many times.", "SHARED_LINK_REDIRECT")
}

async function readCapped(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_UPLOAD_BYTES) throw new UserInputError(fileTooLargeMessage(), "FILE_TOO_LARGE")
    return buffer
  }

  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_UPLOAD_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new UserInputError(fileTooLargeMessage(), "FILE_TOO_LARGE")
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

function rememberCookies(jar: Map<string, string>, headers: Headers) {
  const extra = headers as Headers & { getSetCookie?: () => string[] }
  for (const line of extra.getSetCookie?.() ?? []) {
    const pair = line.split(";")[0] ?? ""
    const eq = pair.indexOf("=")
    if (eq <= 0) continue
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

function isHtml(contentType: string, buffer: Buffer) {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return false
  const head = buffer.subarray(0, 256).toString("utf8").trimStart().toLowerCase()
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<head")) return true
  const type = contentType.toLowerCase()
  return type.includes("text/html") || type.includes("application/xhtml")
}

function filenameFrom(disposition: string, contentType: string, finalUrl: string) {
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(disposition)
  if (star) {
    try {
      return safeName(decodeURIComponent(star[1].trim()), namedFallback(contentType))
    } catch {
      return namedFallback(contentType)
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  if (plain?.[1]) return safeName(plain[1], namedFallback(contentType))

  try {
    const last = decodeURIComponent(new URL(finalUrl).pathname.split("/").pop() ?? "")
    if (/\.(pdf|txt|md|markdown|csv)$/i.test(last)) return safeName(last, namedFallback(contentType))
  } catch {
    return namedFallback(contentType)
  }
  return namedFallback(contentType)
}

function namedFallback(contentType: string) {
  const type = contentType.toLowerCase()
  if (type.includes("pdf")) return "shared-file.pdf"
  if (type.includes("csv")) return "shared-file.csv"
  return "shared-file.txt"
}

function safeName(name: string, fallback: string) {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
  return cleaned || fallback
}
