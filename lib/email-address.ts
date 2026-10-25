const EMAIL_PATTERN =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function emailError(value: string) {
  const email = normalizeEmail(value)
  if (!email) return "Enter an email address."
  if (email.length > 254 || /\s/.test(email)) return "Enter a valid email address."

  const at = email.indexOf("@")
  const local = at >= 0 ? email.slice(0, at) : ""
  const domain = at >= 0 ? email.slice(at + 1) : ""
  if (!local || !domain || local.length > 64 || domain.includes("@")) {
    return "Enter a valid email address."
  }
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return "Enter a valid email address."
  }
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address."

  const tld = domain.split(".").at(-1) ?? ""
  if (!/^[a-z]{2,24}$/.test(tld)) return "Enter a valid email address."
  return null
}
