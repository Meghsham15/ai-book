import "server-only"

import { notFound } from "next/navigation"
import { ConfigError } from "@/lib/errors"
import { getUserMembership } from "@/lib/authz"
import { connectDB } from "@/lib/db"
import { readLimits, readUsage } from "@/lib/limits"
import { listDashboardInvitations, listPendingInvites } from "@/lib/invitations"
import { DocumentModel } from "@/lib/models/document"
import { Membership } from "@/lib/models/membership"
import { Organization } from "@/lib/models/organization"
import { requireUser } from "@/lib/session"
import { atlasIndexSnippet } from "@/lib/vector-index"
import type {
  DocumentItem,
  DocumentStatus,
  DocumentType,
  DashboardInvitation,
  LibraryCard,
  LibraryOption,
  MemberItem,
  OrgDetails,
  Role,
} from "@/types/domain"

export async function getDashboardData() {
  const user = await requireUser()
  try {
    await connectDB()
    const rows = await Membership.find({ userId: user.id }).populate("organizationId").lean()
    const libraries: LibraryCard[] = []

    for (const row of rows) {
      const org = populatedRecord(row.organizationId)
      if (!org?.slug || !org.name) continue
      libraries.push({
        id: String(org._id),
        name: org.name,
        slug: org.slug,
        role: row.role as Role,
        usage: readUsage(org.usage),
        limits: readLimits(org.limits),
      })
    }

    libraries.sort((left, right) => left.name.localeCompare(right.name))
    const invitations = await listDashboardInvitations(user.email)
    return { user, configError: null as string | null, libraries, invitations }
  } catch (error) {
    if (error instanceof ConfigError) {
      return {
        user,
        configError: error.message,
        libraries: [] as LibraryCard[],
        invitations: [] as DashboardInvitation[],
      }
    }
    throw error
  }
}

export async function getOrgPage(slug: string) {
  const user = await requireUser()
  try {
    await connectDB()
  } catch (error) {
    if (error instanceof ConfigError) {
      return { user, configError: error.message, data: null }
    }
    throw error
  }

  const org = await Organization.findOne({ slug })
  if (!org) notFound()
  const membership = await getUserMembership(user.id, org._id.toString())
  if (!membership) notFound()

  const [documents, memberRows, libraryRows, invitations] = await Promise.all([
    DocumentModel.find({ organizationId: org._id }).sort({ createdAt: -1 }).lean(),
    Membership.find({ organizationId: org._id }).populate("userId", "name email image").lean(),
    Membership.find({ userId: user.id }).populate("organizationId", "name slug").lean(),
    membership.role === "admin" ? listPendingInvites(org._id) : Promise.resolve([]),
  ])

  const members: MemberItem[] = []
  for (const row of memberRows) {
    const person = populatedRecord(row.userId)
    if (!person?.email) continue
    members.push({
      userId: String(person._id),
      name: person.name || "Member",
      email: person.email,
      image: person.image || undefined,
      role: row.role as Role,
      isOwner: String(person._id) === String(org.ownerId),
    })
  }
  members.sort((left, right) => {
    const rank = { admin: 0, manager: 1, member: 2 }
    return rank[left.role] - rank[right.role] || left.name.localeCompare(right.name)
  })

  const libraries: LibraryOption[] = []
  for (const row of libraryRows) {
    const library = populatedRecord(row.organizationId)
    if (!library?.slug || !library.name) continue
    libraries.push({
      id: String(library._id),
      name: library.name,
      slug: library.slug,
      role: row.role as Role,
    })
  }
  libraries.sort((left, right) => left.name.localeCompare(right.name))

  const dimensions = org.embeddingDimensions || 0
  const details: OrgDetails = {
    id: org._id.toString(),
    name: org.name,
    slug: org.slug,
    role: membership.role as Role,
    isOwner: String(org.ownerId) === user.id,
    usage: readUsage(org.usage),
    limits: readLimits(org.limits),
    embeddingProvider: org.embeddingProvider || "pending",
    embeddingDimensions: dimensions,
    vectorSearch: process.env.VECTOR_SEARCH === "atlas" ? "atlas" : "memory",
    atlasIndex: atlasIndexSnippet(dimensions, org.vectorIndexName || "chunk_vector_index"),
  }

  const sources: DocumentItem[] = documents.map((document) => ({
    id: String(document._id),
    title: document.title,
    type: document.type as DocumentType,
    status: document.status as DocumentStatus,
    chunkCount: document.chunkCount,
    url: document.url || undefined,
    createdAt: toIso(document.createdAt),
    errorMessage: document.errorMessage || undefined,
  }))

  return {
    user,
    configError: null as string | null,
    data: { org: details, sources, members, libraries, invitations },
  }
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") return value
  return new Date().toISOString()
}

function populatedRecord(value: unknown) {
  if (!value || typeof value !== "object" || !("_id" in value)) return null
  return value as {
    _id: unknown
    name?: string
    email?: string
    image?: string
    slug?: string
    usage?: Parameters<typeof readUsage>[0]
    limits?: Parameters<typeof readLimits>[0]
  }
}
