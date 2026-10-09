import React, { useContext } from "react";
import { motion } from "framer-motion";
import { FlaskConicalIcon, ShieldAlertIcon } from "lucide-react";
import { EVIDENCE_CONFIG, EvidenceBadge } from "./EvidenceBadge";
import { NoteItem } from "../types/canvas";
import { LaunchDateContext, VERDICT_CONFIG, formatPlanDate, hasTest, isReviewOverdue } from "../utils/testFields";

interface StickyNoteProps {
  note: NoteItem;
  selected?: boolean;
  /** 1-based rank if the latest stress test flagged this note as a riskiest assumption */
  riskRank?: number;
  canEdit?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

/** A note card's look for its evidence state: tinted background and a full border in the state's colour. */
export function noteCardClass(note: NoteItem) {
  return `rounded-lg border ${EVIDENCE_CONFIG[note.evidenceState || "assumption"].card}`;
}

/**
 * Marks a note the latest stress test flagged. Dark rather than red, so it never reads as "contradicted".
 */
export function RiskTag({ rank }: { rank: number }) {
  return (
    <div
      className="mb-1.5 inline-flex items-center gap-1 rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface"
      title="Flagged by the latest stress test as one of the riskiest assumptions"
    >
      <ShieldAlertIcon className="h-3 w-3" aria-hidden="true" />
      Risk #{rank}
    </div>
  );
}

/** One line under the note text: the latest verdict and when it's next reviewed. Full detail is in the note panel. */
function TestSummary({ note }: { note: NoteItem }) {
  const launchDate = useContext(LaunchDateContext);
  const verdict = note.latestResult?.verdict ? VERDICT_CONFIG[note.latestResult.verdict] : null;
  const overdue = isReviewOverdue(note);

  const parts: React.ReactNode[] = [];
  if (verdict) {
    parts.push(
      <span key="verdict" className={`inline-flex items-center gap-1 font-semibold ${verdict.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${verdict.dot}`} />
        {verdict.label}
      </span>
    );
  } else if (note.latestResult) {
    parts.push(<span key="result">Result in</span>);
  }
  if (note.reviewDate) {
    parts.push(
      overdue ? (
        <span key="review" className="font-semibold text-rose-700">
          Review overdue
        </span>
      ) : (
        <span key="review">Review {formatPlanDate(launchDate, note.reviewDate).replace(/^Day/, "day")}</span>
      )
    );
  }
  if (parts.length === 0) parts.push(<span key="set">Test set</span>);

  const detail = [
    note.measure && `Measure: ${note.measure}`,
    note.passMark && `Pass: ${note.passMark}`,
    note.reviewDate && `Review: ${note.reviewDate}${launchDate ? ` (${formatPlanDate(launchDate, note.reviewDate)})` : ""}`,
    note.latestResult && `Latest (${note.latestResult.date}): ${note.latestResult.text}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted" title={detail}>
      <FlaskConicalIcon className="h-3 w-3 shrink-0" aria-label="Test" />
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden="true">·</span>}
          {part}
        </React.Fragment>
      ))}
    </p>
  );
}

export function StickyNote({
  note,
  selected = false,
  riskRank,
  canEdit = true,
  onSelect,
  onDelete,
}: StickyNoteProps) {
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className={`group relative p-2.5 transition-all duration-150 hover:shadow-sm ${noteCardClass(note)} ${
        selected ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""
      }`}
    >
      {riskRank && <RiskTag rank={riskRank} />}
      <div
        onClick={onSelect}
        role={onSelect ? "button" : undefined}
        className="cursor-pointer"
      >
        <p className="text-[13px] leading-snug text-ink font-normal pr-4">
          {note.content}
        </p>
        {hasTest(note) && <TestSummary note={note} />}
      </div>

      <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-black/5">
        {/* Opens the note, where the state is changed (with an optional reason) */}
        <EvidenceBadge
          state={note.evidenceState || "assumption"}
          interactive={!!onSelect}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        />

        {canEdit && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete note"
            className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 text-xs px-1 rounded transition-opacity"
          >
            ×
          </button>
        )}
      </div>
    </motion.article>
  );
}