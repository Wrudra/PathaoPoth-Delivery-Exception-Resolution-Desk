"use client";

import { useState } from "react";
import { Bike, Mic, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import type { RiderNote } from "@/features/domain/types";
import { formatDateTime } from "@/lib/format";
import { ConfidenceMeter } from "./badges";

const SAMPLE_NOTES = [
  "3 bar try korsi, phone off chilo, guard dhukte dey na. 2 ta kalo building er pashe basha. Receiver bollo shondhay thakbe, COD 2300 taka ready nai bolse.",
  "address pai nai, house number nai, shudhu boro mosjid er pashe likha. call dhore na.",
  "customer bole order kore nai, nibe na. ferot niye aslam hub e.",
  "packet bhije gese, box vanga, customer nite chay na",
  "dui bar gesi, bashay nai, office e ase. kal sokale dite bolse."
];

export function RiderNoteComposer({
  notes,
  riderName,
  onSubmit,
  submitting,
  compact
}: {
  notes: RiderNote[];
  riderName: string;
  onSubmit: (text: string) => Promise<void> | void;
  submitting?: boolean;
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [showSamples, setShowSamples] = useState(false);

  async function handleSubmit() {
    const value = text.trim();
    if (!value) return;
    await onSubmit(value);
    setText("");
  }

  return (
    <Card>
      <CardHeader
        icon={<Bike size={16} />}
        title="Rider note"
        subtitle={compact ? `Type it the way you'd say it. ${riderName}, the desk will structure it.` : "Rough, Banglish, unpunctuated is fine — the desk structures it into an incident and a next step."}
        actions={
          <button onClick={() => setShowSamples((value) => !value)} className="text-[12px] font-semibold text-ink-500 hover:text-ink-900">
            {showSamples ? "Hide samples" : "Samples"}
          </button>
        }
      />
      <CardBody className="grid gap-3">
        {showSamples ? (
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_NOTES.map((sample) => (
              <button key={sample} onClick={() => setText(sample)} className="rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-left text-[12px] text-ink-700 hover:border-ink-300 hover:bg-white">
                {sample.length > 64 ? `${sample.slice(0, 64)}…` : sample}
              </button>
            ))}
          </div>
        ) : null}
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. 3 bar try korsi, phone off, guard dhukte dey na, shondhay thakbe bolse…"
          className={compact ? "min-h-[140px] text-[17px]" : undefined}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void handleSubmit();
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
            <Mic size={13} /> Voice-to-text from the rider app lands here too.
          </span>
          <Button onClick={() => void handleSubmit()} loading={submitting} disabled={!text.trim()} icon={<Send size={16} />} size={compact ? "lg" : "md"}>
            Send note
          </Button>
        </div>

        {notes.length ? (
          <ul className="mt-2 grid gap-2 border-t border-ink-100 pt-3">
            {notes.map((note) => (
              <li key={note.ItemId} className="rounded-xl border border-ink-100 bg-ink-50/70 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
                  <span className="font-semibold text-ink-900">{note.riderName}</span>
                  <span>· {formatDateTime(note.submittedAt)}</span>
                  <span className="ml-auto inline-flex items-center gap-2">
                    {typeof note.confidence === "number" ? <ConfidenceMeter value={note.confidence} source={note.source} /> : null}
                    <Badge tone={note.status === "confirmed" ? "good" : note.status === "manual_review" ? "warn" : note.status === "structured" ? "violet" : "neutral"}>
                      {note.status === "structured" ? (
                        <>
                          <Sparkles size={11} /> structured
                        </>
                      ) : (
                        note.status.replace("_", " ")
                      )}
                    </Badge>
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-5 text-ink-800">“{note.rawText}”</p>
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
}
