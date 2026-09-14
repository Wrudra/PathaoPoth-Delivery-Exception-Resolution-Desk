"use client";

import { useState } from "react";
import { Bot, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import type { IncidentSummary } from "@/features/ai/types";
import { INCIDENT_LABELS } from "@/features/ai/riderNoteEngine";
import { NEXT_STEPS } from "@/features/domain/constants";
import type { ExceptionCase, NextStep, RiderNote } from "@/features/domain/types";
import { parseJson } from "@/features/data/gateway";
import { formatDateTime, titleCase } from "@/lib/format";
import { ConfidenceMeter } from "./badges";

const STEP_OPTIONS = Object.keys(NEXT_STEPS) as NextStep[];

export function AiPanel({
  item,
  notes,
  canConfirm,
  onConfirm,
  confirming
}: {
  item: ExceptionCase;
  notes: RiderNote[];
  canConfirm: boolean;
  onConfirm: (step: NextStep, note?: RiderNote) => void;
  confirming?: boolean;
}) {
  const latestNote = notes[0];
  const incident =
    parseJson<IncidentSummary | undefined>(item.incidentJson, undefined) ??
    parseJson<IncidentSummary | undefined>(latestNote?.structuredJson, undefined);
  const [override, setOverride] = useState<NextStep | "">("");
  const [showEvidence, setShowEvidence] = useState(true);

  if (!incident) {
    return (
      <Card>
        <CardHeader icon={<Sparkles size={16} />} title="Incident summary" subtitle="Appears as soon as a rider note lands on this case." />
        <CardBody>
          <p className="text-[13px] text-ink-500">No rider note yet. Riders submit rough notes from their phone; the desk turns them into a structured incident and a recommended next step.</p>
        </CardBody>
      </Card>
    );
  }

  const step = (override || item.nextStep || incident.recommendedAction) as NextStep;
  const confirmed = item.nextStepStatus === "confirmed";
  const manual = incident.needsManualReview;

  return (
    <Card className={manual && !confirmed ? "border-warn-600/40" : confirmed ? "border-good-600/40" : "border-violet-600/40"}>
      <CardHeader
        icon={<Sparkles size={16} className={confirmed ? "text-good-600" : "text-violet-600"} />}
        title="Incident summary & next step"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={incident.source === "gemini" ? "violet" : "neutral"}>
              <Bot size={11} /> {incident.source === "gemini" ? `Gemini${incident.model ? ` · ${incident.model}` : ""}` : "Rule engine"}
            </Badge>
            <ConfidenceMeter value={incident.confidence} source={incident.source} />
            {incident.crossCheck ? (
              <Badge tone={incident.crossCheck.agrees ? "good" : "warn"}>{incident.crossCheck.agrees ? "cross-check agrees" : "cross-check disagrees"}</Badge>
            ) : null}
          </span>
        }
      />
      <CardBody className="grid gap-4">
        <p className="text-[15px] leading-6 text-ink-900">{incident.summary}</p>

        <dl className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-4">
          <Fact label="Attempts" value={incident.attempts === null ? "not stated" : String(incident.attempts)} />
          <Fact label="Failure reason" value={titleCase(incident.failureReason)} hint={INCIDENT_LABELS.reason[incident.failureReason]} />
          <Fact label="Address quality" value={titleCase(incident.addressQuality)} hint={incident.landmarks.length ? incident.landmarks.join(", ") : undefined} />
          <Fact label="Phone" value={titleCase(incident.phoneStatus)} />
          <Fact label="Availability" value={incident.preferredWindow ? INCIDENT_LABELS.window[incident.preferredWindow] : "none given"} hint={incident.availabilityHints[0]} />
          <Fact label="COD issue" value={incident.codIssue ? "yes" : "no"} />
          <Fact label="Refusal" value={incident.refusalFirm ? "firm" : "not firm"} />
          <Fact label="Also noted" value={incident.secondaryReasons.length ? incident.secondaryReasons.map(titleCase).join(", ") : "-"} />
        </dl>

        {manual && !confirmed ? (
          <Alert tone="warn" title="Manual review">
            Confidence is {Math.round(incident.confidence * 100)}%. That is below the 60% bar for an automatic recommendation. A care agent picks the next step.
          </Alert>
        ) : null}

        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{confirmed ? "Confirmed next step" : manual ? "Suggested (needs a human)" : "Recommended next step"}</div>
              <div className="mt-1 text-[17px] font-bold text-ink-900">{NEXT_STEPS[step].label}</div>
              <p className="mt-1 text-[13px] leading-5 text-ink-600">{NEXT_STEPS[step].description}</p>
              {confirmed ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-good-700">
                  <Check size={13} /> Confirmed by {item.nextStepConfirmedByName} · {formatDateTime(item.nextStepConfirmedAt)}
                </p>
              ) : null}
            </div>
            {!confirmed && canConfirm ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[260px]">
                <Select value={override || step} onChange={(event) => setOverride(event.target.value as NextStep)} aria-label="Next step">
                  {STEP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {NEXT_STEPS[option].label}
                      {option === incident.recommendedAction ? " (recommended)" : ""}
                    </option>
                  ))}
                </Select>
                <Button onClick={() => onConfirm(step, latestNote)} loading={confirming} icon={<Check size={16} />} variant={manual ? "secondary" : "primary"}>
                  Confirm {step === incident.recommendedAction ? "recommendation" : "override"}
                </Button>
              </div>
            ) : !confirmed ? (
              <p className="max-w-[240px] text-[12px] font-medium leading-5 text-ink-500">Care confirms or overrides this next step. Your desk cannot change it from here.</p>
            ) : null}
          </div>
        </div>

        <div>
          <button onClick={() => setShowEvidence((value) => !value)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-600 hover:text-ink-900">
            {showEvidence ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Why · evidence from the note
          </button>
          {showEvidence ? (
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <ul className="grid gap-1.5">
                {incident.rationale.map((line) => (
                  <li key={line} className="flex gap-2 text-[13px] leading-5 text-ink-700">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                    {line}
                  </li>
                ))}
              </ul>
              <ul className="flex flex-wrap content-start gap-1.5">
                {incident.evidence.map((ev) => (
                  <li key={`${ev.label}-${ev.quote}`} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-[12px]" title={`weight ${ev.weight}`}>
                    <span className="font-semibold text-ink-900">{ev.label}</span>
                    <span className="text-ink-500"> · “{ev.quote}”</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-info-100 bg-info-100/40 px-4 py-3 text-[13px] leading-5 text-info-700">
          <span className="font-semibold">Sender will read:</span> {confirmed ? NEXT_STEPS[step].senderSafe : incident.senderSafeSummary}
        </div>
      </CardBody>
    </Card>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink-900">{value}</dd>
      {hint ? (
        <dd className="mt-0.5 truncate text-[12px] text-ink-500" title={hint}>
          {hint}
        </dd>
      ) : null}
    </div>
  );
}
