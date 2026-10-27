"use client"

import { useState } from "react"
import type { UsageDay } from "@/types/domain"

const metrics = [
  { id: "questions", label: "Questions", hint: "Asked each day" },
  { id: "documents", label: "Documents", hint: "Added each day" },
  { id: "chunks", label: "Chunks", hint: "Indexed each day" },
] as const

type Metric = (typeof metrics)[number]["id"]

export function UsageChart({ days }: { days: UsageDay[] }) {
  const [metric, setMetric] = useState<Metric>("questions")
  const [hover, setHover] = useState<number | null>(null)
  const active = metrics.find((item) => item.id === metric) ?? metrics[0]
  const values = days.map((day) => day[metric])
  const total = values.reduce((sum, value) => sum + value, 0)
  const hovered = hover == null ? null : days[hover]

  return (
    <article className="rounded-2xl border border-line bg-card px-5 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium">{active.label} over 14 days</h2>
          <p className="mt-1 text-xs text-muted">{active.hint}. Days are counted in UTC.</p>
        </div>
        <p className="font-display text-4xl tracking-tight">{total.toLocaleString("en-US")}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Chart metric">
        {metrics.map((item) => {
          const selected = item.id === metric
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setMetric(item.id)
                setHover(null)
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                selected ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-foreground"
              }`}
            >
              <Sparkline values={days.map((day) => day[item.id])} active={selected} />
              {item.label}
            </button>
          )
        })}
      </div>
      <AreaChart
        days={days}
        values={values}
        hover={hover}
        onHover={setHover}
        label={active.label}
      />
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {hovered
          ? `${dayLabel(hovered.date)}: ${hovered[metric].toLocaleString("en-US")} ${active.label.toLowerCase()}`
          : "Move across the line to see one day."}
      </p>
    </article>
  )
}

function AreaChart({
  days,
  values,
  hover,
  onHover,
  label,
}: {
  days: UsageDay[]
  values: number[]
  hover: number | null
  onHover: (index: number | null) => void
  label: string
}) {
  const width = 720
  const height = 220
  const pad = { left: 32, right: 12, top: 18, bottom: 28 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const max = Math.max(1, ...values)
  const coords = values.map((value, index) => ({
    x: pad.left + (index / Math.max(values.length - 1, 1)) * plotW,
    y: pad.top + plotH - (value / max) * plotH,
  }))
  const line = monotonePath(coords)
  const area = `${line} L ${coords.at(-1)?.x ?? pad.left} ${pad.top + plotH} L ${coords[0]?.x ?? pad.left} ${pad.top + plotH} Z`
  const ticks = [0, Math.ceil(max / 2), max].filter((tick, index, all) => all.indexOf(tick) === index)
  const focus = hover == null ? null : coords[hover]

  function move(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * width
    const index = Math.round(((x - pad.left) / plotW) * (values.length - 1))
    onHover(Math.min(values.length - 1, Math.max(0, index)))
  }

  return (
    <div className="relative mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full"
        role="img"
        aria-label={`${label} for each of the last ${days.length} days. Peak is ${max}.`}
        onMouseMove={move}
        onMouseLeave={() => onHover(null)}
      >
        {ticks.map((tick) => {
          const y = pad.top + plotH - (tick / max) * plotH
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="currentColor" className="text-foreground/10" />
              <text x={0} y={y + 4} fill="currentColor" className="text-[11px] text-muted">
                {tick}
              </text>
            </g>
          )
        })}
        <path d={area} fill="currentColor" className="text-accent/15" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" className="text-accent" />
        {focus && hover != null ? (
          <g>
            <line
              x1={focus.x}
              x2={focus.x}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="currentColor"
              className="text-foreground/25"
            />
            <circle cx={focus.x} cy={focus.y} r="5" fill="var(--card)" stroke="currentColor" className="text-accent" strokeWidth="2.5" />
          </g>
        ) : null}
        {days.map((day, index) => {
          const show = index === 0 || index === days.length - 1 || index === Math.floor(days.length / 2)
          if (!show) return null
          return (
            <text
              key={day.date}
              x={coords[index]?.x ?? 0}
              y={height - 6}
              textAnchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}
              fill="currentColor"
              className="text-[11px] text-muted"
            >
              {dayLabel(day.date)}
            </text>
          )
        })}
      </svg>
      {focus && hover != null ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${(focus.x / width) * 100}%`, top: `${Math.max(0, (focus.y / height) * 100 - 18)}%` }}
        >
          <span className="text-muted">{dayLabel(days[hover].date)}</span>
          <span className="ml-2 font-medium">{values[hover].toLocaleString("en-US")}</span>
        </div>
      ) : null}
    </div>
  )
}

function Sparkline({ values, active }: { values: number[]; active: boolean }) {
  const width = 56
  const height = 18
  const max = Math.max(1, ...values)
  const coords = values.map((value, index) => ({
    x: (index / Math.max(values.length - 1, 1)) * width,
    y: height - (value / max) * (height - 2) - 1,
  }))
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`h-4 w-14 ${active ? "text-accent" : "text-muted"}`} aria-hidden="true">
      <path d={monotonePath(coords)} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function dayLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, (month || 1) - 1, day || 1)),
  )
}

function monotonePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  const slopes: number[] = []
  const dx: number[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    dx[index] = points[index + 1].x - points[index].x || 1
    slopes[index] = (points[index + 1].y - points[index].y) / dx[index]
  }
  const tangent = slopes.map((slope, index) => {
    if (index === 0) return slope
    const previous = slopes[index - 1]
    if (previous * slope <= 0) return 0
    return (previous + slope) / 2
  })
  tangent.push(slopes[slopes.length - 1] ?? 0)
  for (let index = 0; index < slopes.length; index += 1) {
    if (Math.abs(slopes[index]) < 1e-6) {
      tangent[index] = 0
      tangent[index + 1] = 0
      continue
    }
    const a = tangent[index] / slopes[index]
    const b = tangent[index + 1] / slopes[index]
    const size = a * a + b * b
    if (size > 9) {
      const scale = 3 / Math.sqrt(size)
      tangent[index] = scale * a * slopes[index]
      tangent[index + 1] = scale * b * slopes[index]
    }
  }
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const span = dx[index]
    const current = points[index]
    const next = points[index + 1]
    path += ` C ${current.x + span / 3} ${current.y + (tangent[index] * span) / 3}, ${next.x - span / 3} ${next.y - (tangent[index + 1] * span) / 3}, ${next.x} ${next.y}`
  }
  return path
}
