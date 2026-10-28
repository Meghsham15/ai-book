"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <h1 className="font-display text-5xl leading-none">This page could not be opened.</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Check the database connection and environment variables, then try again.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="h-11 bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:bg-ink hover:text-on-ink"
        >
          Try again
        </button>
        <Link href="/dashboard" className="inline-flex h-11 items-center border border-line px-5 text-sm font-semibold hover:border-accent">
          Go to libraries
        </Link>
      </div>
    </main>
  );
}
