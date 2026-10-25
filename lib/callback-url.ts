export function safeCallbackUrl(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.includes("\\") ||
    value.startsWith("/login") ||
    value.startsWith("/api")
  ) {
    return "/dashboard"
  }
  return value
}
