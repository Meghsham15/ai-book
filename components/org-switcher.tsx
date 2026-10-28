"use client"

import { useRouter } from "next/navigation"
import { Tooltip } from "@/components/tooltip"
import type { LibraryOption } from "@/types/domain"

export function OrgSwitcher({ libraries, current }: { libraries: LibraryOption[]; current: string }) {
  const router = useRouter()
  if (libraries.length === 0) return null

  return (
    <label className="min-w-0 flex-1 sm:max-w-56 sm:flex-none">
      <span className="sr-only">Switch library</span>
      <Tooltip label="Switch library" className="block min-w-0">
        <select
          value={current}
          onChange={(event) => router.push(`/org/${event.target.value}`)}
          className="h-9 w-full min-w-0 truncate border border-line bg-card px-2 text-sm outline-none transition focus:border-accent sm:px-3"
        >
        {libraries.map((library) => (
          <option key={library.id} value={library.slug}>
            {library.name}
          </option>
        ))}
        </select>
      </Tooltip>
    </label>
  )
}
