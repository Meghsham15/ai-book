"use client"

import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import "katex/dist/katex.min.css"
import { citationDetail } from "@/lib/format"
import type { ChatSource } from "@/types/domain"

function markdownComponents(interactive: boolean, sources: ChatSource[] | undefined, nextMarkId: () => string): Components {
  const cited = (children: ReactNode) => renderCitations(children, interactive, sources, nextMarkId)
  return {
  h1: ({ children }) => (
    <h2 className="mt-4 font-display text-2xl tracking-tight text-foreground first:mt-0">{cited(children)}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-4 font-display text-xl tracking-tight text-foreground first:mt-0">{cited(children)}</h3>
  ),
  h3: ({ children }) => <h4 className="mt-3 text-base font-semibold text-foreground first:mt-0">{cited(children)}</h4>,
  p: ({ children }) => <p className="mt-2 leading-6 first:mt-0">{cited(children)}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{cited(children)}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-accent/40 pl-3 text-muted first:mt-0">{cited(children)}</blockquote>
  ),
  hr: () => <hr className="my-3 border-line" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-line first:mt-0">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-background text-muted">{children}</thead>,
  th: ({ children }) => <th className="border-b border-line px-3 py-2 text-left font-semibold">{cited(children)}</th>,
  td: ({ children }) => <td className="border-b border-line px-3 py-2 align-top">{cited(children)}</td>,
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto whitespace-pre rounded-xl border border-line bg-card px-4 py-3 font-mono text-sm leading-5 text-foreground first:mt-0">
      {cited(children)}
    </pre>
  ),
  code: ({ className, children }) =>
    blockCode(className, children) ? (
      <code className={`whitespace-pre font-mono text-foreground ${className ?? ""}`}>{children}</code>
    ) : (
      <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
    ),
  }
}

const CitationTips = createContext<{
  pinnedId: string | null
  toggle: (id: string) => void
}>({ pinnedId: null, toggle: () => {} })

export function MarkdownMessage({
  content,
  sources,
  interactive = false,
}: {
  content: string
  sources?: ChatSource[]
  interactive?: boolean
}) {
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const markSeq = useRef(0)
  const nextMarkId = useCallback(() => {
    markSeq.current += 1
    return `citation-${markSeq.current}`
  }, [])
  markSeq.current = 0
  const components = useMemo(
    () => markdownComponents(interactive, sources, nextMarkId),
    [interactive, sources, nextMarkId],
  )
  const toggle = useCallback((id: string) => {
    setPinnedId((current) => (current === id ? null : id))
  }, [])

  useEffect(() => {
    if (!pinnedId) return
    function down(event: PointerEvent) {
      const target = event.target
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null
      if (element?.closest("[data-citation-mark]")) return
      setPinnedId(null)
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setPinnedId(null)
    }
    document.addEventListener("pointerdown", down)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("pointerdown", down)
      document.removeEventListener("keydown", key)
    }
  }, [pinnedId])

  return (
    <CitationTips.Provider value={{ pinnedId, toggle }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, [rehypeKatex, { strict: "ignore" }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </CitationTips.Provider>
  )
}

function blockCode(className: string | undefined, children: ReactNode) {
  if (className?.includes("language-")) return true
  return Children.toArray(children).some((child) => typeof child === "string" && child.includes("\n"))
}

function renderCitations(children: ReactNode, interactive: boolean, sources: ChatSource[] | undefined, nextMarkId: () => string): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return splitCitationText(child, interactive, sources, nextMarkId)
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children != null) {
      return cloneElement(child, { children: renderCitations(child.props.children, interactive, sources, nextMarkId) })
    }
    return child
  })
}

function splitCitationText(text: string, interactive: boolean, sources: ChatSource[] | undefined, nextMarkId: () => string) {
  const parts = text.split(/(\[\d+\])/g)
  if (parts.length === 1) return text
  return parts.map((part) => {
    const match = /^\[(\d+)\]$/.exec(part)
    if (!match) return part
    const citation = Number(match[1])
    const source = sources?.[citation - 1]
    if (!interactive || !source) return part
    const markId = nextMarkId()
    return <CitationMark key={markId} markId={markId} citation={citation} source={source} />
  })
}

function keepScroll(node: HTMLElement) {
  const scroller = scrollParent(node)
  const top = scroller?.scrollTop ?? 0
  const page = window.scrollY
  const restore = () => {
    if (scroller && Math.abs(scroller.scrollTop - top) > 1) scroller.scrollTop = top
    if (Math.abs(window.scrollY - page) > 1) window.scrollTo(0, page)
  }
  requestAnimationFrame(restore)
  window.setTimeout(restore, 0)
  window.setTimeout(restore, 320)
}

function scrollParent(node: HTMLElement) {
  let current = node.parentElement
  while (current) {
    const style = getComputedStyle(current)
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1) return current
    current = current.parentElement
  }
  return null
}

function CitationMark({ markId, citation, source }: { markId: string; citation: number; source: ChatSource }) {
  const tips = useContext(CitationTips)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const pinned = tips.pinnedId === markId
  const open = tips.pinnedId ? pinned : hover || focus
  const place = citationDetail(source.excerpt ?? "")

  useEffect(() => {
    if (!open) return
    function position() {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const above = rect.top > 180
      const half = 128
      const margin = 12
      setBox({
        top: above ? rect.top - 8 : rect.bottom + 8,
        left: Math.min(Math.max(rect.left + rect.width / 2, half + margin), window.innerWidth - half - margin),
        above,
      })
    }
    position()
    window.addEventListener("scroll", position, true)
    window.addEventListener("resize", position)
    return () => {
      window.removeEventListener("scroll", position, true)
      window.removeEventListener("resize", position)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-citation-mark=""
        onPointerDown={(event) => {
          keepScroll(event.currentTarget)
          if (event.pointerType !== "mouse") event.preventDefault()
        }}
        onClick={() => tips.toggle(markId)}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return
          if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
          setHover(true)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHover(false)
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setFocus(true)
        }}
        onBlur={() => setFocus(false)}
        className={`mx-0.5 inline-flex h-5 touch-manipulation items-center justify-center border px-1 align-baseline text-[11px] font-semibold leading-none transition [@media(hover:hover)]:hover:-translate-y-px ${
          open ? "border-copper bg-copper text-white dark:text-[#1a0d0b]" : "border-copper/40 bg-copper/10 text-copper"
        }`}
        aria-expanded={open}
        aria-label={`Source ${citation}, ${source.title}${place ? `, ${place}` : ""}`}
      >
        [{citation}]
      </button>
      {open && box
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-30 w-64 max-w-[calc(100vw-1.5rem)] border border-line bg-card px-3 py-2 text-left shadow-[0_16px_40px_-24px_rgba(23,32,51,0.45)]"
              style={{ top: box.top, left: box.left, transform: `translate(-50%, ${box.above ? "-100%" : "0"})` }}
            >
              <span className="block truncate text-xs font-semibold text-foreground">{source.title}</span>
              {place ? <span className="mt-1 block text-xs leading-5 text-muted">{place}</span> : null}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}
