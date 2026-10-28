export const DEFAULT_LIMITS = {
  maxFiles: 50,
  maxWebsites: 20,
  maxTexts: 100,
  maxChunks: 10_000,
} as const

export const MAX_UPLOAD_MB = 4.5
export const MAX_UPLOAD_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024)

export function fileTooLargeMessage() {
  return `Files must be ${MAX_UPLOAD_MB} MB or smaller.`
}
export const MAX_SOURCE_CHARS = 120_000
export const CHUNK_SIZE = 700
export const CHUNK_OVERLAP = 100
export const TOP_K = 6
export const CHAT_LIMIT_PER_MINUTE = 20

/** MongoDB collection that stores NVIDIA Nemotron embedding vectors. */
export const NVIDIA_CHUNK_COLLECTION = "nvidiachunks"
/** Atlas Vector Search index created on `nvidiachunks`. */
export const NVIDIA_VECTOR_INDEX = "nvidia_chunk_vector_index"
/** Native size of nvidia/nemotron-3.5-embed-8b. Shortened vectors must be L2-normalized. */
export const NVIDIA_EMBEDDING_DIMENSIONS = 4096
