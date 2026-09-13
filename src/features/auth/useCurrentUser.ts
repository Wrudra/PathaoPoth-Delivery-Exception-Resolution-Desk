"use client";

import { useQuery } from "@tanstack/react-query";
import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "@/lib/blocks/client";
import { useAuth } from "./AuthProvider";
import type { RoleSlug } from "@/features/domain/types";

export const APP_ROLES: RoleSlug[] = ["ops-manager", "care-agent", "hub-staff", "rider", "sender"];

export function useCurrentUser() {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: () => blocksClient.iam.me(),
    queryKey: ["iam", "me"],
    staleTime: 60_000
  });
}

export function userDisplayName(profile?: BlocksUser): string {
  if (!profile) return "";
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || profile.email || "";
}

/** The app role for this user: the most privileged of the five desk roles they hold. */
export function primaryRole(roles: string[] | undefined): RoleSlug | undefined {
  if (!roles) return undefined;
  return APP_ROLES.find((role) => roles.includes(role));
}

export function hasRole(roles: string[] | undefined, role: RoleSlug): boolean {
  return Boolean(roles?.includes(role));
}
