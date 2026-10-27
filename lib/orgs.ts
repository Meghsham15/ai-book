import "server-only"

import mongoose from "mongoose"
import { DEFAULT_LIMITS } from "@/lib/constants"
import { AuthzError, UserInputError } from "@/lib/errors"
import { sameId } from "@/lib/limits"
import { ChatTurn } from "@/lib/models/chat-turn"
import { Chunk } from "@/lib/models/chunk"
import { DocumentModel } from "@/lib/models/document"
import { Invitation } from "@/lib/models/invitation"
import { Membership } from "@/lib/models/membership"
import { Organization } from "@/lib/models/organization"
import { slugify } from "@/lib/slug"
import type { Role } from "@/types/domain"

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

export async function deleteOrganization(orgId: mongoose.Types.ObjectId, actorId: string) {
  const org = await Organization.findById(orgId)
  if (!org) throw new AuthzError("Organization not found.", 404)
  if (!sameId(org.ownerId, actorId)) {
    throw new AuthzError("Only the owner can delete this library.", 403)
  }

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      await removeLibraryRecords(orgId, session)
    })
  } catch (error) {
    if (!transactionsUnsupported(error)) throw error
    await removeLibraryRecords(orgId)
  } finally {
    await session.endSession()
  }
}

async function removeLibraryRecords(orgId: mongoose.Types.ObjectId, session?: mongoose.ClientSession) {
  const filter = { organizationId: orgId }
  const options = session ? { session } : undefined
  await Chunk.deleteMany(filter, options)
  await DocumentModel.deleteMany(filter, options)
  await ChatTurn.deleteMany(filter, options)
  await Invitation.deleteMany(filter, options)
  await Membership.deleteMany(filter, options)
  const removed = await Organization.deleteOne({ _id: orgId }, options)
  if (removed.deletedCount === 0) throw new AuthzError("This library was already deleted.", 404)
}

function transactionsUnsupported(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  return message.includes("Transaction numbers are only allowed") || message.includes("replica set")
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
