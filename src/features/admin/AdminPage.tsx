"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { updateOne } from "@/features/data/gateway";
import { queryKeys, useCases, useParcels, useRiders, useStaffProfiles } from "@/features/data/queries";
import { HUBS, ROLE_LABEL, SENDER_COMPANIES, hubName, teamForHub, teamLabel } from "@/features/domain/constants";
import type { RoleSlug, StaffProfile } from "@/features/domain/types";
import { resetDemoData, seedDemoData, type SeedProgress } from "@/features/seed/seedRunner";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Alert, PageHeader, ProgressBar, Stat } from "@/components/ui/misc";

export function AdminPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const cases = useCases(Boolean(actor));
  const parcels = useParcels(Boolean(actor));
  const riders = useRiders();
  const staff = useStaffProfiles();
  const [progress, setProgress] = useState<SeedProgress | undefined>();
  const [result, setResult] = useState<{ demoTrackingId: string; counts: Record<string, number> } | undefined>();

  const invalidateAll = () => queryClient.invalidateQueries();

  const seed = useMutation({
    mutationFn: async (reset: boolean) => {
      if (reset) await resetDemoData(setProgress);
      return seedDemoData(setProgress);
    },
    onSuccess: (data) => {
      setResult(data);
      setProgress(undefined);
      void invalidateAll();
      toast({ tone: "good", title: "Demo data ready", description: `Demo parcel ${data.demoTrackingId} is out for delivery on Mirpur → CTG GEC.` });
    },
    onError: (error: Error) => {
      setProgress(undefined);
      toast({ tone: "danger", title: "Seeding failed", description: error.message });
    }
  });

  const wipe = useMutation({
    mutationFn: () => resetDemoData(setProgress),
    onSuccess: () => {
      setProgress(undefined);
      setResult(undefined);
      void invalidateAll();
      toast({ tone: "info", title: "Operational data cleared" });
    },
    onError: (error: Error) => {
      setProgress(undefined);
      toast({ tone: "danger", title: "Reset failed", description: error.message });
    }
  });

  const saveProfile = useMutation({
    mutationFn: (input: { profile: StaffProfile; patch: Partial<StaffProfile> }) => updateOne<StaffProfile>("StaffProfile", input.profile.ItemId, input.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff });
      toast({ tone: "good", title: "Mapping saved" });
    },
    onError: (error: Error) => toast({ tone: "danger", title: "Could not save", description: error.message })
  });

  if (actor && actor.role !== "ops-manager") {
    return (
      <section>
        <PageHeader title="Team & data" />
        <Alert tone="warn">Only ops managers can seed data and map staff to hubs.</Alert>
      </section>
    );
  }

  const busy = seed.isPending || wipe.isPending;

  return (
    <section>
      <PageHeader eyebrow="Operations" title="Team & data" subtitle="Map signed-in people to hubs and teams, and load the demo dataset into Blocks Data." />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Parcels" value={parcels.data?.length ?? "…"} />
        <Stat label="Exception cases" value={cases.data?.length ?? "…"} />
        <Stat label="Riders" value={riders.data?.length ?? "…"} />
        <Stat label="Mapped staff" value={staff.data?.length ?? "…"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader icon={<Database size={16} />} title="Demo dataset" subtitle="Deterministic: 14 riders, ~250 exception cases over four rolling weeks, rider notes, ownership trails, sender updates, and the scripted COD ৳2,300 parcel." />
          <CardBody className="grid gap-4">
            <ul className="grid gap-1.5 text-[13px] text-ink-700">
              <li>· Mirpur 10 → Chattogram GEC refused deliveries: 8 → 10 → 17 → 24 (+41% WoW), 76% COD, one rider on a third of them.</li>
              <li>· Uttara → Sylhet address-missing creeping up (a medium-risk lane to contrast).</li>
              <li>· Older cases resolved, recent ones open / in progress / awaiting acknowledgement, a few past SLA.</li>
              <li>· Writes go through <code className="rounded bg-ink-100 px-1">blocksClient.data</code>; nothing bypasses the gateway.</li>
            </ul>
            {progress ? (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between text-[12px] font-semibold text-ink-700">
                  <span>{progress.step}</span>
                  <span className="tabular">
                    {progress.done}/{progress.total}
                  </span>
                </div>
                <ProgressBar value={progress.total ? progress.done / progress.total : 0} />
              </div>
            ) : null}
            {result ? (
              <Alert tone="good" title={`Loaded · demo parcel ${result.demoTrackingId}`}>
                {Object.entries(result.counts)
                  .map(([key, value]) => `${value} ${key}`)
                  .join(" · ")}
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button icon={<RefreshCw size={16} />} loading={seed.isPending} disabled={busy} onClick={() => seed.mutate(true)}>
                Reset &amp; load demo data
              </Button>
              <Button variant="outline" disabled={busy} loading={seed.isPending && !wipe.isPending} onClick={() => seed.mutate(false)}>
                Load without reset
              </Button>
              <Button variant="danger" icon={<Trash2 size={16} />} disabled={busy} loading={wipe.isPending} onClick={() => wipe.mutate()}>
                Clear operational data
              </Button>
            </div>
            <p className="text-[12px] text-ink-500">Staff mappings are never cleared. Re-run right before a demo so “this week” lines up with today.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Users size={16} />} title="Team mapping" subtitle="Everyone who has signed in, with the hub / team / rider / merchant that scopes what they see." />
          <CardBody className="p-0">
            {staff.isLoading ? <p className="px-5 py-6 text-[13px] text-ink-500">Loading…</p> : null}
            {staff.data && staff.data.length === 0 ? <p className="px-5 py-6 text-[13px] text-ink-500">Nobody has signed in yet. Profiles are created on first login with sensible defaults.</p> : null}
            <ul className="divide-y divide-ink-100">
              {(staff.data ?? []).map((profile) => (
                <li key={profile.ItemId} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_1fr]">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-ink-900">{profile.displayName}</div>
                    <div className="truncate text-[12px] text-ink-500">{profile.email ?? profile.userId}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="brand">{ROLE_LABEL[profile.role as RoleSlug] ?? profile.role}</Badge>
                      <Badge>{profile.hubCode ? hubName(profile.hubCode) : teamLabel(profile.team)}</Badge>
                    </div>
                  </div>
                  {profile.role === "hub-staff" || profile.role === "rider" ? (
                    <label className="grid gap-1 text-[12px] font-semibold text-ink-600">
                      Hub
                      <Select
                        value={profile.hubCode ?? ""}
                        disabled={saveProfile.isPending}
                        onChange={(event) => saveProfile.mutate({ profile, patch: { hubCode: event.target.value, team: teamForHub(event.target.value) } })}
                      >
                        {HUBS.map((hub) => (
                          <option key={hub.code} value={hub.code}>
                            {hub.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : profile.role === "sender" ? (
                    <label className="grid gap-1 text-[12px] font-semibold text-ink-600">
                      Merchant
                      <Select value={profile.senderCompany ?? ""} disabled={saveProfile.isPending} onChange={(event) => saveProfile.mutate({ profile, patch: { senderCompany: event.target.value } })}>
                        {SENDER_COMPANIES.map((company) => (
                          <option key={company} value={company}>
                            {company}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : (
                    <div className="text-[12px] text-ink-500 md:pt-6">{teamLabel(profile.team)}</div>
                  )}
                  {profile.role === "rider" ? (
                    <label className="grid gap-1 text-[12px] font-semibold text-ink-600">
                      Rider record
                      <Select value={profile.riderId ?? ""} disabled={saveProfile.isPending} onChange={(event) => saveProfile.mutate({ profile, patch: { riderId: event.target.value } })}>
                        <option value="">— none —</option>
                        {(riders.data ?? []).map((rider) => (
                          <option key={rider.ItemId} value={rider.ItemId}>
                            {rider.riderCode} · {rider.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : (
                    <div className="hidden md:block" />
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader icon={<ShieldCheck size={16} />} title="Access model" subtitle="Enforced by Blocks IAM roles at sign-in and by the desk's scoping rules." />
        <CardBody className="grid gap-2 text-[13px] text-ink-700 md:grid-cols-2">
          <p>
            <strong>Hub staff</strong> see cases at their hub (origin, destination, or hand-offs addressed to them). <strong>Riders</strong> see parcels assigned to their rider record. <strong>Care</strong> and <strong>ops</strong> see everything.
          </p>
          <p>
            <strong>Senders</strong> only read the <code className="rounded bg-ink-100 px-1">SenderUpdate</code> schema: sanitised headlines, no internal notes, receiver phone never included. All nine schemas are access level <em>User</em> (signed-in only) in the Data Gateway.
          </p>
        </CardBody>
      </Card>
    </section>
  );
}
