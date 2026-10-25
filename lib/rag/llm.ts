import "server-only"

import { ChatOpenAI } from "@langchain/openai"
import type { BaseMessage } from "@langchain/core/messages"
import { ConfigError, RateLimitError, UpstreamError } from "@/lib/errors"

const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const GROQ_CHAT_MODEL = "openai/gpt-oss-20b"

export async function answerWithGroq(messages: BaseMessage[]) {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey || apiKey.startsWith("replace-me")) {
    throw new ConfigError("Add GROQ_API_KEY to .env.local before asking questions.")
  }

  const model = new ChatOpenAI({
    model: process.env.GROQ_CHAT_MODEL || GROQ_CHAT_MODEL,
    apiKey,
    temperature: 0.1,
    maxRetries: 1,
    timeout: 45_000,
    useResponsesApi: false,
    configuration: {
      baseURL: process.env.GROQ_BASE_URL || GROQ_BASE_URL,
    },
  })

  try {
    const result = await model.invoke(messages)
    const text = messageText(result.content).trim()
    if (!text) throw new UpstreamError("The model returned an empty answer. Try asking again.")
    return text
  } catch (error) {
    if (error instanceof ConfigError || error instanceof UpstreamError || error instanceof RateLimitError) {
      throw error
    }
    const status = readStatus(error)
    console.error("Groq request failed", error instanceof Error ? error.message : "unknown error")
    if (status === 429) {
      throw new RateLimitError("The model is busy right now. Wait a moment and try again.")
    }
    if (status === 401 || status === 403) {
      throw new ConfigError("The Groq API key is invalid or expired.")
    }
    throw new UpstreamError("Groq could not answer right now. Check GROQ_API_KEY and GROQ_CHAT_MODEL, then try again.")
  }
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (typeof part === "string") return part
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text
      return ""
    })
    .join("")
}

function readStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") {
    return error.status
  }
  return 0
}
