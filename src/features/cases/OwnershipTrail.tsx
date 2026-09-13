"use client";

import { ArrowLeftRight, CheckCircle2, Clock, Flag, ShieldCheck, UserRound } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { teamLabel } from "@/features/domain/constants";
import type { CaseEvent, ExceptionCase } from "@/features/domain/types";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import { useNow } from "@/lib/hooks";

type Segment = { owner: string; team: string; from: string; to?: string; ackedBy?: string; pendingTo?: string };

/** Derives who owned the case, when, from the append-only event stream. */
export function buildTrail(item: ExceptionCase, events: CaseEvent[]): Segment[] {
  const segments: Segment[] = [{ owner: item.openedByName, team: events.find((e) => e.type === "opened")?.toOwnerTeam ?? item.ownerTeam, from: item.openedAt }];
  for (const event of events) {
    const current = segments[segments.length - 1]!;
    if (event.type === "transfer_requested") current.pendingTo = event.toOwnerTeam;
    if (event.type === "transfer_acknowledged") {
      current.to = event.occurredAt;
      current.pendingTo = undefined;
      segments.push({ owner: event.toOwnerName ?? event.actorName, team: event.toOwnerTeam ?? event.actorTeam ?? "", from: event.occurredAt, ackedBy: event.actorName });
    }
    if (event.type === "transfer_declined") current.pendingTo = undefined;
    if (event.type === "resolved" && current.owner !== event.actorName) {
      current.to = event.occurredAt;
      segments.push({ owner: event.actorName, team: event.actorTeam ?? "", from: event.occurredAt });
    }
  }
  const last = segments[segments.length - 1]!;
  if (item.status === "resolved" || item.status === "closed") last.to = item.resolvedAt ?? item.closedAt ?? last.to;
  if (item.pendingOwnerTeam) last.pendingTo = item.pendingOwnerTeam;
  return segments;
}

export function OwnershipTrail({ item, events }: { item: ExceptionCase; events: CaseEvent[] }) {
  const segments = buildTrail(item, events);
  const now = useNow();
  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck size={16} />}
        title="Ownership trail"
        subtitle="Who was accountable, and when. A hand-off only moves the owner once the receiving side acknowledges."
        actions={
          <Badge tone="ink">
            <UserRound size={12} /> Owner now: {item.ownerName}
          </Badge>
        }
      />
      <CardBody className="pt-2">
        <ol className="relative ml-2 border-l-2 border-ink-200 pl-6">
          {segments.map((segment, index) => {
            const isCurrent = index === segments.length - 1 && !segment.to;
            const end = segment.to ? new Date(segment.to).getTime() : now;
            return (
              <li key={`${segment.owner}-${segment.from}`} className="relative pb-6 last:pb-1">
                <span className={`absolute -left-[31px] top-0.5 grid h-5 w-5 place-items-center rounded-full ring-4 ring-white ${isCurrent ? "bg-brand-500 text-white" : "bg-ink-900 text-white"}`}>
                  {index === 0 ? <Flag size={10} /> : <CheckCircle2 size={10} />}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink-900">{segment.owner}</span>
                  <span className="text-[13px] text-ink-500">{teamLabel(segment.team)}</span>
                  {isCurrent ? <Badge tone="brand">accountable now</Badge> : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
                  <span>
                    <Clock size={11} className="mr-1 inline" />
                    {formatDateTime(segment.from)}
                    {segment.to ? ` → ${formatDateTime(segment.to)}` : " → now"}
                  </span>
                  <span className="tabular font-medium text-ink-700">held {formatDuration(end - new Date(segment.from).getTime())}</span>
                  {segment.ackedBy ? <span>acknowledged by {segment.ackedBy}</span> : null}
                </div>
                {segment.pendingTo ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-100 px-2.5 py-1.5 text-[12px] font-medium text-violet-700">
                    <ArrowLeftRight size={12} className="animate-(--animate-pulse-soft)" />
                    Hand-off to {teamLabel(segment.pendingTo)} awaiting acknowledgement
                    {item.transferRequestedAt ? <span className="text-violet-600/80">· asked {formatRelative(item.transferRequestedAt)}</span> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
