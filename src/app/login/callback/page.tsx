"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { completeLogin } from "@/lib/blocks/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark";

export default function CallbackPage() {
  const { refresh } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    completeLogin(window.location.href)
      .then(async (result) => {
        if (result.ok) {
          await refresh();
          router.replace(result.returnTo);
          return;
        }
        setError(result.message);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [refresh, router]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-8 shadow-(--shadow-card)">
          <div className="mb-6 flex items-center gap-3">
            <BrandMark size={36} />
            <BrandWordmark height={22} />
          </div>
          <h2 className="text-[20px] font-bold text-ink-900">Sign-in failed</h2>
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
          <Button className="mt-6 w-full" onClick={() => router.replace("/login")}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return <LoadingScreen label="Completing sign-in" />;
}
