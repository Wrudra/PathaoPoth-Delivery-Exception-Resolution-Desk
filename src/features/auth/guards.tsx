"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname || "/")}`);
    }
  }, [pathname, router, status]);

  if (status !== "authenticated") return <LoadingScreen label="Checking your session" />;
  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [router, status]);

  if (status === "loading" || status === "authenticated") return <LoadingScreen />;
  return <>{children}</>;
}
