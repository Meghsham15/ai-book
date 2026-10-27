import { z } from "zod"
import { emailError, normalizeEmail } from "@/lib/email-address"

const emailField = z.string().trim().transform((value, context) => {
  const email = normalizeEmail(value)
  const message = emailError(email)
  if (message) {
    context.addIssue({ code: "custom", message })
    return z.NEVER
  }
  return email
})

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, "Name the library with at least 2 characters.").max(60),
})

export const renameOrgSchema = z.object({
  name: z.string().trim().min(2, "Name the library with at least 2 characters.").max(60),
})

export const memberSchema = z.object({
  email: emailField,
  role: z.enum(["admin", "manager", "member"]),
})

export const roleUpdateSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(["admin", "manager", "member"]),
})

export const transferSchema = z.object({
  email: emailField,
})

export const invitationTokenSchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{64}$/, "This invitation link is not valid."),
})

export const textSourceSchema = z.object({
  organizationId: z.string().trim().min(1),
  type: z.literal("text"),
  title: z.string().trim().min(1, "Add a title.").max(120),
  content: z.string().trim().min(1, "Write something to save.").max(120_000),
})

export const websiteSourceSchema = z.object({
  organizationId: z.string().trim().min(1),
  type: z.literal("website"),
  title: z.string().trim().max(120).optional(),
  url: z.string().trim().min(1, "Add a website URL.").max(2000),
})

export const jsonSourceSchema = z.discriminatedUnion("type", [textSourceSchema, websiteSourceSchema])

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(120_000).optional(),
})

export const chatSchema = z.object({
  query: z.string().trim().min(1, "Ask a question first.").max(2000),
  organizationId: z.string().trim().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().max(4000),
      }),
    )
    .max(12)
    .optional(),
})
