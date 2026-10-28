import { NextResponse } from "next/server"
import { clearLibraryChat, listLibraryChat, recentLibraryChat, recordLibraryChat } from "@/lib/chat-history"
import type { ChatStreamEvent } from "@/lib/chat-stream"
import { sourcePlaces, sourceQuestion } from "@/lib/format"
import { readJson, withApi } from "@/lib/http"
import { AppError, RateLimitError, UpstreamError, UserInputError, publicMessage } from "@/lib/errors"
import { DocumentModel } from "@/lib/models/document"
import { NvidiaChunk } from "@/lib/models/nvidia-chunk"
import { requireOrgAccess } from "@/lib/org-access"
import { assertNvidiaConfigured, completeNvidiaAnswer, streamNvidiaAnswer } from "@/lib/rag/llm"
import { buildChatMessages } from "@/lib/rag/prompt"
import { packStudy, studyRequestLabel, type StudyTask } from "@/lib/study"
import { consumeChatQuota } from "@/lib/rag/quota"
import { retrieveChunks, sampleDocumentChunks } from "@/lib/rag/retrieve"
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

  const provider = await resolveEmbeddingProvider()
  const storedProvider = org.embeddingProvider as EmbeddingProvider | undefined
  if (storedProvider && storedProvider !== provider && (org.usage?.chunks ?? 0) > 0) {
    return streamReply(
      request,
      org._id,
      user,
      input.query,
      "This library was indexed with a different embedding model. Remove its sources and add them again so questions can search the NVIDIA vectors.",
      [],
    )
  }
  const task: StudyTask | undefined = input.output
    ? {
        kind: input.output,
        format: input.format ?? "summary",
        difficulty: input.difficulty ?? "medium",
        amount: input.amount ?? "standard",
      }
    : undefined
  const savedQuery = task ? `${studyRequestLabel(task)}\n${input.query}` : input.query
  let question = input.query
  let scopeTitle = ""
  if (input.documentId) {
    const scoped = await DocumentModel.findOne({
      _id: input.documentId,
      organizationId: org._id,
      status: "ready",
    }).select("title")
    if (!scoped) throw new UserInputError("Choose a ready source from this library.")
    scopeTitle = scoped.title
    question = sourceQuestion(input.query, scoped.title)
    if (!question) throw new UserInputError("Add a question after the source name.")
  }

  let chunks = await retrieveChunks({
    organizationId: org._id.toString(),
    query: question,
    provider,
    documentId: input.documentId,
    limit: task?.kind === "table" ? 8 : task ? 10 : undefined,
  })
  if (task?.kind === "table" && input.documentId && broadTableQuery(question)) {
    const spread = await sampleDocumentChunks(input.documentId, 14)
    if (spread.length > 0) chunks = spread
  }

  if (chunks.length === 0) {
    const empty = input.documentId
      ? "I couldn't find anything in that source that matches that question."
      : "I couldn't find anything in this library that matches that question."
    return streamReply(request, org._id, user, savedQuery, empty, [])
  }

  const quota = consumeChatQuota(user.id)
  if (!quota.ok) {
    throw new RateLimitError("You've asked a lot in the last minute. Wait a moment and try again.")
  }

  const documentIds = [...new Set(chunks.map((chunk) => chunk.documentId))]
  const [documents, storedChunks] = await Promise.all([
    DocumentModel.find({ _id: { $in: documentIds } }).select("title type").lean(),
    NvidiaChunk.find({ documentId: { $in: documentIds } }).select("documentId chunkIndex text").lean(),
  ])
  const titleById = new Map(documents.map((document) => [String(document._id), document.title]))
  const typeById = new Map(documents.map((document) => [String(document._id), document.type]))
  const chunksByDocument = new Map<string, { chunkIndex: number; text: string }[]>()
  for (const row of storedChunks) {
    const id = String(row.documentId)
    const list = chunksByDocument.get(id) ?? []
    list.push({ chunkIndex: row.chunkIndex, text: row.text })
    chunksByDocument.set(id, list)
  }
  const placeByChunk = new Map<string, string>()
  for (const [id, list] of chunksByDocument) {
    const kind = typeById.get(id)
    const places = sourcePlaces(list, kind === "website" || kind === "text" ? kind : "file")
    for (const [chunkIndex, place] of places) placeByChunk.set(`${id}:${chunkIndex}`, place)
  }

  const sources: ChatSource[] = chunks.map((chunk) => ({
    documentId: chunk.documentId,
    title: titleById.get(chunk.documentId) || "Untitled",
    chunkIndex: chunk.chunkIndex,
    excerpt: placeByChunk.get(`${chunk.documentId}:${chunk.chunkIndex}`) || "Source",
  }))

  assertNvidiaConfigured()
  const history = task ? [] : await recentLibraryChat(org._id)
  const messages = buildChatMessages({
    query: question,
    scopeTitle: scopeTitle || undefined,
    task,
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
    for await (const delta of streamNvidiaAnswer(messages, request.signal)) {
      answer += delta
      send({ type: "delta", text: delta })
    }
    if (request.signal.aborted) return
    if (!answer.trim()) {
      const recovered = (await completeNvidiaAnswer(messages, request.signal)).trim()
      if (request.signal.aborted) return
      if (!recovered) throw new UpstreamError("The model returned an empty answer. Try asking again.")
      answer = recovered
      send({ type: "delta", text: recovered })
    }
    const stored = task && task.kind !== "report" ? packStudy(task.kind, answer) : answer
    await recordLibraryChat({
      organizationId: org._id,
      query: savedQuery,
      answer: stored,
      sources,
      authorId: user.id,
      authorName: user.name,
    })
    send({ type: "done" })
  })
})

function broadTableQuery(query: string) {
  const text = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  if (/^(all|everything|entire|whole|full|complete)\b/.test(text)) return true
  const words = text.split(" ").filter(Boolean)
  return words.length <= 4 && words.some((word) => ["answer", "answers", "data", "content", "summary", "topics", "points"].includes(word))
}

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
