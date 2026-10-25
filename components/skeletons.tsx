export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-14 border-b border-line bg-card" />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-10">
        <div className="h-10 w-56 animate-pulse rounded-full bg-line" />
        <div className="h-28 animate-pulse rounded-3xl bg-card" />
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  )
}

export function WorkspaceSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="h-14 border-b border-line bg-card" />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="hidden bg-sidebar lg:block" />
        <div className="p-8">
          <div className="h-8 w-52 animate-pulse rounded-full bg-line" />
          <p className="mt-4 text-sm text-muted">Opening the library…</p>
        </div>
      </div>
    </div>
  )
}
