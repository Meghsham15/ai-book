"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { BrandMark } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"

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
    <main className="grid min-h-dvh lg:grid-cols-[1.25fr_0.75fr]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12 sm:py-12">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="font-display text-2xl leading-none">AI Book</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="max-w-xl py-12">
          <h1 className="rise font-display text-5xl leading-[1.05] sm:text-6xl">
            Ask the library your team already wrote.
          </h1>
          <p className="mt-6 max-w-[42ch] text-base leading-7 text-muted">
            Files, pages, and notes stay together. Every answer points back to the passage it came from.
          </p>
          <article className="rise-late mt-10 max-w-md border border-line bg-card px-5 py-5 shadow-[0_24px_50px_-32px_rgba(26,33,64,0.65)]">
            <p className="font-display text-2xl leading-snug">The handover window is 14 days after the contract ends.</p>
            <p className="mt-4 inline-flex items-center gap-2 border-l-4 border-copper pl-3 text-sm text-muted">Handbook, page 4</p>
          </article>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted">Sources stay inside the library that owns them.</p>
      </section>
      <section className="flex items-center bg-sidebar px-6 py-16 text-sidebar-foreground sm:px-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-4xl leading-none">Sign in</h2>
          <p className="mt-3 text-sm leading-6 text-sidebar-foreground/75">Use the Google account that should see your libraries.</p>
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
            className="mt-8 flex h-12 w-full items-center justify-center gap-3 bg-card px-4 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:bg-background disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleMark />
            {pending ? "Redirecting to Google…" : "Continue with Google"}
          </button>
        </div>
      </section>
    </main>
  )
}
