"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronUp, ListChecks, NotebookText, Table2 } from "lucide-react"
import { amounts, difficulties, reportFormats, type Amount, type Difficulty, type ReportFormat, type StudyKind } from "@/lib/study"
import { cn } from "@/lib/utils"

const reportLabels: Record<ReportFormat, string> = {
  summary: "Summary",
  briefing: "Briefing doc",
  "study-guide": "Study guide",
  faq: "FAQ",
  timeline: "Timeline",
}

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
}) {
  const [open, setOpen] = useState(true)
  const selected = output === "report" ? "Reports" : output === "table" ? "Data table" : output === "quiz" ? "Quiz" : ""

  return (
    <div className="mb-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-display text-lg leading-none">Studio</p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-xs font-medium transition hover:border-accent hover:text-accent"
        >
          {open ? "Hide" : "Show"}
          {!open && selected ? <span className="text-muted">{selected}</span> : null}
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      {open ? (
        <>
      <div className="flex flex-wrap gap-1.5 sm:gap-2" role="radiogroup" aria-label="Studio output">
        <StudioChoice
          label="Reports"
          icon={<NotebookText className="h-4 w-4" />}
          pressed={output === "report"}
          disabled={disabled}
          onClick={() => onOutput(output === "report" ? null : "report")}
        />
        <StudioChoice
          label="Data table"
          icon={<Table2 className="h-4 w-4" />}
          pressed={output === "table"}
          disabled={disabled}
          onClick={() => onOutput(output === "table" ? null : "table")}
        />
        <StudioChoice
          label="Quiz"
          icon={<ListChecks className="h-4 w-4" />}
          pressed={output === "quiz"}
          disabled={disabled}
          onClick={() => onOutput(output === "quiz" ? null : "quiz")}
        />
      </div>
      {output === "report" ? (
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Report type">
          {reportFormats.map((item) => (
            <Chip key={item} pressed={format === item} disabled={disabled} onClick={() => onFormat(item)}>
              {reportLabels[item]}
            </Chip>
          ))}
        </div>
      ) : null}
      {output === "table" || output === "quiz" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {output === "quiz" ? (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Difficulty">
              {difficulties.map((item) => (
                <Chip key={item} pressed={difficulty === item} disabled={disabled} onClick={() => onDifficulty(item)}>
                  {item[0].toUpperCase() + item.slice(1)}
                </Chip>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={output === "table" ? "Rows" : "Length"}>
            {amounts.map((item) => (
              <Chip key={item} pressed={amount === item} disabled={disabled} onClick={() => onAmount(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
        </>
      ) : null}
    </div>
  )
}

export function studioPlaceholder(output: StudyKind | null) {
  if (output === "report") return "Describe the report you want"
  if (output === "table") return "Describe the table you want"
  if (output === "quiz") return "Describe the quiz you want"
  return "Ask a question, or type @ to search one source"
}

function StudioChoice({
  label,
  icon,
  pressed,
  disabled,
  onClick,
}: {
  label: string
  icon: ReactNode
  pressed: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium transition disabled:opacity-50 sm:h-9",
        pressed ? "border-ink bg-ink text-on-ink" : "border-line bg-card hover:border-accent sm:hover:-translate-y-0.5",
      )}
    >
      {icon}
      {label}
    </button>
  )
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
        "inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium transition disabled:opacity-50 sm:h-8",
        pressed ? "border-accent bg-accent/15 text-foreground" : "border-line bg-card hover:border-accent sm:hover:-translate-y-0.5",
      )}
    >
      {children}
    </button>
  )
}
