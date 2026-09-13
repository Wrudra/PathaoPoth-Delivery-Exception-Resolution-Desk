"use client";

import { AlertTriangle, ArrowLeftRight, Bike, CheckCheck, CheckCircle2, EyeOff, Flag, MessageSquare, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CaseEvent, CaseEventType } from "@/features/domain/types";
import { formatDateTime } from "@/lib/format";

const ICONS: Record<CaseEventType, { icon: LucideIcon; className: string }> = {
  opened: { icon: Flag, className: "bg-ink-900 text-white" },
  note_added: { icon: MessageSquare, className: "bg-ink-100 text-ink-700" },
  rider_note: { icon: Bike, className: "bg-warn-100 text-warn-700" },
  ai_structured: { icon: Sparkles, className: "bg-violet-100 text-violet-700" },
  next_step_confirmed: { icon: CheckCircle2, className: "bg-good-100 text-good-700" },
  transfer_requested: { icon: ArrowLeftRight, className: "bg-violet-100 text-violet-700" },
  transfer_acknowledged: { icon: CheckCheck, className: "bg-good-100 text-good-700" },
  transfer_declined: { icon: XCircle, className: "bg-brand-100 text-brand-700" },
  status_changed: { icon: Flag, className: "bg-ink-100 text-ink-700" },
  sla_breached: { icon: AlertTriangle, className: "bg-brand-500 text-white" },
  resolved: { icon: CheckCircle2, className: "bg-good-600 text-white" },
  closed: { icon: CheckCircle2, className: "bg-ink-900 text-white" },
  sender_update: { icon: ShieldAlert, className: "bg-info-100 text-info-700" }
};

export function Timeline({ events, isLoading }: { events: CaseEvent[]; isLoading?: boolean }) {
  const ordered = [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return (
    <Card>
      <CardHeader icon={<MessageSquare size={16} />} title="Timeline" subtitle="Every action on the case. Internal entries are never shown to the sender." />
      <CardBody className="pt-2">
        {isLoading ? <p className="py-6 text-[13px] text-ink-500">Loading timeline…</p> : null}
        {!isLoading && ordered.length === 0 ? <p className="py-6 text-[13px] text-ink-500">No events yet.</p> : null}
        <ol className="grid gap-3">
          {ordered.map((event) => {
            const meta = ICONS[event.type] ?? ICONS.note_added;
            const Icon = meta.icon;
            return (
              <li key={event.ItemId} className="flex gap-3">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${meta.className}`}>
                  <Icon size={13} />
                </span>
                <div className="min-w-0 flex-1 rounded-xl border border-ink-100 bg-ink-50/60 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-500">
                    <span className="font-semibold text-ink-900">{event.actorName}</span>
                    {event.actorRole ? <span>· {event.actorRole}</span> : null}
                    <span>· {formatDateTime(event.occurredAt)}</span>
                    {event.internal ? (
                      <Badge tone="neutral" className="ml-auto">
                        <EyeOff size={11} /> internal
                      </Badge>
                    ) : (
                      <Badge tone="info" className="ml-auto">
                        sender-visible
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-ink-800">{event.message}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
