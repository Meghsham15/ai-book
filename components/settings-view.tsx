"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Tooltip } from "@/components/tooltip"
import { TopBar } from "@/components/top-bar"
import { deleteJson, patchJson, postJson } from "@/lib/client-api"
import { canManageOrg, roleLabel } from "@/lib/permissions"
import { emailError } from "@/lib/email-address"
import { formatDate } from "@/lib/format"
import type { MemberItem, OrgDetails, PendingInvite, Role, SessionUser } from "@/types/domain"

const roles: Role[] = ["admin", "manager", "member"]

export function SettingsView({
  user,
  org,
  members,
  invitations,
}: {
  user: SessionUser
  org: OrgDetails
  members: MemberItem[]
  invitations: PendingInvite[]
}) {
  const admin = canManageOrg(org.role)

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <TopBar user={user} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
            Libraries
          </Link>
          <Link href={`/org/${org.slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent">
            <ArrowLeft className="h-4 w-4" />
            Back to {org.name}
          </Link>
        </div>
        <div>
          <h1 className="break-words font-display text-4xl leading-none sm:text-5xl">{org.name}</h1>
          <p className="mt-2 text-sm text-muted">You are {roleLabel(org.role).toLowerCase()} here{org.isOwner ? " and the owner" : ""}.</p>
        </div>

        <section className="border border-line bg-card p-5">
          <h2 className="font-display text-3xl">Appearance</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Light or dark. This stays on this browser.</p>
          <div className="mt-4">
            <ThemeToggle />
          </div>
        </section>
        {admin ? <RenameForm org={org} /> : null}
        <MembersCard org={org} members={members} invitations={invitations} currentUserId={user.id} admin={admin} />
        {org.isOwner ? <DeleteLibrary org={org} /> : null}
      </main>
    </div>
  )
}

function RenameForm({ org }: { org: OrgDetails }) {
  const router = useRouter()
  const [name, setName] = useState(org.name)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage("")
    try {
      await patchJson(`/api/organizations/${org.id}`, { name })
      setMessage("Name saved. The link stays the same.")
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The name could not be saved.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-line bg-card p-5">
      <h2 className="font-display text-3xl">Library name</h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={60}
          required
          className="h-11 flex-1 rounded-none border border-line bg-card px-4 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={pending} className="h-11 rounded-none bg-ink px-5 text-sm font-semibold text-on-ink transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground disabled:translate-y-0 disabled:opacity-60">
          {pending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> : null}
          {pending ? "Saving…" : "Save name"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </form>
  )
}

function MembersCard({
  org,
  members,
  invitations,
  currentUserId,
  admin,
}: {
  org: OrgDetails
  members: MemberItem[]
  invitations: PendingInvite[]
  currentUserId: string
  admin: boolean
}) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("member")
  const [message, setMessage] = useState("")
  const [messageTone, setMessageTone] = useState<"ok" | "bad">("ok")
  const [pending, setPending] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState("")

  function showMessage(text: string, tone: "ok" | "bad" = "ok") {
    setMessage(text)
    setMessageTone(tone)
  }

  async function sendInvite(event: FormEvent) {
    event.preventDefault()
    const invalid = emailError(email)
    if (invalid) {
      showMessage(invalid, "bad")
      return
    }
    setPending(true)
    setMessage("")
    try {
      const result = await postJson<{ emailed: boolean; resent?: boolean; warning?: string }>(
        `/api/organizations/${org.id}/members`,
        { email, role },
      )
      setEmail("")
      if (result.warning) showMessage(result.warning, "bad")
      else showMessage(result.resent ? "Invitation sent again." : "Invitation sent.")
      router.refresh()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "The invitation could not be sent.", "bad")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="border border-line bg-card p-5">
      <h2 className="font-display text-3xl">People</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Admins invite people by email. Someone who already uses AI Book also sees the invitation on their dashboard. A new person opens the link and signs in with that same Google account.
      </p>
      <ul className="mt-5 divide-y divide-line">
        {members.map((member) => (
          <li key={member.userId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {member.name}{" "}
                {member.isOwner ? (
                  <Tooltip label="The owner can delete this library">
                    <span className="text-xs text-copper">Owner</span>
                  </Tooltip>
                ) : null}
              </p>
              <p className="break-all text-sm text-muted">{member.email}</p>
            </div>
            {admin ? (
              <div className="flex items-center gap-2">
                <Tooltip label={member.isOwner ? "Transfer ownership before changing the owner's role" : "Admin manages people. Manager adds sources. Member can ask."}>
                <select
                  value={member.role}
                  disabled={member.isOwner || pending}
                  onChange={async (event) => {
                    setPending(true)
                    setMessage("")
                    try {
                      await patchJson(`/api/organizations/${org.id}/members`, {
                        userId: member.userId,
                        role: event.target.value,
                      })
                      router.refresh()
                    } catch (error) {
                      showMessage(error instanceof Error ? error.message : "The role could not be changed.", "bad")
                    } finally {
                      setPending(false)
                    }
                  }}
                  className="h-10 rounded-none border border-line bg-card px-3 text-sm"
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {roleLabel(item)}
                    </option>
                  ))}
                </select>
                </Tooltip>
                {!member.isOwner ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true)
                      setMessage("")
                      setMessageTone("bad")
                      try {
                        await deleteJson(`/api/organizations/${org.id}/members?userId=${member.userId}`)
                        if (member.userId === currentUserId) {
                          router.push("/dashboard")
                          return
                        }
                        router.refresh()
                      } catch (error) {
                        showMessage(error instanceof Error ? error.message : "The member could not be removed.", "bad")
                      } finally {
                        setPending(false)
                      }
                    }}
                    className="h-10 rounded-none px-3 text-sm text-danger"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ) : (
              <span className="text-sm text-muted">{roleLabel(member.role)}</span>
            )}
          </li>
        ))}
      </ul>

      {admin ? (
        <form onSubmit={sendInvite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@company.com"
            aria-invalid={email.length > 0 && Boolean(emailError(email))}
            className="h-11 rounded-none border border-line bg-card px-4 text-sm outline-none focus:border-accent"
          />
          <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="h-11 rounded-none border border-line bg-card px-3 text-sm">
            {roles.map((item) => (
              <option key={item} value={item}>
                {roleLabel(item)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="h-11 rounded-none bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:bg-ink hover:text-on-ink disabled:translate-y-0 disabled:opacity-60">
            {pending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> : null}
            {pending ? "Sending…" : "Send invite"}
          </button>
        </form>
      ) : null}
      {admin && invitations.length > 0 ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {invitations.map((invite) => (
            <li key={invite.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{invite.email}</p>
                <p className="text-sm text-muted">
                  {invite.kind === "transfer" ? "Ownership transfer" : roleLabel(invite.role)} · pending until {formatDate(invite.expiresAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={async () => {
                  setPending(true)
                  setMessage("")
                  try {
                    await deleteJson(`/api/organizations/${org.id}/invitations?id=${invite.id}`)
                    showMessage(invite.kind === "transfer" ? "Ownership request cancelled." : "Invitation cancelled.")
                    router.refresh()
                  } catch (error) {
                    showMessage(error instanceof Error ? error.message : "The invitation could not be cancelled.", "bad")
                  } finally {
                    setPending(false)
                  }
                }}
                className="h-10 rounded-none px-3 text-sm text-danger"
              >
                {invite.kind === "transfer" ? "Cancel request" : "Cancel invite"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p className={`mt-3 text-sm ${messageTone === "bad" ? "text-danger" : "text-muted"}`}>{message}</p>
      ) : null}

      {org.isOwner ? (
        <form
          className="mt-6 border-t border-line pt-5"
          onSubmit={async (event) => {
            event.preventDefault()
            const invalid = emailError(ownerEmail)
            if (invalid) {
              showMessage(invalid, "bad")
              return
            }
            setPending(true)
            setMessage("")
            try {
              const result = await postJson<{ emailed: boolean; resent?: boolean; warning?: string }>(
                `/api/organizations/${org.id}/transfer`,
                { email: ownerEmail },
              )
              setOwnerEmail("")
              if (result.warning) showMessage(result.warning, "bad")
              else showMessage(result.resent ? "Ownership request sent again." : "Ownership request sent.")
              router.refresh()
            } catch (error) {
              showMessage(error instanceof Error ? error.message : "The ownership request could not be sent.", "bad")
            } finally {
              setPending(false)
            }
          }}
        >
          <h3 className="font-medium">Transfer ownership</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Enter an email, even if that person has never signed in. They get a request by email, and someone who already uses AI Book also sees it on their dashboard. Ownership moves only after they accept. You stay an admin.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              placeholder="name@email.com"
              required
              className="h-11 flex-1 rounded-none border border-line bg-card px-4 text-sm outline-none focus:border-accent"
            />
            <button type="submit" disabled={pending || !ownerEmail.trim()} className="h-11 rounded-none bg-ink px-5 text-sm font-semibold text-on-ink transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground disabled:translate-y-0 disabled:opacity-60">
              {pending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> : null}
              {pending ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

function DeleteLibrary({ org }: { org: OrgDetails }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const confirmed = name.trim() === org.name

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!confirmed) {
      setMessage("Type the library name exactly to confirm.")
      return
    }
    setPending(true)
    setMessage("")
    try {
      await deleteJson(`/api/organizations/${org.id}`, { name: name.trim() })
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The library could not be deleted.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-danger/30 bg-card p-5">
      <h2 className="font-display text-3xl">Delete library</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        This removes {org.name} for everyone connected to it. Files, websites, notes, search chunks, chat, members, and pending invitations are deleted with it.
      </p>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-muted">Type {org.name} to confirm</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          className="h-11 w-full border border-line bg-card px-3 outline-none focus:border-danger"
        />
      </label>
      <button
        type="submit"
        disabled={!confirmed || pending}
        className="mt-4 h-11 rounded-none bg-danger-fill px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-ink hover:text-on-ink disabled:translate-y-0 disabled:opacity-60"
      >
        {pending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Deleting…" : "Delete library"}
      </button>
      {message ? <p className="mt-3 text-sm text-danger">{message}</p> : null}
    </form>
  )
}
