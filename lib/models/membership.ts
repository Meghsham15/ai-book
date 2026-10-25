import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    role: { type: String, enum: ["admin", "manager", "member"], required: true },
  },
  { timestamps: true },
)

membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true })

export type MembershipDocument = InferSchemaType<typeof membershipSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Membership: Model<MembershipDocument> =
  (mongoose.models.Membership as Model<MembershipDocument> | undefined) ??
  mongoose.model<MembershipDocument>("Membership", membershipSchema)
