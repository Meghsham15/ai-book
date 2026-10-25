import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const chunkSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    embeddingProvider: { type: String, enum: ["local", "groq", "xai", "gemini"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

chunkSchema.index({ organizationId: 1, documentId: 1 })

export type ChunkDocument = InferSchemaType<typeof chunkSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Chunk: Model<ChunkDocument> =
  (mongoose.models.Chunk as Model<ChunkDocument> | undefined) ??
  mongoose.model<ChunkDocument>("Chunk", chunkSchema)
