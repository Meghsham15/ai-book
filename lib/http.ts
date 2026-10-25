import "server-only"

import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { AppError, UserInputError, publicMessage } from "@/lib/errors"

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    return NextResponse.json({ error: issue?.message ?? "Check the form and try again." }, { status: 400 })
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(error)
  return NextResponse.json({ error: publicMessage(error) }, { status: 500 })
}

export function withApi<C>(handler: (request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C) => {
    try {
      return await handler(request, context)
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

export async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new UserInputError("The request body must be JSON.")
  }
}
