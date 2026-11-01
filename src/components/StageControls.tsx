"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { BookOpenCheckIcon, FlaskConicalIcon, LightbulbIcon, RepeatIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Stage, STAGE_LABELS, STAGE_MEANINGS, STAGES } from "../../convex/lib/runbookModel";
import type { NoteItem } from "../types/canvas";

export const STAGE_STYLE: Record<Stage, { icon: React.ElementType; chip: string; swatch: string }> = {
  guess: {
    icon: LightbulbIcon,
    chip: "border-dashed border-stone-400 bg-stone-100 text-stone-700",
    swatch: "border border-dashed border-stone-400 bg-stone-200",
  },
  tested: { icon: FlaskConicalIcon, chip: "border-amber-300 bg-amber-50 text-amber-900", swatch: "bg-amber-400" },
  repeatable: { icon: RepeatIcon, chip: "border-teal-300 bg-teal-50 text-teal-900", swatch: "bg-teal-500" },
  codified: { icon: BookOpenCheckIcon, chip: "border-emerald-300 bg-emerald-50 text-emerald-900", swatch: "bg-emerald-600" },
};

export function StageChip({ stage, small = false }: { stage: Stage; small?: boolean }) {
  const { icon: Icon, chip } = STAGE_STYLE[stage];
  return (
    <span
      title={`${STAGE_LABELS[stage]}: ${STAGE_MEANINGS[stage]}`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border font-medium ${chip} ${
        small ? "px-1 py-0 text-[10px]" : "px-1.5 py-0.5 text-[11px]"
      }`}
    >
      <Icon size={small ? 10 : 12} aria-hidden="true" />
      {STAGE_LABELS[stage]}
    </span>
  );
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message.replace(/^.*Uncaught (ConvexError|Error): /, "").split("\n")[0] : "Couldn't save";
}

/**
 * Where a note is on the way from guess to runbook. Guess, tested and repeatable are picked by
 * hand; codified comes only from a live runbook. Repeatable notes can start a draft runbook.
 */
export function NoteStageField({ note, canEdit }: { note: NoteItem; canEdit: boolean }) {
  const updateNote = useMutation(api.notes.updateNote);
  const fromNote = useMutation(api.runbooks.fromNote);
  const stage: Stage = note.stage ?? "guess";
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const pick = async (next: Exclude<Stage, "codified">) => {
    setMessage(null);
    try {
      await updateNote({ noteId: note._id as Id<"notes">, stage: next });
    } catch (err) {
      setMessage({ text: errorText(err), error: true });
    }
  };

  const makeRunbook = async () => {
    setMessage(null);
    try {
      await fromNote({ noteId: note._id as Id<"notes"> });
      setMessage({ text: "Draft runbook made. Add its steps in the Runbooks tab, then make it live." });
    } catch (err) {
      setMessage({ text: errorText(err), error: true });
    }
  };

  return (
    <section aria-label="Stage" className="space-y-2 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">From guess to runbook</p>
        {!canEdit && <StageChip stage={stage} />}
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Stage">
          {STAGES.map((s) => {
            const { icon: Icon } = STAGE_STYLE[s];
            const active = s === stage;
            const locked = s === "codified" || stage === "codified";
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={locked && !active}
                title={
                  s === "codified"
                    ? "Codified comes from a live runbook linking this note"
                    : stage === "codified"
                      ? "Codified by a live runbook. Retire it or unlink the note to change this."
                      : STAGE_MEANINGS[s]
                }
                onClick={() => s !== "codified" && !active && pick(s)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                  active ? STAGE_STYLE[s].chip + " font-semibold" : "border-line bg-surface text-muted hover:text-ink"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Icon size={12} aria-hidden="true" />
                {STAGE_LABELS[s]}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted">{STAGE_MEANINGS[stage]}.</p>
      {canEdit && stage === "repeatable" && (
        <button
          type="button"
          onClick={makeRunbook}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-surface hover:opacity-90"
        >
          <BookOpenCheckIcon size={13} /> Write the runbook
        </button>
      )}
      {canEdit && (stage === "guess" || stage === "tested") && (
        <p className="text-[11px] text-muted">Still searching: run experiments, not runbooks. Mark it repeatable once it works more than once.</p>
      )}
      {message && <p className={`text-xs ${message.error ? "text-rose-700" : "text-emerald-800"}`}>{message.text}</p>}
    </section>
  );
}
