import { NextResponse } from "next/server"
import { readJson, withApi } from "@/lib/http"
import { requireOrgAccess } from "@/lib/org-access"
import { requestOwnershipTransfer } from "@/lib/invitations"
import { transferSchema } from "@/lib/validators"

type Context = { params: Promise<{ orgId: string }> }

export const POST = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { user, org } = await requireOrgAccess(orgId, ["admin"])
  const input = transferSchema.parse(await readJson(request))
  const result = await requestOwnershipTransfer({
    orgId: org._id,
    orgName: org.name,
    invitedBy: user.id,
    email: input.email,
  })
  return NextResponse.json(result)
})
