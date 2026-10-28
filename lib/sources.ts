import "server-only"

import { publicMessage, IndexingError, AuthzError } from "@/lib/errors"
import { releaseDocumentSlot, reserveDocumentSlot } from "@/lib/limits"
import { DocumentModel } from "@/lib/models/document"
import { Chunk } from "@/lib/models/chunk"
import { NvidiaChunk } from "@/lib/models/nvidia-chunk"
import { Organization } from "@/lib/models/organization"
import { indexDocumentText } from "@/lib/rag/index-document"
import type { DocumentType } from "@/types/domain"

export async function createIndexedSource(input: {
  orgId: string
  userId: string
  type: DocumentType
  title: string
  text: string
  url?: string
}) {
  await reserveDocumentSlot(input.orgId, input.type)
  const doc = await DocumentModel.create({
    organizationId: input.orgId,
    title: input.title,
    type: input.type,
    content: input.type === "text" ? input.text : undefined,
    url: input.url,
    status: "processing",
    chunkCount: 0,
    errorMessage: "",
    createdBy: input.userId,
  })

  try {
    const indexed = await indexDocumentText({
      orgId: input.orgId,
      documentId: doc._id.toString(),
      text: input.text,
      previousChunks: 0,
    })
    doc.status = "ready"
    doc.chunkCount = indexed.chunkCount
    doc.errorMessage = ""
    await doc.save()
    return doc
  } catch (error) {
    await DocumentModel.updateOne(
      { _id: doc._id },
      {
        status: "failed",
        chunkCount: 0,
        errorMessage: publicMessage(error).slice(0, 300),
      },
    )
    throw error
  }
}

export async function updateIndexedSource(
  orgId: string,
  documentId: string,
  input: { title?: string; content?: string },
) {
  const doc = await DocumentModel.findOne({ _id: documentId, organizationId: orgId })
  if (!doc) throw new AuthzError("Source not found.", 404)
  if (doc.status === "processing") throw new AuthzError("This source is still processing.", 409)
  if (input.content && doc.type !== "text") {
    throw new AuthzError("Only notes can be rewritten. Upload a replacement file for other sources.", 400)
  }

  if (!input.content) {
    if (input.title) {
      doc.title = input.title
      await doc.save()
    }
    return doc
  }

  try {
    const indexed = await indexDocumentText({
      orgId,
      documentId: doc._id.toString(),
      text: input.content,
      previousChunks: doc.chunkCount,
    })
    doc.content = input.content
    if (input.title) doc.title = input.title
    doc.status = "ready"
    doc.chunkCount = indexed.chunkCount
    doc.errorMessage = ""
    await doc.save()
    return doc
  } catch (error) {
    if (error instanceof IndexingError && error.destroyed) {
      doc.status = "failed"
      doc.chunkCount = 0
      doc.errorMessage = publicMessage(error).slice(0, 300)
      await doc.save()
    }
    throw error
  }
}

export async function deleteIndexedSource(orgId: string, documentId: string) {
  const doc = await DocumentModel.findOne({ _id: documentId, organizationId: orgId })
  if (!doc) throw new AuthzError("Source not found.", 404)
  const chunkCount = doc.chunkCount
  const type = doc.type
  await Promise.all([
    NvidiaChunk.deleteMany({ documentId: doc._id }),
    Chunk.deleteMany({ documentId: doc._id }),
  ])
  await DocumentModel.deleteOne({ _id: doc._id })
  await releaseDocumentSlot(orgId, type)
  if (chunkCount > 0) {
    await Organization.updateOne({ _id: orgId }, { $inc: { "usage.chunks": -chunkCount } })
  }
  await Organization.updateOne({ _id: orgId, "usage.chunks": { $lt: 0 } }, { $set: { "usage.chunks": 0 } })
}
