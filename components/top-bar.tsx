"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { BrandMark } from "@/components/brand"
import { UserMenu } from "@/components/user-menu"
import type { SessionUser } from "@/types/domain"

export function TopBar({ user, children }: { user: SessionUser; children?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-card/90 px-4 backdrop-blur sm:px-6">
      <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
        <BrandMark />
        <span className="font-display text-xl leading-none tracking-tight">AI Book</span>
      </Link>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {children}
        <UserMenu user={user} />
      </div>
    </header>
  )
}
