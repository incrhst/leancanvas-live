import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CameraIcon, Trash2Icon, XIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EvidenceState } from "../types/canvas";
import { EvidenceBadge } from "./EvidenceBadge";
import { describeChange } from "./NoteHistory";
import { formatCalendarDate, localDate, planDay, todayLocal } from "../utils/testFields";

interface SnapshotsPanelProps {
  canvasId: string;
  canEdit: boolean;
  isOwner: boolean;
  launchDate?: string;
  blockTitleOf: (blockId: string) => string;
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
}

type Side = "current" | string;

function defaultLabel(launchDate?: string) {
  const today = todayLocal();
  const day = planDay(launchDate, today);
  return day !== null && day >= 0 ? `Day ${day}` : formatCalendarDate(today);
}

function dayLabel(launchDate: string | undefined, takenAt: number) {
  const day = planDay(launchDate, localDate(takenAt));
  return day !== null && day >= 0 ? ` (day ${day})` : "";
}

function NoteLine({
  note,
  blockTitleOf,
  onOpen,
}: {
  note: { block: string; text: string };
  blockTitleOf: (blockId: string) => string;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted">{blockTitleOf(note.block)}</span>
      <span className="block text-xs text-ink">{note.text}</span>
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} className="block w-full text-left hover:underline">
      {content}
    </button>
  ) : (
    <div>{content}</div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-ink">
        {title} <span className="font-normal text-muted">({count})</span>
      </h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

interface Comparison {
  added: { noteId: string; block: string; text: string }[];
  removed: { noteId: string; block: string; text: string }[];
  changed: { noteId: string; block: string; text: string; changes: { field: string; from?: string; to?: string }[] }[];
}

/** The result of comparing two points: changed state first, then added, removed and edited notes. */
export function SnapshotComparison({
  comparison,
  blockTitleOf,
  onOpenNote,
}: {
  comparison: Comparison;
  blockTitleOf: (blockId: string) => string;
  /** Set when the later side is "now", so the notes still exist to open */
  onOpenNote?: (noteId: string) => void;
}) {
  const stateChanges = comparison.changed.filter((n) => n.changes.some((c) => c.field === "evidenceState"));
  const otherChanges = comparison.changed.filter((n) => n.changes.some((c) => c.field !== "evidenceState"));
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        {stateChanges.length} changed state · {comparison.added.length} added · {comparison.removed.length}{" "}
        removed
        {otherChanges.length > 0 ? ` · ${otherChanges.length} edited` : ""}
      </p>

      <Section title="Changed state" count={stateChanges.length}>
        {stateChanges.map((n) => {
          const change = n.changes.find((c) => c.field === "evidenceState")!;
          return (
            <li key={n.noteId} className="space-y-1.5 rounded-lg border border-line p-2.5">
              <div className="flex flex-wrap items-center gap-1">
                <EvidenceBadge state={change.from as EvidenceState} />
                <span className="text-xs text-muted" aria-label="to">
                  →
                </span>
                <EvidenceBadge state={change.to as EvidenceState} />
              </div>
              <NoteLine
                note={n}
                blockTitleOf={blockTitleOf}
                onOpen={onOpenNote && (() => onOpenNote(n.noteId))}
              />
            </li>
          );
        })}
      </Section>

      <Section title="Added" count={comparison.added.length}>
        {comparison.added.map((n) => (
          <li key={n.noteId} className="rounded-lg border border-line p-2.5">
            <NoteLine
              note={n}
              blockTitleOf={blockTitleOf}
              onOpen={onOpenNote && (() => onOpenNote(n.noteId))}
            />
          </li>
        ))}
      </Section>

      <Section title="Removed" count={comparison.removed.length}>
        {comparison.removed.map((n) => (
          <li key={n.noteId} className="rounded-lg border border-dashed border-line p-2.5 opacity-80">
            <NoteLine note={n} blockTitleOf={blockTitleOf} />
          </li>
        ))}
      </Section>

      <Section title="Edited" count={otherChanges.length}>
        {otherChanges.map((n) => (
          <li key={n.noteId} className="space-y-1 rounded-lg border border-line p-2.5">
            <NoteLine
              note={n}
              blockTitleOf={blockTitleOf}
              onOpen={onOpenNote && (() => onOpenNote(n.noteId))}
            />
            {n.changes
              .filter((c) => c.field !== "evidenceState")
              .map((c, i) => (
                <p key={i} className="break-words text-[11px] text-muted">
                  {describeChange(c, blockTitleOf)}
                </p>
              ))}
          </li>
        ))}
      </Section>

      {stateChanges.length + comparison.added.length + comparison.removed.length + otherChanges.length ===
        0 && <p className="text-xs text-muted">Nothing changed.</p>}
    </div>
  );
}

/**
 * Freeze the canvas under a label (e.g. "Day 30") and compare any two snapshots, or a snapshot
 * and now: what was added, removed, or changed.
 */
export function SnapshotsPanel({
  canvasId,
  canEdit,
  isOwner,
  launchDate,
  blockTitleOf,
  onClose,
  onOpenNote,
}: SnapshotsPanelProps) {
  const id = canvasId as Id<"canvases">;
  const snapshots = useQuery(api.snapshots.list, { canvasId: id });
  const createSnapshot = useMutation(api.snapshots.createSnapshot);
  const deleteSnapshot = useMutation(api.snapshots.deleteSnapshot);
  const [label, setLabel] = useState(() => defaultLabel(launchDate));
  const [from, setFrom] = useState<Side | null>(null);
  const [to, setTo] = useState<Side>("current");
  const [saving, setSaving] = useState(false);

  // Compare the latest snapshot with now until someone picks otherwise
  useEffect(() => {
    if (from === null && snapshots && snapshots.length > 0) setFrom(snapshots[0].snapshotId);
    if (from && from !== "current" && snapshots && !snapshots.some((s) => s.snapshotId === from)) setFrom(null);
  }, [snapshots, from]);

  const comparison = useQuery(
    api.snapshots.compare,
    from && from !== to
      ? { canvasId: id, from: from as Id<"canvasSnapshots"> | "current", to: to as Id<"canvasSnapshots"> | "current" }
      : "skip"
  );

  const take = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const snapshotId = await createSnapshot({ canvasId: id, label });
      setFrom(snapshotId);
      setTo("current");
    } finally {
      setSaving(false);
    }
  };

  const options = (snapshots ?? []).map((s) => (
    <option key={s.snapshotId} value={s.snapshotId}>
      {s.label} ({formatCalendarDate(localDate(s.takenAt))})
    </option>
  ));
  const select =
    "w-full rounded-lg border border-line bg-surface p-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent";


  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          <CameraIcon size={14} aria-hidden="true" />
          Snapshots
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close snapshots"
          className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-stone-100 hover:text-ink"
        >
          <XIcon size={16} />
        </button>
      </header>

      <div className="flex-1 space-y-5 p-4">
        {canEdit && (
          <form onSubmit={take} className="space-y-1.5">
            <label htmlFor="snapshot-label" className="text-xs font-semibold text-muted">
              Freeze the canvas as it is now
            </label>
            <div className="flex gap-1.5">
              <input
                id="snapshot-label"
                value={label}
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={saving || !label.trim()}
                className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
              >
                Take snapshot
              </button>
            </div>
          </form>
        )}

        {snapshots === undefined ? null : snapshots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            No snapshots yet. Take one at day 0 and before each review, then compare them here.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted">Compare</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-muted">From</span>
                  <select value={from ?? ""} onChange={(e) => setFrom(e.target.value)} className={select}>
                    {options}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted">To</span>
                  <select value={to} onChange={(e) => setTo(e.target.value)} className={select}>
                    <option value="current">Now</option>
                    {options}
                  </select>
                </label>
              </div>
            </div>

            {from === to ? (
              <p className="text-xs text-muted">Pick two different points to compare.</p>
            ) : comparison === undefined ? (
              <p className="text-xs text-muted">Comparing…</p>
            ) : comparison === null ? null : (
              <SnapshotComparison
                comparison={comparison}
                blockTitleOf={blockTitleOf}
                onOpenNote={to === "current" ? onOpenNote : undefined}
              />
            )}

            <section className="space-y-1.5 border-t border-line pt-4">
              <p className="text-xs font-semibold text-muted">All snapshots</p>
              <ul className="space-y-1">
                {snapshots.map((s) => (
                  <li key={s.snapshotId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-ink">
                      <strong>{s.label}</strong>{" "}
                      <span className="text-muted">
                        · {formatCalendarDate(localDate(s.takenAt))}
                        {dayLabel(launchDate, s.takenAt)} · {s.noteCount} notes · {s.takenBy}
                      </span>
                    </span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete the snapshot "${s.label}"? This can't be undone.`)) {
                            void deleteSnapshot({ snapshotId: s.snapshotId });
                          }
                        }}
                        aria-label={`Delete snapshot ${s.label}`}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2Icon size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
