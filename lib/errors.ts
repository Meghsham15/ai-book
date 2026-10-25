export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class AuthzError extends AppError {}

export class LimitError extends AppError {
  constructor(message: string) {
    super(message, 409)
  }
}

export class UserInputError extends AppError {
  constructor(message: string) {
    super(message, 400)
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, 503)
  }
}

export class UpstreamError extends AppError {
  constructor(message: string) {
    super(message, 502)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 429)
  }
}

/** The source text was removed while indexing and the document should be marked failed. */
export class IndexingError extends AppError {
  constructor(
    message: string,
    readonly destroyed: boolean,
  ) {
    super(message, 422)
  }
}

export function publicMessage(error: unknown) {
  if (error instanceof AppError) return error.message
  return "Something went wrong. Please try again."
}
