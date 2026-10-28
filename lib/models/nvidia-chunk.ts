import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"
import { NVIDIA_CHUNK_COLLECTION } from "@/lib/constants"

const nvidiaChunkSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    embeddingProvider: { type: String, enum: ["local", "groq", "xai", "gemini", "nvidia"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: NVIDIA_CHUNK_COLLECTION },
)

nvidiaChunkSchema.index({ organizationId: 1, documentId: 1 })

export type NvidiaChunkDocument = InferSchemaType<typeof nvidiaChunkSchema> & {
  _id: mongoose.Types.ObjectId
}

export const NvidiaChunk: Model<NvidiaChunkDocument> =
  (mongoose.models.NvidiaChunk as Model<NvidiaChunkDocument> | undefined) ??
  mongoose.model<NvidiaChunkDocument>("NvidiaChunk", nvidiaChunkSchema, NVIDIA_CHUNK_COLLECTION)
