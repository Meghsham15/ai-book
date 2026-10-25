import "server-only"

import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { AuthzError } from "@/lib/errors"
import { Membership } from "@/lib/models/membership"
import type { Role } from "@/types/domain"

export async function getUserMembership(userId: string, orgId: string) {
  await connectDB()
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(orgId)) return null
  return Membership.findOne({ userId, organizationId: orgId })
}

export function assertObjectId(id: string, label = "Record") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AuthzError(`${label} not found.`, 404)
  }
  return new mongoose.Types.ObjectId(id)
}

export function hasRole(role: Role, allowed: readonly Role[]) {
  return allowed.includes(role)
}
