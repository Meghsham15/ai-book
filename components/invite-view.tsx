"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { TopBar } from "@/components/top-bar"
import { postJson } from "@/lib/client-api"
import { roleLabel } from "@/lib/permissions"
import type { InviteKind, Role, SessionUser } from "@/types/domain"

export function InviteView({
  user,
  invite,
}: {
  user: SessionUser
  invite: {
    token: string
    email: string
    role: Role
    kind: InviteKind
    status: "pending" | "accepted" | "revoked" | "expired"
    organizationName: string
    organizationSlug: string
  } | null
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const matches = Boolean(user.email) && user.email === invite?.email
  const transfer = invite?.kind === "transfer"

  async function respond(action: "accept" | "decline") {
    if (!invite) return
    setPending(true)
    setError("")
    try {
      const result = await postJson<{ slug?: string }>(`/api/invitations/${action}`, { token: invite.token })
      if (action === "accept" && result.slug) {
        router.push(`/org/${result.slug}`)
        router.refresh()
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invitation could not be updated.")
      setPending(false)
    }
  }

  let body = <p className="mt-3 text-sm leading-6 text-muted">This invitation link is not valid.</p>
  if (invite?.status === "expired") {
    body = (
      <p className="mt-3 text-sm leading-6 text-muted">
        {transfer
          ? "This ownership request has expired. Ask the owner to send a new one."
          : "This invitation has expired. Ask an admin to send a new one."}
      </p>
    )
  } else if (invite?.status === "revoked") {
    body = (
      <p className="mt-3 text-sm leading-6 text-muted">
        {transfer ? "This ownership request was cancelled." : "This invitation was cancelled."}
      </p>
    )
  } else if (invite?.status === "accepted" && invite.organizationSlug) {
    body = (
      <p className="mt-3 text-sm leading-6 text-muted">
        {transfer ? `You already accepted ownership of ${invite.organizationName}.` : `You already joined ${invite.organizationName}.`}{" "}
        <Link href={`/org/${invite.organizationSlug}`} className="font-medium text-accent">
          Open the library
        </Link>
      </p>
    )
  } else if (invite && !matches) {
    body = (
      <div className="mt-4">
        <p className="text-sm leading-6 text-muted">
          This {transfer ? "request" : "invitation"} was sent to {invite.email}. You are signed in as {user.email || "another account"}. Sign out, then continue with that Google account.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: `/login?callbackUrl=/invite/${invite.token}` })}
          className="mt-4 h-11 rounded-none bg-ink px-5 text-sm font-semibold text-on-ink transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground disabled:translate-y-0 disabled:opacity-60"
        >
          Sign out
        </button>
      </div>
    )
  } else if (invite) {
    body = (
      <div className="mt-4">
        <p className="text-sm leading-6 text-muted">
          {transfer
            ? `Become the owner of ${invite.organizationName}. You become an admin, and the current owner stays an admin.`
            : `Join ${invite.organizationName} as ${roleLabel(invite.role).toLowerCase()}.`}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void respond("accept")}
            className="h-11 rounded-none bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {pending ? (transfer ? "Accepting…" : "Joining…") : transfer ? "Accept ownership" : "Accept invite"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void respond("decline")}
            className="h-11 rounded-none px-5 text-sm text-danger disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-xl px-4 py-12">
        <section>
          <h1 className="font-display text-5xl leading-none">
            {invite ? invite.organizationName : "Invitation unavailable"}
          </h1>
          {body}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </section>
        <Link href="/dashboard" className="mt-6 inline-flex text-sm font-medium text-accent">
          Go to your libraries
        </Link>
      </main>
    </div>
  )
}
