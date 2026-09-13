"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, PhoneCall, PhoneOff, Route } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { nowIso, updateOne } from "@/features/data/gateway";
import { queryKeys, usePrecallTasks } from "@/features/data/queries";
import { routeLabel } from "@/features/domain/constants";
import type { PrecallStatus, PrecallTask } from "@/features/domain/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { formatRelative, formatTaka, maskPhone } from "@/lib/format";

const STATUS_TONE: Record<PrecallStatus, Tone> = { pending: "warn", confirmed: "good", reschedule: "info", no_answer: "brand", cancelled: "neutral" };

export function PrecallPage() {
  const { actor } = useActor();
  const tasks = usePrecallTasks();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [routeFilter, setRouteFilter] = useState<string>("all");

  const routes = useMemo(() => [...new Set((tasks.data ?? []).map((task) => task.routeCode))], [tasks.data]);
  const visible = (tasks.data ?? []).filter((task) => routeFilter === "all" || task.routeCode === routeFilter);
  const pending = visible.filter((task) => task.status === "pending");
  const done = visible.filter((task) => task.status !== "pending");
  const showPhone = actor?.role === "care-agent" || actor?.role === "ops-manager";

  const outcome = useMutation({
    mutationFn: ({ task, status }: { task: PrecallTask; status: PrecallStatus }) =>
      updateOne<PrecallTask>("PrecallTask", task.ItemId, { status, calledAt: nowIso(), assignedToName: actor?.name, outcomeNote: `${status.replace("_", " ")} by ${actor?.name}` }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.precalls });
      toast({ tone: "good", title: `${variables.task.trackingId}: ${variables.status.replace("_", " ")}` });
    },
    onError: (error: Error) => toast({ tone: "danger", title: "Could not save the outcome", description: error.message })
  });

  if (actor && actor.role !== "care-agent" && actor.role !== "ops-manager") {
    return (
      <section>
        <PageHeader title="Pre-call list" />
        <Alert tone="warn">Pre-calls are made by care agents.</Alert>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        eyebrow="Proactive"
        title="Pre-call list"
        subtitle="COD receivers on lanes the forecast flagged. A two-minute call today prevents a refused delivery tomorrow."
        actions={
          routes.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setRouteFilter("all")} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${routeFilter === "all" ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200"}`}>
                All lanes
              </button>
              {routes.map((route) => (
                <button key={route} onClick={() => setRouteFilter(route)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${routeFilter === route ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200"}`}>
                  {routeLabel(route)}
                </button>
              ))}
            </div>
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="To call" value={pending.length} tone={pending.length ? "brand" : "neutral"} icon={<PhoneCall size={14} />} />
        <Stat label="Confirmed" value={visible.filter((task) => task.status === "confirmed").length} tone="good" />
        <Stat label="COD at stake" value={formatTaka(pending.reduce((sum, task) => sum + task.codAmount, 0))} />
      </div>

      {tasks.isLoading ? <InlineSpinner label="Loading pre-calls…" /> : null}
      {!tasks.isLoading && !visible.length ? (
        <EmptyState icon={<Route size={20} />} title="No pre-calls yet" description="The ops manager generates a list from the route forecast when a lane is likely to fail next week." />
      ) : null}

      {pending.length ? (
        <Card>
          <CardHeader icon={<PhoneCall size={16} />} title={`Call now · ${pending.length}`} subtitle="Confirm cash, address and a delivery window. Record the outcome." />
          <CardBody className="grid gap-2 p-3">
            {pending.map((task) => (
              <div key={task.ItemId} className="grid gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono text-[13px] font-semibold text-ink-900">{task.trackingId}</span>
                    <Badge tone="warn">COD {formatTaka(task.codAmount)}</Badge>
                    <Badge>{routeLabel(task.routeCode)}</Badge>
                  </div>
                  <div className="mt-1 text-[14px] font-semibold text-ink-900">{task.receiverName}</div>
                  <div className="text-[12px] text-ink-500">
                    {task.area} · <span className="mono text-ink-700">{showPhone ? task.receiverPhone ?? "—" : maskPhone(task.receiverPhone)}</span>
                  </div>
                </div>
                <div className="text-[12px] leading-5 text-ink-600">{task.reason}</div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="success" icon={<CheckCircle2 size={14} />} disabled={outcome.isPending} onClick={() => outcome.mutate({ task, status: "confirmed" })}>
                    Confirmed
                  </Button>
                  <Button size="sm" variant="outline" icon={<CalendarClock size={14} />} disabled={outcome.isPending} onClick={() => outcome.mutate({ task, status: "reschedule" })}>
                    Reschedule
                  </Button>
                  <Button size="sm" variant="ghost" icon={<PhoneOff size={14} />} disabled={outcome.isPending} onClick={() => outcome.mutate({ task, status: "no_answer" })}>
                    No answer
                  </Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {done.length ? (
        <Card className="mt-5">
          <CardHeader title={`Called · ${done.length}`} />
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {done.map((task) => (
                <li key={task.ItemId} className="flex flex-wrap items-center gap-2 px-5 py-3 text-[13px]">
                  <span className="mono font-semibold text-ink-900">{task.trackingId}</span>
                  <span className="text-ink-600">{task.receiverName}</span>
                  <span className="text-ink-400">· {routeLabel(task.routeCode)}</span>
                  <Badge tone={STATUS_TONE[task.status]} className="ml-auto">
                    {task.status.replace("_", " ")}
                  </Badge>
                  <span className="text-[12px] text-ink-500">{task.assignedToName ? `${task.assignedToName} · ` : ""}{formatRelative(task.calledAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </section>
  );
}
