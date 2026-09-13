import { WEEK_MS } from "@/features/ai/routeRisk";
import { ROUTE_BY_CODE } from "@/features/domain/constants";
import { isTerminal } from "@/features/domain/sla";
import type { ExceptionCase, ExceptionType } from "@/features/domain/types";

export type Window = { current: ExceptionCase[]; previous: ExceptionCase[] };

/** Rolling 7-day windows: last 7 days vs the 7 before. */
export function splitWeeks(cases: ExceptionCase[], now = Date.now()): Window {
  const current: ExceptionCase[] = [];
  const previous: ExceptionCase[] = [];
  for (const item of cases) {
    const age = now - new Date(item.openedAt).getTime();
    if (age < 0) continue;
    if (age < WEEK_MS) current.push(item);
    else if (age < 2 * WEEK_MS) previous.push(item);
  }
  return { current, previous };
}

export function change(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return current / previous - 1;
}

export type GroupRow = {
  key: string;
  label: string;
  current: number;
  previous: number;
  change: number | null;
  breached: number;
  byType: Partial<Record<ExceptionType, number>>;
  volume?: number;
  rate?: number;
};

export function groupBy(window: Window, keyOf: (item: ExceptionCase) => string | undefined, labelOf: (key: string) => string, volumeOf?: (key: string) => number | undefined): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  const ensure = (key: string) => {
    let row = rows.get(key);
    if (!row) {
      row = { key, label: labelOf(key), current: 0, previous: 0, change: null, breached: 0, byType: {} };
      rows.set(key, row);
    }
    return row;
  };
  for (const item of window.current) {
    const key = keyOf(item);
    if (!key) continue;
    const row = ensure(key);
    row.current += 1;
    row.byType[item.type] = (row.byType[item.type] ?? 0) + 1;
    if (item.slaBreached) row.breached += 1;
  }
  for (const item of window.previous) {
    const key = keyOf(item);
    if (!key) continue;
    ensure(key).previous += 1;
  }
  for (const row of rows.values()) {
    row.change = change(row.current, row.previous);
    const volume = volumeOf?.(row.key);
    if (volume) {
      row.volume = volume;
      row.rate = row.current / volume;
    }
  }
  return [...rows.values()].sort((a, b) => b.current - a.current);
}

export function routeVolume(routeCode: string): number | undefined {
  return ROUTE_BY_CODE[routeCode]?.weeklyVolume;
}

export function averageResolutionHours(cases: ExceptionCase[]): number | null {
  const resolved = cases.filter((item) => isTerminal(item.status) && item.resolvedAt);
  if (!resolved.length) return null;
  const total = resolved.reduce((sum, item) => sum + (new Date(item.resolvedAt!).getTime() - new Date(item.openedAt).getTime()), 0);
  return total / resolved.length / 3_600_000;
}

export function slaHitRate(cases: ExceptionCase[]): number | null {
  const resolved = cases.filter((item) => isTerminal(item.status));
  if (!resolved.length) return null;
  return resolved.filter((item) => !item.slaBreached).length / resolved.length;
}
