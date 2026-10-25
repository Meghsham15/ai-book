import { NextResponse } from "next/server"
import { readJson, withApi } from "@/lib/http"
import { requireOrgAccess } from "@/lib/org-access"
import { transferOrganization } from "@/lib/orgs"
import { transferSchema } from "@/lib/validators"

type Context = { params: Promise<{ orgId: string }> }

export const POST = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { user, org } = await requireOrgAccess(orgId, ["admin"])
  const input = transferSchema.parse(await readJson(request))
  await transferOrganization(org._id, user.id, input.userId)
  return NextResponse.json({ ok: true })
})
