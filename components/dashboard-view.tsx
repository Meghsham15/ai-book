"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Library, Plus } from "lucide-react"
import { SetupNotice } from "@/components/setup-notice"
import { TopBar } from "@/components/top-bar"
import { postJson } from "@/lib/client-api"
import { formatDate } from "@/lib/format"
import { roleLabel } from "@/lib/permissions"
import type { DashboardInvitation, LibraryCard, SessionUser } from "@/types/domain"

export function DashboardView({
  user,
  libraries,
  invitations,
  configError,
}: {
  user: SessionUser
  libraries: LibraryCard[]
  invitations: DashboardInvitation[]
  configError: string | null
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const created = await postJson<{ slug: string }>("/api/organizations", { name })
      router.push(`/org/${created.slug}`)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The library could not be created.")
      setPending(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <TopBar user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-copper">Libraries</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight">Hello, {user.name.split(" ")[0] || "there"}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Each library keeps its own sources, members, and chat. Creating one makes you the admin.
            </p>
          </div>
          <p className="text-sm text-muted">
            {libraries.length} {libraries.length === 1 ? "library" : "libraries"}
          </p>
        </div>

        {configError ? <SetupNotice message={configError} /> : null}
        {invitations.length > 0 ? <InvitationList invitations={invitations} /> : null}

        <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5">
          <label htmlFor="library-name" className="text-sm font-medium">
            New library
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="library-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product handbook"
              minLength={2}
              maxLength={60}
              required
              className="h-12 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none transition focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending || Boolean(configError)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-teal-800 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {pending ? "Creating…" : "Create library"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </form>

        {libraries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card/60 px-6 py-16 text-center">
            <p className="font-display text-3xl">No libraries yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              Create one, then invite teammates by email. They can join even if they have never signed in.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {libraries.map((library) => {
              const sources = library.usage.files + library.usage.websites + library.usage.texts
              return (
                <li key={library.id}>
                  <Link
                    href={`/org/${library.slug}`}
                    className="flex h-full flex-col rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_10px_30px_rgba(14,110,104,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                        <Library className="h-4 w-4" />
                      </span>
                      <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                        {roleLabel(library.role)}
                      </span>
                    </div>
                    <h2 className="mt-4 font-display text-2xl leading-none tracking-tight">{library.name}</h2>
                    <p className="mt-4 text-sm text-muted">
                      {sources} {sources === 1 ? "source" : "sources"} · {library.usage.chunks} chunks
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}

function InvitationList({ invitations }: { invitations: DashboardInvitation[] }) {
  const router = useRouter()
  const [pendingToken, setPendingToken] = useState("")
  const [error, setError] = useState("")

  async function respond(token: string, action: "accept" | "decline") {
    setPendingToken(token)
    setError("")
    try {
      const result = await postJson<{ slug?: string }>(`/api/invitations/${action}`, { token })
      if (action === "accept" && result.slug) {
        router.push(`/org/${result.slug}`)
      }
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invitation could not be updated.")
    } finally {
      setPendingToken("")
    }
  }

  return (
    <section className="rounded-2xl border border-copper/30 bg-card p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <h2 className="font-display text-2xl">Invitations</h2>
      <p className="mt-1 text-sm leading-6 text-muted">These libraries invited the Google account you used to sign in.</p>
      <ul className="mt-4 divide-y divide-line">
        {invitations.map((invite) => (
          <li key={invite.token} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{invite.organizationName}</p>
              <p className="text-sm text-muted">
                {invite.kind === "transfer"
                  ? "Ownership transfer"
                  : `Join as ${roleLabel(invite.role).toLowerCase()}`}{" "}
                · expires {formatDate(invite.expiresAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pendingToken === invite.token}
                onClick={() => void respond(invite.token, "accept")}
                className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {invite.kind === "transfer" ? "Accept ownership" : "Accept"}
              </button>
              <button
                type="button"
                disabled={pendingToken === invite.token}
                onClick={() => void respond(invite.token, "decline")}
                className="h-10 rounded-full px-4 text-sm text-danger disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </section>
  )
}
