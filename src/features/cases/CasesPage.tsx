"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, Plus, RefreshCw, Search } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { useCases } from "@/features/data/queries";
import { CASE_STATUS_LABEL, EXCEPTION_TYPES, EXCEPTION_TYPE_LIST, hubName, teamLabel } from "@/features/domain/constants";
import { isTerminal, slaState } from "@/features/domain/sla";
import type { CaseStatus, ExceptionType } from "@/features/domain/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { PageHeader, Stat } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { useNow } from "@/lib/hooks";
import { CaseTable } from "./CaseTable";
import { canOpenCase, scopeCases } from "./scope";
import { useSlaSweep } from "./useSlaSweep";

type StatusFilter = "active" | "all" | CaseStatus;

export function CasesPage() {
  const { actor } = useActor();
  const cases = useCases(Boolean(actor));
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [type, setType] = useState<ExceptionType | "all">("all");
  useSlaSweep(cases.data, actor);

  const scoped = useMemo(() => scopeCases(cases.data ?? [], actor), [cases.data, actor]);
  const now = useNow();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter((item) => {
      if (status === "active" && isTerminal(item.status)) return false;
      if (status !== "active" && status !== "all" && item.status !== status) return false;
      if (type !== "all" && item.type !== type) return false;
      if (!needle) return true;
      return [item.caseNumber, item.trackingId, item.ownerName, item.riderName ?? "", item.routeCode].some((value) => value.toLowerCase().includes(needle));
    });
  }, [query, scoped, status, type]);

  const active = scoped.filter((item) => !isTerminal(item.status));
  const awaitingMe = active.filter((item) => item.pendingOwnerTeam && item.pendingOwnerTeam === actor?.team);
  const breached = active.filter((item) => item.slaBreached || slaState(item, now).status === "breached");
  const mine = active.filter((item) => item.ownerUserId === actor?.userId);

  const scopeLabel = actor?.role === "hub-staff" ? `${hubName(actor.hubCode)} hub` : actor?.role === "care-agent" ? "all teams" : actor?.role === "ops-manager" ? "all hubs" : teamLabel(actor?.team);

  return (
    <section>
      <PageHeader
        eyebrow={scopeLabel}
        title="Exception cases"
        subtitle="Every case names its owner. Hand-offs stay with the sender until the receiving team acknowledges."
        actions={
          <>
            <Button variant="outline" size="md" icon={<RefreshCw size={16} className={cases.isFetching ? "animate-spin" : ""} />} onClick={() => queryClient.invalidateQueries({ queryKey: ["cases"] })}>
              Refresh
            </Button>
            {canOpenCase(actor) ? (
              <Link href="/cases/new">
                <Button icon={<Plus size={16} />}>Open a case</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active cases" value={active.length} hint={`${scoped.length} total in your scope`} />
        <Stat label="Owned by me" value={mine.length} hint="You are accountable right now" tone="brand" />
        <Stat label="Awaiting my team's ack" value={awaitingMe.length} hint={awaitingMe.length ? "Acknowledge to take ownership" : "Nothing pending"} tone={awaitingMe.length ? "warn" : "neutral"} icon={<ArrowLeftRight size={14} />} />
        <Stat label="SLA breached" value={breached.length} hint={breached.length ? "Aging past threshold" : "All within SLA"} tone={breached.length ? "warn" : "good"} icon={<AlertTriangle size={14} />} />
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case, tracking id, owner, rider, route…" className="pl-10" />
        </div>
        <Select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="md:w-[220px]" aria-label="Status filter">
          <option value="active">Active (not resolved)</option>
          <option value="all">All statuses</option>
          {(Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).map((value) => (
            <option key={value} value={value}>
              {CASE_STATUS_LABEL[value]}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(event) => setType(event.target.value as ExceptionType | "all")} className="md:w-[200px]" aria-label="Type filter">
          <option value="all">All types</option>
          {EXCEPTION_TYPE_LIST.map((value) => (
            <option key={value} value={value}>
              {EXCEPTION_TYPES[value].label}
            </option>
          ))}
        </Select>
      </div>

      {cases.isLoading ? (
        <InlineSpinner label="Loading cases from Blocks Data…" />
      ) : cases.isError ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">Could not load cases: {(cases.error as Error).message}</div>
      ) : (
        <CaseTable
          cases={filtered}
          highlightTeam={actor?.team}
          emptyTitle={scoped.length ? "No cases match these filters" : "No exception cases yet"}
          emptyDescription={scoped.length ? "Try widening the status or type filter." : "Open one on any parcel, or seed the demo data from Team & data (ops manager)."}
        />
      )}
    </section>
  );
}
