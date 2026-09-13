"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Bike, Headset, LineChart, PackageSearch, ShieldCheck, Warehouse } from "lucide-react";
import { RedirectIfAuthenticated } from "@/features/auth/guards";
import { useAuth } from "@/features/auth/AuthProvider";
import { useT } from "@/features/i18n/LocalizationProvider";
import { isLoginConfigured } from "@/lib/blocks/config";
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { LoadingScreen } from "@/components/ui/loading-screen";

const PERSONAS = [
  { icon: Warehouse, label: "Hub staff", text: "Open a case in four fields, hand it on, stay accountable until acknowledged." },
  { icon: Bike, label: "Rider", text: "Type the note the way you'd say it. The desk does the rest." },
  { icon: Headset, label: "Care agent", text: "One click to confirm the recommended next step. Manual review when the AI isn't sure." },
  { icon: LineChart, label: "Ops manager", text: "Exception rates by hub, route and rider — and the route that fails next week." },
  { icon: PackageSearch, label: "Sender", text: "What happened, what's being done, when to expect it. Nothing internal." }
];

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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-500 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[420px] w-[420px] rounded-full bg-brand-700/40" />
        <div className="relative flex items-center gap-3">
          <BrandMark size={44} className="bg-white/15 shadow-none ring-1 ring-white/30" />
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/80">PathaoPoth</div>
            <div className="text-[15px] font-semibold">Delivery Exception Resolution Desk</div>
          </div>
        </div>
        <div className="relative max-w-xl">
          <h1 className="text-[44px] font-bold leading-[1.05] tracking-tight">
            Every stuck parcel has <span className="underline decoration-white/50 decoration-4 underline-offset-8">exactly one owner</span>.
          </h1>
          <p className="mt-6 text-[17px] leading-7 text-white/85">
            40,000 parcels a day. 3–4% become exceptions. This desk gives each one a named owner, turns rider notes into next steps, keeps senders informed, and tells the ops manager which route will fail next week — before it does.
          </p>
          <ul className="mt-8 grid gap-3">
            {PERSONAS.map((persona) => (
              <li key={persona.label} className="flex items-start gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                <persona.icon size={18} className="mt-0.5 shrink-0 text-white" />
                <div>
                  <div className="text-[14px] font-semibold">{persona.label}</div>
                  <div className="text-[13px] leading-5 text-white/80">{persona.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-[12px] text-white/70">
          <ShieldCheck size={14} /> Built on SELISE Blocks · IAM roles, Data Gateway, Notifier, Localization
        </div>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center justify-between">
            <BrandWordmark height={30} />
            <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-semibold text-ink-600">Exception Desk</span>
          </div>
          <h2 className="text-[26px] font-bold tracking-tight text-ink-900">{t("auth.welcome")}</h2>
          <p className="mt-2 text-[14px] leading-6 text-ink-500">{t("auth.subtitle")}</p>

          <div className="mt-8 grid gap-3">
            {!configured ? (
              <Alert tone="warn" title="Login is not configured">
                Set <code className="rounded bg-white px-1">NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID</code> in <code className="rounded bg-white px-1">.env</code> to a public OIDC client whose redirect URI is{" "}
                <code className="rounded bg-white px-1">{typeof window !== "undefined" ? window.location.origin : ""}/login/callback</code>.
              </Alert>
            ) : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button size="lg" className="w-full" disabled={!configured} loading={pending} onClick={() => void handleLogin()} icon={<ArrowRight size={18} />}>
              {pending ? t("auth.redirecting") : t("auth.continue")}
            </Button>
            <p className="text-center text-[12px] leading-5 text-ink-500">
              Sign-in happens on the Blocks hosted login page. Your role — hub staff, rider, care, ops or sender — decides what you see next.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
