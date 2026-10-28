import "server-only"

import { ChatOpenAI } from "@langchain/openai"
import type { BaseMessage } from "@langchain/core/messages"
import { ConfigError, RateLimitError, UpstreamError } from "@/lib/errors"

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
const NVIDIA_CHAT_MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b"

export function assertNvidiaConfigured() {
  const apiKey = process.env.NVIDIA_API_KEY?.trim()
  if (!apiKey || apiKey.startsWith("replace-me")) {
    throw new ConfigError("Add NVIDIA_API_KEY to .env.local before asking questions.")
  }
  return apiKey
}

function thinkingEnabled() {
  return process.env.NVIDIA_ENABLE_THINKING === "true"
}

function nvidiaModel() {
  const thinking = thinkingEnabled()
  return new ChatOpenAI({
    model: process.env.NVIDIA_CHAT_MODEL || NVIDIA_CHAT_MODEL,
    apiKey: assertNvidiaConfigured(),
    temperature: 1,
    topP: 0.95,
    maxTokens: thinking ? 16384 : 4096,
    maxRetries: 1,
    timeout: 55_000,
    useResponsesApi: false,
    configuration: {
      baseURL: process.env.NVIDIA_BASE_URL || NVIDIA_BASE_URL,
    },
    modelKwargs: {
      chat_template_kwargs: { enable_thinking: thinking },
    },
  })
}

export async function* streamNvidiaAnswer(messages: BaseMessage[], signal?: AbortSignal) {
  try {
    const stream = await nvidiaModel().stream(messages, signal ? { signal } : undefined)
    for await (const chunk of stream) {
      if (signal?.aborted) return
      const text = messageText(chunk.content)
      if (text) yield text
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) return
    throw mapNvidiaError(error)
  }
}

export async function completeNvidiaAnswer(messages: BaseMessage[], signal?: AbortSignal) {
  try {
    const result = await nvidiaModel().invoke(messages, signal ? { signal } : undefined)
    return messageText(result.content)
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) return ""
    throw mapNvidiaError(error)
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

function mapNvidiaError(error: unknown) {
  if (error instanceof ConfigError || error instanceof UpstreamError || error instanceof RateLimitError) {
    return error
  }
  const status = readStatus(error)
  console.error("NVIDIA request failed", error instanceof Error ? error.message : "unknown error")
  if (status === 429) {
    return new RateLimitError("The model is busy right now. Wait a moment and try again.")
  }
  if (status === 401 || status === 403) {
    return new ConfigError("The NVIDIA API key is invalid or expired.")
  }
  return new UpstreamError("NVIDIA could not answer right now. Check NVIDIA_API_KEY and NVIDIA_CHAT_MODEL, then try again.")
}

function readStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") {
    return error.status
  }
  return 0
}
