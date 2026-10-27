import "server-only"

import mongoose, { type PipelineStage } from "mongoose"
import { notFound } from "next/navigation"
import { ConfigError } from "@/lib/errors"
import { getUserMembership } from "@/lib/authz"
import { connectDB } from "@/lib/db"
import { readLimits, readUsage } from "@/lib/limits"
import { listDashboardInvitations, listPendingInvites } from "@/lib/invitations"
import { ChatTurn } from "@/lib/models/chat-turn"
import { Chunk } from "@/lib/models/chunk"
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
  DashboardOverview,
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
        queries: 0,
      })
    }

    const questions = await countQuestions(libraries.map((library) => library.id))
    for (const library of libraries) library.queries = questions.get(library.id) ?? 0
    libraries.sort((left, right) => left.name.localeCompare(right.name))
    const [invitations, overview] = await Promise.all([
      listDashboardInvitations(user.email),
      loadOverview(libraries.map((library) => library.id)),
    ])
    return { user, configError: null as string | null, libraries, invitations, overview }
  } catch (error) {
    if (error instanceof ConfigError) {
      return {
        user,
        configError: error.message,
        libraries: [] as LibraryCard[],
        invitations: [] as DashboardInvitation[],
        overview: emptyOverview(),
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

  const [documents, memberRows, libraryRows, invitations, queries] = await Promise.all([
    DocumentModel.find({ organizationId: org._id }).sort({ createdAt: -1 }).lean(),
    Membership.find({ organizationId: org._id }).populate("userId", "name email image").lean(),
    Membership.find({ userId: user.id }).populate("organizationId", "name slug").lean(),
    membership.role === "admin" ? listPendingInvites(org._id) : Promise.resolve([]),
    ChatTurn.countDocuments({ organizationId: org._id, role: "user" }),
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
    queries,
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

const ACTIVITY_DAYS = 14

function emptyOverview(): DashboardOverview {
  return { days: fillDays(new Map(), new Map(), new Map()), ready: 0, processing: 0, failed: 0 }
}

async function loadOverview(orgIds: string[]): Promise<DashboardOverview> {
  const ids = orgIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id))
  if (ids.length === 0) return emptyOverview()
  const start = activityStart()
  const [questions, documents, chunks, statuses] = await Promise.all([
    dailyCounts(ChatTurn, { organizationId: { $in: ids }, role: "user", createdAt: { $gte: start } }),
    dailyCounts(DocumentModel, { organizationId: { $in: ids }, createdAt: { $gte: start } }),
    dailyCounts(Chunk, { organizationId: { $in: ids }, createdAt: { $gte: start } }),
    DocumentModel.aggregate<{ _id: string; count: number }>([
      { $match: { organizationId: { $in: ids } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ])
  const byStatus = new Map(statuses.map((row) => [row._id, row.count]))
  return {
    days: fillDays(questions, documents, chunks),
    ready: byStatus.get("ready") ?? 0,
    processing: byStatus.get("processing") ?? 0,
    failed: byStatus.get("failed") ?? 0,
  }
}

function activityStart() {
  const today = new Date()
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (ACTIVITY_DAYS - 1)))
}

function dailyCounts(model: { aggregate: (pipeline: PipelineStage[]) => PromiseLike<{ _id: string; count: number }[]> }, match: Record<string, unknown>) {
  return model
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
    ])
    .then((rows) => new Map(rows.map((row) => [row._id, row.count])))
}

function fillDays(questions: Map<string, number>, documents: Map<string, number>, chunks: Map<string, number>) {
  const start = activityStart()
  return Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const key = date.toISOString().slice(0, 10)
    return {
      date: key,
      questions: questions.get(key) ?? 0,
      documents: documents.get(key) ?? 0,
      chunks: chunks.get(key) ?? 0,
    }
  })
}

async function countQuestions(orgIds: string[]) {
  const ids = orgIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id))
  if (ids.length === 0) return new Map<string, number>()
  const rows = await ChatTurn.aggregate<{ _id: mongoose.Types.ObjectId; queries: number }>([
    { $match: { organizationId: { $in: ids }, role: "user" } },
    { $group: { _id: "$organizationId", queries: { $sum: 1 } } },
  ])
  return new Map(rows.map((row) => [String(row._id), row.queries]))
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
