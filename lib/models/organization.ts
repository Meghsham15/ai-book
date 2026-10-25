import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"
import { DEFAULT_LIMITS } from "@/lib/constants"

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vectorIndexName: { type: String, default: "chunk_vector_index" },
    embeddingProvider: { type: String, enum: ["local", "groq", "xai", "gemini"], required: false },
    embeddingDimensions: { type: Number, default: 0 },
    limits: {
      maxFiles: { type: Number, default: DEFAULT_LIMITS.maxFiles },
      maxWebsites: { type: Number, default: DEFAULT_LIMITS.maxWebsites },
      maxTexts: { type: Number, default: DEFAULT_LIMITS.maxTexts },
      maxChunks: { type: Number, default: DEFAULT_LIMITS.maxChunks },
    },
    usage: {
      files: { type: Number, default: 0 },
      websites: { type: Number, default: 0 },
      texts: { type: Number, default: 0 },
      chunks: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
)

export type OrganizationDocument = InferSchemaType<typeof organizationSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Organization: Model<OrganizationDocument> =
  (mongoose.models.Organization as Model<OrganizationDocument> | undefined) ??
  mongoose.model<OrganizationDocument>("Organization", organizationSchema)
