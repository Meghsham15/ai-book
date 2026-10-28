"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

const storageKey = "ai-book-theme"

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark")
  localStorage.setItem(storageKey, theme)
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  function choose(next: "light" | "dark") {
    setTheme(next)
    applyTheme(next)
  }

  if (compact) {
    const dark = theme === "dark"
    return (
      <button
        type="button"
        aria-pressed={dark}
        aria-label={dark ? "Switch to light" : "Switch to dark"}
        onClick={() => choose(dark ? "light" : "dark")}
        className="grid h-9 w-9 shrink-0 place-items-center border border-line text-foreground transition hover:border-accent"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    )
  }

  return (
    <div
      className="grid h-11 w-full max-w-xs grid-cols-2 border border-line bg-card p-1"
      role="group"
      aria-label="Appearance"
    >
      <ThemeChoice label="Light" icon={<Sun className="h-3.5 w-3.5" />} pressed={theme === "light"} compact={compact} onClick={() => choose("light")} />
      <ThemeChoice label="Dark" icon={<Moon className="h-3.5 w-3.5" />} pressed={theme === "dark"} compact={compact} onClick={() => choose("dark")} />
    </div>
  )
}

function ThemeChoice({
  label,
  icon,
  pressed,
  compact,
  onClick,
}: {
  label: string
  icon: ReactNode
  pressed: boolean
  compact: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition",
        pressed ? "bg-ink text-on-ink" : "text-muted hover:bg-background hover:text-foreground",
      )}
    >
      {icon}
      {compact ? <span className="sr-only">{label}</span> : label}
    </button>
  )
}
