"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowLeftRight, Headset, PhoneCall, Sparkles } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { useCases, usePrecallTasks } from "@/features/data/queries";
import { isTerminal, slaState } from "@/features/domain/sla";
import { CaseTable } from "@/features/cases/CaseTable";
import { useSlaSweep } from "@/features/cases/useSlaSweep";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, PageHeader, Stat } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { useNow } from "@/lib/hooks";

export function CarePage() {
  const { actor } = useActor();
  const cases = useCases(Boolean(actor));
  const precalls = usePrecallTasks();
  useSlaSweep(cases.data, actor);
  const now = useNow();

  const active = useMemo(() => (cases.data ?? []).filter((item) => !isTerminal(item.status)), [cases.data]);
  const awaitingAck = active.filter((item) => item.pendingOwnerTeam === "care");
  const toConfirm = active.filter((item) => item.nextStepStatus === "recommended" || item.nextStepStatus === "manual_review");
  const breached = active.filter((item) => item.slaBreached || slaState(item, now).status === "breached");
  const atRisk = active.filter((item) => !breached.includes(item) && slaState(item, now).status === "at_risk");
  const pendingCalls = (precalls.data ?? []).filter((task) => task.status === "pending");

  if (actor && actor.role !== "care-agent" && actor.role !== "ops-manager") {
    return (
      <section>
        <PageHeader title="Care queue" />
        <Alert tone="warn">This queue is for care agents. Your role is {actor.role ?? "not assigned"}.</Alert>
      </section>
    );
  }

  return (
    <section>
      <PageHeader eyebrow="Customer care" title="Care queue" subtitle="Acknowledge hand-offs, confirm the recommended next step, and keep senders informed — in that order." />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Awaiting my ack" value={awaitingAck.length} tone={awaitingAck.length ? "warn" : "neutral"} icon={<ArrowLeftRight size={14} />} />
        <Stat label="Next steps to confirm" value={toConfirm.length} tone={toConfirm.length ? "brand" : "neutral"} icon={<Sparkles size={14} />} />
        <Stat label="SLA breached" value={breached.length} tone={breached.length ? "warn" : "good"} icon={<AlertTriangle size={14} />} />
        <Stat label="At risk (≥75% of SLA)" value={atRisk.length} />
        <Link href="/care/precalls" className="block">
          <Stat label="Pre-calls pending" value={pendingCalls.length} tone={pendingCalls.length ? "brand" : "neutral"} icon={<PhoneCall size={14} />} hint="Open the call list →" />
        </Link>
      </div>

      {cases.isLoading ? <InlineSpinner label="Loading the queue…" /> : null}

      {!cases.isLoading ? (
        <div className="grid gap-6">
          <Section icon={<ArrowLeftRight size={16} />} title="Hand-offs awaiting your acknowledgement" subtitle="The sender's team is still accountable until you accept. Open the case and acknowledge." count={awaitingAck.length}>
            <CaseTable cases={awaitingAck} highlightTeam="care" emptyTitle="Nothing waiting for care" emptyDescription="Hub teams hand cases here when the receiver needs a call or the sender needs an answer." />
          </Section>
          <Section icon={<Sparkles size={16} />} title="Recommended next steps to confirm" subtitle="Structured from rider notes. One click confirms; low-confidence ones say so." count={toConfirm.length}>
            <CaseTable cases={toConfirm} emptyTitle="No recommendations pending" />
          </Section>
          <Section icon={<AlertTriangle size={16} />} title="SLA breached" subtitle="Aging past the threshold for their type. The owner has been notified automatically." count={breached.length}>
            <CaseTable cases={breached} emptyTitle="Everything is within SLA" />
          </Section>
          <Section icon={<Headset size={16} />} title="All active cases" count={active.length}>
            <CaseTable cases={active.filter((item) => !awaitingAck.includes(item) && !toConfirm.includes(item) && !breached.includes(item))} emptyTitle="No other active cases" />
          </Section>
        </div>
      ) : null}
    </section>
  );
}

function Section({ icon, title, subtitle, count, children }: { icon: React.ReactNode; title: string; subtitle?: string; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader icon={icon} title={`${title} · ${count}`} subtitle={subtitle} />
      <CardBody className="p-3">{children}</CardBody>
    </Card>
  );
}
