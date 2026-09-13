"use client";

import type { ReactNode } from "react";
import { RequireAuth } from "@/features/auth/guards";
import { AppShell } from "@/components/layout/AppShell";

export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
