"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Tooltip } from "@/components/tooltip"
import type { SessionUser } from "@/types/domain"

export function UserMenu({ user }: { user: SessionUser }) {
  const initial = user.name.slice(0, 1).toUpperCase()

  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
      <ThemeToggle compact />
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-none">{user.name}</p>
        <p className="mt-1 text-xs text-muted">{user.email}</p>
      </div>
      <Tooltip label={`${user.name} · ${user.email}`}>
        {user.image ? (
          // Google profile photos are remote and not part of the app image config.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="hidden h-9 w-9 rounded-full object-cover ring-1 ring-line sm:block" />
        ) : (
          <span className="hidden h-9 w-9 place-items-center rounded-full bg-accent/12 text-sm font-semibold text-accent sm:grid">
            {initial}
          </span>
        )}
      </Tooltip>
      <Tooltip label="Sign out">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-foreground/5 hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}
