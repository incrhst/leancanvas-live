import React from "react";
import { useQuery } from "convex/react";
import { HistoryIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EVIDENCE_CONFIG } from "./EvidenceBadge";
import { EvidenceState, Verdict } from "../types/canvas";
import { formatRelative, truncate } from "../utils/time";
import { VERDICT_CONFIG, formatCalendarDate } from "../utils/testFields";

interface NoteHistoryProps {
  noteId: string;
  blockTitleOf: (blockId: string) => string;
}

type Change = { field: string; from?: string; to?: string };

function stateLabel(state?: string) {
  return state ? EVIDENCE_CONFIG[state as EvidenceState]?.label ?? state : "none";
}

const TEXT_FIELD_LABELS: Record<string, string> = {
  content: "Text",
  measure: "Measure",
  passMark: "Pass mark",
  "latestResult.text": "Result",
};

const DATE_FIELD_LABELS: Record<string, string> = {
  reviewDate: "Review date",
  "latestResult.date": "Result date",
};

function fromTo(label: string, from: string | undefined, to: string | undefined) {
  if (from === undefined) return `${label} set: ${to}`;
  if (to === undefined) return `${label} cleared (was ${from})`;
  return `${label}: ${from} → ${to}`;
}

function describeChange(change: Change, blockTitleOf: (blockId: string) => string) {
  const quote = (value?: string) => (value === undefined ? undefined : `“${truncate(value, 60)}”`);
  if (TEXT_FIELD_LABELS[change.field]) {
    return fromTo(TEXT_FIELD_LABELS[change.field], quote(change.from), quote(change.to));
  }
  if (DATE_FIELD_LABELS[change.field]) {
    const date = (value?: string) => (value === undefined ? undefined : formatCalendarDate(value));
    return fromTo(DATE_FIELD_LABELS[change.field], date(change.from), date(change.to));
  }
  switch (change.field) {
    case "owner":
      return fromTo("Owner", change.from, change.to);
    case "latestResult.verdict": {
      const verdict = (value?: string) => (value === undefined ? undefined : VERDICT_CONFIG[value as Verdict]?.label ?? value);
      return fromTo("Verdict", verdict(change.from), verdict(change.to));
    }
    case "evidenceState":
      return `State: ${stateLabel(change.from)} → ${stateLabel(change.to)}`;
    case "block":
      return `Moved: ${change.from ? blockTitleOf(change.from) : "?"} → ${change.to ? blockTitleOf(change.to) : "?"}`;
    default:
      return `${change.field}: ${change.from ?? "none"} → ${change.to ?? "none"}`;
  }
}

function describeEntry(kind: string, changes: Change[], blockTitleOf: (blockId: string) => string) {
  if (kind === "created") {
    const block = changes.find((c) => c.field === "block")?.to;
    const state = changes.find((c) => c.field === "evidenceState")?.to;
    const extras = changes.filter((c) => !["block", "evidenceState", "content"].includes(c.field));
    return [
      `Added to ${block ? blockTitleOf(block) : "the canvas"} as ${stateLabel(state)}`,
      ...extras.map((c) => describeChange(c, blockTitleOf)),
    ];
  }
  if (kind === "deleted") return ["Deleted"];
  return changes.map((c) => describeChange(c, blockTitleOf));
}

function isSafeLink(link: string) {
  return /^https?:\/\//i.test(link);
}

export function NoteHistory({ noteId, blockTitleOf }: NoteHistoryProps) {
  const history = useQuery(api.notes.getNoteHistory, { noteId: noteId as Id<"notes"> });

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <HistoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
        History
      </label>

      {history === undefined ? null : history.length === 0 ? (
        <p className="text-[11px] text-muted">No changes recorded yet.</p>
      ) : (
        <ol className="space-y-2.5 border-l border-line pl-3">
          {history.map((entry) => (
            <li key={entry._id} className="text-[11px] leading-snug">
              <p className="text-muted">
                <span className="font-semibold text-ink">{entry.userName}</span>
                {entry.via === "mcp" && <> via {entry.clientName || "an agent"}</>} · {formatRelative(entry.at)}
              </p>
              {describeEntry(entry.kind, entry.changes, blockTitleOf).map((line, i) => (
                <p key={i} className="text-ink break-words">
                  {line}
                </p>
              ))}
              {entry.reason && <p className="italic text-muted">“{entry.reason}”</p>}
              {entry.link && isSafeLink(entry.link) && (
                <a
                  href={entry.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline break-all"
                >
                  {truncate(entry.link, 48)}
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
