import type { ChatStreamEvent } from "@/lib/chat-stream"

type ErrorPayload = { error?: string; code?: string } | null

function messageWithCode(payload: ErrorPayload, fallback: string, fallbackCode = "") {
  const message = payload?.error || fallback
  const code = payload?.code || fallbackCode
  return code ? `${message} [${code}]` : message
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ErrorPayload
  if (response.status === 401) {
    throw new Error(messageWithCode(payload, "Sign in to continue.", "AUTH_REQUIRED"))
  }
  if (!response.ok) {
    throw new Error(messageWithCode(payload, "Something went wrong. Please try again.", "INTERNAL"))
  }
  return payload as T
}

export function getJson<T>(url: string) {
  return fetch(url).then(parseResponse<T>)
}

export function postJson<T>(url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parseResponse<T>)
}

export function patchJson<T>(url: string, body: unknown) {
  return fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parseResponse<T>)
}

export function deleteJson<T>(url: string, body?: unknown) {
  return fetch(url, {
    method: "DELETE",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(parseResponse<T>)
}

export function postForm<T>(url: string, body: FormData) {
  return fetch(url, { method: "POST", body }).then(parseResponse<T>)
}

export async function readChatStream(
  url: string,
  body: unknown,
  onEvent: (event: ChatStreamEvent) => void,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  })

  const contentType = response.headers.get("content-type") ?? ""
  if (response.status === 401 || !response.ok || contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as ErrorPayload
    if (response.status === 401) {
      throw new Error(messageWithCode(payload, "Sign in to continue.", "AUTH_REQUIRED"))
    }
    if (!response.ok) {
      throw new Error(messageWithCode(payload, "Something went wrong. Please try again.", "INTERNAL"))
    }
  }

  if (!response.body) {
    throw new Error("The answer could not be streamed. [STREAM_FAILED]")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      emitChatEvent(part, onEvent)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) emitChatEvent(buffer, onEvent)
}

function emitChatEvent(part: string, onEvent: (event: ChatStreamEvent) => void) {
  const line = part
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith("data:"))
  if (!line) return
  const payload = line.slice("data:".length).trim()
  if (!payload) return
  let event: ChatStreamEvent
  try {
    event = JSON.parse(payload) as ChatStreamEvent
  } catch {
    throw new Error("The answer could not be streamed. [STREAM_FAILED]")
  }
  if (event.type === "error") {
    const message = event.error || "The question could not be answered."
    throw new Error(event.code ? `${message} [${event.code}]` : message)
  }
  onEvent(event)
}
