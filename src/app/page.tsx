"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useActor } from "@/features/auth/useStaffProfile";
import { ROLE_HOME } from "@/components/layout/navItems";
import { LoadingScreen } from "@/components/ui/loading-screen";

// "/" routes each person to their own desk: hub staff to their hub's cases,
// riders to their deliveries, care to the queue, ops to the overview, senders
// to their parcels.
export default function HomePage() {
  const { status } = useAuth();
  const { actor, isLoading } = useActor();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isLoading && actor) {
      router.replace(actor.role ? ROLE_HOME[actor.role] : "/profile");
    }
  }, [actor, isLoading, router, status]);

  return <LoadingScreen label="Finding your desk" />;
}
