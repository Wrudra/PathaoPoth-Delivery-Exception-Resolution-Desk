"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowLeftRight, CheckCheck, CheckCircle2, MapPin, Phone, User, XCircle } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { queryKeys, useCase, useCaseEvents, useCaseNotes, useParcel } from "@/features/data/queries";
import { EXCEPTION_TYPES, hubName, routeLabel, teamLabel } from "@/features/domain/constants";
import type { NextStep, RiderNote } from "@/features/domain/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, PageHeader } from "@/components/ui/misc";
import { InlineSpinner } from "@/components/ui/loading-screen";
import { formatDateTime, formatTaka, maskPhone } from "@/lib/format";
import { AiPanel } from "./AiPanel";
import { PriorityDot, SlaBadge, StatusBadge, TypeBadge } from "./badges";
import { acknowledgeTransfer, confirmNextStep, declineTransfer, requestTransfer, resolveCase, submitRiderNote } from "./caseService";
import { DeclineDialog, ResolveDialog, TransferDialog } from "./dialogs";
import { OwnershipTrail } from "./OwnershipTrail";
import { RiderNoteComposer } from "./RiderNoteComposer";
import { canAcknowledge, canConfirmNextStep, canResolve, canSubmitRiderNote, canTransfer } from "./scope";
import { Timeline } from "./Timeline";

export function CaseDetailPage({ id }: { id: string }) {
  const { actor } = useActor();
  const item = useCase(id);
  const events = useCaseEvents(id);
  const notes = useCaseNotes(id);
  const parcel = useParcel(item.data?.parcelId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [transferOpen, setTransferOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.case(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.caseEvents(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.caseNotes(id) });
    void queryClient.invalidateQueries({ queryKey: ["cases"] });
    void queryClient.invalidateQueries({ queryKey: ["parcels"] });
  }

  const fail = (title: string) => (error: Error) => toast({ tone: "danger", title, description: error.message });

  const transfer = useMutation({
    mutationFn: ({ team, note }: { team: string; note: string }) => requestTransfer(item.data!, team, note, actor!),
    onSuccess: (_, variables) => {
      setTransferOpen(false);
      refresh();
      toast({ tone: "good", title: "Hand-off requested", description: `${teamLabel(variables.team)} has been asked to acknowledge. You still own the case.` });
    },
    onError: fail("Transfer failed")
  });

  const acknowledge = useMutation({
    mutationFn: () => acknowledgeTransfer(item.data!, actor!),
    onSuccess: () => {
      refresh();
      toast({ tone: "good", title: "You own this case now", description: "The previous owner has been notified." });
    },
    onError: fail("Could not acknowledge")
  });

  const decline = useMutation({
    mutationFn: (reason: string) => declineTransfer(item.data!, reason, actor!),
    onSuccess: () => {
      setDeclineOpen(false);
      refresh();
      toast({ tone: "info", title: "Hand-off declined", description: "Ownership stays where it was." });
    },
    onError: fail("Could not decline")
  });

  const note = useMutation({
    mutationFn: (text: string) =>
      submitRiderNote(
        item.data!,
        text,
        actor!,
        actor!.role === "rider"
          ? { riderId: actor!.riderId, riderName: actor!.name, riderUserId: actor!.userId }
          : { riderId: item.data!.riderId, riderName: item.data!.riderName ?? "Rider", riderUserId: undefined },
        parcel.data
      ),
    onSuccess: ({ incident }) => {
      refresh();
      toast({
        tone: incident.needsManualReview ? "info" : "good",
        title: incident.needsManualReview ? "Note structured — manual review" : `Recommended: ${incident.recommendedAction.replaceAll("_", " ")}`,
        description: `${Math.round(incident.confidence * 100)}% confidence · ${incident.source === "gemini" ? "Gemini" : "rule engine"}`
      });
    },
    onError: fail("Could not submit the note")
  });

  const confirm = useMutation({
    mutationFn: ({ step, riderNote }: { step: NextStep; riderNote?: RiderNote }) => confirmNextStep(item.data!, step, actor!, riderNote),
    onSuccess: () => {
      refresh();
      toast({ tone: "good", title: "Next step confirmed", description: "The sender's timeline has been updated with a sanitised message." });
    },
    onError: fail("Could not confirm")
  });

  const resolve = useMutation({
    mutationFn: ({ resolution, outcome }: { resolution: string; outcome: "delivered" | "returned" | "claimed" }) => resolveCase(item.data!, resolution, outcome, actor!),
    onSuccess: () => {
      setResolveOpen(false);
      refresh();
      toast({ tone: "good", title: "Case resolved" });
    },
    onError: fail("Could not resolve")
  });

  if (item.isLoading) return <InlineSpinner label="Loading case…" />;
  if (item.isError || !item.data) {
    return (
      <section>
        <PageHeader title="Case not found" />
        <Alert tone="danger">{item.error ? (item.error as Error).message : "This case does not exist or you cannot read it."}</Alert>
        <Link href="/cases" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600">
          <ArrowLeft size={14} /> Back to cases
        </Link>
      </section>
    );
  }

  const data = item.data;
  const pendingForMe = canAcknowledge(actor, data);
  const isOwner = actor?.userId === data.ownerUserId;
  const terminal = data.status === "resolved" || data.status === "closed";
  const showPhone = actor?.role === "care-agent" || actor?.role === "ops-manager" || actor?.role === "rider";

  return (
    <section>
      <Link href={actor?.role === "rider" ? "/rider" : "/cases"} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> {actor?.role === "rider" ? "My deliveries" : "All cases"}
      </Link>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <TypeBadge type={data.type} long /> <span className="text-ink-400">·</span> {routeLabel(data.routeCode)}
          </span>
        }
        title={
          <span className="inline-flex items-center gap-3">
            <PriorityDot priority={data.priority} />
            <span className="mono">{data.caseNumber}</span>
            <StatusBadge status={data.status} />
          </span>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="mono">{data.trackingId}</span>
            <span>opened {formatDateTime(data.openedAt)} by {data.openedByName}</span>
            <SlaBadge item={data} />
          </span>
        }
        actions={
          <>
            {!terminal && canSubmitRiderNote(actor) && actor?.role !== "rider" ? null : null}
            {!terminal && canTransfer(actor, data) && !data.pendingOwnerTeam ? (
              <Button variant="outline" icon={<ArrowLeftRight size={16} />} onClick={() => setTransferOpen(true)}>
                Transfer ownership
              </Button>
            ) : null}
            {!terminal && canResolve(actor, data) ? (
              <Button variant="success" icon={<CheckCircle2 size={16} />} onClick={() => setResolveOpen(true)}>
                Resolve
              </Button>
            ) : null}
          </>
        }
      />

      {pendingForMe ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-violet-600/30 bg-violet-100/60 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[15px] font-bold text-violet-700">
              {data.transferRequestedByName} ({teamLabel(data.ownerTeam)}) is handing this case to {teamLabel(data.pendingOwnerTeam)}
            </div>
            <p className="mt-0.5 text-[13px] leading-5 text-violet-700/90">
              {data.transferNote ? `“${data.transferNote}” — ` : ""}
              {data.ownerName} stays accountable until you acknowledge.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" icon={<XCircle size={16} />} onClick={() => setDeclineOpen(true)}>
              Decline
            </Button>
            <Button size="lg" icon={<CheckCheck size={18} />} loading={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
              Acknowledge &amp; take ownership
            </Button>
          </div>
        </div>
      ) : data.pendingOwnerTeam && !terminal ? (
        <Alert tone="info" className="mb-5" title={`Awaiting acknowledgement from ${teamLabel(data.pendingOwnerTeam)}`}>
          Requested by {data.transferRequestedByName} at {formatDateTime(data.transferRequestedAt)}. {data.ownerName} remains the accountable owner and keeps the SLA clock.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid gap-5">
          <AiPanel item={data} notes={notes.data ?? []} canConfirm={canConfirmNextStep(actor) && !terminal} onConfirm={(step, riderNote) => confirm.mutate({ step, riderNote })} confirming={confirm.isPending} />
          {!terminal && canSubmitRiderNote(actor) ? (
            <RiderNoteComposer notes={notes.data ?? []} riderName={actor?.role === "rider" ? actor.name : data.riderName ?? "the rider"} onSubmit={(text) => note.mutateAsync(text).then(() => undefined)} submitting={note.isPending} compact={actor?.role === "rider"} />
          ) : null}
          <Timeline events={events.data ?? []} isLoading={events.isLoading} />
        </div>

        <div className="grid gap-5 self-start">
          <Card className={isOwner ? "border-brand-300" : undefined}>
            <CardHeader icon={<User size={16} />} title="Accountable owner" subtitle={isOwner ? "That's you." : undefined} />
            <CardBody className="grid gap-2 text-[13px]">
              <div className="text-[18px] font-bold text-ink-900">{data.ownerName}</div>
              <div className="text-ink-600">{teamLabel(data.ownerTeam)} · since {formatDateTime(data.ownerSince)}</div>
              {data.pendingOwnerTeam ? <Badge tone="violet" dot pulse className="w-fit">hand-off to {teamLabel(data.pendingOwnerTeam)} pending</Badge> : null}
              <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 text-[12px]">
                <Meta label="Handling hub" value={hubName(data.hubCode)} />
                <Meta label="Rider" value={data.riderName ?? "—"} />
                <Meta label="COD" value={data.codAmount ? formatTaka(data.codAmount) : "prepaid"} />
                <Meta label="SLA" value={`${EXCEPTION_TYPES[data.type].slaHours}h · due ${formatDateTime(data.slaDueAt)}`} />
                {data.resolution ? <Meta label="Resolution" value={data.resolution} wide /> : null}
                {data.description ? <Meta label="Note at open" value={data.description} wide /> : null}
              </dl>
            </CardBody>
          </Card>

          <OwnershipTrail item={data} events={events.data ?? []} />

          <Card>
            <CardHeader icon={<MapPin size={16} />} title="Parcel & receiver" subtitle={showPhone ? "Receiver contact is visible to your role." : "Receiver phone is masked for your role."} />
            <CardBody className="grid gap-2 text-[13px]">
              {parcel.isLoading ? <p className="text-ink-500">Loading parcel…</p> : null}
              {parcel.data ? (
                <>
                  <div className="font-semibold text-ink-900">{parcel.data.receiverName}</div>
                  <div className="text-ink-600">
                    {parcel.data.receiverAddress ? `${parcel.data.receiverAddress}, ` : ""}
                    {parcel.data.area}
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-ink-700">
                    <Phone size={13} /> {showPhone ? parcel.data.receiverPhone ?? "—" : maskPhone(parcel.data.receiverPhone)}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 text-[12px]">
                    <Meta label="Merchant" value={`${parcel.data.senderCompany} · ${parcel.data.senderName}`} />
                    <Meta label="Payment" value={parcel.data.paymentType === "cod" ? `COD ${formatTaka(parcel.data.codAmount)}` : "Prepaid"} />
                    <Meta label="Dispatched" value={formatDateTime(parcel.data.dispatchedAt)} />
                    <Meta label="Promised" value={formatDateTime(parcel.data.promisedAt)} />
                  </dl>
                </>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <TransferDialog item={data} open={transferOpen} onOpenChange={setTransferOpen} pending={transfer.isPending} onSubmit={(team, noteText) => transfer.mutateAsync({ team, note: noteText }).then(() => undefined)} />
      <DeclineDialog open={declineOpen} onOpenChange={setDeclineOpen} pending={decline.isPending} onSubmit={(reason) => decline.mutateAsync(reason).then(() => undefined)} />
      <ResolveDialog item={data} open={resolveOpen} onOpenChange={setResolveOpen} pending={resolve.isPending} onSubmit={(resolution, outcome) => resolve.mutateAsync({ resolution, outcome }).then(() => undefined)} />
    </section>
  );
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-900">{value}</dd>
    </div>
  );
}
