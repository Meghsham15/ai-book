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
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-card/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Tooltip label="Go to your libraries">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="AI Book, go to libraries">
            <BrandMark />
            <span className="hidden font-display text-xl leading-none tracking-tight sm:inline">AI Book</span>
          </Link>
        </Tooltip>
        <Link
          href="/dashboard"
          aria-current={onLibraries ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 border-b-2 px-1 text-sm font-medium transition",
            onLibraries
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          <Library className="h-4 w-4" />
          Libraries
        </Link>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {children}
        <UserMenu user={user} />
      </div>
    </header>
  )
}
