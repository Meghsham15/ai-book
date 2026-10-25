"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { BrandMark } from "@/components/brand"

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
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative flex flex-col justify-between bg-sidebar px-6 py-8 text-sidebar-foreground sm:px-12 sm:py-12">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-3xl tracking-tight">AI Book</span>
        </div>
        <div className="max-w-xl py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">Shared knowledge</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.08] tracking-tight">
            Ask the things your team already knows.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-sidebar-foreground/75">
            Collect files, sites, and notes in one library. Answers stay attached to the passage they came from.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-sidebar-foreground/70">
            <li>Libraries with admin, manager, and member roles</li>
            <li>Invitations by email, even before the first sign-in</li>
            <li>A shared chat the whole library can read</li>
          </ul>
        </div>
        <p className="text-sm text-sidebar-foreground/50">Sources stay inside the library that owns them.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-[0_12px_40px_rgba(28,25,23,0.06)] sm:p-8">
          <h2 className="font-display text-3xl tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Use the Google account that should see your libraries.</p>
          {!googleConfigured ? (
            <p className="mt-6 rounded-2xl border border-copper/30 bg-copper/10 px-4 py-3 text-sm leading-6 text-foreground">
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
            className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-stone-300 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleMark />
            {pending ? "Redirecting to Google…" : "Continue with Google"}
          </button>
        </div>
      </section>
    </main>
  )
}
