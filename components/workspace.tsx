"use client"

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, ChevronUp, Copy, FileText, Globe, Loader2, Menu, MessageSquare, NotebookPen, PanelRight, Plus, RefreshCw, Send, Settings, Trash2, X } from "lucide-react"
import { AddSourceDialog } from "@/components/add-source-dialog"
import { MarkdownMessage } from "@/components/markdown-message"
import { StudioBar, studioPlaceholder } from "@/components/studio-bar"
import { StudyOutput } from "@/components/study-output"
import { OrgSwitcher } from "@/components/org-switcher"
import { Tooltip } from "@/components/tooltip"
import { TopBar } from "@/components/top-bar"
import { deleteJson, getJson, postJson, readChatStream } from "@/lib/client-api"
import { formatDate, sourceQuestion } from "@/lib/format"
import { packStudy, parseStudy, studyRequestLabel, type Amount, type Difficulty, type ReportFormat, type StudyKind } from "@/lib/study"
import { cn } from "@/lib/utils"
import type { ChatMessage, ChatSource, DocumentItem, LibraryOption, OrgDetails, SessionUser } from "@/types/domain"

const suggestions = [
  "Summarize what this library knows",
  "What are the main topics?",
  "Which points still look incomplete?",
]

type LibraryChatItem = {
  id: string
  title: string
  updatedAt: string
}

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
  const [panel, setPanel] = useState<"library" | "chat">("chat")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sourcesOpen, setSourcesOpen] = useState(true)
  const [chatsOpen, setChatsOpen] = useState(true)
  const [sourceItems, setSourceItems] = useState(sources)
  const [chats, setChats] = useState<LibraryChatItem[]>([])
  const [activeChatId, setActiveChatId] = useState("")
  const [chatsError, setChatsError] = useState("")
  const [creatingChat, setCreatingChat] = useState(false)
  const [asking, setAsking] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [sourceError, setSourceError] = useState("")
  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null

  useEffect(() => {
    const sidebar = localStorage.getItem("ai-book-sidebar")
    const sourcesPanel = localStorage.getItem("ai-book-sources-open")
    const chatsPanel = localStorage.getItem("ai-book-chats-open")
    if (sidebar === "hidden") setSidebarOpen(false)
    if (sourcesPanel === "closed") setSourcesOpen(false)
    if (chatsPanel === "closed") setChatsOpen(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    setChatsError("")
    void getJson<{ chats: LibraryChatItem[] }>(`/api/chats?organizationId=${encodeURIComponent(org.id)}`)
      .then((result) => {
        if (cancelled) return
        setChats(result.chats)
        setActiveChatId((current) => (current && result.chats.some((chat) => chat.id === current) ? current : result.chats[0]?.id ?? ""))
      })
      .catch((caught) => {
        if (!cancelled) setChatsError(caught instanceof Error ? caught.message : "Chats could not be loaded.")
      })
    return () => {
      cancelled = true
    }
  }, [org.id])

  function rememberSidebar(open: boolean) {
    setSidebarOpen(open)
    localStorage.setItem("ai-book-sidebar", open ? "open" : "hidden")
    setPanel(open ? "library" : "chat")
  }

  function rememberSources(open: boolean) {
    setSourcesOpen(open)
    localStorage.setItem("ai-book-sources-open", open ? "open" : "closed")
  }

  function rememberChats(open: boolean) {
    setChatsOpen(open)
    localStorage.setItem("ai-book-chats-open", open ? "open" : "closed")
  }

  async function createChat() {
    if (creatingChat || asking) return
    setChatsOpen(true)
    localStorage.setItem("ai-book-chats-open", "open")
    setCreatingChat(true)
    setChatsError("")
    try {
      const chat = await postJson<LibraryChatItem>("/api/chats", { organizationId: org.id })
      setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)])
      setActiveChatId(chat.id)
      setPanel("chat")
    } catch (caught) {
      setChatsError(caught instanceof Error ? caught.message : "The chat could not be created.")
    } finally {
      setCreatingChat(false)
    }
  }

  async function removeChat(chatId: string) {
    setChatsError("")
    const result = await deleteJson<{ chat: LibraryChatItem }>(
      `/api/chats?organizationId=${encodeURIComponent(org.id)}&chatId=${encodeURIComponent(chatId)}`,
    )
    setChats((current) => {
      const next = current.filter((chat) => chat.id !== chatId)
      return next.some((chat) => chat.id === result.chat.id) ? next : [result.chat, ...next]
    })
    setActiveChatId(result.chat.id)
  }

  function refreshChats() {
    void getJson<{ chats: LibraryChatItem[] }>(`/api/chats?organizationId=${encodeURIComponent(org.id)}`)
      .then((result) => {
        setChats(result.chats)
        setActiveChatId((current) => (current && result.chats.some((chat) => chat.id === current) ? current : result.chats[0]?.id ?? ""))
      })
      .catch(() => undefined)
  }

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
      <div className="flex gap-2 px-3 py-2 lg:hidden">
        <PanelButton active={panel === "chat"} onClick={() => setPanel("chat")}>
          Ask
        </PanelButton>
        <PanelButton
          active={panel === "library"}
          onClick={() => {
            setSidebarOpen(true)
            setPanel("library")
          }}
        >
          Library
        </PanelButton>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 lg:gap-3 lg:p-3">
        <section
          className={cn(
            "min-h-0 w-full min-w-0 flex-col overflow-hidden bg-card text-foreground lg:w-[320px] lg:shrink-0 lg:rounded-3xl lg:border lg:border-line",
            sidebarOpen && panel === "library" ? "flex" : "hidden",
            sidebarOpen ? "lg:flex" : "lg:hidden",
          )}
        >
          <LibrarySidebar
            org={org}
            sources={sourceItems}
            canWrite={canWrite}
            sourceError={sourceError}
            sourcesOpen={sourcesOpen}
            chatsOpen={chatsOpen}
            chats={chats}
            activeChatId={activeChatId}
            chatsError={chatsError}
            creatingChat={creatingChat}
            asking={asking}
            onHide={() => rememberSidebar(false)}
            onSources={rememberSources}
            onChats={rememberChats}
            onSelectChat={(chatId) => {
              if (asking) return
              setActiveChatId(chatId)
              setPanel("chat")
            }}
            onCreateChat={() => void createChat()}
            onRemoveChat={(chatId) => void removeChat(chatId).catch((caught) => {
              setChatsError(caught instanceof Error ? caught.message : "The chat could not be removed.")
            })}
          />
        </section>
        <section className={cn("min-h-0 min-w-0 flex-1", panel === "chat" ? "flex" : "hidden", "lg:flex")}>
          <ChatPanel
            organizationId={org.id}
            libraryName={org.name}
            chatId={activeChatId}
            chatTitle={activeChat?.title || "New chat"}
            sidebarOpen={sidebarOpen}
            onShowSidebar={() => rememberSidebar(true)}
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
            onPending={setAsking}
            onActivity={refreshChats}
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
        active ? "bg-ink text-on-ink" : "text-muted hover:bg-foreground/5",
      )}
    >
      {children}
    </button>
  )
}

function LibrarySidebar({
  org,
  sources,
  canWrite,
  sourceError,
  sourcesOpen,
  chatsOpen,
  chats,
  activeChatId,
  chatsError,
  creatingChat,
  asking,
  onHide,
  onSources,
  onChats,
  onSelectChat,
  onCreateChat,
  onRemoveChat,
}: {
  org: OrgDetails
  sources: DocumentItem[]
  canWrite: boolean
  sourceError: string
  sourcesOpen: boolean
  chatsOpen: boolean
  chats: LibraryChatItem[]
  activeChatId: string
  chatsError: string
  creatingChat: boolean
  asking: boolean
  onHide: () => void
  onSources: (open: boolean) => void
  onChats: (open: boolean) => void
  onSelectChat: (chatId: string) => void
  onCreateChat: () => void
  onRemoveChat: (chatId: string) => void
}) {
  const ready = sources.filter((source) => source.status === "ready").length
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <Tooltip label={org.name} className="max-w-full">
            <h1 className="truncate text-lg font-medium leading-tight tracking-tight">{org.name}</h1>
          </Tooltip>
          <p className="mt-1 text-xs text-muted">{ready} ready to answer</p>
        </div>
        <button
          type="button"
          onClick={onHide}
          aria-label="Close sidebar"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <SlideSection title="Sources" count={sources.length} open={sourcesOpen} onToggle={() => onSources(!sourcesOpen)}>
        <div className="px-4 pb-3 sm:px-5">
          {canWrite ? <AddSourceButton organizationId={org.id} /> : null}
        </div>
        <ul className="space-y-2 px-3 pb-3">
          {sourceError ? <li className="px-2 py-2 text-xs leading-5 text-danger">{sourceError}</li> : null}
          {sources.length === 0 ? (
            <li className="mx-1 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
              <p className="text-base font-medium">No sources yet</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {canWrite
                  ? "Add a file, a shared file link, a public page, or a note. A new chat answers from sources after they say Ready."
                  : "An admin or manager adds sources. You can ask once one says Ready."}
              </p>
            </li>
          ) : (
            sources.map((source) => <SourceRow key={source.id} source={source} canWrite={canWrite} />)
          )}
        </ul>
      </SlideSection>
      <SlideSection
        title="Chats"
        count={chats.length}
        open={chatsOpen}
        onToggle={() => onChats(!chatsOpen)}
        action={
          <button
            type="button"
            onClick={onCreateChat}
            disabled={creatingChat || asking}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-ink px-3 text-xs font-semibold text-on-ink disabled:opacity-60"
          >
            {creatingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            New chat
          </button>
        }
      >
        <p className="px-4 pb-2 text-xs leading-5 text-muted sm:px-5">
          Each chat answers from the sources in this library.
        </p>
        <ul className="space-y-1 px-3 pb-3">
          {chatsError ? <li className="px-2 py-2 text-xs leading-5 text-danger">{chatsError}</li> : null}
          {chats.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted">No chats yet.</li>
          ) : (
            chats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                disabled={asking}
                onSelect={() => onSelectChat(chat.id)}
                onRemove={() => onRemoveChat(chat.id)}
              />
            ))
          )}
        </ul>
      </SlideSection>
      <UsageFooter org={org} />
    </div>
  )
}

function SlideSection({
  title,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={cn("flex min-h-0 flex-col border-t border-line", open && "flex-1")}>
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-full px-2 py-1.5 text-left hover:bg-foreground/5"
        >
          <span className="truncate text-sm font-medium">
            {title}
            <span className="ml-2 text-xs font-medium text-muted">{count}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted">
            {open ? "Hide" : "Show"}
            {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
          </span>
        </button>
        {action}
      </div>
      <div className={cn("grid min-h-0 transition-[grid-template-rows] duration-300 ease-out", open ? "flex-1 grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className={cn("overflow-y-auto", open && "h-full max-h-full")}>{children}</div>
        </div>
      </div>
    </section>
  )
}

function ChatRow({
  chat,
  active,
  disabled,
  onSelect,
  onRemove,
}: {
  chat: LibraryChatItem
  active: boolean
  disabled: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <li className={cn("flex min-w-0 items-center gap-1 rounded-xl px-2 py-1.5", active ? "bg-wash" : "hover:bg-foreground/5")}>
      <button type="button" onClick={onSelect} disabled={disabled} className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-left disabled:opacity-60">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm">{chat.title}</span>
      </button>
      {confirming ? (
        <button type="button" onClick={onRemove} className="shrink-0 text-xs font-semibold text-danger">
          Remove
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={disabled}
          aria-label={`Remove ${chat.title}`}
          className="shrink-0 text-muted disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}

function AddSourceButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-full items-center justify-center rounded-full bg-ink px-4 text-sm font-medium text-on-ink hover:bg-accent hover:text-accent-foreground"
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        Add source
      </button>
      {open ? <AddSourceDialog organizationId={organizationId} onClose={() => setOpen(false)} /> : null}
    </>
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
      ? { label: "Ready", detail: `${source.chunkCount} ${source.chunkCount === 1 ? "chunk" : "chunks"}`, tone: "bg-ready/10 text-ready" }
      : source.status === "processing"
        ? { label: "Indexing", detail: "Still reading this source", tone: "bg-copper/10 text-copper" }
        : { label: "Failed", detail: "Could not be indexed", tone: "bg-danger/10 text-danger" }

  return (
    <li className="min-w-0 overflow-hidden rounded-2xl px-3 py-2.5 hover:bg-foreground/5">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
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
          <p className="mt-1 text-xs text-muted">
            {kind}, {status.detail}, {formatDate(source.createdAt)}
          </p>
          {source.status === "failed" && source.errorMessage ? (
            <p className="mt-1 text-xs leading-5 text-danger">{source.errorMessage}</p>
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
              className="text-xs font-semibold text-danger"
            >
              {pending ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />Removing…</> : "Confirm remove"}
            </button>
          ) : (
            <Tooltip label={`Remove ${source.title}`}>
              <button type="button" onClick={() => setConfirming(true)} className="text-muted hover:text-foreground" aria-label={`Remove ${source.title}`}>
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
    <div className="shrink-0 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs leading-5 break-words text-muted sm:px-5">
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
    <div className="px-2 py-6">
      <h2 className="text-2xl font-medium tracking-tight">{title}</h2>
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
  chatId,
  chatTitle,
  sidebarOpen,
  onShowSidebar,
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
  onPending,
  onActivity,
}: {
  organizationId: string
  libraryName: string
  chatId: string
  chatTitle: string
  sidebarOpen: boolean
  onShowSidebar: () => void
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
  onPending: (pending: boolean) => void
  onActivity: () => void
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
  const [railOpen, setRailOpen] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const readySources = sources.filter((source) => source.status === "ready")
  const mentionMatches = mention
    ? readySources
        .filter((source) => source.title.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 8)
    : []

  useEffect(() => {
    if (localStorage.getItem("ai-book-studio") === "closed") setRailOpen(false)
  }, [])

  function setRail(open: boolean) {
    setRailOpen(open)
    localStorage.setItem("ai-book-studio", open ? "open" : "closed")
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: streamingId ? "auto" : "smooth" })
  }, [messages, pending, streamingId])

  useEffect(() => {
    if (!chatId) {
      setLoaded(true)
      setMessages([])
      return
    }
    let cancelled = false
    setLoaded(false)
    setMessages([])
    setError("")
    setConfirmClear(false)
    void getJson<{ messages: ChatMessage[] }>(
      `/api/chat?organizationId=${encodeURIComponent(organizationId)}&chatId=${encodeURIComponent(chatId)}`,
    )
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
  }, [organizationId, chatId])

  useEffect(() => {
    if (reloadToken === 0 || !chatId) return
    let cancelled = false
    setError("")
    void getJson<{ messages: ChatMessage[] }>(
      `/api/chat?organizationId=${encodeURIComponent(organizationId)}&chatId=${encodeURIComponent(chatId)}`,
    )
      .then((result) => {
        if (!cancelled) setMessages(result.messages)
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The chat could not be refreshed.")
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, chatId, reloadToken])

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
    if (!chatId || !query || pending) {
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
    onPending(true)
    let assistantId = ""
    let replySources: ChatSource[] | undefined
    try {
      await readChatStream(
        "/api/chat",
        {
          query: shown,
          organizationId,
          chatId,
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
        if (event.type === "done") onActivity()
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
      onPending(false)
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 lg:gap-3">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card lg:rounded-3xl lg:border lg:border-line">
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onShowSidebar}
            aria-label="Open sidebar"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-foreground hover:border-accent",
              sidebarOpen && "lg:hidden",
            )}
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Open studio"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/5 xl:hidden"
          >
            <PanelRight className="h-4 w-4" aria-hidden />
          </button>
          {railOpen ? null : (
            <button
              type="button"
              onClick={() => setRail(true)}
              aria-label="Open studio"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/5 xl:inline-flex"
            >
              <PanelRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          <div className="min-w-0">
            <Tooltip label={chatTitle} className="max-w-full">
              <p className="truncate text-base font-medium">{chatTitle}</p>
            </Tooltip>
            <p className="hidden text-xs text-muted sm:block">Answers from the sources in {libraryName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {confirmClear ? (
            <button
              type="button"
              disabled={pending || clearing}
              onClick={() => {
                setClearing(true)
                setError("")
                void deleteJson(`/api/chat?organizationId=${encodeURIComponent(organizationId)}&chatId=${encodeURIComponent(chatId)}`)
                  .then(() => {
                    setMessages([])
                    setConfirmClear(false)
                    onActivity()
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
            <Tooltip label="Clears this chat">
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={pending || refreshing || messages.length === 0}
                className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-muted hover:bg-foreground/5 disabled:opacity-40"
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
              className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted hover:bg-foreground/5 disabled:opacity-40"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sr-only sm:hidden">Refresh</span>
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 py-6 sm:px-8">
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
              <div className="pt-10 sm:pt-16">
                <h2 className="max-w-[18ch] text-3xl font-medium tracking-tight sm:text-4xl">What do you want to know?</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted">
                  {readyCount} {readyCount === 1 ? "source is" : "sources are"} ready in {libraryName}. Answers stay inside that material.
                </p>
                <div className="mt-8 flex flex-col items-start gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void ask(suggestion)}
                      className="rounded-full bg-foreground/5 px-4 py-2 text-left text-sm hover:bg-wash"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.role === "user" && message.authorId === currentUserId
            const fromUser = message.role === "user"
            const study = message.role === "assistant" ? parseStudy(message.content) : null
            const writingStudy = message.id === streamingId && streamingStudy !== ""
            const wide = Boolean(study)
            const requestLine = mine ? message.content.match(/^(Report|Data table|Quiz) · [^\n]+/) : null
            const canCopy = streamingId !== message.id && !study && !writingStudy && Boolean(message.content.trim())
            return (
            <article key={message.id} className={cn("mx-auto max-w-2xl", mine ? "flex justify-end" : "")}>
              <div
                className={cn(
                  wide ? "w-full min-w-0" : "max-w-[min(100%,36rem)] break-words px-4 py-3 text-sm leading-6",
                  fromUser ? "rounded-3xl bg-foreground/6 whitespace-pre-wrap" : wide ? "" : "reading",
                )}
              >
                {message.role === "user" && message.authorName ? (
                  <p className={cn("mb-1 text-xs font-medium", mine ? "text-muted" : "text-accent")}>
                    {mine ? "You" : message.authorName}
                  </p>
                ) : null}
                <Copyable enabled={canCopy}>
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
                    <p className="mb-1 text-xs font-medium text-muted">{requestLine[0]}</p>
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
        className="px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4"
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
                        <Icon className="h-4 w-4 shrink-0 text-accent" />
                        <span className="truncate">{source.title}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          ) : null}
          <div className="composer-shell flex items-end gap-1 rounded-[1.75rem] border border-line p-1.5">
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
                "grid h-11 w-11 shrink-0 place-items-center self-end rounded-full bg-ink text-on-ink hover:bg-accent hover:text-accent-foreground",
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
      {sheetOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-card xl:hidden">
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
            onClose={() => setSheetOpen(false)}
          />
        </div>
      ) : null}
      </div>
      {railOpen ? (
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden bg-card xl:flex xl:rounded-3xl xl:border xl:border-line">
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
            onClose={() => setRail(false)}
          />
        </aside>
      ) : null}
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
