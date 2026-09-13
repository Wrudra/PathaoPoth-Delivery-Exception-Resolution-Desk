import { EXCEPTION_TYPES } from "./constants";
import type { ExceptionCase, ExceptionType } from "./types";

export const HOUR_MS = 3_600_000;

export function slaDueFor(type: ExceptionType, openedAt: Date): Date {
  return new Date(openedAt.getTime() + EXCEPTION_TYPES[type].slaHours * HOUR_MS);
}

export type SlaState = {
  status: "met" | "on_track" | "at_risk" | "breached";
  remainingMs: number;
  ratio: number; // 0 = just opened, 1 = at deadline, >1 = past deadline
};

export function isTerminal(status: ExceptionCase["status"]): boolean {
  return status === "resolved" || status === "closed";
}

export function slaState(item: Pick<ExceptionCase, "openedAt" | "slaDueAt" | "status" | "resolvedAt">, now = Date.now()): SlaState {
  const due = new Date(item.slaDueAt).getTime();
  const opened = new Date(item.openedAt).getTime();
  const end = isTerminal(item.status) && item.resolvedAt ? new Date(item.resolvedAt).getTime() : now;
  const total = Math.max(due - opened, 1);
  const ratio = (end - opened) / total;
  const remainingMs = due - end;

  if (isTerminal(item.status)) return { status: "met", remainingMs, ratio };
  if (remainingMs < 0) return { status: "breached", remainingMs, ratio };
  if (ratio >= 0.75) return { status: "at_risk", remainingMs, ratio };
  return { status: "on_track", remainingMs, ratio };
}

/** Cases whose deadline has passed but whose stored flag has not been raised yet. */
export function unflaggedBreaches(cases: ExceptionCase[], now = Date.now()): ExceptionCase[] {
  return cases.filter((item) => !item.slaBreached && !isTerminal(item.status) && new Date(item.slaDueAt).getTime() < now);
}

export function ageMs(item: Pick<ExceptionCase, "openedAt">, now = Date.now()): number {
  return now - new Date(item.openedAt).getTime();
}
