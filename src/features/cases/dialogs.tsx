"use client";

import { useState } from "react";
import { ArrowLeftRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { HUBS, teamForHub, teamLabel } from "@/features/domain/constants";
import type { ExceptionCase } from "@/features/domain/types";

const TEAM_OPTIONS = [
  { value: "care", label: "Customer care" },
  ...HUBS.map((hub) => ({ value: teamForHub(hub.code), label: `${hub.name} hub` })),
  { value: "ops", label: "Operations" }
];

export function TransferDialog({
  item,
  open,
  onOpenChange,
  onSubmit,
  pending
}: {
  item: ExceptionCase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (team: string, note: string) => Promise<void>;
  pending?: boolean;
}) {
  const suggested = item.ownerTeam === "care" ? teamForHub(item.destHubCode) : "care";
  const [team, setTeam] = useState(suggested);
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Transfer ownership"
        description={`${item.ownerName} (${teamLabel(item.ownerTeam)}) stays accountable until the receiving team acknowledges.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              icon={<ArrowLeftRight size={16} />}
              loading={pending}
              onClick={async () => {
                await onSubmit(team, note.trim());
                setNote("");
              }}
            >
              Request hand-off
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Hand over to" required>
            <Select value={team} onChange={(event) => setTeam(event.target.value)}>
              {TEAM_OPTIONS.filter((option) => option.value !== item.ownerTeam).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note for the receiving team" hint="What have you done, what do you need them to do?">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Receiver confirmed evening window; please dispatch from GEC hub after 6 pm and collect COD ৳2,300." className="min-h-[96px]" />
          </Field>
          <Alert tone="info">Ownership is never “nobody”: the case shows as awaiting acknowledgement and {item.ownerName} keeps the SLA clock until someone at {teamLabel(team)} accepts.</Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeclineDialog({
  open,
  onOpenChange,
  onSubmit,
  pending
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => Promise<void>;
  pending?: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Decline hand-off"
        description="The case stays with its current owner. Say why so they can act."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon={<XCircle size={16} />} loading={pending} disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>
              Decline
            </Button>
          </>
        }
      >
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Parcel is still at Mirpur hub — dispatch it to GEC first." className="min-h-[96px]" />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveDialog({
  item,
  open,
  onOpenChange,
  onSubmit,
  pending
}: {
  item: ExceptionCase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (resolution: string, outcome: "delivered" | "returned" | "claimed") => Promise<void>;
  pending?: boolean;
}) {
  const [outcome, setOutcome] = useState<"delivered" | "returned" | "claimed">(item.type === "damaged" ? "claimed" : item.nextStep === "return_to_sender" ? "returned" : "delivered");
  const [resolution, setResolution] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Resolve case"
        description="Closes the SLA clock and publishes a sanitised update to the sender."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="success" icon={<CheckCircle2 size={16} />} loading={pending} disabled={!resolution.trim()} onClick={() => onSubmit(resolution.trim(), outcome)}>
              Mark resolved
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Outcome" required>
            <Select value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
              <option value="delivered">Delivered to receiver</option>
              <option value="returned">Returned to sender</option>
              <option value="claimed">Claim approved (refund / credit)</option>
            </Select>
          </Field>
          <Field label="Resolution note" required hint="Internal wording is fine; the sender gets a sanitised version.">
            <Textarea value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="e.g. Delivered 7:40 pm by rider Jashim after pre-call; COD ৳2,300 collected." className="min-h-[96px]" />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
