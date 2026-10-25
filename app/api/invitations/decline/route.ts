import { NextResponse } from "next/server"
import { readJson, withApi } from "@/lib/http"
import { declineInvitation } from "@/lib/invitations"
import { connectDB } from "@/lib/db"
import { requireApiUser } from "@/lib/session"
import { invitationTokenSchema } from "@/lib/validators"

export const POST = withApi(async (request) => {
  const user = await requireApiUser()
  const input = invitationTokenSchema.parse(await readJson(request))
  await connectDB()
  await declineInvitation(input.token, user)
  return NextResponse.json({ ok: true })
})