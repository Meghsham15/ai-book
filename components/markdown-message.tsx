"use client"

import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from "react"
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

function markdownComponents(onCitation?: (index: number) => void, sources?: ChatSource[], activeCitation?: number | null): Components {
  const cited = (children: ReactNode) => renderCitations(children, onCitation, sources, activeCitation)
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
      {children}
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

export function MarkdownMessage({
  content,
  sources,
  activeCitation,
  onCitation,
}: {
  content: string
  sources?: ChatSource[]
  activeCitation?: number | null
  onCitation?: (index: number) => void
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeSanitize, [rehypeKatex, { strict: "ignore" }]]}
      components={markdownComponents(onCitation, sources, activeCitation)}
    >
      {content}
    </ReactMarkdown>
  )
}

function blockCode(className: string | undefined, children: ReactNode) {
  if (className?.includes("language-")) return true
  return Children.toArray(children).some((child) => typeof child === "string" && child.includes("\n"))
}

function renderCitations(
  children: ReactNode,
  onCitation?: (index: number) => void,
  sources?: ChatSource[],
  activeCitation?: number | null,
): ReactNode {
  return Children.map(children, (child, childIndex) => {
    if (typeof child === "string") return splitCitationText(child, onCitation, sources, activeCitation, childIndex)
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children != null) {
      return cloneElement(child, { children: renderCitations(child.props.children, onCitation, sources, activeCitation) })
    }
    return child
  })
}

function splitCitationText(
  text: string,
  onCitation: ((index: number) => void) | undefined,
  sources: ChatSource[] | undefined,
  activeCitation: number | null | undefined,
  childIndex: number,
) {
  const parts = text.split(/(\[\d+\])/g)
  if (parts.length === 1) return text
  return parts.map((part, index) => {
    const match = /^\[(\d+)\]$/.exec(part)
    if (!match) return part
    const citation = Number(match[1])
    if (!onCitation) return part
    return (
      <CitationMark
        key={`${childIndex}-${index}`}
        citation={citation}
        source={sources?.[citation - 1]}
        active={activeCitation === citation}
        onClick={() => onCitation(citation)}
      />
    )
  })
}

function CitationMark({
  citation,
  source,
  active,
  onClick,
}: {
  citation: number
  source?: ChatSource
  active: boolean
  onClick: () => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [hover, setHover] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const open = hover || active
  const place = citationDetail(source?.excerpt ?? "")

  useEffect(() => {
    if (!open) return
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const above = rect.top > 180
      setBox({
        top: above ? rect.top - 8 : rect.bottom + 8,
        left: Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140),
        above,
      })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className={`mx-0.5 inline-flex h-5 items-center justify-center border px-1 align-baseline text-[11px] font-semibold leading-none transition hover:-translate-y-px ${
          active ? "border-copper bg-copper text-white dark:text-[#1a0d0b]" : "border-copper/40 bg-copper/10 text-copper"
        }`}
        aria-expanded={open}
        aria-label={source ? `Source ${citation}, ${source.title}` : `Source ${citation}`}
      >
        [{citation}]
      </button>
      {open && source && box
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-30 w-64 border border-line bg-card px-3 py-2 text-left shadow-[0_16px_40px_-24px_rgba(23,32,51,0.45)]"
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
