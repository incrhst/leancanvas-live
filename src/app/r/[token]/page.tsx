"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { CheckCircle2Icon, FlaskConicalIcon, LinkIcon } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { formatCalendarDate, todayLocal } from "../../../utils/testFields";
import { convexErrorMessage } from "../../../utils/convexError";
import { Verdict } from "../../../types/canvas";

const VERDICT_CHOICES: { value: Verdict; label: string }[] = [
  { value: "pass", label: "Yes" },
  { value: "fail", label: "No" },
  { value: "inconclusive", label: "Not sure" },
];

/**
 * A result link: send one test result from a phone, with no account and no sign-in. Shows what
 * we watch and what counts as a pass. A link shared from a note takes results as often as the
 * test needs; a link from the weekly check-in email answers that week's question once.
 */
export default function ResultLinkPage() {
  const params = useParams();
  const token = (params?.token as string) || "";
  const link = useQuery(api.resultLinks.getByLink, { token });
  const submit = useMutation(api.resultLinks.submitByLink);
  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<Verdict | undefined>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept here so the thank-you stays put when a check-in link closes behind it
  const [done, setDone] = useState<{ nothingNew: boolean; canvasTitle: string; checkIn: boolean } | null>(null);

  if (link === undefined && !done) {
    return <Shell>{<p className="py-16 text-center text-sm text-muted">Loading…</p>}</Shell>;
  }

  if (done) {
    return (
      <Shell title={done.canvasTitle} checkIn={done.checkIn}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-8 text-center text-emerald-950">
          <CheckCircle2Icon className="h-9 w-9 text-emerald-700" aria-hidden="true" />
          <h1 className="font-display text-xl font-semibold">
            {done.nothingNew ? "Thanks. Noted: nothing new this week." : "Thanks. Your result is in."}
          </h1>
          {!done.nothingNew && (
            <p className="text-[15px]">It goes on the plan once someone running it has checked it.</p>
          )}
        </div>
        {done.checkIn ? (
          <p className="text-center text-xs text-muted">You can close this page. This week's link has done its job.</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setText("");
              setVerdict(undefined);
            }}
            className="flex w-full min-h-[44px] items-center justify-center text-[15px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Send another result
          </button>
        )}
      </Shell>
    );
  }

  if (link === null || link === undefined) {
    return (
      <Shell>
        <div className="space-y-2 rounded-2xl border border-line bg-surface px-5 py-8 text-center">
          <LinkIcon className="mx-auto h-7 w-7 text-muted" aria-hidden="true" />
          <h1 className="font-display text-lg font-semibold text-ink">This link no longer works</h1>
          <p className="text-sm text-muted">
            It may have been turned off, or a newer link was sent. Ask whoever sent it for a new one.
          </p>
        </div>
      </Shell>
    );
  }

  const checkIn = link.kind === "check_in";

  const send = async (nothingNew = false) => {
    if (!nothingNew && !text.trim()) {
      setError("Type what you saw, then press Send.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submit({
        token,
        ...(nothingNew
          ? { nothingNew: true }
          : { text: text.trim(), verdict, name: name.trim() || undefined, date: todayLocal() }),
      });
      setDone({ nothingNew, canvasTitle: link.canvasTitle, checkIn });
    } catch (err) {
      setError(convexErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const heading = link.measure ?? link.noteText;
  const primary =
    "w-full min-h-[52px] rounded-xl bg-ink px-4 py-3 text-base font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50";
  const field =
    "min-h-[48px] w-full rounded-xl border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <Shell title={link.canvasTitle} from={checkIn ? undefined : link.personName} checkIn={checkIn}>
      <section aria-labelledby="measure" className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {checkIn ? `Weekly check-in for ${link.personName}` : "Test result"}
          {link.reviewDate && ` · review ${formatCalendarDate(link.reviewDate)}`}
        </p>
        <h1 id="measure" className="font-display text-[22px] font-semibold leading-snug text-ink">
          {checkIn ? "Any new evidence this week?" : link.measure ? `What did you see for ${heading}?` : heading}
        </h1>
        <dl className="space-y-2 rounded-xl bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-ink">
          {link.measure && (
            <div>
              <dt className="text-xs font-medium text-muted">We watch</dt>
              <dd className="font-semibold">{link.measure}</dd>
            </div>
          )}
          {link.passMark && (
            <div>
              <dt className="text-xs font-medium text-muted">It passes if</dt>
              <dd className="font-semibold">{link.passMark}</dd>
            </div>
          )}
          {link.noteText !== heading && (
            <div>
              <dt className="text-xs font-medium text-muted">Because we believe</dt>
              <dd>{link.noteText}</dd>
            </div>
          )}
        </dl>
      </section>

      <form
        aria-label="Your result"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="result" className="block text-sm font-medium text-ink">
            {checkIn ? "What's new? A number or a line" : "Result: a number or a line"}
          </label>
          <input
            id="result"
            type="text"
            value={text}
            maxLength={280}
            autoComplete="off"
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 23 sign-ups"
            className={field}
          />
        </div>

        {link.passMark && (
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-ink">Did it pass? (optional)</legend>
            <div className="grid grid-cols-3 gap-2">
              {VERDICT_CHOICES.map((c) => {
                const active = verdict === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setVerdict(active ? undefined : c.value)}
                    className={`min-h-[48px] rounded-xl px-2 text-[15px] transition-colors ${
                      active
                        ? "border-2 border-ink bg-surface font-semibold text-ink"
                        : "border border-line bg-surface text-ink/80 hover:bg-surface-2"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <label className="flex items-center gap-3">
          <span className="shrink-0 text-sm text-muted">Your name</span>
          <input
            type="text"
            value={name}
            maxLength={80}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            placeholder={checkIn ? `${link.personName} (optional)` : "Optional"}
            className={field}
          />
        </label>

        <button type="submit" disabled={busy} className={primary}>
          Send result
        </button>
        {checkIn && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(true)}
            className="w-full min-h-[52px] rounded-xl border border-line bg-surface px-4 py-3 text-base font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            Nothing new this week
          </button>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}
      </form>

      <p className="text-center text-xs leading-relaxed text-muted">
        No account needed. Results from this link are checked before they go on the plan.
        {checkIn ? " This link answers this week's question only." : ""}
      </p>
    </Shell>
  );
}

function Shell({
  title,
  from,
  checkIn,
  children,
}: {
  title?: string;
  from?: string;
  checkIn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-surface">
          <FlaskConicalIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-ink">{title || "LeanOn"}</span>
          <span className="block truncate text-xs text-muted">
            {checkIn ? "Your weekly check-in" : from ? `A result for ${from}` : "A test result"}
          </span>
        </span>
      </header>
      <main className="mx-auto max-w-md space-y-5 px-4 pb-10 pt-5">{children}</main>
    </div>
  );
}
