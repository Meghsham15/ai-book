"use client"

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Copy, FileText, Globe, Loader2, NotebookPen, RefreshCw, Send, Settings, Trash2 } from "lucide-react"
import { MarkdownMessage } from "@/components/markdown-message"
import { StudioBar, studioPlaceholder } from "@/components/studio-bar"
import { StudyOutput } from "@/components/study-output"
import { OrgSwitcher } from "@/components/org-switcher"
import { Tooltip } from "@/components/tooltip"
import { TopBar } from "@/components/top-bar"
import { deleteJson, getJson, postForm, postJson, readChatStream } from "@/lib/client-api"
import { fileTooLargeMessage, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/constants"
import { formatDate, sourceQuestion } from "@/lib/format"
import { packStudy, parseStudy, studyRequestLabel, type Amount, type Difficulty, type ReportFormat, type StudyKind } from "@/lib/study"
import { cn } from "@/lib/utils"
import type { ChatMessage, ChatSource, DocumentItem, DocumentType, LibraryOption, OrgDetails, SessionUser } from "@/types/domain"

const suggestions = [
  "Summarize what this library knows",
  "What are the main topics?",
  "Which points still look incomplete?",
]

export function Workspace({
  user,
  org,
  sources,
  libraries,
  canWrite,
}: {
  user: SessionUser
  org: OrgDetails
  sources: DocumentItem[]
  libraries: LibraryOption[]
  canWrite: boolean
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<"sources" | "chat">("chat")
  const [sourceItems, setSourceItems] = useState(sources)
  const [reloadToken, setReloadToken] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [sourceError, setSourceError] = useState("")

  useEffect(() => {
    setSourceItems(sources)
  }, [sources])

  async function refreshLibrary() {
    if (refreshing) return
    setRefreshing(true)
    setSourceError("")
    try {
      const result = await getJson<{ sources: DocumentItem[] }>(
        `/api/documents?organizationId=${encodeURIComponent(org.id)}`,
      )
      setSourceItems(result.sources)
      router.refresh()
    } catch (caught) {
      setSourceError(caught instanceof Error ? caught.message : "The library could not be refreshed.")
    } finally {
      setReloadToken((value) => value + 1)
      setRefreshing(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-x-hidden">
      <TopBar user={user}>
        <OrgSwitcher libraries={libraries} current={org.slug} />
        <Tooltip label="Members, name, and delete">
          <Link
            href={`/org/${org.slug}/settings`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-foreground transition hover:border-accent sm:h-9 sm:w-auto sm:px-3"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
            <span className="sr-only sm:hidden">Settings</span>
          </Link>
        </Tooltip>
      </TopBar>
      <div className="flex gap-2 border-b border-line px-4 py-2 lg:hidden">
        <PanelButton active={panel === "chat"} onClick={() => setPanel("chat")}>
          Ask
        </PanelButton>
        <PanelButton active={panel === "sources"} onClick={() => setPanel("sources")}>
          Sources{sourceItems.length > 0 ? ` · ${sourceItems.length}` : ""}
        </PanelButton>
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className={cn("min-h-0 w-full min-w-0 flex-col overflow-x-hidden bg-sidebar text-sidebar-foreground", panel === "sources" ? "flex" : "hidden", "lg:flex")}>
          <SourceColumn org={org} sources={sourceItems} canWrite={canWrite} sourceError={sourceError} />
        </section>
        <section className={cn("min-h-0 min-w-0 flex-col", panel === "chat" ? "flex" : "hidden", "lg:flex")}>
          <ChatPanel
            organizationId={org.id}
            libraryName={org.name}
            currentUserId={user.id}
            currentUserName={user.name}
            sources={sourceItems}
            reloadToken={reloadToken}
            refreshing={refreshing}
            canWrite={canWrite}
            readyCount={sourceItems.filter((source) => source.status === "ready").length}
            indexingCount={sourceItems.filter((source) => source.status === "processing").length}
            failedCount={sourceItems.filter((source) => source.status === "failed").length}
            onRefresh={() => void refreshLibrary()}
          />
        </section>
      </div>
    </div>
  )
}

function activeMention(value: string, caret: number) {
  const before = value.slice(0, caret)
  const match = /(?:^|\s)@([^\s@]*)$/.exec(before)
  if (!match) return null
  return { start: before.length - match[1].length - 1, query: match[1] }
}

function PanelButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium",
        active ? "bg-accent text-accent-foreground" : "text-muted",
      )}
    >
      {children}
    </button>
  )
}

function SourceColumn({
  org,
  sources,
  canWrite,
  sourceError,
}: {
  org: OrgDetails
  sources: DocumentItem[]
  canWrite: boolean
  sourceError: string
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <p className="text-sm text-sidebar-foreground/60">Sources</p>
        <Tooltip label={org.name} className="max-w-full">
          <h1 className="mt-1.5 truncate font-display text-3xl leading-none tracking-tight">{org.name}</h1>
        </Tooltip>
        <p className="mt-2 text-xs text-sidebar-foreground/60">
          {sources.filter((source) => source.status === "ready").length} ready to answer
        </p>
      </div>
      {canWrite ? <SourceComposer organizationId={org.id} /> : null}
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {sourceError ? <li className="px-2 py-2 text-xs leading-5 text-orange-200">{sourceError}</li> : null}
        {sources.length === 0 ? (
          <li className="mx-1 rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center">
            <p className="font-display text-2xl tracking-tight">No sources yet</p>
            <p className="mt-2 text-sm leading-6 text-sidebar-foreground/70">
              {canWrite
                ? "Add a PDF, a public page, or a note. Questions can use a source after it says Ready."
                : "An admin or manager adds sources. You can ask once one says Ready."}
            </p>
          </li>
        ) : (
          sources.map((source) => <SourceRow key={source.id} source={source} canWrite={canWrite} />)
        )}
      </ul>
      <UsageFooter org={org} />
    </div>
  )
}

function SourceComposer({ organizationId }: { organizationId: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<DocumentType>("file")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [url, setUrl] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [fileError, setFileError] = useState("")
  const [fileName, setFileName] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === "file") {
      const selected = new FormData(event.currentTarget).get("file")
      if (selected instanceof File && selected.size > MAX_UPLOAD_BYTES) {
        setFileError(fileTooLargeMessage())
        return
      }
    }
    setPending(true)
    setError("")
    try {
      if (mode === "file") {
        const form = new FormData(event.currentTarget)
        form.set("organizationId", organizationId)
        await postForm("/api/documents", form)
      } else if (mode === "website") {
        await postJson("/api/documents", { organizationId, type: "website", title, url })
      } else {
        await postJson("/api/documents", { organizationId, type: "text", title, content })
      }
      setTitle("")
      setContent("")
      setUrl("")
      setFileName("")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The source could not be added.")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="min-w-0 space-y-3 border-b border-white/10 px-4 py-4">
      <div className="grid w-full min-w-0 grid-cols-3 gap-1 rounded-full bg-white/8 p-1">
        {(
          [
            ["file", "File"],
            ["website", "Site"],
            ["text", "Note"],
          ] as const
        ).map(([value, label]) => (
          <Tooltip
            key={value}
            className="flex min-w-0"
            label={value === "file" ? `PDF or text file, up to ${MAX_UPLOAD_MB} MB` : value === "website" ? "A public web page" : "Text you paste in"}
          >
            <button
              type="button"
              onClick={() => {
                setMode(value)
                setFileError("")
                setError("")
              }}
              className={cn(
                "w-full min-w-0 rounded-full px-2 py-1.5 text-xs font-semibold",
                mode === value ? "bg-white text-field" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
              )}
            >
              {label}
            </button>
          </Tooltip>
        ))}
      </div>
      {mode === "file" ? (
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-semibold text-field"
            >
              Choose file
            </button>
            <span className="min-w-0 truncate text-xs text-sidebar-foreground/80">{fileName || "No file chosen"}</span>
            <input
              ref={fileRef}
              name="file"
              type="file"
              required
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
            <p className="text-xs leading-5 text-orange-200" role="alert">
              {fileError}
            </p>
          ) : null}
        </div>
      ) : null}
      {mode === "website" ? (
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          type="url"
          placeholder="https://example.com/guide"
          className="w-full rounded-2xl border border-white/10 bg-white px-3 py-2 text-sm text-field outline-none transition focus:border-accent"
        />
      ) : null}
      {mode !== "file" ? (
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required={mode === "text"}
          placeholder={mode === "text" ? "Note title" : "Title (optional)"}
          className="w-full rounded-2xl border border-white/10 bg-white px-3 py-2 text-sm text-field outline-none transition focus:border-accent"
        />
      ) : null}
      {mode === "text" ? (
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          rows={4}
          placeholder="Paste a FAQ, policy, or note."
          className="w-full resize-none rounded-2xl border border-white/10 bg-white px-3 py-2 text-sm text-field outline-none transition focus:border-accent"
        />
      ) : null}
      <button
        type="submit"
        disabled={pending || Boolean(fileError)}
        className="inline-flex h-10 w-full max-w-full items-center justify-center rounded-full bg-copper px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 dark:text-[#1a0d0b] sm:hover:-translate-y-0.5"
      >
        {pending ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />Indexing…</> : "Add to library"}
      </button>
      {error ? <p className="text-xs leading-5 text-orange-200">{error}</p> : null}
    </form>
  )
}

function SourceRow({ source, canWrite }: { source: DocumentItem; canWrite: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const Icon = source.type === "website" ? Globe : source.type === "text" ? NotebookPen : FileText
  const kind = source.type === "website" ? "Site" : source.type === "text" ? "Note" : "File"
  const status =
    source.status === "ready"
      ? { label: "Ready", detail: `${source.chunkCount} ${source.chunkCount === 1 ? "chunk" : "chunks"}`, tone: "bg-emerald-400/15 text-emerald-100" }
      : source.status === "processing"
        ? { label: "Indexing", detail: "Still reading this source", tone: "bg-copper/30 text-orange-100" }
        : { label: "Failed", detail: "Could not be indexed", tone: "bg-red-400/15 text-orange-100" }

  return (
    <li className="min-w-0 overflow-hidden rounded-2xl bg-white/6 px-3 py-3 transition hover:bg-white/12">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-foreground/70" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Tooltip label={source.title} className="block min-w-0 flex-1">
              <p className="min-w-0 truncate text-sm font-medium">{source.title}</p>
            </Tooltip>
            <Tooltip label={status.detail}>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", status.tone)}>
                {status.label}
              </span>
            </Tooltip>
          </div>
          <p className="mt-1 text-xs text-sidebar-foreground/55">
            {kind}, {status.detail}, {formatDate(source.createdAt)}
          </p>
          {source.status === "failed" && source.errorMessage ? (
            <p className="mt-1 text-xs leading-5 text-orange-200">{source.errorMessage}</p>
          ) : null}
        </div>
      </div>
      {canWrite ? (
        <div className="mt-2 flex justify-end">
          {confirming ? (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setPending(true)
                try {
                  await deleteJson(`/api/documents/${source.id}`)
                  router.refresh()
                } finally {
                  setPending(false)
                  setConfirming(false)
                }
              }}
              className="text-xs font-semibold text-orange-200"
            >
              {pending ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />Removing…</> : "Confirm remove"}
            </button>
          ) : (
            <Tooltip label={`Remove ${source.title}`}>
              <button type="button" onClick={() => setConfirming(true)} className="text-sidebar-foreground/55" aria-label={`Remove ${source.title}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      ) : null}
    </li>
  )
}

function UsageFooter({ org }: { org: OrgDetails }) {
  const used = org.usage.files + org.usage.websites + org.usage.texts
  const cap = org.limits.maxFiles + org.limits.maxWebsites + org.limits.maxTexts
  return (
    <div className="shrink-0 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs leading-5 break-words text-sidebar-foreground/65 sm:px-5">
      <p>
        {used}/{cap} sources · {org.usage.chunks}/{org.limits.maxChunks} chunks · {org.queries}{" "}
        {org.queries === 1 ? "question" : "questions"}
      </p>
      <p className="mt-1">Search: {org.embeddingProvider === "pending" ? "chosen on first source" : org.embeddingProvider}</p>
    </div>
  )
}

function EmptyLibrary({
  canWrite,
  indexingCount,
  failedCount,
  onRefresh,
  refreshing,
}: {
  canWrite: boolean
  indexingCount: number
  failedCount: number
  onRefresh: () => void
  refreshing: boolean
}) {
  const waiting = indexingCount > 0
  const title = waiting ? "A source is still indexing" : failedCount > 0 ? "A source could not be indexed" : "Add a source before asking"
  const detail = waiting
    ? "The chat can answer after a source says Ready. Refresh in a moment."
    : failedCount > 0
      ? "Open Sources to read the error, then add the file again."
      : canWrite
        ? "Use Sources to add a PDF, a public page, or a note."
        : "An admin or manager needs to add a source. You can ask after it says Ready."

  return (
    <div className="rounded-3xl border border-dashed border-line bg-card px-6 py-8">
      <h2 className="font-display text-4xl tracking-tight">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted">{detail}</p>
      {waiting ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      ) : null}
    </div>
  )
}

function ChatPanel({
  organizationId,
  libraryName,
  currentUserId,
  currentUserName,
  sources,
  reloadToken,
  refreshing,
  canWrite,
  readyCount,
  indexingCount,
  failedCount,
  onRefresh,
}: {
  organizationId: string
  libraryName: string
  currentUserId: string
  currentUserName: string
  sources: DocumentItem[]
  reloadToken: number
  refreshing: boolean
  canWrite: boolean
  readyCount: number
  indexingCount: number
  failedCount: number
  onRefresh: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [scope, setScope] = useState<{ id: string; token: string } | null>(null)
  const [searchLabel, setSearchLabel] = useState("")
  const [output, setOutput] = useState<StudyKind | null>(null)
  const [reportFormat, setReportFormat] = useState<ReportFormat>("summary")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [amount, setAmount] = useState<Amount>("standard")
  const [streamingStudy, setStreamingStudy] = useState<"" | "table" | "quiz">("")
  const [pending, setPending] = useState(false)
  const [streamingId, setStreamingId] = useState("")
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const readySources = sources.filter((source) => source.status === "ready")
  const mentionMatches = mention
    ? readySources
        .filter((source) => source.title.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 8)
    : []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: streamingId ? "auto" : "smooth" })
  }, [messages, pending, streamingId])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setMessages([])
    void getJson<{ messages: ChatMessage[] }>(`/api/chat?organizationId=${encodeURIComponent(organizationId)}`)
      .then((result) => {
        if (!cancelled) setMessages(result.messages)
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The chat could not be loaded.")
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  useEffect(() => {
    if (reloadToken === 0) return
    let cancelled = false
    setError("")
    void getJson<{ messages: ChatMessage[] }>(`/api/chat?organizationId=${encodeURIComponent(organizationId)}`)
      .then((result) => {
        if (!cancelled) setMessages(result.messages)
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The chat could not be refreshed.")
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, reloadToken])

  function syncMention(value: string, caret: number) {
    const next = activeMention(value, caret)
    setMention(next)
    setMentionIndex(0)
  }

  function chooseSource(source: DocumentItem) {
    const caret = inputRef.current?.selectionStart ?? draft.length
    const current = activeMention(draft, caret)
    if (!current) return
    const token = `@${source.title}`
    const next = `${draft.slice(0, current.start)}${token} ${draft.slice(caret)}`
    const place = current.start + token.length + 1
    setDraft(next)
    setScope({ id: source.id, token })
    setMention(null)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(place, place)
    })
  }

  async function ask(text: string) {
    const shown = text.trim()
    const scoped = scope && sourceQuestion(shown, scope.token.slice(1)) !== shown ? scope : null
    const query = scoped ? sourceQuestion(shown, scoped.token.slice(1)) : shown
    if (!query || pending) {
      if (shown && !query) setError(output ? "Add a prompt after the source name." : "Add a question after the source name.")
      return
    }
    const task = output
      ? { kind: output, format: reportFormat, difficulty, amount }
      : null
    const verb = output === "report" ? "Writing the report" : output === "table" ? "Writing the table" : output === "quiz" ? "Writing the quiz" : ""
    setDraft("")
    setMention(null)
    setScope(null)
    setStreamingStudy(output === "table" || output === "quiz" ? output : "")
    setSearchLabel(verb ? `${verb}${scoped ? ` from ${scoped.token.slice(1)}` : ""}…` : `Looking through ${scoped ? scoped.token.slice(1) : libraryName}…`)
    setError("")
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: task ? `${studyRequestLabel(task)}\n${shown}` : shown,
      authorId: currentUserId,
      authorName: currentUserName,
    }
    setMessages((current) => [...current, userMessage])
    setPending(true)
    let assistantId = ""
    let replySources: ChatSource[] | undefined
    try {
      await readChatStream(
        "/api/chat",
        {
          query: shown,
          organizationId,
          ...(scoped ? { documentId: scoped.id } : {}),
          ...(task
            ? {
                output: task.kind,
                ...(task.kind === "report"
                  ? { format: task.format }
                  : task.kind === "table"
                    ? { amount: task.amount }
                    : { difficulty: task.difficulty, amount: task.amount }),
              }
            : {}),
        },
        (event) => {
        if (event.type === "sources") {
          replySources = event.sources
          return
        }
        if (event.type === "delta") {
          if (!assistantId) {
            assistantId = crypto.randomUUID()
            setStreamingId(assistantId)
            setMessages((current) => [
              ...current,
              { id: assistantId, role: "assistant", content: event.text, authorName: "AI Book" },
            ])
            return
          }
          const id = assistantId
          setMessages((current) =>
            current.map((message) =>
              message.id === id ? { ...message, content: message.content + event.text } : message,
            ),
          )
          return
        }
        if (event.type === "done" && assistantId) {
          const id = assistantId
          const nextSources = replySources
          const kind = task?.kind === "table" || task?.kind === "quiz" ? task.kind : null
          setStreamingStudy("")
          setMessages((current) =>
            current.map((message) =>
              message.id === id
                ? { ...message, sources: nextSources, content: kind ? packStudy(kind, message.content) : message.content }
                : message,
            ),
          )
        }
      })
    } catch (caught) {
      if (assistantId) {
        const id = assistantId
        const structured = task?.kind === "table" || task?.kind === "quiz"
        setMessages((current) =>
          current.filter((message) => message.id !== id || (!structured && message.content.trim())),
        )
      }
      setError(caught instanceof Error ? caught.message : "The question could not be answered.")
    } finally {
      setStreamingId("")
      setStreamingStudy("")
      setSearchLabel("")
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3 sm:gap-3 sm:px-8">
        <div className="min-w-0">
          <Tooltip label={libraryName} className="max-w-full">
            <p className="truncate text-sm font-medium">Ask {libraryName}</p>
          </Tooltip>
          <p className="hidden text-xs text-muted sm:block">Visible to everyone in this library</p>
        </div>
        <div className="flex items-center gap-2">
          {confirmClear ? (
            <button
              type="button"
              disabled={pending || clearing}
              onClick={() => {
                setClearing(true)
                setError("")
                void deleteJson(`/api/chat?organizationId=${encodeURIComponent(organizationId)}`)
                  .then(() => {
                    setMessages([])
                    setConfirmClear(false)
                  })
                  .catch((caught) => {
                    setError(caught instanceof Error ? caught.message : "The chat could not be cleared.")
                  })
                  .finally(() => setClearing(false))
              }}
              className="inline-flex h-9 items-center rounded-full bg-danger-fill px-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {clearing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />Clearing…</> : "Confirm clear"}
            </button>
          ) : (
            <Tooltip label="Clears this chat for everyone in the library">
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={pending || refreshing || messages.length === 0}
                className="inline-flex h-9 items-center rounded-full border border-line bg-card px-3 text-sm font-medium transition hover:border-danger disabled:opacity-50"
              >
                Clear
              </button>
            </Tooltip>
          )}
          <Tooltip label="Reload sources and the latest chat">
            <button
              type="button"
              onClick={onRefresh}
              disabled={pending || refreshing || clearing}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-card px-3 text-sm font-medium transition hover:border-accent disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sr-only sm:hidden">Refresh</span>
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-6 sm:px-8 sm:py-8">
        {!loaded && messages.length === 0 ? (
          <p className="mx-auto flex max-w-2xl items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading chat…
          </p>
        ) : null}
        {loaded && messages.length === 0 ? (
          <div className="mx-auto max-w-2xl pt-8">
            {readyCount === 0 ? (
              <EmptyLibrary
                canWrite={canWrite}
                indexingCount={indexingCount}
                failedCount={failedCount}
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            ) : (
              <>
                <h2 className="rise font-display text-4xl tracking-tight sm:text-5xl">What do you want to know about {libraryName}?</h2>
                <p className="mt-3 text-sm text-muted">{readyCount} {readyCount === 1 ? "source is" : "sources are"} ready.</p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void ask(suggestion)}
                      className="rounded-full border border-line bg-card px-4 py-2 text-sm transition hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-accent-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.role === "user" && message.authorId === currentUserId
            const study = message.role === "assistant" ? parseStudy(message.content) : null
            const writingStudy = message.id === streamingId && streamingStudy !== ""
            const wide = Boolean(study)
            const requestLine = mine ? message.content.match(/^(Report|Data table|Quiz) · [^\n]+/) : null
            const canCopy = streamingId !== message.id && !study && !writingStudy && Boolean(message.content.trim())
            return (
            <article key={message.id} className={cn("mx-auto max-w-2xl", mine ? "flex justify-end" : "")}>
              <div
                className={cn(
                  wide ? "w-full min-w-0" : "max-w-[90%] break-words rounded-3xl px-4 py-3 text-sm leading-6",
                  mine ? "bg-accent text-accent-foreground whitespace-pre-wrap" : wide ? "" : "reading border border-line bg-card",
                )}
              >
                {message.role === "user" && message.authorName ? (
                  <p className={cn("mb-1 text-xs font-semibold", mine ? "text-accent-foreground/80" : "text-copper")}>
                    {mine ? "You" : message.authorName}
                  </p>
                ) : null}
                <Copyable enabled={canCopy} onDark={mine}>
                {message.role === "assistant" ? (
                  <>
                    {writingStudy ? (
                      <p className="flex items-center gap-2 text-sm text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {streamingStudy === "table" ? "Writing the table…" : "Writing the quiz…"}
                      </p>
                    ) : study ? (
                      <StudyOutput study={study} sources={message.sources} />
                    ) : message.content ? (
                      <MarkdownMessage
                        content={message.content}
                        sources={message.sources}
                        interactive={streamingId !== message.id && Boolean(message.sources?.length)}
                      />
                    ) : null}
                    {streamingId === message.id ? (
                      <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" aria-hidden />
                    ) : null}
                  </>
                ) : requestLine ? (
                  <>
                    <p className="mb-1 text-xs font-semibold text-accent-foreground/80">{requestLine[0]}</p>
                    {message.content.slice(requestLine[0].length).trim()}
                  </>
                ) : (
                  message.content
                )}
                </Copyable>
              </div>
            </article>
            )
          })
        )}
        {pending && !streamingId ? (
          <p className="mx-auto flex max-w-2xl items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {searchLabel}
          </p>
        ) : null}
        {error ? <p className="mx-auto max-w-2xl text-sm text-danger">{error}</p> : null}
        <div ref={endRef} />
      </div>
      <form
        className="border-t border-line bg-card/80 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          void ask(draft)
        }}
      >
        <div className="relative mx-auto max-w-2xl">
          {mention ? (
            <ul className="absolute bottom-full left-0 z-10 mb-2 max-h-64 w-full max-w-sm overflow-y-auto rounded-2xl border border-line bg-card p-1 shadow-lg">
              {mentionMatches.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">
                  {readySources.length === 0 ? "No ready sources yet." : "No matching sources."}
                </li>
              ) : (
                mentionMatches.map((source, index) => {
                  const Icon = source.type === "website" ? Globe : source.type === "text" ? NotebookPen : FileText
                  return (
                    <li key={source.id}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseSource(source)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
                          index === mentionIndex ? "bg-accent/15" : "hover:bg-accent/10",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-copper" />
                        <span className="truncate">{source.title}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          ) : null}
          <StudioBar
            output={output}
            format={reportFormat}
            difficulty={difficulty}
            amount={amount}
            disabled={pending || readyCount === 0}
            onOutput={setOutput}
            onFormat={setReportFormat}
            onDifficulty={setDifficulty}
            onAmount={setAmount}
          />
          <div className="composer-shell flex items-end gap-1 rounded-[1.75rem] border border-line bg-card p-1.5">
          <label className="sr-only" htmlFor="question">
            Question
          </label>
          <textarea
            ref={inputRef}
            id="question"
            value={draft}
            rows={2}
            disabled={pending}
            onChange={(event) => {
              setDraft(event.target.value)
              syncMention(event.target.value, event.target.selectionStart ?? event.target.value.length)
            }}
            onClick={(event) => syncMention(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
            onKeyUp={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter" || event.key === "Escape") return
              syncMention(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
            }}
            onKeyDown={(event) => {
              if (mention && mentionMatches.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault()
                setMentionIndex((current) => {
                  const last = mentionMatches.length - 1
                  if (event.key === "ArrowDown") return current >= last ? 0 : current + 1
                  return current <= 0 ? last : current - 1
                })
                return
              }
              if (mention && event.key === "Escape") {
                event.preventDefault()
                setMention(null)
                return
              }
              if (mention && mentionMatches.length > 0 && event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                chooseSource(mentionMatches[Math.min(mentionIndex, mentionMatches.length - 1)])
                return
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void ask(draft)
              }
            }}
            placeholder={studioPlaceholder(output)}
            className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-base outline-none disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-60 sm:text-sm"
          />
          <Tooltip label={pending ? "Writing the answer" : draft.trim() ? (output ? "Generate" : "Send question") : output ? "Add a prompt to generate" : "Type a question to send"}>
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-busy={pending}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center self-end rounded-full bg-ink text-on-ink transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground",
                pending ? "disabled:translate-y-0 disabled:bg-ink disabled:text-on-ink" : "disabled:translate-y-0 disabled:bg-line disabled:text-muted",
              )}
              aria-label={pending ? "Writing the answer" : "Send question"}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </Tooltip>
          </div>
        </div>
      </form>
    </div>
  )
}

function Copyable({ children, enabled, onDark }: { children: ReactNode; enabled: boolean; onDark?: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  function copy() {
    const text = bodyRef.current?.innerText.replace(/\n{3,}/g, "\n\n").trim() ?? ""
    if (!text) return
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <>
      <div ref={bodyRef}>{children}</div>
      {enabled ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy message"}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium transition",
              onDark ? "text-accent-foreground/85 hover:bg-white/15" : "text-muted hover:bg-background hover:text-foreground",
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
    </>
  )
}
