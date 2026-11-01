"use client"

import type { ReactNode } from "react"
import { ListChecks, NotebookText, Table2, X } from "lucide-react"
import { amounts, difficulties, reportFormats, type Amount, type Difficulty, type ReportFormat, type StudyKind } from "@/lib/study"
import { cn } from "@/lib/utils"

const reportLabels: Record<ReportFormat, string> = {
  summary: "Summary",
  briefing: "Briefing",
  "study-guide": "Study guide",
  faq: "FAQ",
  timeline: "Timeline",
}

const tools: {
  kind: StudyKind
  label: string
  detail: string
  icon: ReactNode
  tint: string
}[] = [
  {
    kind: "report",
    label: "Reports",
    detail: "Summary, briefing, study guide",
    icon: <NotebookText className="h-5 w-5" />,
    tint: "bg-[#e8f0fe] text-[#0b57d0] dark:bg-[#1b2a41] dark:text-[#a8c7fa]",
  },
  {
    kind: "table",
    label: "Data table",
    detail: "Rows pulled from the sources",
    icon: <Table2 className="h-5 w-5" />,
    tint: "bg-[#e6f4ea] text-[#137333] dark:bg-[#1a2e22] dark:text-[#81c995]",
  },
  {
    kind: "quiz",
    label: "Quiz",
    detail: "Questions about the material",
    icon: <ListChecks className="h-5 w-5" />,
    tint: "bg-[#f3e8fd] text-[#7b1fa2] dark:bg-[#2d2236] dark:text-[#e0b4f5]",
  },
]

export function StudioBar({
  output,
  format,
  difficulty,
  amount,
  disabled,
  onOutput,
  onFormat,
  onDifficulty,
  onAmount,
  onClose,
}: {
  output: StudyKind | null
  format: ReportFormat
  difficulty: Difficulty
  amount: Amount
  disabled: boolean
  onOutput: (output: StudyKind | null) => void
  onFormat: (format: ReportFormat) => void
  onDifficulty: (difficulty: Difficulty) => void
  onAmount: (amount: Amount) => void
  onClose?: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <h2 className="text-base font-medium">Studio</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close studio"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        <div className="grid gap-2" role="radiogroup" aria-label="Studio output">
          {tools.map((tool) => {
            const pressed = output === tool.kind
            return (
              <button
                key={tool.kind}
                type="button"
                role="radio"
                aria-checked={pressed}
                disabled={disabled}
                onClick={() => onOutput(pressed ? null : tool.kind)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left disabled:opacity-50",
                  pressed ? "border-accent bg-wash" : "border-line bg-card hover:bg-foreground/5",
                )}
              >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tool.tint)}>{tool.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{tool.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">{tool.detail}</span>
                </span>
              </button>
            )
          })}
        </div>
        {output === "report" ? (
          <div className="flex flex-wrap gap-1.5 pt-1" role="radiogroup" aria-label="Report type">
            {reportFormats.map((item) => (
              <Chip key={item} pressed={format === item} disabled={disabled} onClick={() => onFormat(item)}>
                {reportLabels[item]}
              </Chip>
            ))}
          </div>
        ) : null}
        {output === "table" || output === "quiz" ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {output === "quiz" ? (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Difficulty">
                {difficulties.map((item) => (
                  <Chip key={item} pressed={difficulty === item} disabled={disabled} onClick={() => onDifficulty(item)}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </Chip>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={output === "table" ? "Rows" : "Length"}>
              {amounts.map((item) => (
                <Chip key={item} pressed={amount === item} disabled={disabled} onClick={() => onAmount(item)}>
                  {item[0].toUpperCase() + item.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
        <p className="px-1 pt-2 text-xs leading-5 text-muted">
          {output ? "Add a prompt in the chat box, then send." : "Choose a tool, then describe what you want in the chat."}
        </p>
      </div>
    </div>
  )
}

export function studioPlaceholder(output: StudyKind | null) {
  if (output === "report") return "Describe the report you want"
  if (output === "table") return "Describe the table you want"
  if (output === "quiz") return "Describe the quiz you want"
  return "Ask about the sources in this library"
}

function Chip({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed: boolean
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium disabled:opacity-50",
        pressed ? "bg-ink text-on-ink" : "bg-foreground/5 text-foreground hover:bg-foreground/10",
      )}
    >
      {children}
    </button>
  )
}
