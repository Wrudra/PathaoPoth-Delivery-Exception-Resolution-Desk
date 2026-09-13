"use client";

import { AlertTriangle, CheckCircle2, Clock, Timer } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { CASE_STATUS_LABEL, EXCEPTION_TYPES } from "@/features/domain/constants";
import { slaState } from "@/features/domain/sla";
import type { CaseStatus, ExceptionCase, ExceptionType } from "@/features/domain/types";
import { formatDuration } from "@/lib/format";

const STATUS_TONE: Record<CaseStatus, Tone> = {
  open: "warn",
  awaiting_ack: "violet",
  in_progress: "info",
  resolved: "good",
  closed: "neutral"
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot pulse={status === "awaiting_ack"}>
      {CASE_STATUS_LABEL[status]}
    </Badge>
  );
}

const TYPE_TONE: Record<ExceptionType, Tone> = {
  refused: "brand",
  delayed: "warn",
  damaged: "danger",
  address_missing: "info",
  disputed: "violet"
};

export function TypeBadge({ type, long }: { type: ExceptionType; long?: boolean }) {
  return <Badge tone={TYPE_TONE[type]}>{long ? EXCEPTION_TYPES[type].label : EXCEPTION_TYPES[type].short}</Badge>;
}

export function SlaBadge({ item, now }: { item: Pick<ExceptionCase, "openedAt" | "slaDueAt" | "status" | "resolvedAt" | "slaBreached">; now?: number }) {
  const state = slaState(item, now);
  if (state.status === "met") {
    return (
      <Badge tone="good">
        <CheckCircle2 size={12} /> SLA met
      </Badge>
    );
  }
  if (state.status === "breached" || item.slaBreached) {
    return (
      <Badge tone="danger">
        <AlertTriangle size={12} /> Breached {formatDuration(-state.remainingMs)} ago
      </Badge>
    );
  }
  if (state.status === "at_risk") {
    return (
      <Badge tone="warn">
        <Timer size={12} /> {formatDuration(state.remainingMs)} left
      </Badge>
    );
  }
  return (
    <Badge tone="neutral">
      <Clock size={12} /> {formatDuration(state.remainingMs)} left
    </Badge>
  );
}

export function PriorityDot({ priority }: { priority: ExceptionCase["priority"] }) {
  const color = priority === "critical" ? "bg-brand-600" : priority === "high" ? "bg-warn-600" : "bg-ink-300";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={`${priority} priority`} />;
}

export function ConfidenceMeter({ value, source }: { value: number; source?: string }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.8 ? "bg-good-600" : value >= 0.6 ? "bg-warn-600" : "bg-brand-500";
  return (
    <div className="flex items-center gap-2" title={`${pct}% confidence${source ? ` (${source})` : ""}`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full origin-left rounded-full ${tone}`} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <span className="tabular text-[12px] font-semibold text-ink-700">{pct}%</span>
    </div>
  );
}
