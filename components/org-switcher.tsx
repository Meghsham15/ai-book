"use client"

import { useRouter } from "next/navigation"
import { Tooltip } from "@/components/tooltip"
import type { LibraryOption } from "@/types/domain"

export function OrgSwitcher({ libraries, current }: { libraries: LibraryOption[]; current: string }) {
  const router = useRouter()
  if (libraries.length === 0) return null

  return (
    <label className="min-w-0">
      <span className="sr-only">Switch library</span>
      <Tooltip label="Switch library" className="min-w-0">
        <select
          value={current}
          onChange={(event) => router.push(`/org/${event.target.value}`)}
          className="max-w-44 truncate rounded-full border border-line bg-card px-3 py-2 text-sm outline-none transition focus:border-accent sm:max-w-64"
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
