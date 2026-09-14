import { describe, expect, it } from "vitest";
import type { ExceptionCase, Parcel } from "@/features/domain/types";
import { analyzeRoutes, headlineWeekOverWeek } from "./routeRisk";

const DAY = 86_400_000;

function refusedCases(now: Date, counts: [number, number, number, number]): ExceptionCase[] {
  const cases: ExceptionCase[] = [];
  counts.forEach((count, weekIndex) => {
    const weeksAgo = 3 - weekIndex;
    for (let index = 0; index < count; index += 1) {
      cases.push({
        ItemId: `c-${weekIndex}-${index}`,
        openedAt: new Date(now.getTime() - (weeksAgo * 7 + 1) * DAY).toISOString(),
        type: "refused",
        routeCode: "MIR10-CTGGEC",
        parcelId: `p-${weekIndex}-${index}`,
        riderName: index % 3 === 0 ? "Jashim Uddin" : "Kamal Uddin",
        codAmount: 1500,
        trackingId: `PP-${weekIndex}-${index}`
      } as ExceptionCase);
    }
  });
  return cases;
}

describe("analyzeRoutes headline", () => {
  it("uses refused 17 → 24 (+41%) when that type dominates, even if overall WoW is lower", () => {
    const now = new Date("2026-09-15T06:00:00+06:00");
    const cases = refusedCases(now, [8, 10, 17, 24]);
    for (let index = 0; index < 8; index += 1) {
      cases.push({
        ItemId: `d-prev-${index}`,
        openedAt: new Date(now.getTime() - 8 * DAY).toISOString(),
        type: "delayed",
        routeCode: "MIR10-CTGGEC",
        parcelId: `pd-${index}`,
        codAmount: 0,
        trackingId: `PD-${index}`
      } as ExceptionCase);
    }
    for (let index = 0; index < 4; index += 1) {
      cases.push({
        ItemId: `d-now-${index}`,
        openedAt: new Date(now.getTime() - 1 * DAY).toISOString(),
        type: "delayed",
        routeCode: "MIR10-CTGGEC",
        parcelId: `pn-${index}`,
        codAmount: 0,
        trackingId: `PN-${index}`
      } as ExceptionCase);
    }
    const parcels = cases.map(
      (item) =>
        ({
          ItemId: item.parcelId,
          routeCode: "MIR10-CTGGEC",
          dispatchedAt: item.openedAt,
          area: "GEC Circle"
        }) as Parcel
    );

    const risk = analyzeRoutes(cases, parcels, { now }).find((item) => item.routeCode === "MIR10-CTGGEC");
    expect(risk).toBeDefined();
    expect(risk!.dominantType).toBe("refused");
    expect(risk!.dominantTypeWeekOverWeek).toBeCloseTo(24 / 17 - 1, 5);
    expect(Math.round(headlineWeekOverWeek(risk!) * 100)).toBe(41);
    expect(Math.round(risk!.weekOverWeekChange * 100)).not.toBe(41);
  });
});
