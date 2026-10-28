"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { signIn } from "next-auth/react"
import { BrandMark } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"

const steps = [
  {
    title: "Add sources",
    body: "Put files, public pages, and notes in one library. Everyone you invite sees the same set.",
  },
  {
    title: "Ask, or study",
    body: "Ask in the chat, or turn the sources into a report, a data table, or a quiz.",
  },
  {
    title: "Check the passage",
    body: "Open a citation to see the document and the line the answer used.",
  },
]

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l2.99-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  )
}

export function LoginScreen({
  callbackUrl,
  googleConfigured,
}: {
  callbackUrl: string
  googleConfigured: boolean
}) {
  const [pending, setPending] = useState(false)

  return (
    <main className="grid min-h-dvh overflow-x-hidden lg:grid-cols-[1.25fr_0.75fr]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12 sm:py-12">
        <div className="flex items-center justify-between gap-3">
          <BrandMark lockup />
          <ThemeToggle compact />
        </div>
        <div className="max-w-xl py-12">
          <p className="text-sm font-medium text-copper">Your research partner</p>
          <h1 className="rise mt-3 font-display text-4xl leading-[1.05] sm:text-6xl">
            Understand anything in your library.
          </h1>
          <p className="mt-6 max-w-[46ch] text-base leading-7 text-muted">
            Add the files, pages, and notes you trust. Ask about them. The reply is written only from that material, and each claim points back to the passage it came from.
          </p>
          <div className="mt-10">
            <h2 className="font-display text-2xl">How it works</h2>
            <p className="mt-2 max-w-[48ch] text-sm leading-6 text-muted">
              AI Book is for the sources you put in one shared library. Ask about them. If the answer is not in those sources, it says so.
            </p>
            <ol className="mt-5 space-y-4">
              {steps.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                  <span className="grid h-7 w-7 place-items-center border border-line text-xs font-semibold text-copper">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <article className="mt-8 max-w-md border border-line bg-card px-5 py-5 shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--accent)_55%,transparent)]">
            <p className="text-sm text-muted">Where does the handbook set the handover?</p>
            <p className="mt-3 font-display text-2xl leading-snug">The handover window is 14 days after the contract ends.</p>
            <p className="mt-4 inline-flex items-center gap-2 border-l-4 border-copper pl-3 text-sm text-muted">Handbook, page 4</p>
          </article>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted">Each library keeps its own sources, members, and chat.</p>
      </section>
      <section className="flex items-center border-line bg-sidebar px-6 py-16 text-sidebar-foreground sm:px-12 lg:border-l">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-4xl leading-none">Sign in</h2>
          <p className="mt-3 text-sm leading-6 text-sidebar-foreground/75">Use the Google account that should open your libraries.</p>
          {!googleConfigured ? (
            <p className="mt-6 border border-copper px-4 py-3 text-sm leading-6">
              Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local before signing in.
            </p>
          ) : null}
          <button
            type="button"
            disabled={!googleConfigured || pending}
            onClick={() => {
              setPending(true)
              void signIn("google", { callbackUrl })
            }}
            className="mt-8 flex h-12 w-full items-center justify-center gap-3 border border-line bg-card px-4 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-accent disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <GoogleMark />}
            {pending ? "Redirecting to Google…" : "Continue with Google"}
          </button>
        </div>
      </section>
    </main>
  )
}
