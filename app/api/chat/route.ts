import { NextResponse } from "next/server"
import { clearLibraryChat, listLibraryChat, recentLibraryChat, recordLibraryChat } from "@/lib/chat-history"
import { readJson, withApi } from "@/lib/http"
import { DocumentModel } from "@/lib/models/document"
import { requireOrgAccess } from "@/lib/org-access"
import { RateLimitError } from "@/lib/errors"
import { answerWithGroq } from "@/lib/rag/llm"
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
    return reply(org._id, user, input.query, "This library doesn't have any ready sources yet. Add a file, website, or note, then ask again.", [])
  }

  const provider = (org.embeddingProvider as EmbeddingProvider | undefined) || (await resolveEmbeddingProvider())
  const chunks = await retrieveChunks({
    organizationId: org._id.toString(),
    query: input.query,
    provider,
  })

  if (chunks.length === 0) {
    return reply(org._id, user, input.query, "I couldn't find anything in this library that matches that question.", [])
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
    excerpt: chunk.text.replace(/\s+/g, " ").slice(0, 220),
  }))

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

  const answer = await answerWithGroq(messages)
  return reply(org._id, user, input.query, answer, sources)
})

async function reply(
  organizationId: Parameters<typeof recordLibraryChat>[0]["organizationId"],
  user: { id: string; name: string },
  query: string,
  answer: string,
  sources: ChatSource[],
) {
  await recordLibraryChat({
    organizationId,
    query,
    answer,
    sources,
    authorId: user.id,
    authorName: user.name,
  })
  return NextResponse.json({ answer, sources })
}
