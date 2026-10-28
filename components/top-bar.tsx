"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Library } from "lucide-react"
import { BrandMark } from "@/components/brand"
import { Tooltip } from "@/components/tooltip"
import { UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/domain"

export function TopBar({ user, children }: { user: SessionUser; children?: ReactNode }) {
  const pathname = usePathname()
  const onLibraries = pathname === "/dashboard"

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-card/80 px-3 shadow-[0_10px_40px_-28px_color-mix(in_srgb,var(--accent)_70%,transparent)] sm:gap-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        <Tooltip label="Go to your libraries">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="AI Book, go to libraries">
            <BrandMark />
            <span className="hidden font-display text-xl leading-none tracking-tight text-foreground sm:inline">AI Book</span>
          </Link>
        </Tooltip>
        <Link
          href="/dashboard"
          aria-current={onLibraries ? "page" : undefined}
          className={cn(
            "hidden h-9 shrink-0 items-center gap-1.5 border-b-2 px-1 text-sm font-medium transition sm:inline-flex",
            onLibraries
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          <Library className="h-4 w-4" />
          Libraries
        </Link>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
        {children}
        <UserMenu user={user} />
      </div>
    </header>
  )
}
