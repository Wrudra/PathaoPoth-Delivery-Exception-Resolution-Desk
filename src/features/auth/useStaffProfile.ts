"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { blocksClient } from "@/lib/blocks/client";
import { createOne, listAll, updateOne } from "@/features/data/gateway";
import { queryKeys } from "@/features/data/queries";
import { SENDER_COMPANIES, teamForHub } from "@/features/domain/constants";
import type { Rider, RoleSlug, StaffProfile } from "@/features/domain/types";
import { primaryRole, useCurrentUser, userDisplayName } from "./useCurrentUser";

export type Actor = {
  userId: string;
  name: string;
  email?: string;
  role: RoleSlug | undefined;
  roles: string[];
  team: string;
  hubCode?: string;
  riderId?: string;
  senderCompany?: string;
  profile?: StaffProfile;
};

/** Defaults used when a user signs in for the first time without a mapping. */
function defaultProfile(
  userId: string,
  name: string,
  email: string | undefined,
  role: RoleSlug,
  riders: Rider[],
  staff: StaffProfile[] = []
): Omit<StaffProfile, "ItemId"> {
  switch (role) {
    case "hub-staff": {
      // Origin hub (Mirpur 10) is the first mapping; a later hub-staff user
      // defaults to the demo destination hub so Mirpur → care → GEC can close.
      const originTaken = staff.some((item) => item.role === "hub-staff" && item.hubCode === "MIR10");
      const hubCode = originTaken ? "CTGGEC" : "MIR10";
      return { userId, email, displayName: name, role, hubCode, team: teamForHub(hubCode) };
    }
    case "rider": {
      // Attach the first unlinked Mirpur rider so the demo rider immediately
      // sees the parcels the seed assigned to "Jashim".
      const rider = riders.find((item) => item.riderCode === "R-MIR-014" && !item.userId) ?? riders.find((item) => !item.userId);
      return {
        userId,
        email,
        displayName: name,
        role,
        hubCode: rider?.hubCode ?? "MIR10",
        team: teamForHub(rider?.hubCode ?? "MIR10"),
        riderId: rider?.ItemId
      };
    }
    case "care-agent":
      return { userId, email, displayName: name, role, team: "care" };
    case "ops-manager":
      return { userId, email, displayName: name, role, team: "ops" };
    case "sender":
      return { userId, email, displayName: name, role, team: "sender", senderCompany: SENDER_COMPANIES[0] };
  }
}

/**
 * Resolves the signed-in user into an Actor: IAM identity + roles + the
 * StaffProfile row that scopes them to a hub / team / rider / sender company.
 * A missing profile is created once with sensible defaults; ops can change it
 * on the Team page.
 */
export function useActor() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const user = me.data?.data;
  const userId = user?.itemId;
  const role = primaryRole(user?.roles);

  const profiles = useQuery({
    queryKey: queryKeys.staff,
    queryFn: () => listAll<StaffProfile>("StaffProfile", { sort: { displayName: 1 } }),
    enabled: Boolean(userId),
    staleTime: 60_000
  });

  const riders = useQuery({
    queryKey: queryKeys.riders,
    queryFn: () => listAll<Rider>("Rider", { sort: { name: 1 } }),
    enabled: Boolean(userId) && role === "rider",
    staleTime: 5 * 60_000
  });

  const existing = useMemo(() => profiles.data?.find((item) => item.userId === userId), [profiles.data, userId]);

  const provision = useMutation({
    mutationFn: async () => {
      if (!userId || !role) return;
      const payload = defaultProfile(
        userId,
        userDisplayName(user) || user?.email || "Staff",
        user?.email,
        role,
        riders.data ?? [],
        profiles.data ?? []
      );
      await createOne<StaffProfile>("StaffProfile", payload);
      if (role === "rider" && payload.riderId) {
        await updateOne<Rider>("Rider", payload.riderId, { userId });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff });
      void queryClient.invalidateQueries({ queryKey: queryKeys.riders });
    }
  });

  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current || !userId || !role || !profiles.isSuccess || existing) return;
    if (role === "rider" && !riders.isSuccess) return;
    attempted.current = true;
    provision.mutate();
  }, [existing, profiles.isSuccess, provision, riders.isSuccess, role, userId]);

  const actor = useMemo<Actor | undefined>(() => {
    if (!userId) return undefined;
    return {
      userId,
      name: existing?.displayName || userDisplayName(user) || user?.email || "Unknown",
      email: user?.email,
      role,
      roles: user?.roles ?? [],
      team: existing?.team ?? (role ? defaultProfile(userId, "", undefined, role, [], profiles.data ?? []).team : "unassigned"),
      hubCode: existing?.hubCode,
      riderId: existing?.riderId,
      senderCompany: existing?.senderCompany,
      profile: existing
    };
  }, [existing, role, user, userId]);

  return {
    actor,
    isLoading: me.isLoading || (Boolean(userId) && profiles.isLoading),
    error: me.error ?? profiles.error,
    refetch: () => Promise.all([me.refetch(), profiles.refetch()])
  };
}

export function useLogoutEverywhere() {
  return () => blocksClient.auth.logout({}).catch(() => undefined);
}
