import "server-only"

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    image: { type: String },
    googleId: { type: String, required: true, unique: true },
  },
  { timestamps: true },
)

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId
}

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>("User", userSchema)
