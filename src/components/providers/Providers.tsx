"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { LocalizationProvider } from "@/features/i18n/LocalizationProvider";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session; created lazily so SSR never shares it.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocalizationProvider>
          <ToastProvider>{children}</ToastProvider>
        </LocalizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
