import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard-view";
import { PageSkeleton } from "@/components/skeletons";
import { getDashboardData } from "@/lib/data/libraries";

export const metadata = {
  title: "Libraries",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading your libraries…" />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const data = await getDashboardData();
  return (
    <DashboardView
      user={data.user}
      libraries={data.libraries}
      invitations={data.invitations}
      overview={data.overview}
      configError={data.configError}
    />
  );
}
