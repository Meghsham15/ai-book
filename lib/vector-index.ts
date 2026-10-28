import { NVIDIA_EMBEDDING_DIMENSIONS, NVIDIA_VECTOR_INDEX } from "@/lib/constants"

export function activeVectorIndexName() {
  return process.env.ATLAS_VECTOR_INDEX?.trim() || NVIDIA_VECTOR_INDEX
}

export function atlasIndexSnippet(dimensions: number, indexName = activeVectorIndexName()) {
  return JSON.stringify(
    {
      name: indexName,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: dimensions > 0 ? dimensions : NVIDIA_EMBEDDING_DIMENSIONS,
            similarity: "cosine",
          },
          { type: "filter", path: "organizationId" },
          { type: "filter", path: "documentId" },
        ],
      },
    },
    null,
    2,
  )
}
