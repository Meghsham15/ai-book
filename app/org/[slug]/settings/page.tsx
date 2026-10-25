import { Suspense } from "react";
import { SettingsView } from "@/components/settings-view";
import { SetupNotice } from "@/components/setup-notice";
import { PageSkeleton } from "@/components/skeletons";
import { TopBar } from "@/components/top-bar";
import { getOrgPage } from "@/lib/data/libraries";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading settings…" />}>
      <SettingsContent params={params} />
    </Suspense>
  );
}

async function SettingsContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getOrgPage(slug);

  if (page.configError || !page.data) {
    return (
      <div className="min-h-dvh">
        <TopBar user={page.user} />
        <div className="px-4 py-10">
          <SetupNotice message={page.configError ?? "Settings could not be opened."} />
        </div>
      </div>
    );
  }

  return (
    <SettingsView
      user={page.user}
      org={page.data.org}
      members={page.data.members}
      invitations={page.data.invitations}
    />
  );
}
