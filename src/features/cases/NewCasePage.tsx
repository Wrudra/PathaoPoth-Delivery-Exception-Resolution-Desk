"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageSearch, Search, Zap } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { useParcels } from "@/features/data/queries";
import { EXCEPTION_TYPES, EXCEPTION_TYPE_LIST, hubName, hubShort, routeLabel } from "@/features/domain/constants";
import type { ExceptionType, Parcel } from "@/features/domain/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, PageHeader } from "@/components/ui/misc";
import { formatRelative, formatTaka, maskPhone } from "@/lib/format";
import { openCase } from "./caseService";
import { canOpenCase } from "./scope";

// The four-field quick open: parcel, type, where (hub — pre-filled from the
// staff profile), who last touched it (pre-filled from the parcel). Seconds,
// not minutes.
export function NewCasePage() {
  const router = useRouter();
  const { actor } = useActor();
  const parcels = useParcels(Boolean(actor));
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [parcel, setParcel] = useState<Parcel | undefined>();
  const [type, setType] = useState<ExceptionType>("refused");
  const [description, setDescription] = useState("");

  const candidates = useMemo(() => {
    const list = (parcels.data ?? []).filter((item) => item.status !== "delivered" && item.status !== "returned");
    const needle = query.trim().toLowerCase();
    const scoped = actor?.role === "hub-staff" && actor.hubCode ? list.filter((item) => item.originHubCode === actor.hubCode || item.destHubCode === actor.hubCode) : list;
    const source = scoped.length ? scoped : list;
    if (!needle) return source.slice(0, 8);
    return source.filter((item) => [item.trackingId, item.receiverName, item.area, item.senderCompany, item.riderName ?? ""].some((value) => value.toLowerCase().includes(needle))).slice(0, 8);
  }, [actor, parcels.data, query]);

  const create = useMutation({
    mutationFn: async () => {
      if (!actor || !parcel) throw new Error("Pick a parcel first.");
      return openCase({ parcel, type, description: description.trim() || undefined }, actor);
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
      void queryClient.invalidateQueries({ queryKey: ["parcels"] });
      toast({ tone: "good", title: `${created.caseNumber} opened`, description: `${actor?.name} owns it. SLA clock started.` });
      router.push(`/cases/${created.ItemId}`);
    },
    onError: (error: Error) => toast({ tone: "danger", title: "Could not open the case", description: error.message })
  });

  if (actor && !canOpenCase(actor)) {
    return (
      <section>
        <PageHeader title="Open a case" />
        <Alert tone="warn">Only hub staff and care agents open cases. Your role is {actor.role ?? "not assigned"}.</Alert>
      </section>
    );
  }

  return (
    <section className="max-w-3xl">
      <PageHeader eyebrow={actor?.hubCode ? `${hubName(actor.hubCode)} hub` : "Care desk"} title="Open an exception case" subtitle="Four fields. Where and who-last-touched-it are pre-filled from the parcel and your profile." />

      <Card>
        <CardHeader icon={<PackageSearch size={16} />} title="1 · Parcel" subtitle="Search by tracking id, receiver, area, merchant or rider." />
        <CardBody className="grid gap-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PP-2409-…, receiver name, GEC Circle, Dokan24…" className="pl-10" />
          </div>
          {parcels.isLoading ? <p className="text-[13px] text-ink-500">Loading parcels…</p> : null}
          {!parcels.isLoading && candidates.length === 0 ? <p className="text-[13px] text-ink-500">No open parcels match. Seed the demo data from Team &amp; data if this is a fresh project.</p> : null}
          <ul className="grid gap-1.5">
            {candidates.map((item) => {
              const selected = parcel?.ItemId === item.ItemId;
              return (
                <li key={item.ItemId}>
                  <button
                    onClick={() => setParcel(item)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${selected ? "border-brand-400 bg-brand-50 ring-4 ring-brand-100" : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono text-[13px] font-semibold text-ink-900">{item.trackingId}</span>
                        <Badge tone={item.status === "exception" ? "brand" : "neutral"}>{item.status.replace("_", " ")}</Badge>
                        {item.paymentType === "cod" ? <Badge tone="warn">COD {formatTaka(item.codAmount)}</Badge> : <Badge tone="good">prepaid</Badge>}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-ink-500">
                        {item.receiverName} · {item.area} · {routeLabel(item.routeCode)} · {item.senderCompany}
                        {item.riderName ? ` · rider ${item.riderName}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-[12px] text-ink-500">dispatched {formatRelative(item.dispatchedAt)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader icon={<Zap size={16} />} title="2 · What, where, who" subtitle="Type is the only decision. The rest is already known." />
        <CardBody className="grid gap-4">
          <Field label="Exception type" required>
            <Select value={type} onChange={(event) => setType(event.target.value as ExceptionType)}>
              {EXCEPTION_TYPE_LIST.map((value) => (
                <option key={value} value={value}>
                  {EXCEPTION_TYPES[value].label} · SLA {EXCEPTION_TYPES[value].slaHours}h
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnly label="Where (hub)" value={parcel ? `${hubName(actor?.hubCode ?? parcel.originHubCode)}` : "—"} hint={parcel ? `${hubShort(parcel.originHubCode)} → ${hubShort(parcel.destHubCode)}` : undefined} />
            <ReadOnly label="Who last touched it" value={parcel?.lastTouchedByName ?? parcel?.riderName ?? "—"} hint={parcel?.lastTouchedAt ? formatRelative(parcel.lastTouchedAt) : undefined} />
            <ReadOnly label="Receiver" value={parcel?.receiverName ?? "—"} hint={parcel ? `${parcel.area} · ${maskPhone(parcel.receiverPhone)}` : undefined} />
            <ReadOnly label="Owner on open" value={actor?.name ?? "—"} hint="You, until you hand it off and someone acknowledges" />
          </div>
          <Field label="Note (optional)" hint="Internal. Not shown to the sender.">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Receiver refused at door, said COD amount is wrong." className="min-h-[80px]" />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button size="lg" disabled={!parcel} loading={create.isPending} onClick={() => create.mutate()} icon={<Zap size={16} />}>
              Open case · SLA {EXCEPTION_TYPES[type].slaHours}h
            </Button>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50 px-3.5 py-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-0.5 truncate text-[14px] font-semibold text-ink-900">{value}</div>
      {hint ? <div className="truncate text-[12px] text-ink-500">{hint}</div> : null}
    </div>
  );
}
