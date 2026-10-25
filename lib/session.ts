import "server-only"

import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { AuthzError } from "@/lib/errors"
import type { SessionUser } from "@/types/domain"

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return {
    id: session.user.id,
    name: session.user.name?.trim() || "Member",
    email: session.user.email?.toLowerCase() || "",
    image: session.user.image || undefined,
  }
}

export async function requireUser() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}

export async function requireApiUser() {
  const user = await getSessionUser()
  if (!user) throw new AuthzError("Sign in to continue.", 401)
  return user
}
