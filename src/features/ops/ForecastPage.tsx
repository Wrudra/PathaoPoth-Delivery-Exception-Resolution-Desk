"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Bot, CheckCircle2, PhoneCall, Route, Save, Sparkles, XCircle } from "lucide-react";
import { narrateRoute } from "@/features/ai/client";
import type { RouteForecastNarrative } from "@/features/ai/gemini.server";
import { ROUTE_ACTION_LABEL, analyzeRoutes, type RouteRisk } from "@/features/ai/routeRisk";
import { useActor } from "@/features/auth/useStaffProfile";
import { createMany, createOne, nowIso, updateOne } from "@/features/data/gateway";
import { queryKeys, useCases, useParcels, usePredictions } from "@/features/data/queries";
import { EXCEPTION_TYPES, hubShort } from "@/features/domain/constants";
import type { ExceptionType, PrecallTask, RoutePrediction } from "@/features/domain/types";
import { notifyTeam } from "@/features/notifications/notifier";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Alert, PageHeader, ProgressBar } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { formatDateTime, formatPercent, formatSignedPercent, formatTaka } from "@/lib/format";

const RISK_TONE: Record<string, Tone> = { high: "danger", medium: "warn", low: "good" };

export function ForecastPage() {
  const { actor } = useActor();
  const cases = useCases(Boolean(actor));
  const parcels = useParcels(Boolean(actor));
  const predictions = usePredictions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | undefined>();
  const [narratives, setNarratives] = useState<Record<string, RouteForecastNarrative>>({});

  const risks = useMemo(() => analyzeRoutes(cases.data ?? [], parcels.data ?? []), [cases.data, parcels.data]);
  const active = risks.find((risk) => risk.routeCode === selected) ?? risks[0];
  const savedForActive = (predictions.data ?? []).find((item) => item.routeCode === active?.routeCode && item.decision !== "none");

  const narrate = useMutation({
    mutationFn: (risk: RouteRisk) =>
      narrateRoute({
        routeCode: risk.routeCode,
        routeLabel: risk.label,
        evidence: risk.evidence,
        metrics: {
          exceptionsThisWeek: risk.weeks[risk.weeks.length - 1]?.exceptions ?? 0,
          exceptionsLastWeek: risk.weeks[risk.weeks.length - 2]?.exceptions ?? 0,
          weekOverWeek: formatSignedPercent(risk.weekOverWeekChange),
          predictedRate: formatPercent(risk.predictedRate, 1),
          riskScore: Math.round(risk.riskScore * 100),
          dominantType: risk.dominantType
        },
        recommendedAction: risk.recommendedAction
      }),
    onSuccess: (narrative, risk) => setNarratives((value) => ({ ...value, [risk.routeCode]: narrative })),
    onError: (error: Error) => toast({ tone: "danger", title: "Narration failed", description: error.message })
  });

  async function persistPrediction(risk: RouteRisk, decision: RoutePrediction["decision"]): Promise<string> {
    const narrative = narratives[risk.routeCode];
    const existing = (predictions.data ?? []).find((item) => item.routeCode === risk.routeCode && item.horizonWeekStart.slice(0, 10) === risk.horizonWeekStart.slice(0, 10));
    const payload: Omit<RoutePrediction, "ItemId"> = {
      routeCode: risk.routeCode,
      originHubCode: risk.originHubCode,
      destHubCode: risk.destHubCode,
      weekStart: risk.weekStart,
      horizonWeekStart: risk.horizonWeekStart,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      predictedExceptionRate: risk.predictedRate,
      baselineExceptionRate: risk.baselineRate,
      weekOverWeekChange: risk.weekOverWeekChange,
      dominantType: risk.dominantType,
      evidenceJson: JSON.stringify(risk.evidence),
      recommendedAction: risk.recommendedAction,
      narrative: narrative?.narrative,
      source: narrative?.source === "gemini" ? "gemini" : "heuristic",
      generatedAt: nowIso(),
      generatedByName: actor?.name ?? "Ops",
      decision,
      decidedByName: decision === "none" ? undefined : actor?.name,
      decidedAt: decision === "none" ? undefined : nowIso()
    };
    if (existing) {
      await updateOne<RoutePrediction>("RoutePrediction", existing.ItemId, payload);
      return existing.ItemId;
    }
    return createOne<RoutePrediction>("RoutePrediction", payload);
  }

  const save = useMutation({
    mutationFn: (risk: RouteRisk) => persistPrediction(risk, "none"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.predictions });
      toast({ tone: "good", title: "Forecast saved", description: "Stored in RoutePrediction with its evidence." });
    },
    onError: (error: Error) => toast({ tone: "danger", title: "Could not save", description: error.message })
  });

  const dismiss = useMutation({
    mutationFn: (risk: RouteRisk) => persistPrediction(risk, "dismissed"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.predictions });
      toast({ tone: "info", title: "Forecast dismissed" });
    }
  });

  const precall = useMutation({
    mutationFn: async (risk: RouteRisk) => {
      const predictionId = await persistPrediction(risk, "precall_scheduled");
      const candidates = (parcels.data ?? [])
        .filter((item) => item.routeCode === risk.routeCode && (item.status === "in_transit" || item.status === "out_for_delivery") && item.paymentType === "cod")
        .sort((a, b) => b.codAmount - a.codAmount);
      const due = new Date();
      due.setHours(20, 0, 0, 0);
      const rows: Omit<PrecallTask, "ItemId">[] = candidates.map((parcel) => ({
        predictionId,
        routeCode: risk.routeCode,
        parcelId: parcel.ItemId,
        trackingId: parcel.trackingId,
        receiverName: parcel.receiverName,
        receiverPhone: parcel.receiverPhone,
        area: parcel.area,
        codAmount: parcel.codAmount,
        reason: `${risk.label}: ${EXCEPTION_TYPES[risk.dominantType as ExceptionType]?.label ?? "exceptions"} ${formatSignedPercent(risk.weekOverWeekChange)} WoW, ${Math.round(risk.codShareOfRefused * 100)}% of refusals are COD. Confirm cash, address and window.`,
        assignedToTeam: "care",
        status: "pending",
        createdByName: actor?.name ?? "Ops",
        dueAt: due.toISOString()
      }));
      const created = await createMany<PrecallTask>("PrecallTask", rows);
      await notifyTeam("care", {
        kind: "precall_assigned",
        title: `${created} pre-calls for ${risk.label}`,
        body: `${actor?.name ?? "Ops"} scheduled proactive calls to COD receivers before the next batch fails.`,
        href: "/care/precalls"
      });
      return created;
    },
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.predictions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.precalls });
      toast({ tone: "good", title: `${count} pre-calls created`, description: "Care agents see them in the pre-call list now." });
    },
    onError: (error: Error) => toast({ tone: "danger", title: "Could not create pre-calls", description: error.message })
  });

  if (actor && actor.role !== "ops-manager") {
    return (
      <section>
        <PageHeader title="Route forecast" />
        <Alert tone="warn">The forecast is for ops managers.</Alert>
      </section>
    );
  }

  const candidatesForActive = active ? (parcels.data ?? []).filter((item) => item.routeCode === active.routeCode && (item.status === "in_transit" || item.status === "out_for_delivery") && item.paymentType === "cod") : [];

  return (
    <section>
      <PageHeader eyebrow="Predictive" title="Which route fails next week?" subtitle="Trend projection over four rolling weeks with the evidence behind every call. Act before the next batch, not after." />

      {cases.isLoading || parcels.isLoading ? <InlineSpinner label="Analysing lanes…" /> : null}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="grid gap-2 self-start">
          {risks.map((risk) => (
            <button
              key={risk.routeCode}
              onClick={() => setSelected(risk.routeCode)}
              className={`rounded-2xl border bg-white px-4 py-3 text-left shadow-(--shadow-card) transition-colors ${active?.routeCode === risk.routeCode ? "border-brand-400 ring-4 ring-brand-100" : "border-ink-200 hover:border-ink-300"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-ink-900">{risk.label}</span>
                <Badge tone={RISK_TONE[risk.riskLevel]}>{risk.riskLevel}</Badge>
              </div>
              <div className="mt-1 flex items-center justify-between text-[12px] text-ink-500">
                <span>
                  {risk.weeks[risk.weeks.length - 1]?.exceptions ?? 0} this wk · {formatSignedPercent(risk.weekOverWeekChange)}
                </span>
                <span className="tabular font-semibold text-ink-700">risk {Math.round(risk.riskScore * 100)}</span>
              </div>
              <ProgressBar value={risk.riskScore} tone={risk.riskLevel === "high" ? "brand" : risk.riskLevel === "medium" ? "warn" : "good"} className="mt-2" />
            </button>
          ))}
        </div>

        {active ? (
          <div className="grid gap-5">
            <Card className={active.riskLevel === "high" ? "border-brand-300" : undefined}>
              <CardHeader
                icon={<Route size={16} />}
                title={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {active.label} <Badge tone={RISK_TONE[active.riskLevel]}>{active.riskLevel} risk · score {Math.round(active.riskScore * 100)}</Badge>
                    {savedForActive ? <Badge tone="good">{savedForActive.decision.replace("_", " ")} · {savedForActive.decidedByName}</Badge> : null}
                  </span>
                }
                subtitle={`Predicted ${formatPercent(active.predictedRate, 1)} exception rate next week (~${active.predictedExceptions} parcels) vs ${formatPercent(active.baselineRate, 1)} baseline. ${hubShort(active.originHubCode)} → ${hubShort(active.destHubCode)}.`}
              />
              <CardBody className="grid gap-5 md:grid-cols-[1fr_260px]">
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink-500">Evidence</h4>
                  <ul className="mt-2 grid gap-2">
                    {active.evidence.map((line) => (
                      <li key={line} className="flex gap-2 text-[14px] leading-6 text-ink-800">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink-500">Weekly exceptions</h4>
                  <div className="mt-2 h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={active.weeks.map((week, index) => ({ name: index === active.weeks.length - 1 ? "this wk" : `-${active.weeks.length - 1 - index}w`, exceptions: week.exceptions, projected: 0 })).concat([{ name: "next wk", exceptions: 0, projected: active.predictedExceptions }])} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: "#fafafa" }} contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 12 }} />
                        <Bar dataKey="exceptions" stackId="a" fill="#18181b" radius={[6, 6, 0, 0]} name="Exceptions" />
                        <Bar dataKey="projected" stackId="a" fill="#f37270" radius={[6, 6, 0, 0]} name="Projected" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-lg bg-ink-50 px-2.5 py-2">
                      <div className="text-ink-500">Dominant type</div>
                      <div className="font-semibold text-ink-900">{active.dominantType === "none" ? "—" : EXCEPTION_TYPES[active.dominantType].short} · {Math.round(active.dominantShare * 100)}%</div>
                    </div>
                    <div className="rounded-lg bg-ink-50 px-2.5 py-2">
                      <div className="text-ink-500">COD share (refused)</div>
                      <div className="font-semibold text-ink-900">{Math.round(active.codShareOfRefused * 100)}%</div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="border-ink-900/15">
              <CardHeader
                icon={<Sparkles size={16} />}
                title={`Recommended: ${ROUTE_ACTION_LABEL[active.recommendedAction].label}`}
                subtitle={ROUTE_ACTION_LABEL[active.recommendedAction].description}
                actions={
                  <Button variant="outline" size="sm" icon={<Bot size={14} />} loading={narrate.isPending} onClick={() => narrate.mutate(active)}>
                    {narratives[active.routeCode] ? "Re-narrate" : "Narrate with AI"}
                  </Button>
                }
              />
              <CardBody className="grid gap-4">
                {narratives[active.routeCode] ? (
                  <div className="grid gap-3 rounded-xl border border-violet-600/20 bg-violet-100/40 p-4">
                    <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-violet-700">
                      <Bot size={13} /> {narratives[active.routeCode]!.source === "gemini" ? `Gemini · ${narratives[active.routeCode]!.model}` : "Rule engine"} briefing
                    </div>
                    <p className="text-[14px] leading-6 text-ink-900">{narratives[active.routeCode]!.narrative}</p>
                    <div>
                      <div className="text-[12px] font-bold uppercase tracking-wide text-ink-500">Pre-call script for care</div>
                      <p className="mt-1 rounded-lg bg-white px-3 py-2 text-[13px] leading-6 text-ink-800">“{narratives[active.routeCode]!.precallScript}”</p>
                    </div>
                    {narratives[active.routeCode]!.watchouts.length ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {narratives[active.routeCode]!.watchouts.map((line) => (
                          <li key={line} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-[12px] text-ink-700">
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
                  <div className="mr-auto text-[13px] text-ink-700">
                    <span className="font-semibold text-ink-900">{candidatesForActive.length} COD parcels</span> currently in flight on this lane · {formatTaka(candidatesForActive.reduce((sum, item) => sum + item.codAmount, 0))} at stake
                  </div>
                  <Button icon={<PhoneCall size={16} />} loading={precall.isPending} disabled={!candidatesForActive.length || savedForActive?.decision === "precall_scheduled"} onClick={() => precall.mutate(active)}>
                    {savedForActive?.decision === "precall_scheduled" ? "Pre-call list scheduled" : "Generate pre-call list for care"}
                  </Button>
                  <Button variant="outline" icon={<Save size={16} />} loading={save.isPending} onClick={() => save.mutate(active)}>
                    Save forecast
                  </Button>
                  <Button variant="ghost" icon={<XCircle size={16} />} loading={dismiss.isPending} onClick={() => dismiss.mutate(active)}>
                    Dismiss
                  </Button>
                </div>
                {savedForActive?.decision === "precall_scheduled" ? (
                  <Alert tone="good" title="Decision recorded">
                    {savedForActive.decidedByName} scheduled pre-calls at {formatDateTime(savedForActive.decidedAt)}. <Link href="/care/precalls" className="font-semibold underline">Open the call list →</Link>
                  </Alert>
                ) : null}
              </CardBody>
            </Card>
          </div>
        ) : null}
      </div>

      {(predictions.data ?? []).length ? (
        <Card className="mt-5">
          <CardHeader icon={<CheckCircle2 size={16} />} title="Forecast log" subtitle="Saved predictions and the decisions taken on them." />
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {(predictions.data ?? []).slice(0, 12).map((item) => (
                <li key={item.ItemId} className="flex flex-wrap items-center gap-2 px-5 py-3 text-[13px]">
                  <span className="font-semibold text-ink-900">{hubShort(item.originHubCode)} → {hubShort(item.destHubCode)}</span>
                  <Badge tone={RISK_TONE[item.riskLevel]}>{item.riskLevel} · {Math.round(item.riskScore * 100)}</Badge>
                  <span className="text-ink-500">{formatSignedPercent(item.weekOverWeekChange)} WoW · {ROUTE_ACTION_LABEL[item.recommendedAction]?.label}</span>
                  <Badge tone={item.decision === "precall_scheduled" ? "good" : item.decision === "dismissed" ? "neutral" : "info"} className="ml-auto">
                    {item.decision.replace("_", " ")}
                  </Badge>
                  <span className="text-[12px] text-ink-500">{item.generatedByName} · {formatDateTime(item.generatedAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </section>
  );
}
