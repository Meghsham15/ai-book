import "server-only"

import { CHAT_LIMIT_PER_MINUTE } from "@/lib/constants"

const buckets = new Map<string, { count: number; reset: number }>()

export function consumeChatQuota(userId: string) {
  const now = Date.now()
  const current = buckets.get(userId)
  if (!current || current.reset < now) {
    buckets.set(userId, { count: 1, reset: now + 60_000 })
    return { ok: true as const, remaining: CHAT_LIMIT_PER_MINUTE - 1 }
  }
  if (current.count >= CHAT_LIMIT_PER_MINUTE) {
    return { ok: false as const, retryAfterMs: current.reset - now }
  }
  current.count += 1
  return { ok: true as const, remaining: CHAT_LIMIT_PER_MINUTE - current.count }
}
