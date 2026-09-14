"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, Bike, Building2, Route, TrendingUp } from "lucide-react";
import { analyzeRoutes } from "@/features/ai/routeRisk";
import { useActor } from "@/features/auth/useStaffProfile";
import { useCases, useParcels } from "@/features/data/queries";
import { EXCEPTION_TYPES, EXCEPTION_TYPE_LIST, hubName, hubShort, routeLabel } from "@/features/domain/constants";
import { isTerminal } from "@/features/domain/sla";
import type { ExceptionType } from "@/features/domain/types";
import { useSlaSweep } from "@/features/cases/useSlaSweep";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Alert, PageHeader, Stat } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { formatPercent, formatSignedPercent } from "@/lib/format";
import { averageResolutionHours, groupBy, routeVolume, slaHitRate, splitWeeks } from "./analytics";

const TYPE_COLORS: Record<ExceptionType, string> = {
  refused: "#e83330",
  delayed: "#d97706",
  damaged: "#7a1a19",
  address_missing: "#2563eb",
  disputed: "#7c3aed"
};

const RISK_TONE: Record<string, Tone> = { high: "danger", medium: "warn", low: "good" };

export function OpsPage() {
  const { actor } = useActor();
  const cases = useCases(Boolean(actor));
  const parcels = useParcels(Boolean(actor));
  useSlaSweep(cases.data, actor);

  const data = useMemo(() => cases.data ?? [], [cases.data]);
  const window = useMemo(() => splitWeeks(data), [data]);
  const byHub = useMemo(() => groupBy(window, (item) => item.originHubCode, hubName), [window]);
  const byRoute = useMemo(() => groupBy(window, (item) => item.routeCode, routeLabel, routeVolume), [window]);
  const byRider = useMemo(() => groupBy(window, (item) => item.riderName, (key) => key).slice(0, 8), [window]);
  const risks = useMemo(() => analyzeRoutes(data, parcels.data ?? []), [data, parcels.data]);
  const riskByRoute = new Map(risks.map((risk) => [risk.routeCode, risk]));

  const totalVolume = byRoute.reduce((sum, row) => sum + (row.volume ?? 0), 0);
  const currentRate = totalVolume ? window.current.length / totalVolume : null;
  const previousRate = totalVolume ? window.previous.length / totalVolume : null;
  const breachedActive = data.filter((item) => !isTerminal(item.status) && item.slaBreached).length;
  const topRisk = risks[0];

  if (actor && actor.role !== "ops-manager") {
    return (
      <section>
        <PageHeader title="Ops overview" />
        <Alert tone="warn">The operations view is for ops managers.</Alert>
      </section>
    );
  }

  const typeStack = byRoute.slice(0, 8).map((row) => ({ name: row.label, ...row.byType }));

  return (
    <section>
      <PageHeader eyebrow="Operations" title="Exception overview" subtitle="Last 7 days versus the 7 before, by hub, route and rider. Patterns, not one-off complaints." actions={<Link href="/ops/forecast" className="inline-flex items-center gap-1 rounded-xl bg-brand-500 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-brand-600">Route forecast <ArrowRight size={16} /></Link>} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Exceptions this week" value={window.current.length} hint={`${window.previous.length} last week (${formatSignedPercent(window.previous.length ? window.current.length / window.previous.length - 1 : null)})`} tone="brand" icon={<TrendingUp size={14} />} />
        <Stat label="Exception rate" value={formatPercent(currentRate, 1)} hint={`${formatPercent(previousRate, 1)} last week · lane volume basis`} />
        <Stat label="SLA breached (active)" value={breachedActive} tone={breachedActive ? "warn" : "good"} icon={<AlertTriangle size={14} />} />
        <Stat label="SLA hit rate" value={formatPercent(slaHitRate(data))} hint="resolved within threshold" tone="good" />
        <Stat label="Avg time to resolve" value={averageResolutionHours(data) ? `${averageResolutionHours(data)!.toFixed(1)}h` : "-"} />
      </div>

      {cases.isLoading ? <InlineSpinner label="Crunching exceptions…" /> : null}

      {topRisk && topRisk.riskLevel !== "low" ? (
        <Link href="/ops/forecast" className="mb-5 block rounded-2xl border border-brand-300 bg-brand-50 px-5 py-4 transition-colors hover:border-brand-400">
          <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-brand-700">
            <Route size={14} /> Likely to fail again next week
            <Badge tone={RISK_TONE[topRisk.riskLevel]} className="ml-1">
              {topRisk.riskLevel} risk · {Math.round(topRisk.riskScore * 100)}
            </Badge>
          </div>
          <div className="mt-1 text-[20px] font-bold text-ink-900">
            {topRisk.label}: {EXCEPTION_TYPES[topRisk.dominantType as ExceptionType]?.label.toLowerCase() ?? "exceptions"} {formatSignedPercent(topRisk.weekOverWeekChange)} week over week
          </div>
          <p className="mt-1 text-[13px] leading-5 text-ink-700">{topRisk.evidence[0]} {topRisk.evidence[1]}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700">See the evidence and act <ArrowRight size={14} /></span>
        </Link>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Route size={16} />} title="By route" subtitle="Exceptions this week, stacked by type" />
          <CardBody>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeStack} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="#f4f4f5" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#3f3f46" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#fafafa" }} contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 12 }} />
                  {EXCEPTION_TYPE_LIST.map((type) => (
                    <Bar key={type} dataKey={type} stackId="a" fill={TYPE_COLORS[type]} name={EXCEPTION_TYPES[type].short} radius={type === "disputed" ? [0, 6, 6, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-600">
              {EXCEPTION_TYPE_LIST.map((type) => (
                <span key={type} className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS[type] }} /> {EXCEPTION_TYPES[type].short}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Building2 size={16} />} title="By origin hub" subtitle="This week vs last week" />
          <CardBody>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byHub.map((row) => ({ name: hubShort(row.key), current: row.current, previous: row.previous }))} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#3f3f46" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "#fafafa" }} contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 12 }} />
                  <Bar dataKey="previous" name="Last week" fill="#d4d4d8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="current" name="This week" fill="#e83330" radius={[6, 6, 0, 0]}>
                    {byHub.map((row) => (
                      <Cell key={row.key} fill={row.change !== null && row.change > 0.25 ? "#e83330" : "#18181b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader icon={<Route size={16} />} title="Route table" subtitle="Week-over-week change and forecast risk" />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[620px] text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3">Route</th>
                  <th className="px-3 py-3 text-right">This week</th>
                  <th className="px-3 py-3 text-right">Last week</th>
                  <th className="px-3 py-3 text-right">Change</th>
                  <th className="px-3 py-3 text-right">Rate</th>
                  <th className="px-3 py-3">Dominant</th>
                  <th className="px-5 py-3">Forecast</th>
                </tr>
              </thead>
              <tbody>
                {byRoute.map((row) => {
                  const risk = riskByRoute.get(row.key);
                  const dominant = (Object.entries(row.byType) as [ExceptionType, number][]).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <tr key={row.key} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                      <td className="px-5 py-3 font-semibold text-ink-900">{row.label}</td>
                      <td className="tabular px-3 py-3 text-right font-semibold">{row.current}</td>
                      <td className="tabular px-3 py-3 text-right text-ink-500">{row.previous}</td>
                      <td className={`tabular px-3 py-3 text-right font-semibold ${row.change !== null && row.change > 0.2 ? "text-brand-600" : row.change !== null && row.change < -0.2 ? "text-good-700" : "text-ink-700"}`}>{formatSignedPercent(row.change)}</td>
                      <td className="tabular px-3 py-3 text-right text-ink-700">{formatPercent(row.rate ?? null, 1)}</td>
                      <td className="px-3 py-3">{dominant ? <Badge>{EXCEPTION_TYPES[dominant[0]].short} · {dominant[1]}</Badge> : "-"}</td>
                      <td className="px-5 py-3">{risk ? <Badge tone={RISK_TONE[risk.riskLevel]}>{risk.riskLevel} · {Math.round(risk.riskScore * 100)}</Badge> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Bike size={16} />} title="By rider" subtitle="Most exceptions this week: bad route or bad luck?" />
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {byRider.map((row) => {
                const max = byRider[0]?.current ?? 1;
                return (
                  <li key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="truncate font-semibold text-ink-900">{row.label}</span>
                        <span className="tabular text-ink-500">
                          {row.current} <span className="text-ink-400">/ {row.previous} last wk</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-ink-900" style={{ width: `${(row.current / max) * 100}%` }} />
                      </div>
                    </div>
                    <span className={`tabular text-[12px] font-semibold ${row.change !== null && row.change > 0.3 ? "text-brand-600" : "text-ink-500"}`}>{formatSignedPercent(row.change)}</span>
                  </li>
                );
              })}
              {!byRider.length ? <li className="px-5 py-6 text-[13px] text-ink-500">No rider data this week.</li> : null}
            </ul>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
