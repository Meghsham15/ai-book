import "server-only"

import mongoose from "mongoose"
import { ChatTurn } from "@/lib/models/chat-turn"
import { historyText } from "@/lib/study"
import type { ChatMessage, ChatSource } from "@/types/domain"

const VISIBLE_LIMIT = 60
const PROMPT_LIMIT = 8
const STORE_LIMIT = 60
const TRIM_OLDEST = 10

export async function listLibraryChat(organizationId: mongoose.Types.ObjectId) {
  const rows = await ChatTurn.find({ organizationId }).sort({ createdAt: -1 }).limit(VISIBLE_LIMIT).lean()
  return rows.reverse().map((row) =>
    toMessage({
      _id: row._id,
      role: row.role,
      content: row.content,
      sources: row.sources?.map((source) => ({
        documentId: source.documentId,
        title: source.title,
        chunkIndex: source.chunkIndex,
        excerpt: source.excerpt,
      })),
      authorId: row.authorId,
      authorName: row.authorName,
      createdAt: row.createdAt,
    }),
  )
}

export async function recentLibraryChat(organizationId: mongoose.Types.ObjectId) {
  const rows = await ChatTurn.find({ organizationId })
    .sort({ createdAt: -1 })
    .limit(PROMPT_LIMIT)
    .select("role content")
    .lean()
  return rows.reverse().map((row) => ({
    role: row.role as "user" | "assistant",
    content: historyText(row.content),
  }))
}

export async function clearLibraryChat(organizationId: mongoose.Types.ObjectId) {
  await ChatTurn.deleteMany({ organizationId })
}

export async function recordLibraryChat(input: {
  organizationId: mongoose.Types.ObjectId
  query: string
  answer: string
  sources: ChatSource[]
  authorId: string
  authorName: string
}) {
  await trimOldestChats(input.organizationId, 2)
  await ChatTurn.insertMany([
    {
      organizationId: input.organizationId,
      role: "user",
      content: input.query,
      authorId: input.authorId,
      authorName: input.authorName.slice(0, 80),
    },
    {
      organizationId: input.organizationId,
      role: "assistant",
      content: input.answer,
      sources: input.sources,
      authorName: "AI Book",
    },
  ])
}

async function trimOldestChats(organizationId: mongoose.Types.ObjectId, incoming: number) {
  let count = await ChatTurn.countDocuments({ organizationId })
  while (count + incoming > STORE_LIMIT) {
    const oldest = await ChatTurn.find({ organizationId })
      .sort({ createdAt: 1, _id: 1 })
      .limit(TRIM_OLDEST)
      .select("_id")
      .lean()
    if (oldest.length === 0) return
    await ChatTurn.deleteMany({ _id: { $in: oldest.map((row) => row._id) } })
    count -= oldest.length
  }
}

function toMessage(row: {
  _id: mongoose.Types.ObjectId
  role: string
  content: string
  sources?: ChatSource[] | null
  authorId?: mongoose.Types.ObjectId | null
  authorName?: string | null
  createdAt?: Date
}): ChatMessage {
  return {
    id: String(row._id),
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    sources: row.sources?.length ? row.sources : undefined,
    authorId: row.authorId ? String(row.authorId) : undefined,
    authorName: row.authorName || undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : undefined,
  }
}
