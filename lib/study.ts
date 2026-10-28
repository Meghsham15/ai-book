export const studyKinds = ["report", "table", "quiz"] as const
export const reportFormats = ["summary", "briefing", "study-guide", "faq", "timeline"] as const
export const difficulties = ["easy", "medium", "hard"] as const
export const amounts = ["fewer", "standard", "more"] as const

export type StudyKind = (typeof studyKinds)[number]
export type ReportFormat = (typeof reportFormats)[number]
export type Difficulty = (typeof difficulties)[number]
export type Amount = (typeof amounts)[number]

export type StudyTask = {
  kind: StudyKind
  format: ReportFormat
  difficulty: Difficulty
  amount: Amount
}

export type QuizQuestion = {
  prompt: string
  format: "choice" | "short"
  choices: string[]
  answer: number | string
  explanation: string
  hint: string
  citation: string
}

export type StudyPack =
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "quiz"; questions: QuizQuestion[] }

const REPORT_LABEL: Record<ReportFormat, string> = {
  summary: "Summary",
  briefing: "Briefing doc",
  "study-guide": "Study guide",
  faq: "FAQ",
  timeline: "Timeline",
}

const COUNTS: Record<Amount, number> = {
  fewer: 5,
  standard: 8,
  more: 12,
}

const DIFFICULTY: Record<Difficulty, string> = {
  easy: "Stay with definitions and facts stated directly in the sources.",
  medium: "Ask the reader to explain an idea or apply it once.",
  hard: "Ask the reader to compare, notice an edge case, or connect two parts of the sources.",
}

export function studyRequestLabel(task: StudyTask) {
  if (task.kind === "report") return `Report · ${REPORT_LABEL[task.format]}`
  const amount = task.amount[0].toUpperCase() + task.amount.slice(1)
  if (task.kind === "table") return `Data table · ${amount}`
  const difficulty = task.difficulty[0].toUpperCase() + task.difficulty.slice(1)
  return `Quiz · ${difficulty} · ${amount}`
}

export function studyBrief(task: StudyTask) {
  const count = COUNTS[task.amount]
  if (task.kind === "report") return reportBrief(task.format)
  if (task.kind === "table") {
    return `Create a data table with about ${count} rows.
Read the numbered passages and take the rows from what those passages say.
Each row is a different fact, definition, formula, step, or question and its answer from the passages.
Do not put a document title, a file name, or the prompt in any cell.
The last column is named Source. Its cell is only a citation such as [1], matching the passage number.
Choose column names that fit the prompt. When the prompt asks for everything or all the answers, use Topic, Fact, and Source.
Do not repeat a row, and do not copy this example into the table.
Return one JSON object and no Markdown table, in this shape:
{"columns":["Topic","Fact","Source"],"rows":[["the topic named in the passage","the fact, formula, or answer written in that passage","[1]"]]}
Every row has one cell per column. If the passages do not contain enough, return {"columns":[],"rows":[]}.`
  }
  return `Create exactly ${count} multiple-choice questions grounded in the sources.
${DIFFICULTY[task.difficulty]}
Every question has exactly four choices and one correct answer. The answer is the index of the correct choice, starting at 0.
Put the correct choice in a different position for each question.
Do not write a data table. Do not write a short-answer question.
Each question needs an explanation and a citation such as [1].
Return one JSON object and no other text, in this shape:
{"questions":[{"prompt":"...","format":"choice","choices":["...","...","...","..."],"answer":2,"explanation":"...","hint":"","citation":"[1]"}]}
If the sources do not contain enough, return {"questions":[]}.`
}

function reportBrief(format: ReportFormat) {
  const shared = "Use Markdown. Cite the sources inline as [1], [2]. Do not invent citations, and do not create images, slides, or audio."
  if (format === "summary") return `Write a summary with short sections and bold key terms. ${shared}`
  if (format === "briefing") {
    return `Write a briefing document for a reader who has not opened the sources. Include why it matters, the main findings, and what to do next. ${shared}`
  }
  if (format === "study-guide") {
    return `Write a study guide with key terms, the ideas to understand, a few review questions, and the answers after the questions. ${shared}`
  }
  if (format === "faq") return `Write an FAQ. Make each question a heading and keep each answer to a short paragraph. ${shared}`
  return `Write a timeline. Give each entry an order or a date from the sources and one or two sentences. If the sources have no dates, number the steps and say that the sources do not date them. ${shared}`
}

export function historyText(content: string) {
  const study = parseStudy(content)
  if (study?.kind === "table") return "Generated a data table from the sources."
  if (study?.kind === "quiz") return "Generated a quiz from the sources."
  return content
}

export function packStudy(kind: "table" | "quiz", raw: string) {
  const existing = parseStudy(raw)
  if (existing?.kind === kind) return raw.startsWith(`[[study:${kind}]]`) ? raw : encodeStudy(existing)
  const parsed = kind === "table" ? toTable(extractJson(raw)) ?? markdownTable(raw) : toQuiz(extractJson(raw))
  if (!usable(parsed)) return raw.trim()
  return encodeStudy(parsed as StudyPack)
}

export function parseStudy(content: string): StudyPack | null {
  const marked = content.match(/^\[\[study:(table|quiz)\]\]\n([\s\S]+)$/)
  if (marked) {
    const value = extractJson(marked[2])
    return usable(marked[1] === "table" ? toTable(value) : toQuiz(value))
  }
  const trimmed = content.trim()
  if (trimmed.startsWith("{") || trimmed.startsWith("```")) {
    const value = extractJson(trimmed)
    const body = record(value)
    if (Array.isArray(body?.columns) || Array.isArray(body?.rows) || body?.kind === "table") return usable(toTable(value))
    if (Array.isArray(body?.questions) || body?.kind === "quiz") return usable(toQuiz(value))
  }
  return usable(markdownTable(trimmed))
}

function usable(parsed: StudyPack | null) {
  if (!parsed) return null
  if (parsed.kind === "table") return parsed.columns.length > 0 && parsed.rows.length > 0 ? parsed : null
  return parsed.questions.length > 0 ? parsed : null
}

export function answersMatch(expected: string, given: string) {
  const left = normalizeAnswer(expected)
  const right = normalizeAnswer(given)
  if (!left || !right) return false
  if (left === right) return true
  return left.length >= 4 && right.includes(left)
}

function encodeStudy(study: StudyPack) {
  return `[[study:${study.kind}]]\n${JSON.stringify(study)}`
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const slice = sliceJsonObject(fenced?.[1] ?? raw)
  if (!slice) return null
  try {
    return JSON.parse(slice) as unknown
  } catch {
    return null
  }
}

function sliceJsonObject(body: string) {
  const start = body.indexOf("{")
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let index = start; index < body.length; index += 1) {
    const char = body[index]
    if (inString) {
      if (escape) escape = false
      else if (char === "\\") escape = true
      else if (char === "\"") inString = false
      continue
    }
    if (char === "\"") {
      inString = true
      continue
    }
    if (char === "{") depth += 1
    if (char === "}") {
      depth -= 1
      if (depth === 0) return body.slice(start, index + 1)
    }
  }
  return null
}

function markdownTable(content: string): StudyPack | null {
  const lines = content.split(/\n/).map((line) => line.trim()).filter(Boolean)
  const separator = lines.findIndex((line) => (line.match(/-{3,}/g) ?? []).length >= 2 && /^[|:\-\s]+$/.test(line))
  if (separator > 0) {
    const columns = pipeCells(lines[separator - 1])
    const rows = lines.slice(separator + 1).filter((line) => line.includes("|")).flatMap((line) => {
      const row = pipeCells(line)
      if (!row.length) return []
      return [columns.map((_, index) => row[index] ?? "")]
    })
    const outside = `${lines.slice(0, Math.max(0, separator - 1)).join(" ")} ${lines.slice(separator + 1).filter((line) => !line.includes("|")).join(" ")}`.trim()
    if (columns.length >= 2 && rows.length > 0 && outside.length <= 80) return { kind: "table", columns, rows }
  }

  const match = content.match(/\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?/)
  if (!match || match.index == null) return null
  const width = (match[0].match(/-{3,}/g) ?? []).length
  if (width < 2) return null
  const header = pipeCells(content.slice(0, match.index))
  const columns = header.slice(-width)
  const body = pipeCells(content.slice(match.index + match[0].length))
  if (columns.length < 2 || columns.some((column) => !column) || body.length < width) return null
  const rows: string[][] = []
  for (let index = 0; index < body.length; index += width) {
    const row = columns.map((_, column) => body[index + column] ?? "")
    if (row.some(Boolean) && row.join(" ") !== columns.join(" ")) rows.push(row)
  }
  const prefix = header.slice(0, -width).join(" ")
  if (!rows.length || prefix.length > 80) return null
  return { kind: "table", columns, rows }
}

function pipeCells(value: string) {
  return value
    .split("|")
    .map((cell) => cell.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function toTable(value: unknown): StudyPack | null {
  const body = record(value)
  const listed = Array.isArray(body?.columns) ? body.columns : Array.isArray(body?.headers) ? body.headers : []
  const columns = listed.map((column) => clean(column)).filter(Boolean).slice(0, 8)
  const rows = Array.isArray(body?.rows) ? body.rows : []
  if (columns.length === 0) return null
  return {
    kind: "table",
    columns,
    rows: rows.slice(0, 20).flatMap((item) => {
      const cells = rowCells(item, columns)
      return cells ? [cells] : []
    }),
  }
}

function rowCells(item: unknown, columns: string[]) {
  if (Array.isArray(item)) {
    const cells = columns.map((_, index) => clean(item[index]))
    return cells.some(Boolean) ? cells : null
  }
  const row = record(item)
  if (!row) return null
  const cells = columns.map((column) => clean(row[column]))
  return cells.some(Boolean) ? cells : null
}

function toQuiz(value: unknown): StudyPack | null {
  const questions = record(value)?.questions
  if (!Array.isArray(questions)) return null
  const parsed: QuizQuestion[] = []
  for (const item of questions.slice(0, 16)) {
    const row = record(item)
    const prompt = clean(row?.prompt)
    if (!prompt) continue
    const choices = Array.isArray(row?.choices) ? row.choices.map((choice) => clean(choice)).filter(Boolean).slice(0, 4) : []
    const explanation = clean(row?.explanation)
    const hint = clean(row?.hint)
    const citation = clean(row?.citation)
    if (row?.format !== "short" && choices.length >= 2) {
      const answer = choiceIndex(row?.answer, choices)
      if (answer < 0) continue
      const placed = placeAnswer(prompt, choices, answer)
      parsed.push({ prompt, format: "choice", choices: placed.choices, answer: placed.answer, explanation, hint, citation })
      continue
    }
    const answer = clean(row?.answer)
    if (!answer) continue
    parsed.push({ prompt, format: "short", choices: [], answer, explanation, hint, citation })
  }
  return { kind: "quiz", questions: parsed }
}

function placeAnswer(prompt: string, choices: string[], answer: number) {
  const order = choices.map((_, index) => index)
  let state = hashText(`${prompt}\n${choices.join("\n")}`) || 1
  for (let index = order.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const swap = state % (index + 1)
    const current = order[index]
    order[index] = order[swap]
    order[swap] = current
  }
  return { choices: order.map((index) => choices[index]), answer: order.indexOf(answer) }
}

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function choiceIndex(value: unknown, choices: string[]) {
  if (typeof value === "number" && value >= 0 && value < choices.length) return value
  if (typeof value !== "string") return -1
  const token = value.trim()
  const letter = token.toUpperCase()
  if (/^[A-D]$/.test(letter)) {
    const index = letter.charCodeAt(0) - 65
    return index < choices.length ? index : -1
  }
  return choices.findIndex((choice) => normalizeAnswer(choice) === normalizeAnswer(token))
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function clean(value: unknown) {
  if (typeof value === "number") return String(value).slice(0, 800)
  if (typeof value !== "string") return ""
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 800)
}

function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
