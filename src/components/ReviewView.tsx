import React from "react";
import Link from "next/link";
import { FlaskConicalIcon, GavelIcon, HistoryIcon } from "lucide-react";
import { EvidenceState, LatestResult } from "../types/canvas";
import { EvidenceBadge } from "./EvidenceBadge";
import { SnapshotComparison } from "./SnapshotsPanel";
import { formatCalendarDate, formatPlanDate, localDate } from "../utils/testFields";

export type TestOutcome = "missed" | "met" | "unclear" | "no_result";

export interface ReviewData {
  title: string;
  launchDate?: string;
  today: string;
  tests: {
    noteId: string;
    block: string;
    text: string;
    evidenceState: EvidenceState;
    markets?: string[];
    owner?: string;
    measure?: string;
    passMark?: string;
    reviewDate?: string;
    latestResult?: LatestResult;
    outcome: TestOutcome;
    reviewOverdue: boolean;
  }[];
  openDecisions: {
    noteId: string;
    block: string;
    text: string;
    question: string;
    deciderId: string;
    decider: string;
    requestedBy: string;
    dueDate: string;
    overdue: boolean;
  }[];
  since: { snapshotId: string; label: string; takenAt: number } | null;
  snapshots: { snapshotId: string; label: string; takenAt: number }[];
  changes: React.ComponentProps<typeof SnapshotComparison>["comparison"] | null;
}

const OUTCOME_GROUPS: { outcome: TestOutcome; title: string; tone: string }[] = [
  { outcome: "missed", title: "Missed the pass mark", tone: "text-rose-700" },
  { outcome: "no_result", title: "No result yet", tone: "text-ink" },
  { outcome: "unclear", title: "Too early to tell", tone: "text-ink" },
  { outcome: "met", title: "Met the pass mark", tone: "text-emerald-700" },
];

function SectionHeading({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
      {icon}
      {title}
      <span className="text-sm font-normal text-muted">({count})</span>
    </h2>
  );
}

function Field({ label, value, tone = "text-ink" }: { label: string; value?: string; tone?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-muted">{label}</dt>
      <dd className={`break-words text-sm ${tone}`}>{value}</dd>
    </div>
  );
}

/**
 * The review-meeting view: open decisions, tests and their results against the pass mark, and
 * what changed since a snapshot. Read-only.
 */
export function ReviewView({
  review,
  blockTitleOf,
  currentUserId,
  onPickSnapshot,
}: {
  review: ReviewData;
  blockTitleOf: (blockId: string) => string;
  currentUserId?: string;
  onPickSnapshot: (snapshotId: string) => void;
}) {
  const plan = (date: string) => formatPlanDate(review.launchDate, date).replace(/^Day/, "day");
  const blockLine = (block: string, extras: (string | undefined)[] = []) =>
    [blockTitleOf(block).replace(/^\d+\.\s*/, ""), ...extras].filter(Boolean).join(" · ");

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <SectionHeading icon={<GavelIcon size={18} aria-hidden="true" />} title="Decisions waiting" count={review.openDecisions.length} />
        {review.openDecisions.length === 0 ? (
          <p className="text-sm text-muted">No open decisions.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {review.openDecisions.map((d) => (
              <li key={d.noteId} className="space-y-1.5 rounded-xl border border-line bg-surface p-4">
                <p className="text-base font-semibold leading-snug text-ink">{d.question}</p>
                <p className={`text-xs ${d.overdue ? "font-semibold text-rose-700" : "text-muted"}`}>
                  {d.decider} decides · {d.overdue ? "overdue, was due" : "due"} {plan(d.dueDate)} · asked by {d.requestedBy}
                </p>
                <p className="text-xs text-muted">{blockLine(d.block)}: {d.text}</p>
                {currentUserId === d.deciderId && (
                  <Link href="/decisions" className="inline-block text-xs font-semibold text-accent underline">
                    Answer it
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading icon={<FlaskConicalIcon size={18} aria-hidden="true" />} title="Tests" count={review.tests.length} />
        {review.tests.length === 0 && (
          <p className="text-sm text-muted">No note has a test yet. Add a measure and pass mark to a note to see it here.</p>
        )}
        {OUTCOME_GROUPS.map(({ outcome, title, tone }) => {
          const group = review.tests.filter((t) => t.outcome === outcome);
          if (group.length === 0) return null;
          return (
            <div key={outcome} className="space-y-2">
              <h3 className={`text-sm font-semibold ${tone}`}>
                {title} ({group.length})
              </h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {group.map((t) => (
                  <li key={t.noteId} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug text-ink">{t.text}</p>
                        <EvidenceBadge state={t.evidenceState} />
                      </div>
                      <p className="text-xs text-muted">
                        {blockLine(t.block, [t.markets?.length ? `${t.markets.join(", ")} only` : undefined, t.owner])}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <Field label="Measure" value={t.measure} />
                      <Field label="Pass mark" value={t.passMark} />
                      <Field
                        label={t.latestResult ? `Latest result, ${formatCalendarDate(t.latestResult.date)}` : "Latest result"}
                        value={t.latestResult?.text ?? "None yet"}
                        tone={tone}
                      />
                      <Field
                        label="Review"
                        value={t.reviewDate && `${plan(t.reviewDate)}${t.reviewOverdue ? " (overdue)" : ""}`}
                        tone={t.reviewOverdue ? "font-semibold text-rose-700" : "text-ink"}
                      />
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading
            icon={<HistoryIcon size={18} aria-hidden="true" />}
            title={review.since ? `Changed since ${review.since.label}` : "Changes"}
            count={review.changes ? review.changes.added.length + review.changes.removed.length + review.changes.changed.length : 0}
          />
          {review.snapshots.length > 1 && review.since && (
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              Since
              <select
                value={review.since.snapshotId}
                onChange={(e) => onPickSnapshot(e.target.value)}
                className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
              >
                {review.snapshots.map((s) => (
                  <option key={s.snapshotId} value={s.snapshotId}>
                    {s.label} ({formatCalendarDate(localDate(s.takenAt))})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {review.changes ? (
          <div className="max-w-2xl">
            <SnapshotComparison comparison={review.changes} blockTitleOf={blockTitleOf} />
          </div>
        ) : (
          <p className="text-sm text-muted">
            No snapshot yet. Take one from the canvas's Snapshots panel (e.g. "Day 0") to see what changes between reviews.
          </p>
        )}
      </section>
    </div>
  );
}
