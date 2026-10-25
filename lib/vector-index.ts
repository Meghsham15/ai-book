export function atlasIndexSnippet(dimensions: number, indexName: string) {
  return JSON.stringify(
    {
      name: indexName,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: dimensions > 0 ? dimensions : 384,
            similarity: "cosine",
          },
          { type: "filter", path: "organizationId" },
        ],
      },
    },
    null,
    2,
  )
}
