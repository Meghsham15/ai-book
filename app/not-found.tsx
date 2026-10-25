import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">404</p>
      <h1 className="mt-3 font-display text-5xl tracking-tight">That page is not in the library.</h1>
      <Link href="/dashboard" className="mt-6 text-sm font-semibold text-accent">
        Back to your libraries
      </Link>
    </main>
  );
}
