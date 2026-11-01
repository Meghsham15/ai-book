import "server-only"

import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { AppError, UserInputError, errorCodes, publicCode, publicMessage, type ErrorCode } from "@/lib/errors"

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Check the form and try again."
    return NextResponse.json({ error: message, code: codeForValidation(message) }, { status: 400 })
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error(error)
  return NextResponse.json({ error: publicMessage(error), code: publicCode(error) }, { status: 500 })
}

function codeForValidation(message: string): ErrorCode {
  if (message === "Enter an email address." || message === "Enter a valid email address.") return errorCodes.EMAIL_INVALID
  if (message === "Name the library with at least 2 characters.") return errorCodes.LIBRARY_NAME_INVALID
  if (message === "Add a title.") return errorCodes.TITLE_REQUIRED
  if (message === "Write something to save.") return errorCodes.NOTE_EMPTY
  if (message === "Add a website URL.") return errorCodes.WEBSITE_URL_REQUIRED
  if (message === "Add a file link.") return errorCodes.FILE_LINK_REQUIRED
  if (message === "Ask a question first.") return errorCodes.QUESTION_REQUIRED
  if (message === "Choose a source from the list.") return errorCodes.SOURCE_ID_INVALID
  if (message === "Choose a chat.") return errorCodes.CHAT_REQUIRED
  if (message === "This invitation link is not valid.") return errorCodes.INVITE_TOKEN_INVALID
  return errorCodes.INPUT_INVALID
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
    throw new UserInputError("The request body must be JSON.", errorCodes.INVALID_JSON)
  }
}
