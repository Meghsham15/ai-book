import "server-only"

import mongoose from "mongoose"
import { ConfigError } from "@/lib/errors"
import { isConfiguredSecret } from "@/lib/env"

type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache
}

const cached: MongooseCache = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
}

globalForMongoose.mongooseCache = cached

export async function connectDB() {
  const uri = process.env.MONGODB_URI
  if (!isConfiguredSecret(uri)) {
    throw new ConfigError("Add your MongoDB connection string to MONGODB_URI in .env.local.")
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri as string, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 8000,
      })
      .then((connection) => {
        cached.conn = connection
        return connection
      })
      .catch((error: unknown) => {
        cached.promise = null
        throw error
      })
  }

  return cached.promise
}
