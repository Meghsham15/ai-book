import { Suspense } from "react";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceSkeleton } from "@/components/skeletons";
import { TopBar } from "@/components/top-bar";
import { Workspace } from "@/components/workspace";
import { getOrgPage } from "@/lib/data/libraries";
import { canWriteDocuments } from "@/lib/permissions";

export const metadata = {
  title: "Library",
};

export default function OrgPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <OrgContent params={params} />
    </Suspense>
  );
}

async function OrgContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getOrgPage(slug);

  if (page.configError || !page.data) {
    return (
      <div className="min-h-dvh">
        <TopBar user={page.user} />
        <div className="px-4 py-10">
          <SetupNotice message={page.configError ?? "This library could not be opened."} />
        </div>
      </div>
    );
  }

  return (
    <Workspace
      user={page.user}
      org={page.data.org}
      sources={page.data.sources}
      libraries={page.data.libraries}
      canWrite={canWriteDocuments(page.data.org.role)}
    />
  );
}
