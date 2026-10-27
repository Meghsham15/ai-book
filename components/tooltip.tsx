"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number; above: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    function place() {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const above = rect.top > 56
      setBox({
        top: above ? rect.top - 6 : rect.bottom + 6,
        left: Math.min(Math.max(rect.left + rect.width / 2, 24), window.innerWidth - 24),
        above,
      })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open])

  return (
    <>
      <span
        ref={anchorRef}
        className={cn("inline-flex max-w-full", className)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open && box
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-40 max-w-64 rounded-none border border-line bg-card px-2 py-1 text-left text-xs leading-5 text-foreground shadow-[0_8px_24px_rgba(28,25,23,0.12)]"
              style={{ top: box.top, left: box.left, transform: `translate(-50%, ${box.above ? "-100%" : "0"})` }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}
