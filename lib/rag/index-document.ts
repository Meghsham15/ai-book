import "server-only"

import {
  AppError,
  IndexingError,
  publicMessage,
} from "@/lib/errors"
import { Chunk } from "@/lib/models/chunk"
import { NvidiaChunk } from "@/lib/models/nvidia-chunk"
import { Organization } from "@/lib/models/organization"
import { reserveChunksOrThrow } from "@/lib/limits"
import { splitText } from "@/lib/rag/chunk"
import { embedTexts, resolveEmbeddingProvider, type EmbeddingProvider } from "@/lib/rag/embeddings"
import { activeVectorIndexName } from "@/lib/vector-index"
import { UserInputError } from "@/lib/errors"

export async function indexDocumentText(input: {
  orgId: string
  documentId: string
  text: string
  previousChunks: number
}) {
  const pieces = await splitText(input.text)
  if (pieces.length === 0) {
    throw new UserInputError("No readable text was found in that source.")
  }

  const org = await Organization.findById(input.orgId)
  if (!org) throw new IndexingError("Organization not found.", false)

  const requested = await resolveEmbeddingProvider()
  const stored = org.embeddingProvider
  const hasVectors = (org.usage?.chunks ?? 0) > 0 || input.previousChunks > 0
  if (stored && hasVectors && stored !== requested) {
    throw new UserInputError(
      requested === "nvidia"
        ? "This library was indexed with a different embedding model. Remove its sources and add them again so they are stored as NVIDIA vectors in the nvidiachunks collection."
        : `This library uses ${stored} embeddings. Delete its sources, then add them again to switch to ${requested}.`,
    )
  }
  const provider: EmbeddingProvider = stored && hasVectors ? stored : requested

  const extra = Math.max(0, pieces.length - input.previousChunks)
  await reserveChunksOrThrow(input.orgId, extra)

  let replaced = false
  try {
    const vectors = await embedTexts(pieces, provider, "passage")
    await Promise.all([
      NvidiaChunk.deleteMany({ documentId: input.documentId }),
      Chunk.deleteMany({ documentId: input.documentId }),
    ])
    replaced = true
    await NvidiaChunk.insertMany(
      pieces.map((text, chunkIndex) => ({
        organizationId: input.orgId,
        documentId: input.documentId,
        chunkIndex,
        text,
        embedding: vectors[chunkIndex],
        embeddingProvider: provider,
      })),
      { ordered: true },
    )

    const shrink = pieces.length - input.previousChunks - extra
    if (shrink !== 0) {
      await Organization.updateOne({ _id: input.orgId }, { $inc: { "usage.chunks": shrink } })
    }

    await Organization.updateOne(
      { _id: input.orgId },
      {
        $set: {
          embeddingProvider: provider,
          embeddingDimensions: vectors[0]?.length ?? org.embeddingDimensions ?? 0,
          vectorIndexName: activeVectorIndexName(),
        },
      },
    )

    return { chunkCount: pieces.length, provider }
  } catch (error) {
    if (!replaced) {
      if (extra) {
        await Organization.updateOne({ _id: input.orgId }, { $inc: { "usage.chunks": -extra } })
      }
    } else {
      await Promise.all([
        NvidiaChunk.deleteMany({ documentId: input.documentId }),
        Chunk.deleteMany({ documentId: input.documentId }),
      ])
      await Organization.updateOne(
        { _id: input.orgId },
        { $inc: { "usage.chunks": -(input.previousChunks + extra) } },
      )
    }

    if (error instanceof IndexingError) throw error
    const message = error instanceof AppError ? error.message : "This source could not be indexed."
    if (!(error instanceof AppError)) console.error(error)
    throw new IndexingError(message || publicMessage(error), replaced)
  }
}
