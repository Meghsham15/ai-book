import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const conversationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title: { type: String, required: true, trim: true, default: "New chat" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
)

conversationSchema.index({ organizationId: 1, updatedAt: -1 })

export type ConversationDocument = InferSchemaType<typeof conversationSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

export const Conversation: Model<ConversationDocument> =
  (mongoose.models.Conversation as Model<ConversationDocument> | undefined) ??
  mongoose.model<ConversationDocument>("Conversation", conversationSchema)
