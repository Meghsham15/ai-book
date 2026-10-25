import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const documentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["file", "website", "text"], required: true },
    content: { type: String },
    url: { type: String },
    fileId: { type: String },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing",
    },
    chunkCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
)

export type SourceDocument = InferSchemaType<typeof documentSchema> & {
  _id: mongoose.Types.ObjectId
}

export const DocumentModel: Model<SourceDocument> =
  (mongoose.models.Document as Model<SourceDocument> | undefined) ??
  mongoose.model<SourceDocument>("Document", documentSchema)
