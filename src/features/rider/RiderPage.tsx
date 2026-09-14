"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bike, ChevronRight, MapPin, MessageSquarePlus, Phone } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { useCases, useParcels } from "@/features/data/queries";
import { hubName, routeLabel } from "@/features/domain/constants";
import { isTerminal } from "@/features/domain/sla";
import { SlaBadge, StatusBadge, TypeBadge } from "@/features/cases/badges";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { formatRelative, formatTaka } from "@/lib/format";

export function RiderPage() {
  const { actor } = useActor();
  const parcels = useParcels(Boolean(actor));
  const cases = useCases(Boolean(actor));

  const myParcels = useMemo(() => (parcels.data ?? []).filter((item) => actor?.riderId && item.riderId === actor.riderId && item.status !== "delivered" && item.status !== "returned"), [actor, parcels.data]);
  const myCases = useMemo(() => (cases.data ?? []).filter((item) => actor?.riderId && item.riderId === actor.riderId && !isTerminal(item.status)), [actor, cases.data]);
  const caseByParcel = new Map(myCases.map((item) => [item.parcelId, item]));

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
        <Stat label="Stops in hand" value={myParcels.length} />
        <Stat label="Open cases" value={myCases.length} tone={myCases.length ? "brand" : "neutral"} />
        <Stat label="COD to collect" value={formatTaka(myParcels.reduce((sum, item) => sum + (item.codAmount ?? 0), 0))} />
      </div>

      {parcels.isLoading || cases.isLoading ? <InlineSpinner label="Loading your stops…" /> : null}

      {!parcels.isLoading && myParcels.length === 0 && myCases.length === 0 ? (
        <EmptyState icon={<Bike size={20} />} title="No stops right now" description="Parcels assigned to your rider record appear here as soon as the hub dispatches them." />
      ) : null}

      <ul className="grid gap-3">
        {myParcels.map((parcel) => {
          const item = caseByParcel.get(parcel.ItemId);
          const inner = (
            <div className={`rounded-2xl border bg-white p-4 shadow-(--shadow-card) transition-colors ${item ? "border-brand-200 hover:border-brand-400" : "border-ink-200"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[14px] font-bold text-ink-900">{parcel.trackingId}</span>
                {item ? <TypeBadge type={item.type} /> : <Badge>{parcel.status.replace("_", " ")}</Badge>}
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
          .filter((item) => !myParcels.some((parcel) => parcel.ItemId === item.parcelId))
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
