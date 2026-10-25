import { NextResponse } from "next/server"
import { readJson, withApi } from "@/lib/http"
import { acceptInvitation } from "@/lib/invitations"
import { connectDB } from "@/lib/db"
import { requireApiUser } from "@/lib/session"
import { invitationTokenSchema } from "@/lib/validators"

export const POST = withApi(async (request) => {
  const user = await requireApiUser()
  const input = invitationTokenSchema.parse(await readJson(request))
  await connectDB()
  const result = await acceptInvitation(input.token, user)
  return NextResponse.json(result)
})
