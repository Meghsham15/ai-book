import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <h1 className="font-display text-5xl leading-none">That page is not in the library.</h1>
      <Link href="/dashboard" className="mt-6 inline-flex h-11 w-fit items-center bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:bg-ink hover:text-on-ink">
        Go to libraries
      </Link>
    </main>
  );
}
