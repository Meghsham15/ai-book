import "server-only"

import mongoose from "mongoose"
import { AuthzError, UserInputError } from "@/lib/errors"
import { ChatTurn } from "@/lib/models/chat-turn"
import { Conversation } from "@/lib/models/conversation"
import { historyText } from "@/lib/study"
import type { ChatMessage, ChatSource } from "@/types/domain"

export type LibraryChat = {
  id: string
  title: string
  updatedAt: string
}

const VISIBLE_LIMIT = 60
const PROMPT_LIMIT = 8
const STORE_LIMIT = 60
const TRIM_OLDEST = 10

export async function listLibraryChats(organizationId: mongoose.Types.ObjectId) {
  await adoptOrphanTurns(organizationId)
  let rows = await Conversation.find({ organizationId }).sort({ updatedAt: -1 }).lean()
  if (rows.length === 0) {
    const created = await Conversation.create({ organizationId, title: "New chat" })
    rows = [created.toObject()]
  }
  return rows.map(toChat)
}

export async function createLibraryChat(organizationId: mongoose.Types.ObjectId, userId: string) {
  const chat = await Conversation.create({
    organizationId,
    title: "New chat",
    createdBy: mongoose.isValidObjectId(userId) ? userId : undefined,
  })
  return toChat(chat)
}

export async function deleteLibraryChat(organizationId: mongoose.Types.ObjectId, chatId: string) {
  const chat = await findLibraryChat(organizationId, chatId)
  await ChatTurn.deleteMany({ organizationId, chatId: chat._id })
  await chat.deleteOne()
  const next = await Conversation.findOne({ organizationId }).sort({ updatedAt: -1 })
  if (next) return toChat(next)
  return createLibraryChat(organizationId, String(chat.createdBy ?? ""))
}

export async function listLibraryChat(organizationId: mongoose.Types.ObjectId, chatId: mongoose.Types.ObjectId) {
  const rows = await ChatTurn.find({ organizationId, chatId }).sort({ createdAt: -1 }).limit(VISIBLE_LIMIT).lean()
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

export async function recentLibraryChat(organizationId: mongoose.Types.ObjectId, chatId: mongoose.Types.ObjectId) {
  const rows = await ChatTurn.find({ organizationId, chatId })
    .sort({ createdAt: -1 })
    .limit(PROMPT_LIMIT)
    .select("role content")
    .lean()
  return rows.reverse().map((row) => ({
    role: row.role as "user" | "assistant",
    content: historyText(row.content),
  }))
}

export async function clearLibraryChat(organizationId: mongoose.Types.ObjectId, chatId: mongoose.Types.ObjectId) {
  await ChatTurn.deleteMany({ organizationId, chatId })
}

export async function recordLibraryChat(input: {
  organizationId: mongoose.Types.ObjectId
  chatId: mongoose.Types.ObjectId
  query: string
  answer: string
  sources: ChatSource[]
  authorId: string
  authorName: string
}) {
  await trimOldestChats(input.organizationId, input.chatId, 2)
  await ChatTurn.insertMany([
    {
      organizationId: input.organizationId,
      chatId: input.chatId,
      role: "user",
      content: input.query,
      authorId: input.authorId,
      authorName: input.authorName.slice(0, 80),
    },
    {
      organizationId: input.organizationId,
      chatId: input.chatId,
      role: "assistant",
      content: input.answer,
      sources: input.sources,
      authorName: "AI Book",
    },
  ])
  const chat = await Conversation.findOne({ _id: input.chatId, organizationId: input.organizationId })
  if (!chat) return
  if (chat.title === "New chat") {
    const title = input.query.replace(/\s+/g, " ").trim().slice(0, 72)
    if (title) chat.title = title
  }
  chat.updatedAt = new Date()
  await chat.save()
}

async function findLibraryChat(organizationId: mongoose.Types.ObjectId, chatId: string) {
  if (!mongoose.isValidObjectId(chatId)) throw new UserInputError("Choose a chat.", "CHAT_REQUIRED")
  const chat = await Conversation.findOne({ _id: chatId, organizationId })
  if (!chat) throw new AuthzError("That chat is not in this library.", 404, "CHAT_NOT_FOUND")
  return chat
}

export async function resolveLibraryChat(organizationId: mongoose.Types.ObjectId, chatId?: string) {
  await adoptOrphanTurns(organizationId)
  if (chatId) return findLibraryChat(organizationId, chatId)
  const latest = await Conversation.findOne({ organizationId }).sort({ updatedAt: -1 })
  if (latest) return latest
  return Conversation.create({ organizationId, title: "New chat" })
}

async function adoptOrphanTurns(organizationId: mongoose.Types.ObjectId) {
  const orphan = await ChatTurn.exists({
    organizationId,
    $or: [{ chatId: { $exists: false } }, { chatId: null }],
  })
  if (!orphan) return
  let chat = await Conversation.findOne({ organizationId }).sort({ createdAt: 1 })
  if (!chat) chat = await Conversation.create({ organizationId, title: "Library chat" })
  await ChatTurn.updateMany(
    { organizationId, $or: [{ chatId: { $exists: false } }, { chatId: null }] },
    { $set: { chatId: chat._id } },
  )
}

function toChat(chat: { _id: mongoose.Types.ObjectId; title?: string | null; updatedAt?: Date; createdAt?: Date }): LibraryChat {
  const when = chat.updatedAt instanceof Date ? chat.updatedAt : chat.createdAt
  return {
    id: String(chat._id),
    title: chat.title?.trim() || "New chat",
    updatedAt: when instanceof Date ? when.toISOString() : new Date().toISOString(),
  }
}

async function trimOldestChats(organizationId: mongoose.Types.ObjectId, chatId: mongoose.Types.ObjectId, incoming: number) {
  let count = await ChatTurn.countDocuments({ organizationId, chatId })
  while (count + incoming > STORE_LIMIT) {
    const oldest = await ChatTurn.find({ organizationId, chatId })
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
