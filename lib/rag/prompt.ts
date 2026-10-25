import "server-only"

import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"

const SYSTEM_PROMPT = `You are AI Book, a research assistant for one shared library.
Answer only from the numbered sources.
If the sources do not contain the answer, say you cannot find it in this library.
Cite sources inline as [1], [2]. Never invent a citation.
Write in clear, concise prose.`

export function buildChatMessages(input: {
  query: string
  history: { role: "user" | "assistant"; content: string }[]
  sources: { index: number; title: string; text: string }[]
}) {
  let budget = 12_000
  const blocks: string[] = []

  for (const source of input.sources) {
    if (budget < 200) break
    const text = source.text.slice(0, Math.min(source.text.length, budget))
    budget -= text.length
    blocks.push(`[${source.index}] ${source.title}\n${text}`)
  }

  const history = input.history.slice(-8).map((item) => {
    const content = item.content.slice(0, 2000)
    return item.role === "user" ? new HumanMessage(content) : new AIMessage(content)
  })

  return [
    new SystemMessage(SYSTEM_PROMPT),
    ...history,
    new HumanMessage(`Sources:\n${blocks.join("\n\n") || "No sources."}\n\nQuestion: ${input.query}`),
  ]
}
