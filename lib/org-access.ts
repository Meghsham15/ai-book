import "server-only"

import { connectDB } from "@/lib/db"
import { AuthzError } from "@/lib/errors"
import { assertObjectId } from "@/lib/authz"
import { Membership } from "@/lib/models/membership"
import { Organization } from "@/lib/models/organization"
import { requireApiUser } from "@/lib/session"
import type { Role } from "@/types/domain"

export async function requireOrgAccess(orgId: string, allowed: readonly Role[]) {
  const user = await requireApiUser()
  await connectDB()
  const organizationId = assertObjectId(orgId, "Organization")
  const org = await Organization.findById(organizationId)
  if (!org) throw new AuthzError("Organization not found.", 404)

  const membership = await Membership.findOne({ userId: user.id, organizationId: org._id })
  if (!membership || !allowed.includes(membership.role as Role)) {
    throw new AuthzError(
      membership ? "You don't have permission for that." : "You don't have access to this library.",
      403,
    )
  }

  return { user, org, membership, role: membership.role as Role }
}
