import React, { useContext } from "react";
import { FlaskConicalIcon } from "lucide-react";
import { LatestResult, NoteItem, Verdict } from "../types/canvas";
import { EditableField } from "./EditableField";
import {
  LaunchDateContext,
  VERDICT_CONFIG,
  formatCalendarDate,
  hasTest,
  isReviewOverdue,
  planDay,
  todayLocal,
} from "../utils/testFields";

export type TestFieldsPatch = {
  measure?: string | null;
  passMark?: string | null;
  reviewDate?: string | null;
  latestResult?: LatestResult | null;
};

interface NoteTestFieldsProps {
  note: NoteItem;
  canEdit: boolean;
  onUpdate?: (patch: TestFieldsPatch) => void;
}

const VERDICTS: Verdict[] = ["pass", "fail", "inconclusive"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium text-muted">{children}</span>;
}

export function NoteTestFields({ note, canEdit, onUpdate }: NoteTestFieldsProps) {
  const result = note.latestResult;
  const launchDate = useContext(LaunchDateContext);
  const reviewDay = note.reviewDate ? planDay(launchDate, note.reviewDate) : null;
  const reviewSuffix = `${reviewDay !== null && reviewDay >= 0 ? ` · Day ${reviewDay}` : ""}${
    isReviewOverdue(note) ? " (overdue)" : ""
  }`;

  if (!canEdit || !onUpdate) {
    if (!hasTest(note)) return null;
    return (
      <div className="space-y-2">
        <SectionLabel />
        <dl className="space-y-1.5 text-xs">
          {note.measure && <ReadOnlyRow label="Measure" value={note.measure} />}
          {note.passMark && <ReadOnlyRow label="Pass mark" value={note.passMark} />}
          {note.reviewDate && (
            <ReadOnlyRow
              label="Review"
              value={`${formatCalendarDate(note.reviewDate)}${reviewSuffix}`}
            />
          )}
          {result && (
            <ReadOnlyRow
              label={`Latest result, ${formatCalendarDate(result.date)}`}
              value={`${result.verdict ? `${VERDICT_CONFIG[result.verdict].label}: ` : ""}${result.text}`}
            />
          )}
        </dl>
      </div>
    );
  }

  const setResult = (next: Partial<LatestResult>) => {
    if (!result) return;
    onUpdate({ latestResult: { ...result, ...next } });
  };

  return (
    <div className="space-y-2.5">
      <SectionLabel />

      <label className="block space-y-1">
        <FieldLabel>Measure: what we watch</FieldLabel>
        <EditableField
          value={note.measure ?? ""}
          onCommit={(value) => onUpdate({ measure: value || null })}
          placeholder="e.g. Cost per budget-tool start, by post"
        />
      </label>

      <label className="block space-y-1">
        <FieldLabel>Pass mark: what counts as success</FieldLabel>
        <EditableField
          value={note.passMark ?? ""}
          onCommit={(value) => onUpdate({ passMark: value || null })}
          placeholder="e.g. Below $2 per start"
        />
      </label>

      <label className="block space-y-1">
        <FieldLabel>Review date{reviewSuffix}</FieldLabel>
        <EditableField
          type="date"
          value={note.reviewDate ?? ""}
          onCommit={(value) => onUpdate({ reviewDate: value || null })}
        />
      </label>

      <div className="space-y-1">
        <FieldLabel>Latest result</FieldLabel>
        <EditableField
          multiline
          rows={2}
          value={result?.text ?? ""}
          onCommit={(text) =>
            onUpdate({
              latestResult: text
                ? { date: result?.date ?? todayLocal(), verdict: result?.verdict, text }
                : null,
            })
          }
          placeholder="What did we see?"
          aria-label="Latest result"
        />
        {result && (
          <div className="flex flex-wrap items-center gap-2">
            <EditableField
              type="date"
              value={result.date}
              onCommit={(date) => date && setResult({ date })}
              className="!w-auto py-1 text-xs"
              aria-label="Result date"
            />
            <div className="flex gap-1" role="group" aria-label="Verdict">
              {VERDICTS.map((verdict) => {
                const conf = VERDICT_CONFIG[verdict];
                const active = result.verdict === verdict;
                return (
                  <button
                    key={verdict}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setResult({ verdict: active ? undefined : verdict })}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                      active ? `border-current font-semibold ${conf.text}` : "border-line text-muted hover:bg-surface-2"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel() {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <FlaskConicalIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Test
      </p>
      <p className="text-[11px] text-muted">How we'd know if this is wrong.</p>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
