"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Globe, NotebookPen, RefreshCw, Send, Settings, Trash2 } from "lucide-react"
import { OrgSwitcher } from "@/components/org-switcher"
import { TopBar } from "@/components/top-bar"
import { deleteJson, getJson, postForm, postJson } from "@/lib/client-api"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ChatMessage, DocumentItem, DocumentType, LibraryOption, OrgDetails, SessionUser } from "@/types/domain"

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
    <div className="flex h-dvh flex-col">
      <TopBar user={user}>
        <OrgSwitcher libraries={libraries} current={org.slug} />
        <Link
          href={`/org/${org.slug}/settings`}
          className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-foreground/5 hover:text-foreground"
          aria-label="Library settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </TopBar>
      <div className="flex gap-2 border-b border-line px-4 py-2 lg:hidden">
        <PanelButton active={panel === "chat"} onClick={() => setPanel("chat")}>
          Ask
        </PanelButton>
        <PanelButton active={panel === "sources"} onClick={() => setPanel("sources")}>
          Sources
        </PanelButton>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className={cn("min-h-0 flex-col bg-sidebar text-sidebar-foreground", panel === "sources" ? "flex" : "hidden", "lg:flex")}>
          <SourceColumn org={org} sources={sourceItems} canWrite={canWrite} sourceError={sourceError} />
        </section>
        <section className={cn("min-h-0 flex-col", panel === "chat" ? "flex" : "hidden", "lg:flex")}>
          <ChatPanel
            organizationId={org.id}
            libraryName={org.name}
            currentUserId={user.id}
            currentUserName={user.name}
            reloadToken={reloadToken}
            refreshing={refreshing}
            onRefresh={() => void refreshLibrary()}
          />
        </section>
      </div>
    </div>
  )
}

function PanelButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">Library</p>
        <h1 className="mt-1.5 truncate font-display text-3xl leading-none tracking-tight">{org.name}</h1>
      </div>
      {canWrite ? <SourceComposer organizationId={org.id} /> : null}
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {sourceError ? <li className="px-2 py-2 text-xs leading-5 text-orange-200">{sourceError}</li> : null}
        {sources.length === 0 ? (
          <li className="px-2 py-8 text-sm leading-6 text-sidebar-foreground/65">
            Nothing is in this library yet. Add a file, a public page, or a note.
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The source could not be added.")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-b border-white/10 px-4 py-4">
      <div className="grid grid-cols-3 gap-1 rounded-full bg-white/8 p-1">
        {(
          [
            ["file", "File"],
            ["website", "Site"],
            ["text", "Note"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "rounded-full px-2 py-1.5 text-xs font-semibold",
              mode === value ? "bg-white text-ink" : "text-sidebar-foreground/70",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "file" ? (
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf"
          className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink"
        />
      ) : null}
      {mode === "website" ? (
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          type="url"
          placeholder="https://example.com/guide"
          className="w-full rounded-2xl border border-white/10 bg-white px-3 py-2 text-sm text-ink outline-none"
        />
      ) : null}
      {mode !== "file" ? (
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required={mode === "text"}
          placeholder={mode === "text" ? "Note title" : "Title (optional)"}
          className="w-full rounded-2xl border border-white/10 bg-white px-3 py-2 text-sm text-ink outline-none"
        />
      ) : null}
      {mode === "text" ? (
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          rows={4}
          placeholder="Paste a FAQ, policy, or note."
          className="w-full resize-none rounded-2xl border border-white/10 bg-white px-3 py-2 text-sm text-ink outline-none"
        />
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-full bg-copper text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
      >
        {pending ? "Indexing…" : "Add to library"}
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

  return (
    <li className="rounded-2xl bg-white/6 px-3 py-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-foreground/70" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{source.title}</p>
          <p className="mt-1 text-xs text-sidebar-foreground/55">
            {source.status === "ready" ? `${source.chunkCount} chunks` : source.status} · {formatDate(source.createdAt)}
          </p>
          {source.errorMessage ? <p className="mt-1 text-xs leading-5 text-orange-200">{source.errorMessage}</p> : null}
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
              {pending ? "Removing…" : "Confirm remove"}
            </button>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="text-sidebar-foreground/55" aria-label={`Remove ${source.title}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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
    <div className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-sidebar-foreground/65">
      <p>
        {used}/{cap} sources · {org.usage.chunks}/{org.limits.maxChunks} chunks
      </p>
      <p className="mt-1">Search: {org.embeddingProvider === "pending" ? "chosen on first source" : org.embeddingProvider}</p>
    </div>
  )
}

function ChatPanel({
  organizationId,
  libraryName,
  currentUserId,
  currentUserName,
  reloadToken,
  refreshing,
  onRefresh,
}: {
  organizationId: string
  libraryName: string
  currentUserId: string
  currentUserName: string
  reloadToken: number
  refreshing: boolean
  onRefresh: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, pending])

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

  async function ask(text: string) {
    const query = text.trim()
    if (!query || pending) return
    setDraft("")
    setError("")
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      authorId: currentUserId,
      authorName: currentUserName,
    }
    setMessages((current) => [...current, userMessage])
    setPending(true)
    try {
      const result = await postJson<{ answer: string; sources: ChatMessage["sources"] }>("/api/chat", {
        query,
        organizationId,
      })
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: result.answer, sources: result.sources, authorName: "AI Book" },
      ])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The question could not be answered.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8">
        <p className="text-sm text-muted">Shared with this library · newest 60 messages</p>
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
              className="inline-flex h-9 items-center rounded-full bg-danger px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {clearing ? "Clearing…" : "Confirm clear"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={pending || refreshing || messages.length === 0}
              className="inline-flex h-9 items-center rounded-full border border-line bg-card px-3 text-sm font-medium transition hover:border-danger disabled:opacity-50"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending || refreshing || clearing}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-card px-3 text-sm font-medium transition hover:border-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-8 sm:px-8">
        {!loaded && messages.length === 0 ? (
          <p className="mx-auto max-w-2xl text-sm text-muted">Loading chat…</p>
        ) : null}
        {loaded && messages.length === 0 ? (
          <div className="mx-auto max-w-2xl pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">Ask</p>
            <h2 className="mt-3 font-display text-5xl tracking-tight">What do you want to know about {libraryName}?</h2>
            <div className="mt-8 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void ask(suggestion)}
                  className="rounded-full border border-line bg-card px-4 py-2 text-sm transition hover:border-accent"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.role === "user" && message.authorId === currentUserId
            return (
            <article key={message.id} className={cn("mx-auto max-w-2xl", mine ? "flex justify-end" : "")}>
              <div
                className={cn(
                  "max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap",
                  mine ? "bg-accent text-accent-foreground" : "border border-line bg-card",
                )}
              >
                {message.role === "user" && message.authorName ? (
                  <p className={cn("mb-1 text-xs font-semibold", mine ? "text-accent-foreground/80" : "text-copper")}>
                    {mine ? "You" : message.authorName}
                  </p>
                ) : null}
                {message.content}
                {message.sources && message.sources.length > 0 ? (
                  <ul className="mt-3 space-y-2 border-t border-line pt-3">
                    {message.sources.map((source, index) => (
                      <li key={`${message.id}-${source.documentId}-${source.chunkIndex}`} className={cn("text-xs leading-5", mine ? "text-accent-foreground/80" : "text-muted")}>
                        <span className={cn("font-semibold", mine ? "text-accent-foreground" : "text-foreground")}>[{index + 1}] {source.title}</span>
                        <span className="mt-0.5 block">{source.excerpt}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
            )
          })
        )}
        {pending ? <p className="mx-auto max-w-2xl text-sm text-muted">Looking through the library…</p> : null}
        {error ? <p className="mx-auto max-w-2xl text-sm text-danger">{error}</p> : null}
        <div ref={endRef} />
      </div>
      <form
        className="border-t border-line bg-card/80 px-4 py-4 sm:px-8"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          void ask(draft)
        }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <label className="sr-only" htmlFor="question">
            Question
          </label>
          <textarea
            id="question"
            value={draft}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void ask(draft)
              }
            }}
            placeholder="Ask a question about this library"
            className="min-h-12 flex-1 resize-none rounded-3xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40"
            aria-label="Send question"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
