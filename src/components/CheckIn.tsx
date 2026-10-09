import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ClipboardCheckIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { LatestResult, Verdict } from "../types/canvas";
import { VERDICT_CONFIG, formatCalendarDate, todayLocal } from "../utils/testFields";

export interface PendingCheckIn {
  noteId: string;
  canvasId: string;
  canvasTitle: string;
  text: string;
  measure?: string;
  passMark?: string;
  latestResult?: LatestResult;
  markets?: string[];
}

function errorMessage(err: unknown) {
  const data = (err as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  return err instanceof Error ? err.message.replace(/^.*Uncaught (ConvexError|Error): /, "").split("\n")[0] : "Something went wrong";
}

/** One "any new evidence?" question: No, or Yes with a line (and optionally how it compares with the pass mark). */
export function CheckInCard({
  item,
  onAnswered,
}: {
  item: PendingCheckIn;
  onAnswered?: (hasEvidence: boolean) => void;
}) {
  const answer = useMutation(api.checkIns.answer);
  const [saying, setSaying] = useState(false);
  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (hasEvidence: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await answer({
        noteId: item.noteId as Id<"notes">,
        hasEvidence,
        text: hasEvidence ? text : undefined,
        verdict: hasEvidence ? verdict : undefined,
        date: todayLocal(),
      });
      onAnswered?.(hasEvidence);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const button = "flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors";
  return (
    <article className="space-y-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          <Link href={`/canvas/${item.canvasId}`} className="hover:underline">
            {item.canvasTitle}
          </Link>
          {item.markets?.length ? ` · ${item.markets.join(", ")} only` : ""}
        </p>
        <h2 className="text-base font-semibold leading-snug text-ink">{item.text}</h2>
        {(item.measure || item.passMark) && (
          <p className="text-xs text-muted">
            {item.measure && <>Measure: {item.measure}</>}
            {item.measure && item.passMark && " · "}
            {item.passMark && <>Pass: {item.passMark}</>}
          </p>
        )}
        {item.latestResult && (
          <p className="text-xs text-muted">
            Last result ({formatCalendarDate(item.latestResult.date)}): {item.latestResult.text}
          </p>
        )}
      </div>

      {!saying ? (
        <div className="space-y-1.5">
          <p className="text-sm text-ink">Any new evidence this week?</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void send(false)} className={`${button} border border-line bg-surface text-ink hover:bg-surface-2`}>
              No
            </button>
            <button type="button" disabled={busy} onClick={() => setSaying(true)} className={`${button} bg-ink text-surface hover:opacity-90`}>
              Yes
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(true);
          }}
          className="space-y-2"
        >
          <label className="block space-y-1">
            <span className="text-sm text-ink">What did you see? One line.</span>
            <input
              autoFocus
              value={text}
              maxLength={280}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. $1.40 per start across 12 posts"
              className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          {item.passMark && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Against the pass mark">
              {(Object.keys(VERDICT_CONFIG) as Verdict[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={verdict === v}
                  onClick={() => setVerdict(verdict === v ? undefined : v)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                    verdict === v ? `border-current font-semibold ${VERDICT_CONFIG[v].text}` : "border-line text-muted"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${VERDICT_CONFIG[v].dot}`} />
                  {VERDICT_CONFIG[v].label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !text.trim()} className={`${button} bg-ink text-surface`}>
              Save
            </button>
            <button type="button" onClick={() => setSaying(false)} className={`${button} text-muted hover:text-ink`}>
              Back
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </article>
  );
}

/** "3 check-ins", linking to /check-in. Hidden when there are none. */
export function CheckInsWaitingChip() {
  const pending = useQuery(api.checkIns.myPending);
  if (!pending || pending.length === 0) return null;
  return (
    <Link
      href="/check-in"
      title={`${pending.length} weekly check-in ${pending.length === 1 ? "question" : "questions"} for you`}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink hover:bg-surface-2"
    >
      <ClipboardCheckIcon size={12} aria-hidden="true" />
      {pending.length}
      <span className="hidden sm:inline">{pending.length === 1 ? "check-in" : "check-ins"}</span>
    </Link>
  );
}
