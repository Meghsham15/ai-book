export function isConfiguredSecret(value: string | undefined) {
  return Boolean(value && !value.startsWith("replace-me") && !value.includes("your-"))
}
