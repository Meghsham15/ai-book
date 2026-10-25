import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { readJson, withApi } from "@/lib/http"
import { createOrganization } from "@/lib/orgs"
import { requireApiUser } from "@/lib/session"
import { createOrgSchema } from "@/lib/validators"


export const GET = withApi(async () => {
  const user = await requireApiUser()
  await connectDB()
  const { Membership } = await import("@/lib/models/membership")
  const rows = await Membership.find({ userId: user.id }).populate("organizationId", "name slug").lean()
  const organizations = rows.flatMap((row) => {
    const org = row.organizationId
    if (!org || typeof org !== "object" || !("slug" in org)) return []
    const record = org as unknown as { _id: unknown; name: string; slug: string }
    return [{ id: String(record._id), name: record.name, slug: record.slug, role: row.role }]
  })
  return NextResponse.json({ organizations })
})

export const POST = withApi(async (request) => {
  const user = await requireApiUser()
  await connectDB()
  const input = createOrgSchema.parse(await readJson(request))
  const org = await createOrganization(user.id, input.name)
  return NextResponse.json({ id: org._id.toString(), name: org.name, slug: org.slug }, { status: 201 })
})
