import { Suspense } from "react"
import { InviteView } from "@/components/invite-view"
import { PageSkeleton } from "@/components/skeletons"
import { connectDB } from "@/lib/db"
import { describeInvitation } from "@/lib/invitations"
import { requireUser } from "@/lib/session"

export const metadata = {
  title: "Invitation",
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading the invitation…" />}>
      <InviteContent params={params} />
    </Suspense>
  )
}

async function InviteContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await requireUser()
  await connectDB()
  const invite = await describeInvitation(token)
  return <InviteView user={user} invite={invite} />
}
