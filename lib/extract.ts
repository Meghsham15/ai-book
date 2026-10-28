import "server-only"

import { load } from "cheerio"
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf"
import { fileTooLargeMessage, MAX_SOURCE_CHARS, MAX_UPLOAD_BYTES } from "@/lib/constants"
import { UpstreamError, UserInputError } from "@/lib/errors"

export async function extractUploadText(file: File) {
  if (file.size <= 0) throw new UserInputError("That file is empty.")
  if (file.size > MAX_UPLOAD_BYTES) throw new UserInputError(fileTooLargeMessage())

  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf"
  const isText =
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    file.type.startsWith("text/")

  if (isPdf) return extractPdfText(buffer)

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

const MIN_PAGE_LETTERS = 40
const PAGE_READ_CONCURRENCY = 3
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

async function extractPdfText(buffer: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const result = await extractText(pdf, { mergePages: false })
  const pages = Array.isArray(result.text) ? result.text : [result.text]
  const slots = new Array<string>(pages.length)
  const pictured: number[] = []

  pages.forEach((page, index) => {
    const text = cleanupPage(page)
    if (letterCount(text) >= MIN_PAGE_LETTERS) slots[index] = text
    else pictured.push(index)
  })

  let failed = 0
  await mapPool(pictured, PAGE_READ_CONCURRENCY, async (index) => {
    try {
      const png = await renderPageAsImage(pdf, index + 1, {
        canvasImport: () => import("@napi-rs/canvas"),
        width: 1200,
      })
      const text = await transcribePage(await pngToJpeg(png))
      if (letterCount(text) >= MIN_PAGE_LETTERS) slots[index] = text
      else failed += 1
    } catch (error) {
      failed += 1
      console.error(
        "A PDF page could not be read",
        index + 1,
        error instanceof Error ? error.message : "unknown error",
      )
      if (error instanceof UserInputError) throw error
    }
  })

  const text = cleanupText(
    slots
      .map((page, index) => (page ? `Page ${index + 1}\n${page}` : ""))
      .filter(Boolean)
      .join("\n\n"),
  )
  if (!text) {
    throw new UserInputError(
      pictured.length > 0
        ? "This PDF's pages are pictures, and they could not be read. Check NVIDIA_API_KEY and try again."
        : "No readable text was found in that PDF.",
    )
  }
  if (failed > 0) {
    console.warn(`${failed} pictured PDF page${failed === 1 ? "" : "s"} could not be read.`)
  }
  return text
}

async function pngToJpeg(png: ArrayBuffer) {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas")
  const image = await loadImage(Buffer.from(png))
  const canvas = createCanvas(image.width, image.height)
  canvas.getContext("2d").drawImage(image, 0, 0)
  return canvas.toBuffer("image/jpeg", 72)
}

async function transcribePage(jpeg: Buffer) {
  const apiKey = process.env.NVIDIA_API_KEY?.trim()
  if (!apiKey || apiKey.startsWith("replace-me")) {
    throw new UserInputError("This PDF's pages are pictures. Add NVIDIA_API_KEY so those pages can be read.")
  }

  const base = (process.env.NVIDIA_BASE_URL || NVIDIA_BASE_URL).replace(/\/$/, "")
  const model = process.env.NVIDIA_CHAT_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b"
  let response: Response | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        top_p: 0.95,
        max_tokens: 4096,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe every readable word on this page in reading order. Keep headings, numbered lists, tables, and equations as plain text. Include labels printed on diagrams. Skip the printed page number and blank margins. Do not describe the photo and do not add commentary.",
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
              },
            ],
          },
        ],
      }),
    })
    if (response.status !== 429) break
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  if (!response?.ok) {
    throw new UpstreamError("A pictured PDF page could not be read. Check NVIDIA_API_KEY and try again.")
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[]
  }
  return cleanupPage(payload.choices?.[0]?.message?.content ?? "")
}

function letterCount(text: string) {
  return (text.match(/[A-Za-z0-9]/g) ?? []).length
}

function cleanupPage(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const current = cursor
      cursor += 1
      await worker(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
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
