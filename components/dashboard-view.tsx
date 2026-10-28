"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { SetupNotice } from "@/components/setup-notice"
import { Tooltip } from "@/components/tooltip"
import { TopBar } from "@/components/top-bar"
import { UsageOverview } from "@/components/usage-overview"
import { postJson } from "@/lib/client-api"
import { formatDate } from "@/lib/format"
import { roleLabel } from "@/lib/permissions"
import type { DashboardInvitation, DashboardOverview, LibraryCard, SessionUser } from "@/types/domain"

export function DashboardView({
  user,
  libraries,
  invitations,
  overview,
  configError,
}: {
  user: SessionUser
  libraries: LibraryCard[]
  invitations: DashboardInvitation[]
  overview: DashboardOverview
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
    <div className="min-h-dvh overflow-x-hidden">
      <TopBar user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="rise font-display text-4xl leading-none sm:text-5xl">Hello, {user.name.split(" ")[0] || "there"}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
              Each library keeps its own sources, members, and chat. Creating one makes you the admin.
            </p>
          </div>
          <p className="text-sm text-muted">
            {libraries.length} {libraries.length === 1 ? "library" : "libraries"}
          </p>
        </div>
        {libraries.length === 0 ? (
          <div className="border-y border-line py-16">
            <p className="font-display text-4xl">No libraries yet</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted">
              Create one below, then invite teammates by email. They can join even if they have never signed in.
            </p>
          </div>
        ) : (
          <ul className="border-y border-line">
            {libraries.map((library) => {
              const sources = library.usage.files + library.usage.websites + library.usage.texts
              return (
                <li key={library.id} className="border-b border-line last:border-b-0">
                  <Link href={`/org/${library.slug}`} className="page-link grid gap-2 py-5 pl-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div>
                      <h2 className="break-words font-display text-3xl leading-none">{library.name}</h2>
                      <p className="mt-2 text-sm text-muted">
                        {sources} {sources === 1 ? "source" : "sources"}, {library.queries}{" "}
                        {library.queries === 1 ? "question" : "questions"}
                      </p>
                    </div>
                    <Tooltip
                      label={
                        library.role === "admin"
                          ? "You can manage this library"
                          : library.role === "manager"
                            ? "You can add and remove sources"
                            : "You can ask questions"
                      }
                    >
                      <span className="text-sm text-accent">{roleLabel(library.role)}</span>
                    </Tooltip>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <form onSubmit={onSubmit}>
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
              className="h-12 flex-1 border border-line bg-card px-4 text-sm outline-none transition focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending || Boolean(configError)}
              className="inline-flex h-12 items-center justify-center gap-2 bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:bg-ink hover:text-on-ink disabled:translate-y-0 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" />}
              {pending ? "Creating…" : "Create library"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </form>

        {invitations.length > 0 ? <InvitationList invitations={invitations} /> : null}
        {configError ? <SetupNotice message={configError} /> : <UsageOverview libraries={libraries} overview={overview} />}

       
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
    <section className="border-t border-line pt-6">
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
                className="inline-flex h-10 items-center gap-2 bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:bg-ink hover:text-on-ink disabled:translate-y-0 disabled:opacity-60"
              >
                {pendingToken === invite.token ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {invite.kind === "transfer" ? "Accept ownership" : "Accept"}
              </button>
              <button
                type="button"
                disabled={pendingToken === invite.token}
                onClick={() => void respond(invite.token, "decline")}
                className="h-10 px-4 text-sm text-danger disabled:opacity-60"
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
