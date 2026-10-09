import React from "react";
import { useQuery } from "convex/react";
import { HistoryIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EVIDENCE_CONFIG } from "./EvidenceBadge";
import { EvidenceState } from "../types/canvas";
import { formatRelative, truncate } from "../utils/time";

interface NoteHistoryProps {
  noteId: string;
  blockTitleOf: (blockId: string) => string;
}

type Change = { field: string; from?: string; to?: string };

function stateLabel(state?: string) {
  return state ? EVIDENCE_CONFIG[state as EvidenceState]?.label ?? state : "none";
}

function describeChange(change: Change, blockTitleOf: (blockId: string) => string) {
  switch (change.field) {
    case "evidenceState":
      return `State: ${stateLabel(change.from)} → ${stateLabel(change.to)}`;
    case "block":
      return `Moved: ${change.from ? blockTitleOf(change.from) : "?"} → ${change.to ? blockTitleOf(change.to) : "?"}`;
    case "content":
      return `Text: “${truncate(change.from ?? "", 60)}” → “${truncate(change.to ?? "", 60)}”`;
    default:
      return `${change.field}: ${change.from ?? "none"} → ${change.to ?? "none"}`;
  }
}

function describeEntry(kind: string, changes: Change[], blockTitleOf: (blockId: string) => string) {
  if (kind === "created") {
    const block = changes.find((c) => c.field === "block")?.to;
    const state = changes.find((c) => c.field === "evidenceState")?.to;
    return [`Added to ${block ? blockTitleOf(block) : "the canvas"} as ${stateLabel(state)}`];
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
