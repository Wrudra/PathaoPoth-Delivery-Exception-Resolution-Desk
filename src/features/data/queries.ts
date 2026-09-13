"use client";

import { useQuery } from "@tanstack/react-query";
import { getOne, listAll } from "./gateway";
import type {
  CaseEvent,
  ExceptionCase,
  Parcel,
  PrecallTask,
  Rider,
  RiderNote,
  RoutePrediction,
  SenderUpdate,
  StaffProfile
} from "@/features/domain/types";

export const queryKeys = {
  cases: ["cases"] as const,
  case: (id: string) => ["cases", id] as const,
  caseEvents: (caseId: string) => ["caseEvents", caseId] as const,
  caseNotes: (caseId: string) => ["riderNotes", caseId] as const,
  parcels: ["parcels"] as const,
  parcel: (id: string) => ["parcels", id] as const,
  riders: ["riders"] as const,
  staff: ["staffProfiles"] as const,
  senderUpdates: ["senderUpdates"] as const,
  predictions: ["routePredictions"] as const,
  precalls: ["precallTasks"] as const
};

export function useCases(enabled = true) {
  return useQuery({
    queryKey: queryKeys.cases,
    queryFn: () => listAll<ExceptionCase>("ExceptionCase", { sort: { openedAt: -1 } }),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.case(id ?? ""),
    queryFn: () => getOne<ExceptionCase>("ExceptionCase", id!),
    enabled: Boolean(id)
  });
}

export function useCaseEvents(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.caseEvents(caseId ?? ""),
    queryFn: () => listAll<CaseEvent>("CaseEvent", { filter: { caseId }, sort: { occurredAt: 1 } }),
    enabled: Boolean(caseId)
  });
}

export function useCaseNotes(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.caseNotes(caseId ?? ""),
    queryFn: () => listAll<RiderNote>("RiderNote", { filter: { caseId }, sort: { submittedAt: -1 } }),
    enabled: Boolean(caseId)
  });
}

export function useParcels(enabled = true) {
  return useQuery({
    queryKey: queryKeys.parcels,
    queryFn: () => listAll<Parcel>("Parcel", { sort: { dispatchedAt: -1 } }),
    enabled,
    staleTime: 30_000
  });
}

/**
 * Parcel fields the sender audience may see. Receiver phone and street
 * address are deliberately absent, so the sender client never requests them
 * from the gateway; the UI masks nothing because it never receives them.
 */
export const SENDER_PARCEL_FIELDS = [
  "trackingId", "senderUserId", "senderName", "senderCompany", "receiverName", "area", "originHubCode", "destHubCode", "routeCode",
  "codAmount", "paymentType", "status", "dispatchedAt", "promisedAt"
] as const;

export type SenderParcel = Pick<Parcel, "ItemId" | "CreatedDate" | (typeof SENDER_PARCEL_FIELDS)[number]>;

/** Parcels booked by the signed-in sender, filtered at the gateway rather than in the browser. */
export function useSenderParcels(scope: { senderCompany?: string; senderUserId: string } | undefined) {
  const filter = scope ? (scope.senderCompany ? { senderCompany: scope.senderCompany } : { senderUserId: scope.senderUserId }) : undefined;
  return useQuery({
    queryKey: [...queryKeys.parcels, "sender", filter],
    queryFn: () => listAll<SenderParcel>("Parcel", { filter, sort: { dispatchedAt: -1 }, fields: SENDER_PARCEL_FIELDS }),
    enabled: Boolean(filter),
    staleTime: 30_000,
    refetchInterval: 30_000
  });
}

export function useParcel(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.parcel(id ?? ""),
    queryFn: () => getOne<Parcel>("Parcel", id!),
    enabled: Boolean(id)
  });
}

export function useRiders() {
  return useQuery({
    queryKey: queryKeys.riders,
    queryFn: () => listAll<Rider>("Rider", { sort: { name: 1 } }),
    staleTime: 5 * 60_000
  });
}

export function useStaffProfiles() {
  return useQuery({
    queryKey: queryKeys.staff,
    queryFn: () => listAll<StaffProfile>("StaffProfile", { sort: { displayName: 1 } }),
    staleTime: 60_000
  });
}

export function useSenderUpdates(senderFilter: Record<string, unknown> | undefined) {
  return useQuery({
    queryKey: [...queryKeys.senderUpdates, senderFilter],
    queryFn: () => listAll<SenderUpdate>("SenderUpdate", { filter: senderFilter, sort: { occurredAt: -1 } }),
    enabled: Boolean(senderFilter),
    refetchInterval: 30_000
  });
}

export function usePredictions() {
  return useQuery({
    queryKey: queryKeys.predictions,
    queryFn: () => listAll<RoutePrediction>("RoutePrediction", { sort: { generatedAt: -1 } }),
    staleTime: 30_000
  });
}

export function usePrecallTasks() {
  return useQuery({
    queryKey: queryKeys.precalls,
    queryFn: () => listAll<PrecallTask>("PrecallTask", { sort: { CreatedDate: -1 } }),
    staleTime: 15_000,
    refetchInterval: 30_000
  });
}
