export type Role = "admin" | "manager" | "member"
export type DocumentType = "file" | "website" | "text"
export type DocumentStatus = "processing" | "ready" | "failed"

export type Limits = {
  maxFiles: number
  maxWebsites: number
  maxTexts: number
  maxChunks: number
}

export type Usage = {
  files: number
  websites: number
  texts: number
  chunks: number
}

export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string
}

export type LibraryCard = {
  id: string
  name: string
  slug: string
  role: Role
  usage: Usage
  limits: Limits
}

export type LibraryOption = {
  id: string
  name: string
  slug: string
  role: Role
}

export type DocumentItem = {
  id: string
  title: string
  type: DocumentType
  status: DocumentStatus
  chunkCount: number
  url?: string
  createdAt: string
  errorMessage?: string
}

export type PendingInvite = {
  id: string
  email: string
  role: Role
  expiresAt: string
}

export type DashboardInvitation = {
  token: string
  organizationName: string
  role: Role
  expiresAt: string
}

export type MemberItem = {
  userId: string
  name: string
  email: string
  image?: string
  role: Role
  isOwner: boolean
}

export type OrgDetails = {
  id: string
  name: string
  slug: string
  role: Role
  isOwner: boolean
  usage: Usage
  limits: Limits
  embeddingProvider: string
  embeddingDimensions: number
  vectorSearch: "memory" | "atlas"
  atlasIndex: string
}

export type ChatSource = {
  documentId: string
  title: string
  chunkIndex: number
  excerpt: string
}

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: ChatSource[]
  authorId?: string
  authorName?: string
  createdAt?: string
}
