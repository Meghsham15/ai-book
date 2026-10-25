import "server-only"

import mongoose from "mongoose"
import { TOP_K } from "@/lib/constants"
import { Chunk } from "@/lib/models/chunk"
import { embedQuery, type EmbeddingProvider } from "@/lib/rag/embeddings"

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
}) {
  const queryVector = await embedQuery(input.query, input.provider)
  if ((process.env.VECTOR_SEARCH || "memory") === "atlas") {
    try {
      return await atlasSearch(input.organizationId, queryVector)
    } catch (error) {
      console.warn(
        "Atlas vector search failed. Using stored embeddings instead.",
        error instanceof Error ? error.message : "unknown error",
      )
    }
  }
  return memorySearch(input.organizationId, input.provider, queryVector)
}

async function atlasSearch(organizationId: string, queryVector: number[]) {
  const rows = await Chunk.aggregate<{
    documentId: mongoose.Types.ObjectId
    chunkIndex: number
    text: string
    score?: number
  }>([
    {
      $vectorSearch: {
        index: process.env.ATLAS_VECTOR_INDEX || "chunk_vector_index",
        path: "embedding",
        queryVector,
        numCandidates: Math.max(TOP_K * 20, 80),
        limit: TOP_K,
        filter: { organizationId: new mongoose.Types.ObjectId(organizationId) },
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

async function memorySearch(organizationId: string, provider: EmbeddingProvider, queryVector: number[]) {
  const cursor = Chunk.find({
    organizationId,
    embeddingProvider: provider,
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
    })
  }
  return best
}

function insertTop(best: RetrievedChunk[], candidate: RetrievedChunk) {
  if (best.length === TOP_K && candidate.score <= best[best.length - 1].score) return
  best.push(candidate)
  best.sort((left, right) => right.score - left.score)
  if (best.length > TOP_K) best.pop()
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
