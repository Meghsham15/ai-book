import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const sourceSchema = new Schema(
  {
    documentId: { type: String, required: true },
    title: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    excerpt: { type: String, required: true },
  },
  { _id: false },
)

const chatTurnSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [sourceSchema], default: undefined },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    authorName: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

chatTurnSchema.index({ organizationId: 1, createdAt: 1 })

export type ChatTurnDocument = InferSchemaType<typeof chatTurnSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt?: Date
}

export const ChatTurn: Model<ChatTurnDocument> =
  (mongoose.models.ChatTurn as Model<ChatTurnDocument> | undefined) ??
  mongoose.model<ChatTurnDocument>("ChatTurn", chatTurnSchema)
