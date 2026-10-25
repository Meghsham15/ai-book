import "server-only"

import { randomBytes } from "node:crypto"
import mongoose from "mongoose"
import { emailError, normalizeEmail } from "@/lib/email-address"
import { AppError, AuthzError, UserInputError } from "@/lib/errors"
import { sendInvitationEmail } from "@/lib/mail"
import { Invitation } from "@/lib/models/invitation"
import { Membership } from "@/lib/models/membership"
import { Organization } from "@/lib/models/organization"
import { User } from "@/lib/models/user"
import type { PendingInvite, Role, SessionUser } from "@/types/domain"

const INVITE_DAYS = 7

function appOrigin() {
  return (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")
}

function freshExpiry() {
  return new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000)
}

function isPending(invite: { status: string; expiresAt: Date }) {
  return invite.status === "pending" && invite.expiresAt.getTime() > Date.now()
}

export async function inviteToOrganization(input: {
  orgId: mongoose.Types.ObjectId
  orgName: string
  invitedBy: string
  email: string
  role: Role
}) {
  const email = normalizeEmail(input.email)
  const invalid = emailError(email)
  if (invalid) throw new UserInputError(invalid)

  const existingUser = await User.findOne({ email })
  if (existingUser) {
    const membership = await Membership.exists({ organizationId: input.orgId, userId: existingUser._id })
    if (membership) throw new UserInputError("That person is already in this library.")
  }

  const token = randomBytes(32).toString("hex")
  const expiresAt = freshExpiry()
  const pending = await Invitation.findOne({
    organizationId: input.orgId,
    email,
    status: "pending",
  })

  if (pending) {
    pending.role = input.role
    pending.token = token
    pending.expiresAt = expiresAt
    pending.invitedBy = new mongoose.Types.ObjectId(input.invitedBy)
    await pending.save()
  } else {
    await Invitation.create({
      organizationId: input.orgId,
      email,
      role: input.role,
      token,
      status: "pending",
      invitedBy: input.invitedBy,
      expiresAt,
    })
  }

  const inviteUrl = `${appOrigin()}/invite/${token}`
  try {
    await sendInvitationEmail({
      to: email,
      organizationName: input.orgName,
      role: input.role,
      inviteUrl,
      expiresAt,
    })
    return { emailed: true, resent: Boolean(pending) }
  } catch (error) {
    const warning =
      error instanceof AppError
        ? error.message
        : "The invitation was saved, but the email could not be sent."
    return { emailed: false, resent: Boolean(pending), warning }
  }
}

export async function acceptInvitation(token: string, user: SessionUser) {
  const invite = await loadOpenInvitation(token, user.email)
  const existing = await Membership.findOne({ organizationId: invite.organizationId, userId: user.id })
  if (!existing) {
    await Membership.create({
      userId: user.id,
      organizationId: invite.organizationId,
      role: invite.role,
    })
  }
  invite.status = "accepted"
  await invite.save()

  const org = await Organization.findById(invite.organizationId).select("slug name")
  return { slug: org?.slug || "", name: org?.name || "Library" }
}

export async function declineInvitation(token: string, user: SessionUser) {
  const invite = await loadOpenInvitation(token, user.email)
  invite.status = "revoked"
  await invite.save()
}

export async function revokeInvitation(orgId: mongoose.Types.ObjectId, invitationId: string) {
  if (!mongoose.isValidObjectId(invitationId)) throw new UserInputError("Choose an invitation to cancel.")
  const result = await Invitation.updateOne(
    { _id: invitationId, organizationId: orgId, status: "pending" },
    { $set: { status: "revoked" } },
  )
  if (result.matchedCount === 0) throw new AuthzError("That invitation is no longer pending.", 404)
}

export async function listPendingInvites(orgId: mongoose.Types.ObjectId): Promise<PendingInvite[]> {
  const rows = await Invitation.find({
    organizationId: orgId,
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean()

  return rows.map((row) => ({
    id: String(row._id),
    email: row.email,
    role: row.role as Role,
    expiresAt: row.expiresAt.toISOString(),
  }))
}

export async function listDashboardInvitations(email: string) {
  if (!email) return []
  const rows = await Invitation.find({
    email: normalizeEmail(email),
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .populate("organizationId", "name slug")
    .sort({ createdAt: -1 })
    .lean()

  const invitations = []
  for (const row of rows) {
    const org = row.organizationId
    if (!org || typeof org !== "object" || !("name" in org) || !org.name) continue
    invitations.push({
      token: row.token,
      organizationName: String(org.name),
      role: row.role as Role,
      expiresAt: row.expiresAt.toISOString(),
    })
  }
  return invitations
}

export async function describeInvitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const invite = await Invitation.findOne({ token })
  if (!invite) return null
  const org = await Organization.findById(invite.organizationId).select("name slug")
  const expired = invite.status === "pending" && invite.expiresAt.getTime() <= Date.now()
  return {
    token: invite.token,
    email: invite.email,
    role: invite.role as Role,
    status: expired ? ("expired" as const) : invite.status,
    organizationName: org?.name || "a library",
    organizationSlug: org?.slug || "",
    expiresAt: invite.expiresAt.toISOString(),
  }
}

async function loadOpenInvitation(token: string, email: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new UserInputError("This invitation link is not valid.")
  const invite = await Invitation.findOne({ token })
  if (!invite || !isPending(invite)) throw new UserInputError("This invitation is no longer active.")
  if (!email || invite.email !== normalizeEmail(email)) {
    throw new AuthzError("Sign in with the Google account this invitation was sent to.", 403)
  }
  return invite
}
