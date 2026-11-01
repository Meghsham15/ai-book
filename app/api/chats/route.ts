import { NextResponse } from "next/server"
import { createLibraryChat, deleteLibraryChat, listLibraryChats } from "@/lib/chat-history"
import { UserInputError } from "@/lib/errors"
import { readJson, withApi } from "@/lib/http"
import { requireOrgAccess } from "@/lib/org-access"
import { z } from "zod"

const createChatSchema = z.object({
  organizationId: z.string().trim().min(1),
})

export const GET = withApi(async (request) => {
  const organizationId = new URL(request.url).searchParams.get("organizationId") || ""
  const { org } = await requireOrgAccess(organizationId, ["admin", "manager", "member"])
  const chats = await listLibraryChats(org._id)
  return NextResponse.json({ chats })
})

export const POST = withApi(async (request) => {
  const input = createChatSchema.parse(await readJson(request))
  const { user, org } = await requireOrgAccess(input.organizationId, ["admin", "manager", "member"])
  const chat = await createLibraryChat(org._id, user.id)
  return NextResponse.json(chat, { status: 201 })
})

export const DELETE = withApi(async (request) => {
  const url = new URL(request.url)
  const organizationId = url.searchParams.get("organizationId") || ""
  const chatId = url.searchParams.get("chatId") || ""
  if (!chatId) throw new UserInputError("Choose a chat.", "CHAT_REQUIRED")
  const { org } = await requireOrgAccess(organizationId, ["admin", "manager", "member"])
  const chat = await deleteLibraryChat(org._id, chatId)
  return NextResponse.json({ ok: true, chat })
})
