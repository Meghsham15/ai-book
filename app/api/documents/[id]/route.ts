import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { AuthzError } from "@/lib/errors"
import { readJson, withApi } from "@/lib/http"
import { DocumentModel } from "@/lib/models/document"
import { requireOrgAccess } from "@/lib/org-access"
import { deleteIndexedSource, updateIndexedSource } from "@/lib/sources"
import { updateDocumentSchema } from "@/lib/validators"

export const maxDuration = 60

type Context = { params: Promise<{ id: string }> }

export const GET = withApi<Context>(async (_request, context) => {
  const { id } = await context.params
  await connectDB()
  const doc = await DocumentModel.findById(id)
  if (!doc) throw new AuthzError("Source not found.", 404)
  await requireOrgAccess(doc.organizationId.toString(), ["admin", "manager", "member"])
  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    type: doc.type,
    content: doc.type === "text" ? doc.content ?? "" : "",
    url: doc.url ?? "",
    status: doc.status,
  })
})

export const PATCH = withApi<Context>(async (request, context) => {
  const { id } = await context.params
  await connectDB()
  const existing = await DocumentModel.findById(id)
  if (!existing) throw new AuthzError("Source not found.", 404)
  await requireOrgAccess(existing.organizationId.toString(), ["admin", "manager"])
  const input = updateDocumentSchema.parse(await readJson(request))
  const doc = await updateIndexedSource(existing.organizationId.toString(), id, input)
  return NextResponse.json({ id: doc._id.toString(), status: doc.status, title: doc.title })
})

export const DELETE = withApi<Context>(async (_request, context) => {
  const { id } = await context.params
  await connectDB()
  const existing = await DocumentModel.findById(id)
  if (!existing) throw new AuthzError("Source not found.", 404)
  await requireOrgAccess(existing.organizationId.toString(), ["admin", "manager"])
  await deleteIndexedSource(existing.organizationId.toString(), id)
  return NextResponse.json({ ok: true })
})
