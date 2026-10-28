import "server-only"

import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { studyBrief, type StudyTask } from "@/lib/study"

const SYSTEM_PROMPT = `You are AI Book, a research assistant for one shared library.
Answer only from the numbered sources.
If the sources do not contain the answer, say you cannot find it in this library.
Cite sources inline as [1], [2]. Never invent a citation, and do not paste source passages into the answer.
Write the answer in Markdown: a short heading when it helps, **bold** for names, lists for steps, and a Markdown table when comparing rows.
Write formulas as LaTeX, using $...$ for a symbol in a sentence and $$...$$ for an equation on its own line. Do not wrap a formula in backticks or a code fence.
When a circuit diagram helps, draw it in one fenced code block using only spaces and the characters - | + [ ] so the wires stay in columns. Do not use TikZ, HTML, or an image for the diagram.
Do not write HTML tags. When several items belong in one table cell, put each item on its own line with a Markdown line break, not an HTML tag.
Write in clear, concise prose.`

const TABLE_PROMPT = `You extract one data table from the numbered passages.
Every cell except the citation must be a fact written in a passage.
Never fill a cell with a document title or a file name.
Do not add outside knowledge, images, slides, or audio.
If the passages do not contain enough, return {"columns":[],"rows":[]}.
Return one JSON object and no other text.`

const QUIZ_PROMPT = `You write a multiple-choice quiz for one shared library.
Every question has exactly four options and one correct answer.
Use only the numbered sources. Do not add outside knowledge, images, slides, or audio.
If the sources do not contain enough, return {"questions":[]}.
Return one JSON object and no other text.`

export function buildChatMessages(input: {
  query: string
  history: { role: "user" | "assistant"; content: string }[]
  sources: { index: number; title: string; text: string }[]
  scopeTitle?: string
  task?: StudyTask
}) {
  let budget = input.task?.kind === "table" ? 18_000 : 12_000
  const blocks: string[] = []

  for (const source of input.sources) {
    if (budget < 200) break
    const text = source.text.slice(0, Math.min(source.text.length, budget))
    budget -= text.length
    blocks.push(input.task?.kind === "table" ? `[${source.index}]\n${text}` : `[${source.index}] ${source.title}\n${text}`)
  }

  const history = input.history.slice(-8).map((item) => {
    const content = item.content.slice(0, 2000)
    return item.role === "user" ? new HumanMessage(content) : new AIMessage(content)
  })

  const request = input.task
    ? `${studyBrief(input.task)}\n\nPrompt: ${input.query}`
    : `Question: ${input.query}`

  return [
    new SystemMessage(
      input.task?.kind === "table" ? TABLE_PROMPT : input.task?.kind === "quiz" ? QUIZ_PROMPT : SYSTEM_PROMPT,
    ),
    ...history,
    new HumanMessage(
      `Sources:\n${blocks.join("\n\n") || "No sources."}\n\n${
        input.scopeTitle
          ? input.task?.kind === "table"
            ? `These passages are the only source. Do not write the title "${input.scopeTitle}" in the table.\n`
            : `Use only "${input.scopeTitle}".\n`
          : ""
      }${request}`,
    ),
  ]
}
