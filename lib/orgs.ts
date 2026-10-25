import "server-only"

import mongoose from "mongoose"
import { DEFAULT_LIMITS } from "@/lib/constants"
import { AuthzError, UserInputError } from "@/lib/errors"
import { sameId } from "@/lib/limits"
import { Membership } from "@/lib/models/membership"
import { Organization } from "@/lib/models/organization"
import { slugify } from "@/lib/slug"
import type { Limits, Role } from "@/types/domain"

export async function createOrganization(userId: string, name: string) {
  const base = slugify(name)
  let slug = `${base}-${Date.now().toString(36)}`
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const exists = await Organization.exists({ slug: candidate })
    if (!exists) {
      slug = candidate
      break
    }
  }

  const org = await Organization.create({
    name,
    slug,
    ownerId: userId,
    limits: { ...DEFAULT_LIMITS },
    usage: { files: 0, websites: 0, texts: 0, chunks: 0 },
    vectorIndexName: process.env.ATLAS_VECTOR_INDEX || "chunk_vector_index",
  })

  try {
    await Membership.create({ userId, organizationId: org._id, role: "admin" })
  } catch (error) {
    await Organization.deleteOne({ _id: org._id })
    throw error
  }

  return org
}

export async function renameOrganization(orgId: mongoose.Types.ObjectId, name: string) {
  const org = await Organization.findByIdAndUpdate(orgId, { name }, { new: true })
  if (!org) throw new AuthzError("Organization not found.", 404)
  return org
}

export async function updateOrganizationLimits(orgId: mongoose.Types.ObjectId, limits: Limits) {
  const org = await Organization.findById(orgId)
  if (!org) throw new AuthzError("Organization not found.", 404)
  org.limits = limits
  await org.save()
  return org
}

export async function updateMemberRole(orgId: mongoose.Types.ObjectId, userId: string, role: Role) {
  const org = await Organization.findById(orgId)
  if (!org) throw new AuthzError("Organization not found.", 404)
  if (sameId(org.ownerId, userId) && role !== "admin") {
    throw new UserInputError("Transfer ownership before changing the owner's role.")
  }

  const membership = await Membership.findOne({ organizationId: orgId, userId })
  if (!membership) throw new AuthzError("That person is not in this library.", 404)
  membership.role = role
  await membership.save()
}

export async function removeOrganizationMember(orgId: mongoose.Types.ObjectId, userId: string) {
  const org = await Organization.findById(orgId)
  if (!org) throw new AuthzError("Organization not found.", 404)
  if (sameId(org.ownerId, userId)) {
    throw new UserInputError("Transfer ownership before removing the owner.")
  }

  const result = await Membership.deleteOne({ organizationId: orgId, userId })
  if (result.deletedCount === 0) throw new AuthzError("That person is not in this library.", 404)
}

export async function transferOrganization(orgId: mongoose.Types.ObjectId, actorId: string, nextOwnerId: string) {
  const org = await Organization.findById(orgId)
  if (!org) throw new AuthzError("Organization not found.", 404)
  if (!sameId(org.ownerId, actorId)) {
    throw new AuthzError("Only the owner can transfer this library.", 403)
  }
  if (sameId(org.ownerId, nextOwnerId)) {
    throw new UserInputError("You already own this library.")
  }

  const membership = await Membership.findOne({ organizationId: orgId, userId: nextOwnerId })
  if (!membership) throw new UserInputError("Choose someone who is already a member.")
  membership.role = "admin"
  await membership.save()
  org.ownerId = new mongoose.Types.ObjectId(nextOwnerId)
  await org.save()
}
