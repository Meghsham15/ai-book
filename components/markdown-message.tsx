"use client"

import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-4 font-display text-2xl tracking-tight text-foreground first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-4 font-display text-xl tracking-tight text-foreground first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => <h4 className="mt-3 text-base font-semibold text-foreground first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mt-2 leading-6 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-accent/40 pl-3 text-muted first:mt-0">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-line" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-line first:mt-0">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-background text-muted">{children}</thead>,
  th: ({ children }) => <th className="border-b border-line px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-3 py-2 align-top">{children}</td>,
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-xl bg-sidebar px-3 py-2 text-xs leading-5 text-sidebar-foreground first:mt-0">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
