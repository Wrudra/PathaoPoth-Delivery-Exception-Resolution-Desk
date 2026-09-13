"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSessionClaims, logout as endSession, onSessionExpired, startLogin } from "@/lib/blocks/auth";

export type AuthStatus = "authenticated" | "loading" | "unauthenticated";

type AuthContextValue = {
  claims: Record<string, unknown> | undefined;
  login: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  status: AuthStatus;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_KEY = ["auth", "session"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // The session's source of truth is IAM's GET /iam/v4/auth/me: the hosted
  // login sets an httpOnly cookie this app never sees, so a successful call is
  // what "signed in" means. Regaining focus re-checks promptly (sign-out in
  // another tab, expiry while idle); the interval is only a backstop.
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => (await fetchSessionClaims()) ?? null,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000
  });

  const refresh = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: SESSION_KEY });
  }, [queryClient]);

  useEffect(() => onSessionExpired(() => void refresh()), [refresh]);

  const login = useCallback(async (returnTo?: string) => {
    await startLogin(returnTo);
  }, []);

  const logout = useCallback(async () => {
    await endSession();
    queryClient.removeQueries({ queryKey: ["iam"] });
    queryClient.removeQueries({ queryKey: ["staffProfiles"] });
    await refresh();
  }, [queryClient, refresh]);

  const status: AuthStatus = session.isPending ? "loading" : session.data ? "authenticated" : "unauthenticated";
  const claims = session.data ?? undefined;

  const value = useMemo<AuthContextValue>(() => ({ claims, login, logout, refresh, status }), [claims, login, logout, refresh, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
