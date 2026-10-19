import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { CheckIcon, CopyIcon, InboxIcon, LinkIcon, MailIcon, MessageCircleIcon, Share2Icon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { NoteItem, Verdict } from "../types/canvas";
import { VERDICT_CONFIG, formatCalendarDate } from "../utils/testFields";
import { convexErrorMessage } from "../utils/convexError";

const VERDICTS: Verdict[] = ["pass", "fail", "inconclusive"];

const textButton =
  "min-h-9 rounded-md px-2 text-[13px] text-ink/80 hover:bg-surface-2 hover:text-ink transition-colors disabled:opacity-50";
const primaryButton =
  "min-h-10 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const outlineButton =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-surface-2";

/** What gets pasted into WhatsApp or an email along with the link. */
export function resultLinkMessage(note: Pick<NoteItem, "measure" | "passMark" | "content">, url: string) {
  const what = note.measure ? `the result for ${note.measure}` : `a result for “${note.content}”`;
  const pass = note.passMark ? ` It passes if ${note.passMark}.` : "";
  return `Can you send ${what}?${pass} No account needed, just tap: ${url}`;
}

/**
 * Results from a note's result link, and the link itself (editors only). Results sent from a link
 * wait here until accepted or rejected; accepting makes one the note's latest result and leaves
 * the evidence state for the test card to ask about.
 */
export function NoteResultLink({ note }: { note: NoteItem }) {
  const noteId = note._id as Id<"notes">;
  const data = useQuery(api.resultLinks.forNote, { noteId });
  if (!data) return null;
  return (
    <div className="space-y-3">
      {data.pending.map((p) => (
        <PendingResult key={p._id} result={p} />
      ))}
      <ShareLink note={note} token={data.token} />
    </div>
  );
}

type Pending = NonNullable<FunctionReturnType<typeof api.resultLinks.forNote>>["pending"][number];

function PendingResult({ result }: { result: Pending }) {
  const accept = useMutation(api.resultLinks.accept);
  const reject = useMutation(api.resultLinks.reject);
  const [verdict, setVerdict] = useState<Verdict | undefined>(result.verdict);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(convexErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div
      role="group"
      aria-label="Result sent from a link, waiting for you"
      className="space-y-2.5 rounded-lg border border-sky-300 bg-sky-50/70 p-3"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-900">
        <InboxIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        New result via link, no account
      </p>
      <p className="text-sm font-semibold leading-snug text-ink break-words">{result.text}</p>
      <p className="text-xs text-muted">
        {result.name ? `From “${result.name}”` : "No name given"} · {formatCalendarDate(result.date)}
        {result.verdict && ` · they say ${VERDICT_CONFIG[result.verdict].label.toLowerCase()}`}
      </p>
      <div role="group" aria-label="Verdict to record" className="grid grid-cols-3 gap-1.5">
        {VERDICTS.map((v) => {
          const conf = VERDICT_CONFIG[v];
          const active = verdict === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              onClick={() => setVerdict(active ? undefined : v)}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-1 text-xs transition-colors ${
                active
                  ? `border-2 border-current bg-surface font-semibold ${conf.text}`
                  : "border border-line bg-surface text-ink/80 hover:bg-surface-2"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${conf.dot}`} aria-hidden="true" />
              {conf.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => accept({ submissionId: result._id, verdict: verdict ?? null }))}
          className={primaryButton}
        >
          Accept result
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => reject({ submissionId: result._id }))}
          className={textButton}
        >
          Reject
        </button>
      </div>
      <p className="text-[11px] text-muted">Accepting doesn't change how sure we are. You decide that next.</p>
      {error && <p className="text-[11px] text-rose-700">{error}</p>}
    </div>
  );
}

function ShareLink({ note, token }: { note: NoteItem; token: string | null }) {
  const replaceLink = useMutation(api.resultLinks.replaceLink);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);

  const change = async (off: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await replaceLink({ noteId: note._id as Id<"notes">, off });
    } catch (err) {
      setError(convexErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-1.5">
        <button type="button" disabled={busy} onClick={() => change(false)} className={outlineButton}>
          <LinkIcon className="h-4 w-4" aria-hidden="true" />
          Get a link for results
        </button>
        <p className="text-[11px] leading-relaxed text-muted">
          Anyone with the link can send a result from their phone, no account. You check each one before it counts.
        </p>
        {error && <p className="text-[11px] text-rose-700">{error}</p>}
      </div>
    );
  }

  const url = `${window.location.origin}/r/${token}`;
  const message = resultLinkMessage(note, url);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <LinkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Result link · no account needed
      </p>
      <div className="flex gap-1.5">
        <input
          readOnly
          value={url}
          aria-label="Result link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
        />
        <button type="button" onClick={copy} className={outlineButton}>
          {copied ? <CheckIcon className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <CopyIcon className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ text: message }).catch(() => {})}
            className={outlineButton}
          >
            <Share2Icon className="h-4 w-4" aria-hidden="true" />
            Share
          </button>
        )}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={outlineButton}
        >
          <MessageCircleIcon className="h-4 w-4" aria-hidden="true" />
          WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent("Can you send a result?")}&body=${encodeURIComponent(message)}`}
          className={outlineButton}
        >
          <MailIcon className="h-4 w-4" aria-hidden="true" />
          Email
        </a>
      </div>
      <div className="-ml-2 flex flex-wrap gap-1">
        <button type="button" disabled={busy} onClick={() => change(false)} className={textButton}>
          New link
        </button>
        <button type="button" disabled={busy} onClick={() => change(true)} className={textButton}>
          Turn off
        </button>
      </div>
      <p className="text-[11px] text-muted">A new link or turning it off stops the old one working.</p>
      {error && <p className="text-[11px] text-rose-700">{error}</p>}
    </div>
  );
}
