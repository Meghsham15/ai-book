import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const invitationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "manager", "member"], required: true },
    kind: { type: String, enum: ["invite", "transfer"], default: "invite" },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending", required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
)

invitationSchema.index({ email: 1, status: 1 })
invitationSchema.index({ organizationId: 1, email: 1, status: 1 })

export type InvitationDocument = InferSchemaType<typeof invitationSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Invitation: Model<InvitationDocument> =
  (mongoose.models.Invitation as Model<InvitationDocument> | undefined) ??
  mongoose.model<InvitationDocument>("Invitation", invitationSchema)
