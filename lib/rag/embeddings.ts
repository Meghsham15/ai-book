import "server-only"

import { OpenAIEmbeddings } from "@langchain/openai"
import { UpstreamError } from "@/lib/errors"

export type EmbeddingProvider = "local" | "groq" | "xai" | "gemini"

const LOCAL_DIM = 384
const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const GROQ_EMBEDDING_MODEL = "nomic-embed-text-v1_5"
let detectedProvider: Promise<EmbeddingProvider> | null = null

export async function resolveEmbeddingProvider(): Promise<EmbeddingProvider> {
  const forced = process.env.EMBEDDING_PROVIDER?.toLowerCase()
  if (forced === "local" || forced === "groq" || forced === "xai" || forced === "gemini") return forced
  if (!detectedProvider) detectedProvider = detectProvider()
  return detectedProvider
}

export async function embedTexts(texts: string[], provider: EmbeddingProvider) {
  if (provider === "local") return texts.map(localEmbed)
  if (provider === "groq") return embedWithGroq(texts)
  if (provider === "xai") return embedWithXai(texts)
  return embedWithGemini(texts)
}

export async function embedQuery(text: string, provider: EmbeddingProvider) {
  const [vector] = await embedTexts([text], provider)
  return vector
}

async function detectProvider(): Promise<EmbeddingProvider> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey && !geminiKey.startsWith("replace-me")) {
    try {
      await embedWithGemini(["library"])
      return "gemini"
    } catch (error) {
      console.warn(
        "Gemini embeddings are unavailable. Trying the next provider.",
        error instanceof Error ? error.message : "unknown error",
      )
    }
  }

  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey && !groqKey.startsWith("replace-me")) {
    try {
      await embedWithGroq(["library"])
      return "groq"
    } catch (error) {
      console.warn(
        "Groq embeddings are unavailable. Using local embeddings.",
        error instanceof Error ? error.message : "unknown error",
      )
    }
  }

  return "local"
}

async function embedWithGroq(texts: string[]) {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey || apiKey.startsWith("replace-me")) {
    throw new UpstreamError("Add GROQ_API_KEY before using Groq embeddings.")
  }

  const embeddings = new OpenAIEmbeddings({
    apiKey,
    model: process.env.GROQ_EMBEDDING_MODEL || GROQ_EMBEDDING_MODEL,
    batchSize: 32,
    timeout: 20_000,
    configuration: {
      baseURL: process.env.GROQ_BASE_URL || GROQ_BASE_URL,
    },
  })

  try {
    const vectors = await embeddings.embedDocuments(texts)
    if (vectors.some((vector) => vector.length === 0)) {
      throw new UpstreamError("Groq returned an empty embedding.")
    }
    return vectors.map((vector) => normalize(vector))
  } catch (error) {
    if (error instanceof UpstreamError) throw error
    console.error("Groq embedding request failed", error instanceof Error ? error.message : "unknown error")
    throw new UpstreamError("Groq embeddings could not be created. Check GROQ_API_KEY and GROQ_EMBEDDING_MODEL.")
  }
}

function localEmbed(text: string) {
  const vector = new Float64Array(LOCAL_DIM)
  const tokens = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []
  const add = (token: string) => {
    let hash = 2166136261
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    vector[Math.abs(hash) % LOCAL_DIM] += (hash & 2) === 0 ? 1 : -1
  }

  for (let index = 0; index < tokens.length; index += 1) {
    add(tokens[index])
    if (index + 1 < tokens.length) add(`${tokens[index]}_${tokens[index + 1]}`)
  }

  return normalize(Array.from(vector))
}

async function embedWithXai(texts: string[]) {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new UpstreamError("Add XAI_API_KEY before using xAI embeddings.")

  const embeddings = new OpenAIEmbeddings({
    apiKey,
    model: process.env.XAI_EMBEDDING_MODEL || "v1",
    batchSize: 32,
    timeout: 20_000,
    configuration: {
      baseURL: "https://api.x.ai/v1",
    },
  })

  try {
    const vectors = await embeddings.embedDocuments(texts)
    return vectors.map((vector) => normalize(vector))
  } catch (error) {
    console.error("xAI embedding request failed", error instanceof Error ? error.message : "unknown error")
    throw new UpstreamError("xAI embeddings could not be created. Check XAI_EMBEDDING_MODEL or switch EMBEDDING_PROVIDER.")
  }
}

async function embedWithGemini(texts: string[]) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey || apiKey.startsWith("replace-me")) {
    throw new UpstreamError("Add GEMINI_API_KEY before using Gemini embeddings.")
  }
  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2"
  return mapPool(texts, 4, async (text) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text.slice(0, 8000) }] },
          outputDimensionality: 768,
        }),
      },
    )

    if (!response.ok) {
      console.error("Gemini embedding request failed", response.status)
      throw new UpstreamError("Gemini embeddings could not be created. Check GEMINI_API_KEY and GEMINI_EMBEDDING_MODEL.")
    }

    const payload = (await response.json()) as { embedding?: { values?: number[] } }
    if (!payload.embedding?.values?.length) {
      throw new UpstreamError("Gemini returned an empty embedding.")
    }
    return normalize(payload.embedding.values)
  })
}

function normalize(values: number[]) {
  let sum = 0
  for (const value of values) sum += value * value
  const norm = Math.sqrt(sum) || 1
  return values.map((value) => value / norm)
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const current = cursor
      cursor += 1
      results[current] = await worker(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
  return results
}
