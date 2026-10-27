import { NextResponse } from "next/server"
import { clearLibraryChat, listLibraryChat, recentLibraryChat, recordLibraryChat } from "@/lib/chat-history"
import type { ChatStreamEvent } from "@/lib/chat-stream"
import { passageExcerpt } from "@/lib/format"
import { readJson, withApi } from "@/lib/http"
import { AppError, RateLimitError, UpstreamError, publicMessage } from "@/lib/errors"
import { DocumentModel } from "@/lib/models/document"
import { requireOrgAccess } from "@/lib/org-access"
import { assertGroqConfigured, completeGroqAnswer, streamGroqAnswer } from "@/lib/rag/llm"
import { buildChatMessages } from "@/lib/rag/prompt"
import { consumeChatQuota } from "@/lib/rag/quota"
import { retrieveChunks } from "@/lib/rag/retrieve"
import { resolveEmbeddingProvider, type EmbeddingProvider } from "@/lib/rag/embeddings"
import { chatSchema } from "@/lib/validators"
import type { ChatSource } from "@/types/domain"

export const maxDuration = 60

export const DELETE = withApi(async (request) => {
  const organizationId = new URL(request.url).searchParams.get("organizationId") || ""
  const { org } = await requireOrgAccess(organizationId, ["admin", "manager", "member"])
  await clearLibraryChat(org._id)
  return NextResponse.json({ ok: true })
})

export const GET = withApi(async (request) => {
  const organizationId = new URL(request.url).searchParams.get("organizationId") || ""
  const { org } = await requireOrgAccess(organizationId, ["admin", "manager", "member"])
  const messages = await listLibraryChat(org._id)
  return NextResponse.json({ messages })
})

export const POST = withApi(async (request) => {
  const input = chatSchema.parse(await readJson(request))
  const { user, org } = await requireOrgAccess(input.organizationId, ["admin", "manager", "member"])
  const readyCount = await DocumentModel.countDocuments({ organizationId: org._id, status: "ready" })

  if (readyCount === 0) {
    return streamReply(request, org._id, user, input.query, "This library doesn't have any ready sources yet. Add a file, website, or note, then ask again.", [])
  }

  const provider = (org.embeddingProvider as EmbeddingProvider | undefined) || (await resolveEmbeddingProvider())
  const chunks = await retrieveChunks({
    organizationId: org._id.toString(),
    query: input.query,
    provider,
  })

  if (chunks.length === 0) {
    return streamReply(request, org._id, user, input.query, "I couldn't find anything in this library that matches that question.", [])
  }

  const quota = consumeChatQuota(user.id)
  if (!quota.ok) {
    throw new RateLimitError("You've asked a lot in the last minute. Wait a moment and try again.")
  }

  const titles = await DocumentModel.find({ _id: { $in: chunks.map((chunk) => chunk.documentId) } })
    .select("title")
    .lean()
  const titleById = new Map(titles.map((document) => [String(document._id), document.title]))

  const sources: ChatSource[] = chunks.map((chunk) => ({
    documentId: chunk.documentId,
    title: titleById.get(chunk.documentId) || "Untitled",
    chunkIndex: chunk.chunkIndex,
    excerpt: passageExcerpt(chunk.text),
  }))

  assertGroqConfigured()
  const history = await recentLibraryChat(org._id)
  const messages = buildChatMessages({
    query: input.query,
    history,
    sources: sources.map((source, index) => ({
      index: index + 1,
      title: source.title,
      text: chunks[index]?.text ?? source.excerpt,
    })),
  })

  return chatStream(request, async (send) => {
    send({ type: "sources", sources })
    let answer = ""
    for await (const delta of streamGroqAnswer(messages, request.signal)) {
      answer += delta
      send({ type: "delta", text: delta })
    }
    if (request.signal.aborted) return
    if (!answer.trim()) {
      const recovered = (await completeGroqAnswer(messages, request.signal)).trim()
      if (request.signal.aborted) return
      if (!recovered) throw new UpstreamError("The model returned an empty answer. Try asking again.")
      answer = recovered
      send({ type: "delta", text: recovered })
    }
    await recordLibraryChat({
      organizationId: org._id,
      query: input.query,
      answer,
      sources,
      authorId: user.id,
      authorName: user.name,
    })
    send({ type: "done" })
  })
})

function streamReply(
  request: Request,
  organizationId: Parameters<typeof recordLibraryChat>[0]["organizationId"],
  user: { id: string; name: string },
  query: string,
  answer: string,
  sources: ChatSource[],
) {
  return chatStream(request, async (send) => {
    await recordLibraryChat({
      organizationId,
      query,
      answer,
      sources,
      authorId: user.id,
      authorName: user.name,
    })
    send({ type: "sources", sources })
    send({ type: "delta", text: answer })
    send({ type: "done" })
  })
}

function chatStream(request: Request, run: (send: (event: ChatStreamEvent) => void) => Promise<void>) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (event: ChatStreamEvent) => {
        if (closed || request.signal.aborted) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      try {
        await run(send)
      } catch (error) {
        if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) return
        if (!(error instanceof AppError)) console.error(error)
        send({ type: "error", error: publicMessage(error) })
      } finally {
        closed = true
        try {
          controller.close()
        } catch {
          // The client may already have closed the stream.
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
