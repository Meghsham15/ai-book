import { NextResponse } from "next/server"
import { readJson, withApi } from "@/lib/http"
import { assertLimitsCoverUsage, readUsage } from "@/lib/limits"
import { renameOrganization, updateOrganizationLimits } from "@/lib/orgs"
import { requireOrgAccess } from "@/lib/org-access"
import { limitsSchema, renameOrgSchema } from "@/lib/validators"

type Context = { params: Promise<{ orgId: string }> }

export const PATCH = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { org } = await requireOrgAccess(orgId, ["admin"])
  const body = await readJson(request)

  if (body && typeof body === "object" && "maxFiles" in body) {
    const limits = limitsSchema.parse(body)
    assertLimitsCoverUsage(limits, readUsage(org.usage))
    await updateOrganizationLimits(org._id, limits)
    return NextResponse.json({ ok: true })
  }

  const input = renameOrgSchema.parse(body)
  await renameOrganization(org._id, input.name)
  return NextResponse.json({ ok: true })
})
