import "server-only"

import mongoose from "mongoose"
import { DEFAULT_LIMITS } from "@/lib/constants"
import { LimitError } from "@/lib/errors"
import { Organization } from "@/lib/models/organization"
import type { DocumentType, Limits, Usage } from "@/types/domain"

export function readLimits(limits?: Partial<Limits> | null): Limits {
  return {
    maxFiles: limits?.maxFiles ?? DEFAULT_LIMITS.maxFiles,
    maxWebsites: limits?.maxWebsites ?? DEFAULT_LIMITS.maxWebsites,
    maxTexts: limits?.maxTexts ?? DEFAULT_LIMITS.maxTexts,
    maxChunks: limits?.maxChunks ?? DEFAULT_LIMITS.maxChunks,
  }
}

export function readUsage(usage?: Partial<Usage> | null): Usage {
  return {
    files: usage?.files ?? 0,
    websites: usage?.websites ?? 0,
    texts: usage?.texts ?? 0,
    chunks: usage?.chunks ?? 0,
  }
}

function usagePath(type: DocumentType) {
  if (type === "file") return "usage.files" as const
  if (type === "website") return "usage.websites" as const
  return "usage.texts" as const
}

function usageExpr(type: DocumentType) {
  if (type === "file") return "$usage.files"
  if (type === "website") return "$usage.websites"
  return "$usage.texts"
}

function limitExpr(type: DocumentType) {
  if (type === "file") return "$limits.maxFiles"
  if (type === "website") return "$limits.maxWebsites"
  return "$limits.maxTexts"
}

function sourceLabel(type: DocumentType) {
  if (type === "file") return "files"
  if (type === "website") return "websites"
  return "notes"
}

export async function reserveDocumentSlot(orgId: string, type: DocumentType) {
  const updated = await Organization.findOneAndUpdate(
    {
      _id: orgId,
      $expr: { $lt: [usageExpr(type), limitExpr(type)] },
    },
    { $inc: { [usagePath(type)]: 1 } },
    { new: true },
  )

  if (updated) return updated

  const org = await Organization.findById(orgId)
  const limits = readLimits(org?.limits)
  const limit = type === "file" ? limits.maxFiles : type === "website" ? limits.maxWebsites : limits.maxTexts
  throw new LimitError(
    `This library already has the maximum of ${limit} ${sourceLabel(type)}. Remove a source to add another.`,
  )
}

export async function releaseDocumentSlot(orgId: string, type: DocumentType) {
  await Organization.updateOne(
    { _id: orgId, [usagePath(type)]: { $gt: 0 } },
    { $inc: { [usagePath(type)]: -1 } },
  )
}

export async function reserveChunksOrThrow(orgId: string, count: number) {
  if (count <= 0) return
  const updated = await Organization.findOneAndUpdate(
    {
      _id: orgId,
      $expr: { $lte: [{ $add: ["$usage.chunks", count] }, "$limits.maxChunks"] },
    },
    { $inc: { "usage.chunks": count } },
    { new: true },
  )
  if (updated) return

  const org = await Organization.findById(orgId)
  const limits = readLimits(org?.limits)
  const usage = readUsage(org?.usage)
  throw new LimitError(
    `This library can store ${limits.maxChunks} chunks and already uses ${usage.chunks}. This source needs ${count} more. Remove a source to make room.`,
  )
}

export function assertLimitsCoverUsage(limits: Limits, usage: Usage) {
  if (limits.maxFiles < usage.files) {
    throw new LimitError(`The file limit can't be lower than the ${usage.files} files already stored.`)
  }
  if (limits.maxWebsites < usage.websites) {
    throw new LimitError(`The website limit can't be lower than the ${usage.websites} websites already stored.`)
  }
  if (limits.maxTexts < usage.texts) {
    throw new LimitError(`The note limit can't be lower than the ${usage.texts} notes already stored.`)
  }
  if (limits.maxChunks < usage.chunks) {
    throw new LimitError(`The chunk limit can't be lower than the ${usage.chunks} chunks already stored.`)
  }
}

export function sameId(left: mongoose.Types.ObjectId | string, right: mongoose.Types.ObjectId | string) {
  return String(left) === String(right)
}
