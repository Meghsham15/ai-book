import { NextResponse } from "next/server"
import { titleFromFilename } from "@/lib/format"
import { readJson, withApi } from "@/lib/http"
import { extractUploadText, extractWebsiteText } from "@/lib/extract"
import { requireOrgAccess } from "@/lib/org-access"
import { createIndexedSource } from "@/lib/sources"
import { UserInputError } from "@/lib/errors"
import { jsonSourceSchema } from "@/lib/validators"
import { DocumentModel } from "@/lib/models/document"
import type { DocumentItem, DocumentStatus, DocumentType } from "@/types/domain"

export const maxDuration = 60

export const GET = withApi(async (request) => {
  const organizationId = new URL(request.url).searchParams.get("organizationId")
  if (!organizationId) throw new UserInputError("Choose a library.")
  const { org } = await requireOrgAccess(organizationId, ["admin", "manager", "member"])
  const documents = await DocumentModel.find({ organizationId: org._id }).sort({ createdAt: -1 }).lean()
  const sources: DocumentItem[] = documents.map((document) => ({
    id: String(document._id),
    title: document.title,
    type: document.type as DocumentType,
    status: document.status as DocumentStatus,
    chunkCount: document.chunkCount,
    url: document.url || undefined,
    createdAt: document.createdAt instanceof Date ? document.createdAt.toISOString() : new Date().toISOString(),
    errorMessage: document.errorMessage || undefined,
  }))
  return NextResponse.json({ sources })
})

export const POST = withApi(async (request) => {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    const organizationId = String(form.get("organizationId") ?? "")
    const uploaded = form.get("file")
    const titleInput = String(form.get("title") ?? "").trim()
    if (!(uploaded instanceof File)) throw new UserInputError("Choose a file to upload.")
    const { user, org } = await requireOrgAccess(organizationId, ["admin", "manager"])
    const text = await extractUploadText(uploaded)
    if (!text) throw new UserInputError("No readable text was found in that file.")
    const doc = await createIndexedSource({
      orgId: org._id.toString(),
      userId: user.id,
      type: "file",
      title: (titleInput || titleFromFilename(uploaded.name)).slice(0, 120),
      text,
    })
    return NextResponse.json({ id: doc._id.toString(), status: doc.status }, { status: 201 })
  }

  const input = jsonSourceSchema.parse(await readJson(request))
  const { user, org } = await requireOrgAccess(input.organizationId, ["admin", "manager"])

  if (input.type === "text") {
    const doc = await createIndexedSource({
      orgId: org._id.toString(),
      userId: user.id,
      type: "text",
      title: input.title,
      text: input.content,
    })
    return NextResponse.json({ id: doc._id.toString(), status: doc.status }, { status: 201 })
  }

  const website = await extractWebsiteText(input.url)
  let title = input.title?.trim() || ""
  if (!title) {
    try {
      title = new URL(website.url).hostname.replace(/^www\./, "")
    } catch {
      title = "Website"
    }
  }
  const doc = await createIndexedSource({
    orgId: org._id.toString(),
    userId: user.id,
    type: "website",
    title: title.slice(0, 120),
    text: website.text,
    url: website.url,
  })
  return NextResponse.json({ id: doc._id.toString(), status: doc.status }, { status: 201 })
})
