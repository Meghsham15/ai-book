import type { Role } from "@/types/domain"

export function canWriteDocuments(role: Role) {
  return role === "admin" || role === "manager"
}

export function canManageOrg(role: Role) {
  return role === "admin"
}

export function roleLabel(role: Role) {
  if (role === "admin") return "Admin"
  if (role === "manager") return "Manager"
  return "Member"
}
