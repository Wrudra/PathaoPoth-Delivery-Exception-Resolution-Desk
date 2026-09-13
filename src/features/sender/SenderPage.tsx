"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, EyeOff, PackageSearch, Search, ShieldCheck, Truck } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { useSenderParcels, useSenderUpdates, type SenderParcel } from "@/features/data/queries";
import { hubShort } from "@/features/domain/constants";
import type { SenderUpdate, SenderUpdateStatus } from "@/features/domain/types";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { formatDateTime, formatRelative, formatTaka } from "@/lib/format";

const STATUS_META: Record<SenderUpdateStatus, { label: string; tone: Tone }> = {
  investigating: { label: "Looking into it", tone: "warn" },
  action_planned: { label: "Action planned", tone: "info" },
  in_progress: { label: "In progress", tone: "info" },
  resolved: { label: "Resolved", tone: "good" },
  returned: { label: "Returning to you", tone: "neutral" }
};

export function SenderPage() {
  const { actor } = useActor();
  // Scope is applied at the gateway: only this merchant's parcels come back,
  // and only the sender-safe projection of them (no receiver phone/address).
  const parcels = useSenderParcels(actor?.role === "sender" ? { senderCompany: actor.senderCompany, senderUserId: actor.userId } : undefined);
  const [query, setQuery] = useState("");
  const mine = useMemo(() => parcels.data ?? [], [parcels.data]);

  const trackingIds = useMemo(() => mine.map((item) => item.trackingId), [mine]);
  const updates = useSenderUpdates(trackingIds.length ? { trackingId: { $in: trackingIds.slice(0, 400) } } : undefined);
  const updatesByTracking = useMemo(() => {
    const map = new Map<string, SenderUpdate[]>();
    for (const update of updates.data ?? []) {
      const list = map.get(update.trackingId) ?? [];
      list.push(update);
      map.set(update.trackingId, list);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return map;
  }, [updates.data]);

  const withIssues = mine.filter((item) => updatesByTracking.has(item.trackingId) || item.status === "exception");
  const filtered = (query ? mine : withIssues).filter((item) => !query || [item.trackingId, item.receiverName, item.area].some((value) => value.toLowerCase().includes(query.toLowerCase())));
  const open = withIssues.filter((item) => item.status === "exception");

  if (actor && actor.role !== "sender") {
    return (
      <section>
        <PageHeader title="My parcels" />
        <Alert tone="warn">This is the sender view. Staff see cases under Cases.</Alert>
      </section>
    );
  }

  return (
    <section className="max-w-4xl">
      <PageHeader
        eyebrow={actor?.senderCompany ?? "Sender"}
        title="Your parcels with a delivery issue"
        subtitle="What happened, what we're doing about it, and when to expect a resolution. Receiver numbers and internal notes are never shown here."
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Open issues" value={open.length} tone={open.length ? "brand" : "good"} />
        <Stat label="Resolved recently" value={withIssues.length - open.length} />
        <Stat label="COD awaiting" value={formatTaka(open.reduce((sum, item) => sum + item.codAmount, 0))} />
      </div>

      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a tracking id, receiver or area — including parcels without issues" className="pl-10" />
      </div>

      {parcels.isLoading || updates.isLoading ? <InlineSpinner label="Loading your parcels…" /> : null}
      {!parcels.isLoading && filtered.length === 0 ? <EmptyState icon={<PackageSearch size={20} />} title="No delivery issues" description="All your parcels are moving normally. Anything that gets stuck shows up here with a named team on it." /> : null}

      <div className="grid gap-4">
        {filtered.map((parcel) => (
          <ParcelCard key={parcel.ItemId} parcel={parcel} updates={updatesByTracking.get(parcel.trackingId) ?? []} />
        ))}
      </div>

      <p className="mt-6 inline-flex items-center gap-2 text-[12px] text-ink-500">
        <ShieldCheck size={13} /> You are reading the sanitised <span className="mono">SenderUpdate</span> stream. Internal notes and receiver contact details are never requested by this view.
      </p>
    </section>
  );
}

function ParcelCard({ parcel, updates }: { parcel: SenderParcel; updates: SenderUpdate[] }) {
  const latest = updates[0];
  const meta = latest ? STATUS_META[latest.status] : parcel.status === "delivered" ? STATUS_META.resolved : { label: parcel.status.replace("_", " "), tone: "neutral" as Tone };
  return (
    <Card>
      <CardBody className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono text-[15px] font-bold text-ink-900">{parcel.trackingId}</span>
              <Badge tone={meta.tone} dot pulse={latest?.status === "investigating"}>
                {meta.label}
              </Badge>
              {parcel.paymentType === "cod" ? <Badge tone="warn">COD {formatTaka(parcel.codAmount)}</Badge> : <Badge tone="good">Prepaid</Badge>}
            </div>
            <div className="mt-1 text-[13px] text-ink-600">
              To {parcel.receiverName} · {parcel.area} · {hubShort(parcel.originHubCode)} → {hubShort(parcel.destHubCode)}
            </div>
            <div className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-ink-400">
              <EyeOff size={12} /> receiver phone and street address withheld
            </div>
          </div>
          {latest?.expectedResolutionAt ? (
            <div className="rounded-xl bg-ink-50 px-3 py-2 text-right">
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Expect resolution</div>
              <div className="text-[14px] font-semibold text-ink-900">{formatDateTime(latest.expectedResolutionAt)}</div>
              <div className="text-[12px] text-ink-500">{formatRelative(latest.expectedResolutionAt)}</div>
            </div>
          ) : null}
        </div>

        {latest ? (
          <div className="rounded-xl border border-ink-100 bg-ink-50/70 px-4 py-3">
            <div className="text-[15px] font-semibold text-ink-900">{latest.headline}</div>
            <p className="mt-1 text-[13px] leading-6 text-ink-700">{latest.detail}</p>
            {latest.nextAction ? (
              <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-info-700">
                <Truck size={13} /> Next: {latest.nextAction}
              </div>
            ) : null}
          </div>
        ) : null}

        {updates.length > 1 ? (
          <ol className="grid gap-2 border-t border-ink-100 pt-3">
            {updates.slice(1).map((update) => (
              <li key={update.ItemId} className="flex gap-3 text-[13px]">
                <span className="mt-0.5 text-ink-400">{update.status === "resolved" ? <CheckCircle2 size={14} /> : <Clock size={14} />}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-ink-900">{update.headline}</span>
                  <span className="text-ink-500"> · {formatDateTime(update.occurredAt)}</span>
                  <p className="text-ink-600">{update.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </CardBody>
    </Card>
  );
}
