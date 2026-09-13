"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { RedirectIfAuthenticated } from "@/features/auth/guards";
import { useAuth } from "@/features/auth/AuthProvider";
import { useT } from "@/features/i18n/LocalizationProvider";
import { isLoginConfigured } from "@/lib/blocks/config";
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { LoadingScreen } from "@/components/ui/loading-screen";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RedirectIfAuthenticated>
        <LoginScreen />
      </RedirectIfAuthenticated>
    </Suspense>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const { t } = useT();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? undefined;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const configured = isLoginConfigured();

  async function handleLogin() {
    setError(undefined);
    setPending(true);
    try {
      await login(returnTo);
    } catch (caught) {
      setError((caught as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-6">
      <div className="w-full max-w-[400px] rounded-2xl border border-ink-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <BrandWordmark height={22} />
            <div className="mt-0.5 text-[12px] font-medium text-ink-500">Exception Desk</div>
          </div>
        </div>
        <h1 className="text-[24px] font-bold tracking-tight text-ink-900">{t("auth.welcome")}</h1>
        <p className="mt-2 text-[14px] leading-6 text-ink-500">{t("auth.subtitle")}</p>

        <div className="mt-8 grid gap-3">
          {!configured ? <Alert tone="warn">Login is not configured on this deployment.</Alert> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button size="lg" className="w-full" disabled={!configured} loading={pending} onClick={() => void handleLogin()} icon={<ArrowRight size={18} />}>
            {pending ? t("auth.redirecting") : t("auth.continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}
