import { NextResponse } from "next/server"
import { AuthzError, UserInputError } from "@/lib/errors"
import { readJson, withApi } from "@/lib/http"
import { sameId } from "@/lib/limits"
import { deleteOrganization, renameOrganization } from "@/lib/orgs"
import { requireOrgAccess } from "@/lib/org-access"
import { renameOrgSchema } from "@/lib/validators"

type Context = { params: Promise<{ orgId: string }> }

export const PATCH = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { org } = await requireOrgAccess(orgId, ["admin"])
  const input = renameOrgSchema.parse(await readJson(request))
  await renameOrganization(org._id, input.name)
  return NextResponse.json({ ok: true })
})

export const DELETE = withApi<Context>(async (request, context) => {
  const { orgId } = await context.params
  const { user, org } = await requireOrgAccess(orgId, ["admin"])
  if (!sameId(org.ownerId, user.id)) {
    throw new AuthzError("Only the owner can delete this library.", 403)
  }
  const body = await readJson(request)
  const name = body && typeof body === "object" && "name" in body && typeof body.name === "string" ? body.name.trim() : ""
  if (name !== org.name) {
    throw new UserInputError("Type the library name exactly to confirm.")
  }
  await deleteOrganization(org._id, user.id)
  return NextResponse.json({ ok: true })
})
