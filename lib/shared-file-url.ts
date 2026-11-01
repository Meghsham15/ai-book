import { load } from "cheerio"
import { assertPublicHttpUrl } from "@/lib/website-text"
import { UserInputError } from "@/lib/errors"

const SHARE_MISS = "That link is not a shared file. Use a Google Drive, Docs, Dropbox, or OneDrive link that anyone can open, or a direct PDF or text file link."

export function resolveSharedFileUrl(raw: string) {
  const url = new URL(assertPublicHttpUrl(raw))
  const host = url.hostname.toLowerCase().replace(/^www\./, "")

  if (host === "drive.google.com") return googleDriveDownload(url)
  if (host === "docs.google.com") return googleDocsExport(url)
  if (host === "dropbox.com" || host.endsWith(".dropbox.com")) {
    url.searchParams.set("dl", "1")
    return url.toString()
  }
  if (host === "1drv.ms" || host === "onedrive.live.com" || host.endsWith(".sharepoint.com")) {
    return oneDriveContent(url.toString())
  }
  if (host === "app.box.com" || host === "box.com") return boxDownload(url)
  return url.toString()
}

export function isPublishedGoogleDoc(raw: string) {
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    return host === "docs.google.com" && /\/pub(html)?\/?$/.test(url.pathname)
  } catch {
    return false
  }
}

export function googleDownloadConfirm(html: string, pageUrl: string) {
  const $ = load(html)
  const form = $("form")
    .filter((_, element) => {
      const action = $(element).attr("action") ?? ""
      const fields = $(element).html() ?? ""
      return /download|export|confirm/i.test(`${action} ${fields}`)
    })
    .first()

  if (form.length) {
    const next = new URL(form.attr("action") || pageUrl, pageUrl)
    let confirmed = false
    form.find("input[name]").each((_, element) => {
      const name = $(element).attr("name")
      if (!name) return
      if (name === "confirm" || name === "export" || name === "id") confirmed = true
      next.searchParams.set(name, $(element).attr("value") ?? "")
    })
    if (confirmed) {
      try {
        return assertPublicHttpUrl(next.toString())
      } catch {
        return ""
      }
    }
  }

  const href = $("a[href*='confirm='], a[href*='export=download']").first().attr("href")
  if (!href) return ""
  try {
    return assertPublicHttpUrl(new URL(href, pageUrl).toString())
  } catch {
    return ""
  }
}

export function isAccessWall(html: string, finalUrl: string) {
  try {
    if (new URL(finalUrl).hostname.toLowerCase() === "accounts.google.com") return true
  } catch {
    return true
  }
  const head = html.slice(0, 12_000)
  return /ServiceLogin|accounts\.google\.com\/v3\/signin|docs-access-denied|You need access/i.test(head)
}

export function textFromHtmlDocument(html: string) {
  const $ = load(html)
  const title = $("title").first().text().replace(/\s+/g, " ").trim()
  $("script, style, noscript, svg, iframe, canvas").remove()
  const text = $("body")
    .text()
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  return { title, text }
}

function googleDriveDownload(url: URL) {
  if (/\/folders\//.test(url.pathname) || url.pathname === "/drive/folders") {
    throw new UserInputError("That link is a folder. Share one file instead.", "DRIVE_FOLDER")
  }
  const fromPath = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1]
  const fromQuery =
    url.pathname === "/open" || url.pathname === "/uc" || url.pathname.startsWith("/uc/")
      ? url.searchParams.get("id")
      : ""
  const id = fromPath || fromQuery || ""
  if (!id || !/^[\w-]+$/.test(id)) throw new UserInputError("That Google Drive link is not a file.", "DRIVE_LINK_INVALID")
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`
}

function googleDocsExport(url: URL) {
  if (isPublishedGoogleDoc(url.toString())) return url.toString()
  const match = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/)
  if (!match) throw new UserInputError("That Google link is not a Doc, Sheet, or Slide.", "GOOGLE_DOC_LINK_INVALID")
  const id = match[2]
  if (!/^[\w-]+$/.test(id)) throw new UserInputError("That Google link is not a Doc, Sheet, or Slide.", "GOOGLE_DOC_LINK_INVALID")
  const format = match[1] === "spreadsheets" ? "csv" : "txt"
  const next = new URL(`https://docs.google.com/${match[1]}/d/${id}/export`)
  next.searchParams.set("format", format)
  if (match[1] === "spreadsheets") {
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""))
    const gid = url.searchParams.get("gid") || hash.get("gid") || ""
    if (/^\d+$/.test(gid)) next.searchParams.set("gid", gid)
  }
  return next.toString()
}

function oneDriveContent(shareUrl: string) {
  const encoded = Buffer.from(shareUrl, "utf8").toString("base64url")
  return `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/content`
}

function boxDownload(url: URL) {
  const shared = url.pathname.match(/^\/s\/([^/]+)/)?.[1]
  if (!shared) throw new UserInputError(SHARE_MISS, "SHARED_LINK_UNSUPPORTED")
  return `https://app.box.com/index.php?rm=box_download_shared_file&shared_name=${encodeURIComponent(shared)}`
}
