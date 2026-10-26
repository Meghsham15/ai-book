"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
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
    <div className="min-h-dvh">
      <TopBar user={user} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Link href={`/org/${org.slug}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to {org.name}
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">Settings</p>
          <h1 className="mt-2 font-display text-5xl tracking-tight">{org.name}</h1>
          <p className="mt-2 text-sm text-muted">You are {roleLabel(org.role).toLowerCase()} here{org.isOwner ? " and the owner" : ""}.</p>
        </div>

        {admin ? <RenameForm org={org} /> : null}
        <MembersCard org={org} members={members} invitations={invitations} currentUserId={user.id} admin={admin} />
        {admin ? <LimitsForm org={org} /> : <LimitsReadout org={org} />}
        <SearchCard org={org} />
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
    <form onSubmit={onSubmit} className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-display text-3xl">Library name</h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={60}
          required
          className="h-11 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={pending} className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60">
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
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-display text-3xl">People</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Admins invite people by email. Someone who already uses AI Book also sees the invitation on their dashboard. A new person opens the link and signs in with that same Google account.
      </p>
      <ul className="mt-5 divide-y divide-line">
        {members.map((member) => (
          <li key={member.userId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {member.name} {member.isOwner ? <span className="text-xs text-copper">Owner</span> : null}
              </p>
              <p className="text-sm text-muted">{member.email}</p>
            </div>
            {admin ? (
              <div className="flex items-center gap-2">
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
                  className="h-10 rounded-full border border-line bg-white px-3 text-sm"
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {roleLabel(item)}
                    </option>
                  ))}
                </select>
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
                    className="h-10 rounded-full px-3 text-sm text-danger"
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
            className="h-11 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-accent"
          />
          <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="h-11 rounded-full border border-line bg-white px-3 text-sm">
            {roles.map((item) => (
              <option key={item} value={item}>
                {roleLabel(item)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-60">
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
                className="h-10 rounded-full px-3 text-sm text-danger"
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
              className="h-11 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-accent"
            />
            <button type="submit" disabled={pending || !ownerEmail.trim()} className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

function LimitsForm({ org }: { org: OrgDetails }) {
  const router = useRouter()
  const [limits, setLimits] = useState(org.limits)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")

  function update(key: keyof typeof limits, value: string) {
    setLimits((current) => ({ ...current, [key]: Number(value) }))
  }

  return (
    <form
      className="rounded-3xl border border-line bg-card p-5"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault()
        setPending(true)
        setMessage("")
        try {
          await patchJson(`/api/organizations/${org.id}`, limits)
          setMessage("Limits saved.")
          router.refresh()
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Limits could not be saved.")
        } finally {
          setPending(false)
        }
      }}
    >
      <h2 className="font-display text-3xl">Limits</h2>
      <p className="mt-2 text-sm text-muted">
        Using {org.usage.files} files, {org.usage.websites} websites, {org.usage.texts} notes, and {org.usage.chunks} chunks.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <LimitField label="Files" value={limits.maxFiles} onChange={(value) => update("maxFiles", value)} />
        <LimitField label="Websites" value={limits.maxWebsites} onChange={(value) => update("maxWebsites", value)} />
        <LimitField label="Notes" value={limits.maxTexts} onChange={(value) => update("maxTexts", value)} />
        <LimitField label="Chunks" value={limits.maxChunks} onChange={(value) => update("maxChunks", value)} />
      </div>
      <button type="submit" disabled={pending} className="mt-4 h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : "Save limits"}
      </button>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </form>
  )
}

function LimitField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <input
        type="number"
        value={value}
        min={1}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-line bg-white px-3 outline-none focus:border-accent"
      />
    </label>
  )
}

function LimitsReadout({ org }: { org: OrgDetails }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5 text-sm leading-6">
      <h2 className="font-display text-3xl">Limits</h2>
      <p className="mt-3 text-muted">
        {org.usage.files}/{org.limits.maxFiles} files · {org.usage.websites}/{org.limits.maxWebsites} websites · {org.usage.texts}/{org.limits.maxTexts} notes · {org.usage.chunks}/{org.limits.maxChunks} chunks
      </p>
    </section>
  )
}

function SearchCard({ org }: { org: OrgDetails }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-display text-3xl">Search index</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Embeddings are {org.embeddingProvider === "pending" ? "chosen when the first source is added" : org.embeddingProvider}
        {org.embeddingDimensions ? ` · ${org.embeddingDimensions} dimensions` : ""}. Retrieval mode is {org.vectorSearch}.
        The provider stays with this library until every source is removed.
      </p>
      {org.vectorSearch === "atlas" ? (
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-sidebar p-4 text-xs leading-5 text-sidebar-foreground">{org.atlasIndex}</pre>
      ) : null}
    </section>
  )
}
