import { NextResponse } from "next/server"
import { readJson, withApi } from "@/lib/http"
import { inviteToOrganization } from "@/lib/invitations"
import { removeOrganizationMember, updateMemberRole } from "@/lib/orgs"
import { requireOrgAccess } from "@/lib/org-access"
import { UserInputError } from "@/lib/errors"
import { memberSchema, roleUpdateSchema } from "@/lib/validators"

type Context = { params: Promise<{ orgId: string }> }

export const POST = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { user, org } = await requireOrgAccess(orgId, ["admin"])
  const input = memberSchema.parse(await readJson(request))
  const result = await inviteToOrganization({
    orgId: org._id,
    orgName: org.name,
    invitedBy: user.id,
    email: input.email,
    role: input.role,
  })
  return NextResponse.json(result, { status: 201 })
})

export const PATCH = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { org } = await requireOrgAccess(orgId, ["admin"])
  const input = roleUpdateSchema.parse(await readJson(request))
  await updateMemberRole(org._id, input.userId, input.role)
  return NextResponse.json({ ok: true })
})

export const DELETE = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { org } = await requireOrgAccess(orgId, ["admin"])
  const userId = new URL(request.url).searchParams.get("userId")
  if (!userId) throw new UserInputError("Choose a member to remove.")
  await removeOrganizationMember(org._id, userId)
  return NextResponse.json({ ok: true })
})
