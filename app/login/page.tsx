import { Suspense } from "react";
import { LoginScreen } from "@/components/login-screen";
import { safeCallbackUrl } from "@/lib/callback-url";
import { isConfiguredSecret } from "@/lib/env";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const googleConfigured =
    isConfiguredSecret(process.env.GOOGLE_CLIENT_ID) &&
    isConfiguredSecret(process.env.GOOGLE_CLIENT_SECRET);

  return (
    <Suspense fallback={<LoginScreen callbackUrl="/dashboard" googleConfigured={googleConfigured} />}>
      <LoginFromQuery searchParams={searchParams} googleConfigured={googleConfigured} />
    </Suspense>
  );
}

async function LoginFromQuery({
  searchParams,
  googleConfigured,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
  googleConfigured: boolean;
}) {
  const params = await searchParams;
  return <LoginScreen callbackUrl={safeCallbackUrl(params.callbackUrl)} googleConfigured={googleConfigured} />;
}
