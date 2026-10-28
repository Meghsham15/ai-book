"use client"

import { useState } from "react"
import { answersMatch, type QuizQuestion, type StudyPack } from "@/lib/study"
import { cn } from "@/lib/utils"
import type { ChatSource } from "@/types/domain"

export function StudyOutput({ study, sources }: { study: StudyPack; sources?: ChatSource[] }) {
  if (study.kind === "table") return <DataTable columns={study.columns} rows={study.rows} sources={sources} />
  return <Quiz questions={study.questions} sources={sources} />
}

function DataTable({ columns, rows, sources }: { columns: string[]; rows: string[][]; sources?: ChatSource[] }) {
  const titles = (sources ?? []).map((source) => source.title.toLowerCase())
  const kept = rows.filter((row) => !rowRepeatsTitle(row, titles))
  if (columns.length === 0 || kept.length === 0) {
    return <p className="text-sm text-muted">The passages did not include facts for that table. Name a topic from the source, such as the definitions or the formulas.</p>
  }
  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-card">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead className="bg-background text-muted">
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} className="border-b border-line px-3 py-2 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kept.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => (
                <td key={`${rowIndex}-${columnIndex}`} className="border-b border-line px-3 py-2 align-top leading-6">
                  <CellValue text={row[columnIndex] ?? ""} sources={sources} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function rowRepeatsTitle(row: string[], titles: string[]) {
  const facts = row.slice(0, -1).map((cell) => cell.trim()).filter(Boolean)
  if (facts.length === 0) return true
  return facts.every((cell) => {
    const value = cell.toLowerCase()
    return titles.some((title) => value === title || (value.length >= 4 && (title.includes(value) || value.includes(title))))
  })
}

function CellValue({ text, sources }: { text: string; sources?: ChatSource[] }) {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <>
      {parts.map((part, index) => {
        const number = part.match(/^\[(\d+)\]$/)
        if (!number) return <span key={index}>{part}</span>
        const source = sources?.[Number(number[1]) - 1]
        return (
          <span key={index} className="text-muted">
            {source ? `${source.title}${source.excerpt ? ` · ${source.excerpt}` : ""}` : part}
          </span>
        )
      })}
    </>
  )
}

function Quiz({ questions, sources }: { questions: QuizQuestion[]; sources?: ChatSource[] }) {
  const [choices, setChoices] = useState<Record<number, number>>({})
  const [written, setWritten] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  if (questions.length === 0) {
    return <p className="text-sm text-muted">The sources did not contain enough for a quiz on that prompt.</p>
  }

  const answered = questions.filter((question, index) => isAnswered(question, choices[index], checked[index]))
  const correctCount = questions.filter((question, index) =>
    isAnswered(question, choices[index], checked[index]) && isCorrect(question, choices[index], written[index] ?? ""),
  ).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="font-display text-2xl leading-none">Quiz</p>
        <p className="text-sm text-muted">
          {correctCount} correct · {answered.length} of {questions.length}
        </p>
      </div>
      {questions.map((question, index) => {
        const picked = choices[index]
        const revealed = question.format === "choice" ? picked !== undefined : Boolean(checked[index])
        const right = revealed && isCorrect(question, picked, written[index] ?? "")
        const answerText = question.format === "choice" ? question.choices[Number(question.answer)] : String(question.answer)
        return (
          <div key={index} className="rounded-3xl border border-line bg-card px-3 py-4 sm:px-5 sm:py-5">
            <p className="break-words text-base leading-7">
              {index + 1}. {question.prompt}
            </p>
            {question.format === "choice" ? (
              <div className="mt-4 space-y-2">
                {question.choices.map((choice, choiceIndex) => {
                  const selected = picked === choiceIndex
                  const showCorrect = revealed && choiceIndex === question.answer
                  const showWrong = revealed && selected && choiceIndex !== question.answer
                  return (
                    <button
                      key={`${choiceIndex}-${choice}`}
                      type="button"
                      disabled={revealed}
                      onClick={() => setChoices((current) => ({ ...current, [index]: choiceIndex }))}
                      className={cn(
                        "flex w-full break-words rounded-2xl border px-3 py-2.5 text-left text-sm leading-6 transition disabled:cursor-default",
                        showCorrect && "border-ready bg-ready/10",
                        showWrong && "border-danger bg-danger/10",
                        !showCorrect && !showWrong && "border-line hover:border-accent sm:hover:-translate-y-0.5",
                      )}
                    >
                      {choice}
                    </button>
                  )
                })}
              </div>
            ) : (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  if ((written[index] ?? "").trim()) setChecked((current) => ({ ...current, [index]: true }))
                }}
              >
                <input
                  value={written[index] ?? ""}
                  disabled={revealed}
                  onChange={(event) => setWritten((current) => ({ ...current, [index]: event.target.value }))}
                  placeholder="Your answer"
                  className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-background px-3 text-sm outline-none transition focus:border-accent disabled:opacity-70"
                />
                <button type="submit" disabled={revealed || !(written[index] ?? "").trim()} className="h-11 rounded-full bg-ink px-4 text-sm font-medium text-on-ink transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground disabled:translate-y-0 disabled:opacity-40">
                  Check
                </button>
              </form>
            )}
            {revealed ? (
              <div className="mt-3">
                <p className={cn("text-sm font-semibold", right ? "text-ready" : "text-danger")}>{right ? "Correct" : "Wrong"}</p>
                {right ? null : <p className="mt-1 text-sm leading-6">Answer: {answerText}</p>}
                {question.explanation ? <p className="mt-1 text-sm leading-6 text-muted">{question.explanation}</p> : null}
                <SourceNote citation={question.citation} sources={sources} />
              </div>
            ) : null}
          </div>
        )
      })}
      {answered.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            setChoices({})
            setWritten({})
            setChecked({})
          }}
          className="inline-flex h-9 items-center rounded-full border border-line px-3 text-sm font-medium"
        >
          Retake
        </button>
      ) : null}
    </div>
  )
}

function isCorrect(question: QuizQuestion, choice: number | undefined, written: string) {
  if (question.format === "choice") return choice === question.answer
  return typeof question.answer === "string" && answersMatch(question.answer, written)
}

function isAnswered(question: QuizQuestion, choice: number | undefined, checked: boolean | undefined) {
  return question.format === "choice" ? choice !== undefined : Boolean(checked)
}

function SourceNote({ citation, sources }: { citation: string; sources?: ChatSource[] }) {
  const number = Number(citation.match(/\[(\d+)\]/)?.[1] ?? "")
  const source = sources?.[number - 1]
  if (!source && !citation) return null
  return (
    <p className="mt-3 text-xs text-muted">
      {source ? `${source.title}${source.excerpt ? ` · ${source.excerpt}` : ""}` : citation}
    </p>
  )
}
