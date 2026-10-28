import "server-only"

import mongoose from "mongoose"
import { TOP_K } from "@/lib/constants"
import { NvidiaChunk } from "@/lib/models/nvidia-chunk"
import { embedQuery, type EmbeddingProvider } from "@/lib/rag/embeddings"
import { activeVectorIndexName } from "@/lib/vector-index"

export type RetrievedChunk = {
  documentId: string
  chunkIndex: number
  text: string
  score: number
}

export async function retrieveChunks(input: {
  organizationId: string
  query: string
  provider: EmbeddingProvider
  documentId?: string
  limit?: number
}) {
  const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 16) : TOP_K
  const queryVector = await embedQuery(input.query, input.provider)
  if ((process.env.VECTOR_SEARCH || "memory") === "atlas") {
    try {
      const rows = await atlasSearch(input.organizationId, queryVector, input.documentId, limit)
      if (!input.documentId || rows.every((row) => row.documentId === input.documentId)) return rows
    } catch (error) {
      console.warn(
        "Atlas vector search failed. Using stored embeddings instead.",
        error instanceof Error ? error.message : "unknown error",
      )
    }
  }
  return memorySearch(input.organizationId, input.provider, queryVector, input.documentId, limit)
}

export async function sampleDocumentChunks(documentId: string, count: number): Promise<RetrievedChunk[]> {
  const rows = await NvidiaChunk.find({ documentId })
    .select("documentId chunkIndex text")
    .sort({ chunkIndex: 1 })
    .lean()
  if (rows.length === 0) return []
  const picks = rows.length <= count ? rows : Array.from({ length: count }, (_, index) => {
    const at = Math.round((index * (rows.length - 1)) / Math.max(count - 1, 1))
    return rows[at]
  })
  const seen = new Set<number>()
  return picks.flatMap((row) => {
    if (seen.has(row.chunkIndex)) return []
    seen.add(row.chunkIndex)
    return [{
      documentId: String(row.documentId),
      chunkIndex: row.chunkIndex,
      text: row.text,
      score: 0,
    }]
  })
}

async function atlasSearch(organizationId: string, queryVector: number[], documentId: string | undefined, limit: number) {
  const rows = await NvidiaChunk.aggregate<{
    documentId: mongoose.Types.ObjectId
    chunkIndex: number
    text: string
    score?: number
  }>([
    {
      $vectorSearch: {
        index: activeVectorIndexName(),
        path: "embedding",
        queryVector,
        numCandidates: Math.max(limit * 20, 80),
        limit,
        filter: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          ...(documentId ? { documentId: new mongoose.Types.ObjectId(documentId) } : {}),
        },
      },
    },
    {
      $project: {
        documentId: 1,
        chunkIndex: 1,
        text: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ])

  return rows.map((row) => ({
    documentId: String(row.documentId),
    chunkIndex: row.chunkIndex,
    text: row.text,
    score: row.score ?? 0,
  }))
}

async function memorySearch(
  organizationId: string,
  provider: EmbeddingProvider,
  queryVector: number[],
  documentId: string | undefined,
  limit: number,
) {
  const cursor = NvidiaChunk.find({
    organizationId,
    embeddingProvider: provider,
    ...(documentId ? { documentId } : {}),
  })
    .select("documentId chunkIndex text embedding")
    .lean()
    .cursor()

  const best: RetrievedChunk[] = []
  for await (const chunk of cursor) {
    const embedding = chunk.embedding as number[] | undefined
    if (!embedding || embedding.length !== queryVector.length) continue
    const score = cosine(queryVector, embedding)
    insertTop(best, {
      documentId: String(chunk.documentId),
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      score,
    }, limit)
  }
  return best
}

function insertTop(best: RetrievedChunk[], candidate: RetrievedChunk, limit: number) {
  if (best.length === limit && candidate.score <= best[best.length - 1].score) return
  best.push(candidate)
  best.sort((left, right) => right.score - left.score)
  if (best.length > limit) best.pop()
}

function cosine(left: number[], right: number[]) {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }
  if (!leftNorm || !rightNorm) return 0
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}
