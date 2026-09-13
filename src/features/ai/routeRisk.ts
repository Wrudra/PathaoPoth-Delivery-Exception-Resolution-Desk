import { EXCEPTION_TYPES, ROUTE_BY_CODE, hubShort, routeLabel } from "@/features/domain/constants";
import type { ExceptionCase, ExceptionType, Parcel, RiskLevel, RouteAction } from "@/features/domain/types";

// Route-level failure forecasting.
//
// Looks across recent exceptions on each lane and asks: which route is likely
// to fail again next week, and why? The model is deliberately transparent --
// a Holt-style trend projection on the weekly exception rate plus a risk score
// built from named evidence (week-over-week growth, type concentration, rider
// concentration, COD exposure, repeat addresses). Every number the manager
// sees can be traced back to rows in ExceptionCase / Parcel.

export const WEEK_MS = 7 * 86_400_000;

export type WeekBucket = { weekStart: string; parcels: number; exceptions: number; byType: Record<string, number> };

// Weeks are rolling 7-day windows ending now: "this week" = the last 7 days,
// "last week" = the 7 before. Calendar weeks would compare a nearly empty
// Monday against a full week and hide the pattern.

export type RouteRisk = {
  routeCode: string;
  label: string;
  originHubCode: string;
  destHubCode: string;
  weeks: WeekBucket[];
  currentRate: number;
  previousRate: number;
  baselineRate: number;
  weekOverWeekChange: number;
  predictedRate: number;
  predictedExceptions: number;
  riskScore: number;
  riskLevel: RiskLevel;
  dominantType: ExceptionType | "none";
  dominantShare: number;
  codShareOfRefused: number;
  topRider?: { name: string; share: number; count: number };
  repeatAreas: { area: string; count: number }[];
  evidence: string[];
  recommendedAction: RouteAction;
  weekStart: string;
  horizonWeekStart: string;
};

/** Monday 00:00 (local) of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function bucketKey(iso: string, anchor: Date): number {
  const time = new Date(iso).getTime();
  return Math.floor((anchor.getTime() - time) / WEEK_MS); // 0 = current week
}

export function analyzeRoutes(cases: ExceptionCase[], parcels: Parcel[], options: { weeks?: number; now?: Date } = {}): RouteRisk[] {
  const weeks = options.weeks ?? 4;
  const now = options.now ?? new Date();
  const anchor = new Date(now.getTime() + 60_000); // include events written a moment ago
  const routeCodes = new Set<string>([...parcels.map((item) => item.routeCode), ...cases.map((item) => item.routeCode)].filter(Boolean));
  const results: RouteRisk[] = [];

  for (const routeCode of routeCodes) {
    const routeParcels = parcels.filter((item) => item.routeCode === routeCode);
    const routeCases = cases.filter((item) => item.routeCode === routeCode);
    const buckets: WeekBucket[] = [];
    for (let index = weeks - 1; index >= 0; index -= 1) {
      const weekStart = new Date(anchor.getTime() - (index + 1) * WEEK_MS);
      buckets.push({ weekStart: weekStart.toISOString(), parcels: 0, exceptions: 0, byType: {} });
    }
    const bucketFor = (iso: string | undefined) => {
      if (!iso) return undefined;
      const offset = bucketKey(iso, anchor);
      if (offset < 0 || offset >= weeks) return undefined;
      return buckets[weeks - 1 - offset];
    };
    for (const parcel of routeParcels) {
      const bucket = bucketFor(parcel.dispatchedAt ?? parcel.CreatedDate);
      if (bucket) bucket.parcels += 1;
    }
    for (const item of routeCases) {
      const bucket = bucketFor(item.openedAt);
      if (!bucket) continue;
      bucket.exceptions += 1;
      bucket.byType[item.type] = (bucket.byType[item.type] ?? 0) + 1;
    }
    // The Parcel table holds every exception parcel but only a sample of the
    // routine ones, so the rate denominator is the lane's master weekly volume
    // (or the observed count when it is larger).
    const configuredVolume = ROUTE_BY_CODE[routeCode]?.weeklyVolume ?? 400;
    for (const bucket of buckets) bucket.parcels = Math.max(bucket.parcels, configuredVolume);

    const rates = buckets.map((bucket) => bucket.exceptions / Math.max(bucket.parcels, 1));
    const current = buckets[buckets.length - 1]!;
    const previous = buckets[buckets.length - 2];
    const currentRate = rates[rates.length - 1] ?? 0;
    const previousRate = rates[rates.length - 2] ?? 0;
    const baselineRate = rates.slice(0, -1).reduce((sum, value) => sum + value, 0) / Math.max(rates.length - 1, 1);
    const weekOverWeekChange = previous && previous.exceptions > 0 ? current.exceptions / previous.exceptions - 1 : current.exceptions > 0 ? 1 : 0;

    // Holt linear trend (alpha .6, beta .4) on weekly rates, projected one week out.
    let level = rates[0] ?? 0;
    let trend = rates.length > 1 ? (rates[1] ?? 0) - (rates[0] ?? 0) : 0;
    for (let index = 1; index < rates.length; index += 1) {
      const value = rates[index] ?? 0;
      const previousLevel = level;
      level = 0.6 * value + 0.4 * (level + trend);
      trend = 0.4 * (level - previousLevel) + 0.6 * trend;
    }
    const predictedRate = Math.max(0, level + trend);
    const predictedExceptions = Math.round(predictedRate * current.parcels);

    // Type concentration over the last two weeks.
    const recentCases = routeCases.filter((item) => {
      const offset = bucketKey(item.openedAt, anchor);
      return offset >= 0 && offset < 2;
    });
    const typeCounts = new Map<ExceptionType, number>();
    for (const item of recentCases) typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
    const topType: [ExceptionType | "none", number] = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["none", 0];
    const [dominantType, dominantCount] = topType;
    const dominantShare = recentCases.length ? dominantCount / recentCases.length : 0;

    const refused = recentCases.filter((item) => item.type === "refused");
    const codShareOfRefused = refused.length ? refused.filter((item) => item.codAmount >= 1000).length / refused.length : 0;

    const riderCounts = new Map<string, number>();
    for (const item of recentCases) if (item.riderName) riderCounts.set(item.riderName, (riderCounts.get(item.riderName) ?? 0) + 1);
    const [topRiderName, topRiderCount] = [...riderCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const topRider = topRiderName ? { name: topRiderName, count: topRiderCount!, share: topRiderCount! / Math.max(recentCases.length, 1) } : undefined;

    const areaCounts = new Map<string, number>();
    const parcelById = new Map(routeParcels.map((item) => [item.ItemId, item]));
    for (const item of recentCases) {
      const area = parcelById.get(item.parcelId)?.area;
      if (area) areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
    }
    const repeatAreas = [...areaCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([area, count]) => ({ area, count }));

    // --- risk score --------------------------------------------------------------
    const growthTerm = Math.max(0, Math.min(weekOverWeekChange, 1.5)) / 1.5; // 0..1
    const levelTerm = Math.min(currentRate / 0.08, 1); // 8 % weekly exception rate = saturated
    const trendConsistent = rates.length >= 3 && rates[rates.length - 1]! > rates[rates.length - 2]! && rates[rates.length - 2]! > rates[rates.length - 3]!;
    const concentrationTerm = dominantShare;
    const exposureTerm = dominantType === "refused" ? codShareOfRefused : dominantType === "address_missing" ? Math.min(repeatAreas.length / 3, 1) : 0.3;
    const riderTerm = topRider ? Math.min(topRider.share / 0.5, 1) : 0;
    const volumeTerm = Math.min(current.exceptions / 20, 1);
    let riskScore = 0.3 * growthTerm + 0.2 * levelTerm + 0.15 * concentrationTerm + 0.15 * exposureTerm + 0.1 * riderTerm + 0.1 * volumeTerm;
    if (trendConsistent) riskScore += 0.08;
    if (current.exceptions < 3) riskScore *= 0.5;
    riskScore = Math.max(0, Math.min(1, Number(riskScore.toFixed(3))));
    const riskLevel: RiskLevel = riskScore >= 0.6 ? "high" : riskScore >= 0.35 ? "medium" : "low";

    // --- evidence --------------------------------------------------------------------
    const evidence: string[] = [];
    if (previous) {
      evidence.push(
        `${current.exceptions} exceptions this week vs ${previous.exceptions} last week (${weekOverWeekChange >= 0 ? "+" : ""}${Math.round(weekOverWeekChange * 100)}% week over week).`
      );
    }
    if (dominantType !== "none" && recentCases.length) {
      const typeCurrent = current.byType[dominantType] ?? 0;
      const typePrevious = previous?.byType[dominantType] ?? 0;
      const typeChange = typePrevious > 0 ? typeCurrent / typePrevious - 1 : null;
      evidence.push(
        `${EXCEPTION_TYPES[dominantType].label} dominates: ${Math.round(dominantShare * 100)}% of recent exceptions${typeChange !== null ? ` (${typeCurrent} vs ${typePrevious}, ${typeChange >= 0 ? "+" : ""}${Math.round(typeChange * 100)}%)` : ` (${typeCurrent} this week)`}.`
      );
    }
    if (dominantType === "refused" && refused.length) {
      evidence.push(`${Math.round(codShareOfRefused * 100)}% of refused parcels carry COD ≥ ৳1,000 — cash-at-door is the likely driver.`);
    }
    if (topRider && topRider.share >= 0.3 && topRider.count >= 3) {
      evidence.push(`Rider ${topRider.name} is on ${topRider.count} of ${recentCases.length} recent failures (${Math.round(topRider.share * 100)}%).`);
    }
    if (repeatAreas.length) {
      evidence.push(`Repeat trouble spots: ${repeatAreas.map((item) => `${item.area} (${item.count})`).join(", ")}.`);
    }
    if (trendConsistent) evidence.push("Exception rate has risen three weeks in a row.");
    evidence.push(
      `Trend projection: ${(predictedRate * 100).toFixed(1)}% exception rate next week (~${predictedExceptions} of ~${current.parcels} parcels) vs ${(baselineRate * 100).toFixed(1)}% baseline.`
    );

    // --- action ---------------------------------------------------------------------
    let recommendedAction: RouteAction = "monitor";
    if (riskLevel !== "low") {
      if (dominantType === "refused" && codShareOfRefused >= 0.5) recommendedAction = "precall_cod_customers";
      else if (topRider && topRider.share >= 0.45 && topRider.count >= 4) recommendedAction = "reassign_rider";
      else if (dominantType === "address_missing") recommendedAction = "address_verification";
      else if (dominantType === "refused") recommendedAction = "precall_cod_customers";
    }

    results.push({
      routeCode,
      label: routeLabel(routeCode),
      originHubCode: ROUTE_BY_CODE[routeCode]?.origin ?? routeCode.split("-")[0] ?? "",
      destHubCode: ROUTE_BY_CODE[routeCode]?.dest ?? routeCode.split("-")[1] ?? "",
      weeks: buckets,
      currentRate,
      previousRate,
      baselineRate,
      weekOverWeekChange,
      predictedRate,
      predictedExceptions,
      riskScore,
      riskLevel,
      dominantType,
      dominantShare,
      codShareOfRefused,
      topRider,
      repeatAreas,
      evidence,
      recommendedAction,
      weekStart: current.weekStart,
      horizonWeekStart: new Date(new Date(current.weekStart).getTime() + WEEK_MS).toISOString()
    });
  }

  return results.sort((a, b) => b.riskScore - a.riskScore);
}

export const ROUTE_ACTION_LABEL: Record<RouteAction, { label: string; description: string }> = {
  precall_cod_customers: {
    label: "Pre-call COD customers",
    description: "Care calls every COD receiver on this lane before dispatch to confirm cash, address and a delivery window."
  },
  reassign_rider: {
    label: "Reassign rider coverage",
    description: "One rider accounts for most failures; rebalance the lane and review with the vendor."
  },
  address_verification: {
    label: "Verify addresses before dispatch",
    description: "Address-missing dominates; collect house/road numbers and landmarks at booking."
  },
  monitor: {
    label: "Monitor",
    description: "No actionable pattern yet; keep watching the weekly rate."
  }
};

export function describeRoute(routeCode: string): string {
  const route = ROUTE_BY_CODE[routeCode];
  if (!route) return routeCode;
  return `${hubShort(route.origin)} → ${hubShort(route.dest)}`;
}
