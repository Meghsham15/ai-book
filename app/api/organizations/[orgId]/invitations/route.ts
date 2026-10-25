import { NextResponse } from "next/server"
import { withApi } from "@/lib/http"
import { revokeInvitation } from "@/lib/invitations"
import { requireOrgAccess } from "@/lib/org-access"
import { UserInputError } from "@/lib/errors"

type Context = { params: Promise<{ orgId: string }> }

export const DELETE = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { org } = await requireOrgAccess(orgId, ["admin"])
  const invitationId = new URL(request.url).searchParams.get("id")
  if (!invitationId) throw new UserInputError("Choose an invitation to cancel.")
  await revokeInvitation(org._id, invitationId)
  return NextResponse.json({ ok: true })
})
