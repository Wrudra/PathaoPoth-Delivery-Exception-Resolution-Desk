"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bike, ChevronRight, MapPin, MessageSquarePlus, Phone, Search } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { useCases, useParcels } from "@/features/data/queries";
import { hubName, isScriptedDemoParcel, routeLabel } from "@/features/domain/constants";
import { isTerminal } from "@/features/domain/sla";
import { SlaBadge, StatusBadge, TypeBadge } from "@/features/cases/badges";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { formatRelative, formatTaka } from "@/lib/format";

export function RiderPage() {
  const { actor } = useActor();
  const parcels = useParcels(Boolean(actor));
  const cases = useCases(Boolean(actor));
  const [query, setQuery] = useState("");

  const myParcels = useMemo(() => (parcels.data ?? []).filter((item) => actor?.riderId && item.riderId === actor.riderId && item.status !== "delivered" && item.status !== "returned"), [actor, parcels.data]);
  const myCases = useMemo(() => (cases.data ?? []).filter((item) => actor?.riderId && item.riderId === actor.riderId && !isTerminal(item.status)), [actor, cases.data]);
  const caseByParcel = useMemo(() => new Map(myCases.map((item) => [item.parcelId, item])), [myCases]);

  const visibleParcels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const ranked = [...myParcels]
      .filter((parcel) => {
        const item = caseByParcel.get(parcel.ItemId);
        if (isScriptedDemoParcel(parcel) || parcel.status === "out_for_delivery") return true;
        return Boolean(item && !isTerminal(item.status));
      })
      .sort((a, b) => {
        const demo = Number(isScriptedDemoParcel(b)) - Number(isScriptedDemoParcel(a));
        if (demo) return demo;
        const caseA = caseByParcel.get(a.ItemId);
        const caseB = caseByParcel.get(b.ItemId);
        const open = Number(Boolean(caseB)) - Number(Boolean(caseA));
        if (open) return open;
        return new Date(b.lastTouchedAt ?? b.dispatchedAt ?? 0).getTime() - new Date(a.lastTouchedAt ?? a.dispatchedAt ?? 0).getTime();
      });
    if (!needle) return ranked;
    return ranked.filter((parcel) => {
      const item = caseByParcel.get(parcel.ItemId);
      const hay = [parcel.trackingId, parcel.receiverName, parcel.area, parcel.receiverAddress ?? "", String(parcel.codAmount ?? ""), item?.caseNumber ?? ""].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [caseByParcel, myParcels, query]);

  if (actor && actor.role !== "rider") {
    return (
      <section>
        <PageHeader title="My deliveries" />
        <Alert tone="warn">This view is for riders. Your role is {actor.role ?? "not assigned"}.</Alert>
      </section>
    );
  }

  return (
    <section className="max-w-3xl">
      <PageHeader
        eyebrow={actor?.hubCode ? `${hubName(actor.hubCode)} hub` : "Rider"}
        title={`Salam, ${actor?.name.split(" ")[0] ?? "rider"}`}
        subtitle="Your stops with an open exception. Tap one and type what happened. The desk turns it into the next step."
      />

      {!actor?.riderId ? (
        <Alert tone="warn" title="No rider record linked" className="mb-4">
          Ask an ops manager to link your login to a rider on Team &amp; data.
        </Alert>
      ) : null}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Stops in hand" value={visibleParcels.length} />
        <Stat label="Open cases" value={myCases.length} tone={myCases.length ? "brand" : "neutral"} />
        <Stat label="COD to collect" value={formatTaka(visibleParcels.reduce((sum, item) => sum + (item.codAmount ?? 0), 0))} />
      </div>

      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tracking id, receiver, GEC Circle, 2300…" className="pl-10" />
      </div>

      {parcels.isLoading || cases.isLoading ? <InlineSpinner label="Loading your stops…" /> : null}

      {!parcels.isLoading && myParcels.length === 0 && myCases.length === 0 ? (
        <EmptyState icon={<Bike size={20} />} title="No stops right now" description="Parcels assigned to your rider record appear here as soon as the hub dispatches them." />
      ) : null}

      <ul className="grid gap-3">
        {visibleParcels.map((parcel) => {
          const item = caseByParcel.get(parcel.ItemId);
          const inner = (
            <div className={`rounded-2xl border bg-white p-4 shadow-(--shadow-card) transition-colors ${item ? "border-brand-200 hover:border-brand-400" : "border-ink-200"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[14px] font-bold text-ink-900">{parcel.trackingId}</span>
                {item ? <TypeBadge type={item.type} /> : <Badge>{parcel.status.replaceAll("_", " ")}</Badge>}
                {item ? <StatusBadge status={item.status} /> : null}
                <span className="ml-auto text-[15px] font-bold text-ink-900">{parcel.paymentType === "cod" ? `COD ${formatTaka(parcel.codAmount)}` : "Prepaid"}</span>
              </div>
              <div className="mt-2 text-[16px] font-semibold text-ink-900">{parcel.receiverName}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-600">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {parcel.receiverAddress ?? parcel.area}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone size={13} /> {parcel.receiverPhone ?? "-"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
                <span>{routeLabel(parcel.routeCode)}</span>
                <span>· dispatched {formatRelative(parcel.dispatchedAt)}</span>
                {item ? <SlaBadge item={item} /> : null}
                {item ? (
                  <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-600">
                    <MessageSquarePlus size={14} /> Add note <ChevronRight size={14} />
                  </span>
                ) : (
                  <span className="ml-auto text-ink-400">no case yet. Hub staff opens one if delivery fails</span>
                )}
              </div>
            </div>
          );
          return <li key={parcel.ItemId}>{item ? <Link href={`/cases/${item.ItemId}`}>{inner}</Link> : inner}</li>;
        })}
        {myCases
          .filter((item) => !visibleParcels.some((parcel) => parcel.ItemId === item.parcelId))
          .map((item) => (
            <li key={item.ItemId}>
              <Link href={`/cases/${item.ItemId}`} className="block rounded-2xl border border-brand-200 bg-white p-4 shadow-(--shadow-card) hover:border-brand-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[14px] font-bold text-ink-900">{item.trackingId}</span>
                  <TypeBadge type={item.type} />
                  <StatusBadge status={item.status} />
                  <span className="ml-auto text-[15px] font-bold text-ink-900">{item.codAmount ? `COD ${formatTaka(item.codAmount)}` : "Prepaid"}</span>
                </div>
                <div className="mt-2 text-[13px] text-ink-600">
                  {routeLabel(item.routeCode)} · owner {item.ownerName}
                </div>
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}
