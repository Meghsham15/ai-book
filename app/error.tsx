"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">Something went wrong</p>
      <h1 className="mt-3 font-display text-5xl tracking-tight">This page could not be opened.</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Check the database connection and environment variables, then try again.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link href="/dashboard" className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-semibold">
          Go to libraries
        </Link>
      </div>
    </main>
  );
}
