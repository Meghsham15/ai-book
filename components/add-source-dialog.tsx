"use client"

import { FormEvent, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { CircleAlert, Loader2, X } from "lucide-react"
import { Tooltip } from "@/components/tooltip"
import { postForm, postJson } from "@/lib/client-api"
import { fileTooLargeMessage, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { DocumentType } from "@/types/domain"

const fileLinkHelp = `Use a link that anyone can open without signing in. This reads Google Drive files, Google Docs, Sheets, and Slides, Dropbox, and OneDrive when sharing is set to anyone with the link. A direct link to a PDF or text file works too. A spreadsheet is read from the sheet in the link, or the first sheet. The file must be ${MAX_UPLOAD_MB} MB or smaller. A link that asks for a sign-in is not fetched.`

export function AddSourceDialog({
  organizationId,
  onClose,
}: {
  organizationId: string
  onClose: () => void
}) {
  const router = useRouter()
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [mode, setMode] = useState<DocumentType>("file")
  const [fileMethod, setFileMethod] = useState<"upload" | "link">("upload")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [url, setUrl] = useState("")
  const [fileName, setFileName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [fileError, setFileError] = useState("")
  const pendingRef = useRef(false)
  onCloseRef.current = onClose
  pendingRef.current = pending

  useEffect(() => {
    panelRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pendingRef.current) onCloseRef.current()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === "file" && fileMethod === "upload") {
      const selected = fileRef.current?.files?.[0]
      if (!selected) {
        setFileError("Choose a file to upload.")
        return
      }
      if (selected.size > MAX_UPLOAD_BYTES) {
        setFileError(fileTooLargeMessage())
        return
      }
    }
    setPending(true)
    setError("")
    try {
      if (mode === "file" && fileMethod === "upload") {
        const form = new FormData()
        form.set("organizationId", organizationId)
        const selected = fileRef.current?.files?.[0]
        if (!selected) throw new Error("Choose a file to upload.")
        form.set("file", selected)
        if (title.trim()) form.set("title", title.trim())
        await postForm("/api/documents", form)
      } else if (mode === "file") {
        await postJson("/api/documents", {
          organizationId,
          type: "file",
          url,
          ...(title.trim() ? { title: title.trim() } : {}),
        })
      } else if (mode === "website") {
        await postJson("/api/documents", {
          organizationId,
          type: "website",
          url,
          ...(title.trim() ? { title: title.trim() } : {}),
        })
      } else {
        await postJson("/api/documents", { organizationId, type: "text", title, content })
      }
      router.refresh()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The source could not be added.")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0c121b]/55 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[min(40rem,calc(100dvh-1.5rem))] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-[var(--card)] p-5 text-foreground shadow-[0_24px_80px_rgba(12,18,27,0.35)] outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="font-display text-3xl tracking-tight">
              Add source
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">A file, a public page, or a note for this library.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-foreground disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-full bg-black/5 p-1 dark:bg-white/10" role="tablist" aria-label="Source type">
            {(
              [
                ["file", "File"],
                ["website", "Website"],
                ["text", "Note"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => {
                  setMode(value)
                  setError("")
                  setFileError("")
                }}
                className={cn(
                  "rounded-full px-2 py-1.5 text-xs font-semibold",
                  mode === value ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1 rounded-full bg-black/5 p-1 dark:bg-white/10" role="tablist" aria-label="How to add the file">
                {(
                  [
                    ["upload", "Upload"],
                    ["link", "Link"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={fileMethod === value}
                    onClick={() => {
                      setFileMethod(value)
                      setError("")
                      setFileError("")
                    }}
                    className={cn(
                      "rounded-full px-2 py-1.5 text-xs font-semibold",
                      fileMethod === value ? "bg-white text-field shadow-sm" : "text-muted hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {fileMethod === "upload" ? (
                <div className="space-y-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="shrink-0 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-on-ink"
                    >
                      Choose file
                    </button>
                    <span className="min-w-0 truncate text-xs text-muted">{fileName || `PDF or text, up to ${MAX_UPLOAD_MB} MB`}</span>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf"
                      onChange={(event) => {
                        const selected = event.target.files?.[0]
                        setFileName(selected?.name ?? "")
                        setFileError(selected && selected.size > MAX_UPLOAD_BYTES ? fileTooLargeMessage() : "")
                      }}
                      className="sr-only"
                    />
                  </div>
                  {fileError ? (
                    <p className="text-xs leading-5 text-danger" role="alert">
                      {fileError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      required
                      type="url"
                      placeholder="https://drive.google.com/file/d/…"
                      aria-label="Shared file link"
                      className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-field outline-none transition focus:border-accent"
                    />
                    <Tooltip wide label={fileLinkHelp}>
                      <button
                        type="button"
                        aria-label="How shared file links work"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-foreground"
                      >
                        <CircleAlert className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                  <p className="text-xs leading-5 text-muted">Anyone with the link can open it. No sign-in.</p>
                </div>
              )}
            </div>
          ) : null}

          {mode === "website" ? (
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              type="url"
              placeholder="https://example.com/guide"
              aria-label="Website URL"
              className="w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-field outline-none transition focus:border-accent"
            />
          ) : null}

          {mode !== "file" || fileMethod === "link" ? (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required={mode === "text"}
              placeholder={mode === "text" ? "Note title" : "Title (optional)"}
              aria-label={mode === "text" ? "Note title" : "Title"}
              className="w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-field outline-none transition focus:border-accent"
            />
          ) : null}

          {mode === "text" ? (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              rows={5}
              placeholder="Paste a FAQ, policy, or note."
              aria-label="Note"
              className="w-full resize-none rounded-2xl border border-line bg-white px-3 py-2 text-sm text-field outline-none transition focus:border-accent"
            />
          ) : null}

          <button
            type="submit"
            disabled={pending || Boolean(fileError)}
            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-ink px-4 text-sm font-medium text-on-ink hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Indexing…
              </>
            ) : (
              "Add to library"
            )}
          </button>
          {error ? (
            <p className="text-xs leading-5 text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>,
    document.body,
  )
}
