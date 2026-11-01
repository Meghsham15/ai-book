import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { load } from "cheerio"
import { MAX_SOURCE_CHARS } from "@/lib/constants"
import { UserInputError } from "@/lib/errors"

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const THIN_PAGE_LETTERS = 800

export function assertPublicHttpUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UserInputError("Enter a valid website URL.", "WEBSITE_URL_INVALID")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserInputError("Only http and https links can be imported.", "WEBSITE_URL_PROTOCOL")
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
    throw new UserInputError("That address can't be imported.", "WEBSITE_URL_BLOCKED")
  }

  return url.toString()
}

export async function extractWebsiteText(raw: string) {
  const fetched = await fetchHtml(raw)
  let text = htmlToText(fetched.html)
  if (pageIsThin(fetched.html, text)) {
    const rendered = await renderPage(fetched.url)
    const renderedText = rendered ? htmlToText(rendered) : ""
    if (letterCount(renderedText) > letterCount(text)) text = renderedText
    if (letterCount(text) < THIN_PAGE_LETTERS) {
      const fromScripts = await proseFromScripts(fetched.html, fetched.url)
      if (letterCount(fromScripts) > letterCount(text)) text = fromScripts
    }
  }
  text = cleanupText(text)
  if (!text) throw new UserInputError("That page didn't include any readable text.", "WEBSITE_EMPTY")
  return { url: fetched.url, text }
}

async function fetchHtml(raw: string) {
  let current = assertPublicHttpUrl(raw)
  let response: Response | null = null

  for (let hop = 0; hop < 4; hop += 1) {
    response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
      },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) throw new UserInputError("That page redirected without a destination.", "WEBSITE_REDIRECT")
      current = assertPublicHttpUrl(new URL(location, current).toString())
      continue
    }
    break
  }

  if (!response || !response.ok) {
    throw new UserInputError("That page could not be fetched.", "WEBSITE_FETCH_FAILED")
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("pdf")) {
    throw new UserInputError("That link is a PDF. Upload the file instead.", "WEBSITE_IS_PDF")
  }

  const html = (await response.text()).slice(0, 1_500_000)
  return { url: current, html }
}

function pageIsThin(html: string, text: string) {
  if (letterCount(text) >= THIN_PAGE_LETTERS) return false
  const $ = load(html)
  if ($("script[src]").length > 0) return true
  let inline = 0
  $("script:not([src])").each((_, element) => {
    inline += ($(element).html() ?? "").length
  })
  return inline > 1_000
}

function htmlToText(html: string) {
  const $ = load(html)
  const notes = $("noscript")
    .toArray()
    .map((element) => load($(element).html() ?? "").root().text())
  $("script, style, svg, iframe, canvas, template, noscript").remove()
  $("nav, footer, aside").remove()
  $("p, h1, h2, h3, h4, h5, h6, li, tr, br, div, section, article, main, header, blockquote, pre, figcaption").append("\n")
  const candidates = [notes.join("\n"), $("article").text(), $("main").text(), $("[role='main']").text(), $("body").text()]
  return candidates.map((value) => cleanupText(value)).sort((left, right) => right.length - left.length)[0] ?? ""
}

async function renderPage(url: string) {
  const binary = browserBinary()
  if (!binary) return ""
  const profile = await mkdtemp(join(tmpdir(), "aibook-browser-"))
  try {
    return await new Promise<string>((resolve) => {
      const child = spawn(
        binary,
        [
          "--headless=new",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-sync",
          "--no-first-run",
          "--no-default-browser-check",
          `--user-data-dir=${profile}`,
          "--virtual-time-budget=12000",
          "--timeout=20000",
          "--dump-dom",
          url,
        ],
        { windowsHide: true },
      )
      child.stderr?.resume()
      const chunks: Buffer[] = []
      let size = 0
      const timer = setTimeout(() => child.kill(), 25_000)
      child.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length
        if (size > 20_000_000) {
          child.kill()
          return
        }
        chunks.push(chunk)
      })
      child.on("error", () => {
        clearTimeout(timer)
        resolve("")
      })
      child.on("close", () => {
        clearTimeout(timer)
        resolve(Buffer.concat(chunks).toString("utf8"))
      })
    })
  } finally {
    await rm(profile, { recursive: true, force: true }).catch(() => undefined)
  }
}

function browserBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ]
  return candidates.find((path) => path && existsSync(path)) ?? ""
}

async function proseFromScripts(html: string, pageUrl: string) {
  const page = new URL(pageUrl)
  const $ = load(html)
  const scripts: string[] = []
  $("script[src]").each((_, element) => {
    const src = $(element).attr("src")
    if (!src || scripts.length >= 2) return
    try {
      const absolute = new URL(src, pageUrl)
      if (absolute.hostname !== page.hostname) return
      scripts.push(assertPublicHttpUrl(absolute.toString()))
    } catch {
      return
    }
  })

  const lines: string[] = []
  const seen = new Set<string>()
  for (const scriptUrl of scripts) {
    try {
      const response = await fetch(scriptUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": BROWSER_UA, Accept: "*/*" },
      })
      if (!response.ok) continue
      const source = (await response.text()).slice(0, 10_000_000)
      for (const match of source.matchAll(/(?:children|description|summary|title|name|des)\s*:\s*"((?:\\.|[^"\\])*)"/g)) {
        const text = keepCopy(decodeJsString(match[1]))
        if (!text || seen.has(text)) continue
        seen.add(text)
        lines.push(text)
      }
    } catch {
      continue
    }
  }
  return cleanupText(lines.join("\n"))
}

function decodeJsString(raw: string) {
  try {
    return JSON.parse(`"${raw}"`) as string
  } catch {
    return ""
  }
}

function keepCopy(value: string) {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length < 8 || text.length > 500) return ""
  if (!/[A-Za-z]/.test(text)) return ""
  if (/https?:|[{}<>]|webpack|function\b/.test(text)) return ""
  if (!/\s/.test(text) && text.length < 12) return ""
  return text
}

function letterCount(text: string) {
  return (text.match(/[A-Za-z0-9]/g) ?? []).length
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
