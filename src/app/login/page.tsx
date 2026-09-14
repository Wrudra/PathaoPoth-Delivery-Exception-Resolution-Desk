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
  { icon: LineChart, label: "Ops manager", text: "Exception rates by hub, route and rider, and the route that fails next week." },
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
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-brand-500 px-6 py-8 text-white sm:px-10 lg:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-white/10 lg:h-[520px] lg:w-[520px]" />
        <div className="pointer-events-none absolute -bottom-36 -left-20 h-[340px] w-[340px] rounded-full bg-brand-700/45 lg:h-[420px] lg:w-[420px]" />

        <div className="relative flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/80">PathaoPoth</div>
            <div className="text-[15px] font-semibold">Delivery Exception Resolution Desk</div>
          </div>
        </div>

        <div className="relative mt-10 max-w-xl lg:mt-0">
          <h1 className="text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[40px] lg:text-[44px]">
            Every stuck parcel has <span className="underline decoration-white/50 decoration-4 underline-offset-8">exactly one owner</span>.
          </h1>
          <p className="mt-5 hidden text-[15px] leading-7 text-white/85 sm:block sm:text-[17px] lg:block">
            40,000 parcels a day. 3-4% become exceptions. This desk gives each one a named owner, turns rider notes into next steps, keeps senders informed, and tells the ops manager which route will fail next week, before it does.
          </p>
          <ul className="mt-8 hidden gap-3 lg:grid">
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

        <div className="relative mt-8 hidden items-center gap-2 text-[12px] text-white/70 lg:flex">
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
            {!configured ? <Alert tone="warn">Login is not configured on this deployment.</Alert> : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button size="lg" className="w-full" disabled={!configured} loading={pending} onClick={() => void handleLogin()} icon={<ArrowRight size={18} />}>
              {pending ? t("auth.redirecting") : t("auth.continue")}
            </Button>
            <p className="text-center text-[12px] leading-5 text-ink-500">
              Sign-in happens on the Blocks hosted login page. Your role (hub staff, rider, care, ops or sender) decides what you see next.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
