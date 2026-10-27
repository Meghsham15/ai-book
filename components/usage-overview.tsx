import { UsageChart } from "@/components/usage-chart"
import type { DashboardOverview, LibraryCard } from "@/types/domain"

export function UsageOverview({
  libraries,
  overview,
}: {
  libraries: LibraryCard[]
  overview: DashboardOverview
}) {
  const documents = libraries.reduce(
    (sum, library) => sum + library.usage.files + library.usage.websites + library.usage.texts,
    0,
  )
  const chunks = libraries.reduce((sum, library) => sum + library.usage.chunks, 0)
  const questions = libraries.reduce((sum, library) => sum + library.queries, 0)
  const files = libraries.reduce((sum, library) => sum + library.usage.files, 0)
  const websites = libraries.reduce((sum, library) => sum + library.usage.websites, 0)
  const notes = libraries.reduce((sum, library) => sum + library.usage.texts, 0)

  return (
    <section className="flex flex-col gap-4" aria-label="Library overview">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.7fr)]">
        <UsageChart days={overview.days} />
        <article className="rounded-2xl border border-line bg-card px-5 py-4">
          <h2 className="text-sm font-medium">Sources</h2>
          <p className="mt-1 text-xs text-muted">How the documents are stored</p>
          <SourceMix files={files} websites={websites} notes={notes} />
          <StatusRow ready={overview.ready} processing={overview.processing} failed={overview.failed} />
        </article>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat value={documents} label="Documents" detail="Files, sites, and notes" />
        <Stat value={chunks} label="Chunks" detail="Pieces the search can use" />
        <Stat value={questions} label="Questions" detail="Asked in your libraries" />
      </div>
      {libraries.length > 1 ? (
        <article className="rounded-2xl border border-line bg-card px-5 py-4">
          <h2 className="text-sm font-medium">Libraries</h2>
          <p className="mt-1 text-xs text-muted">Bar length compares libraries. The largest value fills the row.</p>
          <ul className="mt-4 space-y-4">
            {libraries.map((library) => (
              <LibraryCompare key={library.id} library={library} libraries={libraries} />
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  )
}

function Stat({ value, label, detail }: { value: number; label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tracking-tight">{value.toLocaleString("en-US")}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </div>
  )
}

function SourceMix({ files, websites, notes }: { files: number; websites: number; notes: number }) {
  const parts = [
    { label: "Files", value: files, color: "var(--accent)" },
    { label: "Sites", value: websites, color: "var(--copper)" },
    { label: "Notes", value: notes, color: "var(--ink)" },
  ]
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let cursor = 0

  return (
    <div className="mt-4 flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img" aria-label={`${total} documents`}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-foreground/8" />
        {total > 0
          ? parts.map((part) => {
              if (part.value === 0) return null
              const length = (part.value / total) * circumference
              const start = cursor
              cursor += length
              return (
                <circle
                  key={part.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={part.color}
                  strokeWidth="12"
                  strokeDasharray={`${length} ${Math.max(circumference - length, 0.01)}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 60 60)"
                />
              )
            })
          : null}
        <text x="60" y="56" textAnchor="middle" fill="currentColor" className="font-display text-[22px] text-foreground">
          {total}
        </text>
        <text x="60" y="74" textAnchor="middle" fill="currentColor" className="text-[10px] text-muted">
          total
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: part.color }} />
              {part.label}
            </span>
            <span className="font-medium">{part.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusRow({ ready, processing, failed }: { ready: number; processing: number; failed: number }) {
  const total = ready + processing + failed
  const parts = [
    { label: "Ready", value: ready, className: "bg-accent" },
    { label: "Indexing", value: processing, className: "bg-copper" },
    { label: "Failed", value: failed, className: "bg-danger" },
  ]
  return (
    <div className="mt-5">
      <div className="flex h-2 overflow-hidden rounded-full bg-foreground/8" aria-hidden="true">
        {total === 0
          ? null
          : parts.map((part) =>
              part.value > 0 ? (
                <span key={part.label} className={part.className} style={{ width: `${(part.value / total) * 100}%` }} />
              ) : null,
            )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((part) => (
          <li key={part.label}>
            {part.label} {part.value}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LibraryCompare({ library, libraries }: { library: LibraryCard; libraries: LibraryCard[] }) {
  const maxChunks = Math.max(1, ...libraries.map((item) => item.usage.chunks))
  const maxQuestions = Math.max(1, ...libraries.map((item) => item.queries))
  const rows = [
    { label: "Chunks", value: library.usage.chunks, max: maxChunks, className: "bg-accent" },
    { label: "Questions", value: library.queries, max: maxQuestions, className: "bg-copper" },
  ]
  return (
    <li>
      <p className="text-sm font-medium">{library.name}</p>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
            <span className="text-xs text-muted">{row.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-foreground/8" aria-hidden="true">
              <span
                className={`block h-full rounded-full ${row.className}`}
                style={{ width: `${row.value === 0 ? 0 : Math.max(4, (row.value / row.max) * 100)}%` }}
              />
            </span>
            <span className="text-right text-xs font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </li>
  )
}
