import type { Actor } from "@/features/auth/useStaffProfile";
import { structureNote } from "@/features/ai/client";
import type { IncidentSummary } from "@/features/ai/types";
import { createOne, getOne, nowIso, updateOne } from "@/features/data/gateway";
import { EXCEPTION_TYPES, NEXT_STEPS, teamForHub, teamLabel } from "@/features/domain/constants";
import { slaDueFor } from "@/features/domain/sla";
import type {
  CaseEvent,
  CaseEventType,
  ExceptionCase,
  ExceptionType,
  NextStep,
  Parcel,
  RiderNote,
  SenderUpdate,
  SenderUpdateStatus
} from "@/features/domain/types";
import { notifyTeam, notifyUsers } from "@/features/notifications/notifier";

// The ownership rules of the desk live here, not in the UI:
//  * a case always has exactly one accountable owner (ownerUserId / ownerTeam);
//  * a transfer does NOT move ownership -- it records a pending team and the
//    current owner stays accountable until the receiving side acknowledges;
//  * every change appends a CaseEvent; anything a sender may see goes through
//    SenderUpdate with sanitised text, never the internal event stream.

export type OpenCaseInput = {
  parcel: Parcel;
  type: ExceptionType;
  description?: string;
  priority?: ExceptionCase["priority"];
};

function caseNumber(now: Date): string {
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `EX-${y}${m}${d}-${suffix}`;
}

async function appendEvent(
  item: Pick<ExceptionCase, "ItemId" | "caseNumber">,
  actor: Actor,
  type: CaseEventType,
  message: string,
  extra: Partial<Omit<CaseEvent, "ItemId" | "caseId" | "caseNumber" | "type" | "message" | "actorUserId" | "actorName" | "occurredAt">> = {}
): Promise<string> {
  return createOne<CaseEvent>("CaseEvent", {
    caseId: item.ItemId,
    caseNumber: item.caseNumber,
    type,
    actorUserId: actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    actorTeam: actor.team,
    message,
    internal: extra.internal ?? true,
    occurredAt: nowIso(),
    ...extra
  });
}

async function publishSenderUpdate(
  item: ExceptionCase,
  status: SenderUpdateStatus,
  headline: string,
  detail: string,
  nextAction?: string,
  expectedResolutionAt?: string
): Promise<void> {
  await createOne<SenderUpdate>("SenderUpdate", {
    caseId: item.ItemId,
    caseNumber: item.caseNumber,
    parcelId: item.parcelId,
    trackingId: item.trackingId,
    senderUserId: item.senderUserId,
    status,
    headline,
    detail,
    nextAction,
    expectedResolutionAt,
    occurredAt: nowIso()
  });
}

export async function openCase(input: OpenCaseInput, actor: Actor): Promise<ExceptionCase> {
  const now = new Date();
  const hubCode = actor.hubCode ?? input.parcel.originHubCode;
  const ownerTeam = actor.team.startsWith("hub:") ? actor.team : teamForHub(hubCode);
  const slaDueAt = slaDueFor(input.type, now).toISOString();
  const priority: ExceptionCase["priority"] = input.priority ?? (input.parcel.codAmount >= 2000 || input.type === "damaged" ? "high" : "normal");

  const payload: Omit<ExceptionCase, "ItemId"> = {
    caseNumber: caseNumber(now),
    parcelId: input.parcel.ItemId,
    trackingId: input.parcel.trackingId,
    senderUserId: input.parcel.senderUserId,
    type: input.type,
    status: "open",
    priority,
    hubCode,
    originHubCode: input.parcel.originHubCode,
    destHubCode: input.parcel.destHubCode,
    routeCode: input.parcel.routeCode,
    riderId: input.parcel.riderId,
    riderName: input.parcel.riderName,
    codAmount: input.parcel.codAmount,
    openedByUserId: actor.userId,
    openedByName: actor.name,
    openedAt: now.toISOString(),
    ownerUserId: actor.userId,
    ownerName: actor.name,
    ownerTeam,
    ownerSince: now.toISOString(),
    slaDueAt,
    slaBreached: false,
    nextStepStatus: "none",
    description: input.description
  };

  const itemId = await createOne<ExceptionCase>("ExceptionCase", payload);
  const created: ExceptionCase = { ItemId: itemId, ...payload };

  await Promise.all([
    appendEvent(created, actor, "opened", `Case opened as “${EXCEPTION_TYPES[input.type].label}” by ${actor.name} (${teamLabel(ownerTeam)}). Owner: ${actor.name}.`, {
      internal: false,
      toOwnerTeam: ownerTeam,
      toOwnerName: actor.name,
      payloadJson: JSON.stringify({ description: input.description ?? "", codAmount: input.parcel.codAmount })
    }),
    updateOne<Parcel>("Parcel", input.parcel.ItemId, { status: "exception", lastTouchedByName: actor.name, lastTouchedAt: now.toISOString() }),
    publishSenderUpdate(
      created,
      "investigating",
      "We are looking into a delivery issue",
      `Your parcel ${input.parcel.trackingId} could not be delivered as planned (${EXCEPTION_TYPES[input.type].label.toLowerCase()}). A named team member at ${teamLabel(ownerTeam)} now owns the case.`,
      undefined,
      slaDueAt
    )
  ]);

  return created;
}

export async function addInternalNote(item: ExceptionCase, message: string, actor: Actor): Promise<void> {
  await appendEvent(item, actor, "note_added", message, { internal: true });
}

export async function requestTransfer(item: ExceptionCase, toTeam: string, note: string, actor: Actor): Promise<void> {
  if (toTeam === item.ownerTeam) throw new Error("The case is already owned by that team.");
  const now = nowIso();
  await updateOne<ExceptionCase>("ExceptionCase", item.ItemId, {
    status: "awaiting_ack",
    pendingOwnerTeam: toTeam,
    transferRequestedByName: actor.name,
    transferRequestedAt: now,
    transferNote: note
  });
  await appendEvent(item, actor, "transfer_requested", `${actor.name} asked ${teamLabel(toTeam)} to take over. ${actor.name} remains the owner until they acknowledge.${note ? ` Note: ${note}` : ""}`, {
    internal: true,
    fromOwnerTeam: item.ownerTeam,
    fromOwnerName: item.ownerName,
    toOwnerTeam: toTeam,
    payloadJson: JSON.stringify({ note })
  });
  await notifyTeam(toTeam, {
    kind: "transfer_requested",
    caseId: item.ItemId,
    caseNumber: item.caseNumber,
    title: `${item.caseNumber} needs your acknowledgement`,
    body: `${actor.name} (${teamLabel(item.ownerTeam)}) is handing over a ${EXCEPTION_TYPES[item.type].short.toLowerCase()} case on ${item.trackingId}.`,
    href: `/cases/${item.ItemId}`
  });
}

export async function acknowledgeTransfer(item: ExceptionCase, actor: Actor): Promise<void> {
  if (!item.pendingOwnerTeam) throw new Error("There is no pending transfer on this case.");
  if (actor.team !== item.pendingOwnerTeam && actor.role !== "ops-manager") {
    throw new Error(`Only ${teamLabel(item.pendingOwnerTeam)} can acknowledge this transfer.`);
  }
  const now = nowIso();
  const previousOwnerUserId = item.ownerUserId;
  await updateOne<ExceptionCase>("ExceptionCase", item.ItemId, {
    status: "in_progress",
    ownerUserId: actor.userId,
    ownerName: actor.name,
    ownerTeam: item.pendingOwnerTeam,
    ownerSince: now,
    hubCode: item.pendingOwnerTeam.startsWith("hub:") ? item.pendingOwnerTeam.slice(4) : item.hubCode,
    pendingOwnerTeam: "",
    pendingOwnerUserId: "",
    transferRequestedByName: "",
    transferNote: ""
  });
  await appendEvent(item, actor, "transfer_acknowledged", `${actor.name} acknowledged and took ownership for ${teamLabel(item.pendingOwnerTeam)} (from ${item.ownerName}, ${teamLabel(item.ownerTeam)}).`, {
    internal: false,
    fromOwnerTeam: item.ownerTeam,
    fromOwnerName: item.ownerName,
    toOwnerTeam: item.pendingOwnerTeam,
    toOwnerName: actor.name
  });
  await notifyUsers([previousOwnerUserId], {
    kind: "transfer_acknowledged",
    caseId: item.ItemId,
    caseNumber: item.caseNumber,
    title: `${item.caseNumber} acknowledged by ${actor.name}`,
    body: `${teamLabel(item.pendingOwnerTeam)} now owns the case.`,
    href: `/cases/${item.ItemId}`
  });
}

export async function declineTransfer(item: ExceptionCase, reason: string, actor: Actor): Promise<void> {
  if (!item.pendingOwnerTeam) throw new Error("There is no pending transfer on this case.");
  await updateOne<ExceptionCase>("ExceptionCase", item.ItemId, {
    status: "in_progress",
    pendingOwnerTeam: "",
    pendingOwnerUserId: "",
    transferRequestedByName: "",
    transferNote: ""
  });
  await appendEvent(item, actor, "transfer_declined", `${actor.name} (${teamLabel(item.pendingOwnerTeam)}) declined the hand-off: ${reason}. ${item.ownerName} keeps ownership.`, {
    internal: true,
    fromOwnerTeam: item.pendingOwnerTeam,
    toOwnerTeam: item.ownerTeam,
    toOwnerName: item.ownerName
  });
}

export async function submitRiderNote(
  item: ExceptionCase,
  rawText: string,
  actor: Actor,
  rider: { riderId?: string; riderName: string; riderUserId?: string },
  parcel?: Parcel
): Promise<{ note: RiderNote; incident: IncidentSummary }> {
  const submittedAt = nowIso();
  const noteId = await createOne<RiderNote>("RiderNote", {
    caseId: item.ItemId,
    caseNumber: item.caseNumber,
    parcelId: item.parcelId,
    trackingId: item.trackingId,
    riderId: rider.riderId,
    riderName: rider.riderName,
    riderUserId: rider.riderUserId,
    rawText,
    language: "banglish",
    status: "pending",
    submittedAt
  });
  await appendEvent(item, actor, "rider_note", `Rider note from ${rider.riderName}: “${rawText}”`, { internal: true });

  const incident = await structureNote(rawText, {
    caseType: item.type,
    codAmount: item.codAmount,
    area: parcel?.area,
    receiverName: parcel?.receiverName
  });

  const status: RiderNote["status"] = incident.needsManualReview ? "manual_review" : "structured";
  await updateOne<RiderNote>("RiderNote", noteId, {
    structuredJson: JSON.stringify(incident),
    recommendedAction: incident.recommendedAction,
    confidence: incident.confidence,
    source: incident.source,
    status
  });
  await updateOne<ExceptionCase>("ExceptionCase", item.ItemId, {
    incidentJson: JSON.stringify(incident),
    nextStep: incident.recommendedAction,
    nextStepStatus: incident.needsManualReview ? "manual_review" : "recommended",
    nextStepConfidence: incident.confidence,
    nextStepSource: incident.source,
    status: item.status === "open" ? "in_progress" : item.status
  });
  await appendEvent(
    item,
    actor,
    "ai_structured",
    incident.needsManualReview
      ? `Structured the rider note (${Math.round(incident.confidence * 100)}% confidence). Below the auto-recommend bar, so it is queued for manual review. ${incident.summary}`
      : `Structured the rider note: ${incident.summary} Recommended: ${NEXT_STEPS[incident.recommendedAction].label} (${Math.round(incident.confidence * 100)}% confidence, ${incident.source}).`,
    { internal: true, payloadJson: JSON.stringify(incident) }
  );
  await notifyTeam("care", {
    kind: "next_step_recommended",
    caseId: item.ItemId,
    caseNumber: item.caseNumber,
    title: incident.needsManualReview ? `${item.caseNumber} needs manual review` : `${item.caseNumber}: ${NEXT_STEPS[incident.recommendedAction].label} recommended`,
    body: incident.summary,
    href: `/cases/${item.ItemId}`
  });

  const note: RiderNote = {
    ItemId: noteId,
    caseId: item.ItemId,
    caseNumber: item.caseNumber,
    parcelId: item.parcelId,
    trackingId: item.trackingId,
    riderId: rider.riderId,
    riderName: rider.riderName,
    riderUserId: rider.riderUserId,
    rawText,
    language: "banglish",
    structuredJson: JSON.stringify(incident),
    recommendedAction: incident.recommendedAction,
    confidence: incident.confidence,
    source: incident.source,
    status,
    submittedAt
  };
  return { note, incident };
}

export async function confirmNextStep(item: ExceptionCase, step: NextStep, actor: Actor, note?: RiderNote): Promise<void> {
  const now = nowIso();
  const overridden = item.nextStep && item.nextStep !== step;
  await updateOne<ExceptionCase>("ExceptionCase", item.ItemId, {
    nextStep: step,
    nextStepStatus: "confirmed",
    nextStepSource: overridden ? "human" : item.nextStepSource ?? "human",
    nextStepConfirmedByName: actor.name,
    nextStepConfirmedAt: now,
    status: item.status === "open" ? "in_progress" : item.status
  });
  if (note) await updateOne<RiderNote>("RiderNote", note.ItemId, { status: "confirmed", confirmedByName: actor.name, confirmedAt: now });

  const meta = NEXT_STEPS[step];
  await appendEvent(item, actor, "next_step_confirmed", `${actor.name} confirmed the next step: ${meta.label}${overridden ? ` (overriding the recommended “${NEXT_STEPS[item.nextStep!].label}”)` : ""}.`, {
    internal: false,
    payloadJson: JSON.stringify({ step, overridden: Boolean(overridden) })
  });

  const eta = new Date();
  if (step === "evening_redelivery") {
    eta.setHours(21, 0, 0, 0);
    if (eta.getTime() < Date.now()) eta.setDate(eta.getDate() + 1);
  } else eta.setTime(eta.getTime() + 24 * 3_600_000);

  await publishSenderUpdate(item, step === "return_to_sender" ? "returned" : "action_planned", meta.senderSafe, `Update on parcel ${item.trackingId}: ${meta.senderSafe} ${step === "courier_claim" ? "Our team will contact you about the refund or credit." : "We will update you as soon as the attempt is complete."}`, meta.label, eta.toISOString());
}

export async function resolveCase(item: ExceptionCase, resolution: string, outcome: "delivered" | "returned" | "claimed", actor: Actor): Promise<void> {
  const now = nowIso();
  await updateOne<ExceptionCase>("ExceptionCase", item.ItemId, {
    status: "resolved",
    resolution,
    resolvedAt: now,
    ownerUserId: actor.userId,
    ownerName: actor.name,
    ownerTeam: actor.team,
    pendingOwnerTeam: "",
    pendingOwnerUserId: ""
  });
  await updateOne<Parcel>("Parcel", item.parcelId, {
    status: outcome === "delivered" ? "delivered" : "returned",
    lastTouchedByName: actor.name,
    lastTouchedAt: now
  });
  await appendEvent(item, actor, "resolved", `Resolved by ${actor.name}: ${resolution}`, { internal: false, payloadJson: JSON.stringify({ outcome }) });
  await publishSenderUpdate(
    item,
    outcome === "returned" ? "returned" : "resolved",
    outcome === "delivered" ? "Delivered" : outcome === "returned" ? "Returned to you" : "Claim approved",
    outcome === "delivered"
      ? `Parcel ${item.trackingId} has been delivered. Thank you for your patience.`
      : outcome === "returned"
        ? `Parcel ${item.trackingId} is on its way back to you.`
        : `Your claim for parcel ${item.trackingId} has been approved. The credit will appear on your next statement.`
  );
}

export async function flagSlaBreach(item: ExceptionCase, actor: Actor): Promise<void> {
  const now = nowIso();
  await updateOne<ExceptionCase>("ExceptionCase", item.ItemId, { slaBreached: true, slaBreachedAt: now, priority: item.priority === "critical" ? "critical" : "high" });
  await appendEvent(item, actor, "sla_breached", `SLA breached: no resolution ${EXCEPTION_TYPES[item.type].slaHours}h after opening. Owner ${item.ownerName} (${teamLabel(item.ownerTeam)}) notified.`, {
    internal: true
  });
  await notifyUsers([item.ownerUserId], {
    kind: "sla_breached",
    caseId: item.ItemId,
    caseNumber: item.caseNumber,
    title: `${item.caseNumber} breached its SLA`,
    body: `${EXCEPTION_TYPES[item.type].label} on ${item.trackingId} is past ${EXCEPTION_TYPES[item.type].slaHours}h.`,
    href: `/cases/${item.ItemId}`
  });
}

export async function refreshCase(itemId: string): Promise<ExceptionCase | undefined> {
  return getOne<ExceptionCase>("ExceptionCase", itemId);
}
