import "server-only"

import nodemailer from "nodemailer"
import { ConfigError, UpstreamError } from "@/lib/errors"
import { roleLabel } from "@/lib/permissions"

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;"
    if (character === "<") return "&lt;"
    if (character === ">") return "&gt;"
    if (character === '"') return "&quot;"
    return "&#39;"
  })
}

export async function sendInvitationEmail(input: {
  to: string
  organizationName: string
  role: string
  inviteUrl: string
  expiresAt: Date
}) {
  const from = process.env.INVITE_FROM_EMAIL?.trim()
  const user = process.env.SMTP_USER?.trim() || from
  const pass = process.env.SMTP_PASS?.trim()
  if (!from || !user || !pass) {
    throw new ConfigError("Add SMTP_PASS, a Gmail app password for the invitation sender, before emails can be sent.")
  }

  const role = roleLabel(input.role === "admin" || input.role === "manager" ? input.role : "member")
  const when = input.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  const safeName = escapeHtml(input.organizationName)
  const safeUrl = escapeHtml(input.inviteUrl)

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user, pass },
  })

  try {
    await transport.sendMail({
      from: `AI Book <${from}>`,
      to: input.to,
      subject: `You're invited to ${input.organizationName} on AI Book`,
      text: [
        `You are invited to join ${input.organizationName} on AI Book as ${role}.`,
        "",
        "Open this link and sign in with Google using this same email address:",
        input.inviteUrl,
        "",
        `This invitation expires on ${when}.`,
      ].join("\n"),
      html: `<p>You are invited to join <strong>${safeName}</strong> on AI Book as ${role}.</p><p><a href="${safeUrl}">Accept the invitation</a></p><p>Sign in with Google using this same email address. This invitation expires on ${when}.</p>`,
    })
  } catch (error) {
    console.error("Invitation email failed", error instanceof Error ? error.message : "unknown error")
    throw new UpstreamError("The invitation was saved, but the email could not be sent. Check the sender mailbox settings.")
  }
}
