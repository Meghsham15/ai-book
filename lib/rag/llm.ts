import "server-only"

import { ChatOpenAI } from "@langchain/openai"
import type { BaseMessage } from "@langchain/core/messages"
import { ConfigError, RateLimitError, UpstreamError } from "@/lib/errors"

const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const GROQ_CHAT_MODEL = "openai/gpt-oss-20b"

export function assertGroqConfigured() {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey || apiKey.startsWith("replace-me")) {
    throw new ConfigError("Add GROQ_API_KEY to .env.local before asking questions.")
  }
  return apiKey
}

function groqModel() {
  return new ChatOpenAI({
    model: process.env.GROQ_CHAT_MODEL || GROQ_CHAT_MODEL,
    apiKey: assertGroqConfigured(),
    temperature: 0.1,
    maxRetries: 1,
    timeout: 60_000,
    useResponsesApi: false,
    configuration: {
      baseURL: process.env.GROQ_BASE_URL || GROQ_BASE_URL,
    },
  })
}

export async function* streamGroqAnswer(messages: BaseMessage[], signal?: AbortSignal) {
  try {
    const stream = await groqModel().stream(messages, signal ? { signal } : undefined)
    for await (const chunk of stream) {
      if (signal?.aborted) return
      const text = messageText(chunk.content)
      if (text) yield text
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) return
    throw mapGroqError(error)
  }
}

export async function completeGroqAnswer(messages: BaseMessage[], signal?: AbortSignal) {
  try {
    const result = await groqModel().invoke(messages, signal ? { signal } : undefined)
    return messageText(result.content)
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) return ""
    throw mapGroqError(error)
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

function mapGroqError(error: unknown) {
  if (error instanceof ConfigError || error instanceof UpstreamError || error instanceof RateLimitError) {
    return error
  }
  const status = readStatus(error)
  console.error("Groq request failed", error instanceof Error ? error.message : "unknown error")
  if (status === 429) {
    return new RateLimitError("The model is busy right now. Wait a moment and try again.")
  }
  if (status === 401 || status === 403) {
    return new ConfigError("The Groq API key is invalid or expired.")
  }
  return new UpstreamError("Groq could not answer right now. Check GROQ_API_KEY and GROQ_CHAT_MODEL, then try again.")
}

function readStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") {
    return error.status
  }
  return 0
}
