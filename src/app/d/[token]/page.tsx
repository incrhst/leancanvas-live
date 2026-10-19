"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { CheckCircle2Icon, GavelIcon, LinkIcon, MessageSquareIcon } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { formatLongDate, isPastDue } from "../../../../convex/lib/decisionText";
import { DecisionAnswer, DecisionDefault, outcomeLabel } from "../../../components/NoteDecision";
import { todayLocal } from "../../../utils/testFields";
import { convexErrorMessage } from "../../../utils/convexError";
import { DecisionStatus } from "../../../types/canvas";

const ANSWERED: Record<Exclude<DecisionAnswer, "choose">, string> = {
  approve: "You approved it.",
  reject: "You rejected it.",
  change: "You asked for a change. It goes back with your comment.",
};

/**
 * The decision link from the request email: one question, answered from a phone with no account
 * and no sign-in. Shows the deadline and what happens if nobody decides.
 */
export default function DecisionLinkPage() {
  const params = useParams();
  const token = (params?.token as string) || "";
  const decision = useQuery(api.decisions.getByLink, { token });
  const answerByLink = useMutation(api.decisions.answerByLink);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [askingChange, setAskingChange] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept here so the thank-you stays put once the link closes behind it
  const [done, setDone] = useState<string | null>(null);

  if (decision === undefined) {
    return <Shell>{<p className="py-16 text-center text-sm text-muted">Loading…</p>}</Shell>;
  }

  if (done) {
    return (
      <Shell title={decision?.canvasTitle}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-8 text-center text-emerald-950">
          <CheckCircle2Icon className="h-9 w-9 text-emerald-700" aria-hidden="true" />
          <h1 className="font-display text-xl font-semibold">Thanks. Your answer is in.</h1>
          <p className="text-[15px]">{done}</p>
          {decision && <p className="text-sm text-emerald-900">{decision.requestedBy} can see it on the plan now.</p>}
        </div>
        <p className="text-center text-xs text-muted">You can close this page. The link has done its job and won't work again.</p>
      </Shell>
    );
  }

  if (decision === null) {
    return (
      <Shell>
        <div className="space-y-2 rounded-2xl border border-line bg-surface px-5 py-8 text-center">
          <LinkIcon className="mx-auto h-7 w-7 text-muted" aria-hidden="true" />
          <h1 className="font-display text-lg font-semibold text-ink">This link no longer works</h1>
          <p className="text-sm text-muted">
            The request may have been withdrawn, or a newer link was sent. Ask whoever sent it for a new one.
          </p>
        </div>
      </Shell>
    );
  }

  const today = todayLocal();
  const by = formatLongDate(decision.dueDate, Number(today.slice(0, 4)));

  if (decision.status !== "open") {
    return (
      <Shell title={decision.canvasTitle}>
        <div className="space-y-2 rounded-2xl border border-line bg-surface px-5 py-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Already answered</p>
          <h1 className="text-lg font-semibold leading-snug text-ink">{decision.question}</h1>
          <p className="text-[15px] font-semibold text-ink">
            {outcomeLabel({ status: decision.status as DecisionStatus, choice: decision.choice })}
          </p>
          <p className="text-sm text-muted">There's nothing more to do here.</p>
        </div>
      </Shell>
    );
  }

  const send = async (answer: DecisionAnswer, choice?: string) => {
    if (answer === "change" && !comment.trim()) {
      setError("Say what should change, then press Send.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await answerByLink({
        token,
        answer,
        choice,
        comment: comment.trim() || undefined,
        name: name.trim() || undefined,
      });
      setDone(answer === "choose" ? `You chose “${choice}”.` : ANSWERED[answer]);
    } catch (err) {
      setError(convexErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const overdue = isPastDue(decision.dueDate, today);
  const primary =
    "w-full min-h-[52px] rounded-xl bg-ink px-4 py-3 text-base font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50";
  const secondary =
    "w-full min-h-[52px] rounded-xl border border-line bg-surface px-4 py-3 text-base font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50";
  const choices = decision.options
    ? decision.options.map((option) => ({ label: option, answer: "choose" as const, choice: option }))
    : [
        { label: "Approve", answer: "approve" as const, choice: undefined },
        { label: "Reject", answer: "reject" as const, choice: undefined },
      ];

  return (
    <Shell title={decision.canvasTitle} from={decision.requestedBy}>
      <section aria-labelledby="question" className="space-y-3">
        <p className={`font-mono text-[11px] uppercase tracking-wider ${overdue ? "text-amber-800" : "text-muted"}`}>
          {overdue ? `Was needed by ${by}` : `Decision needed by ${by}`}
        </p>
        <h1 id="question" className="font-display text-[22px] font-semibold leading-snug text-ink">
          {decision.question}
        </h1>
        {decision.noteText !== decision.question && (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-ink">{decision.noteText}</p>
        )}
        <DecisionDefault decision={{ ...decision, status: "open" }} size="lg" />
        {overdue && decision.defaultOutcome && (
          <p className="text-sm text-muted">You can still answer. Your answer replaces the default.</p>
        )}
      </section>

      <section aria-label="Your answer" className="space-y-2.5">
        <label className="flex items-center gap-3">
          <span className="shrink-0 text-sm text-muted">Your name</span>
          <input
            type="text"
            value={name}
            maxLength={80}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            placeholder={`${decision.deciderName} (optional)`}
            className="min-h-[44px] w-full rounded-xl border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        {choices.map((c, i) => (
          <button
            key={c.label}
            type="button"
            disabled={busy}
            onClick={() => void send(c.answer, c.choice)}
            className={i === 0 ? primary : secondary}
          >
            {c.label}
          </button>
        ))}

        {askingChange ? (
          <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <label htmlFor="comment" className="block text-sm font-medium text-ink">
              What should change?
            </label>
            <textarea
              id="comment"
              rows={3}
              autoFocus
              value={comment}
              maxLength={500}
              onChange={(e) => setComment(e.target.value)}
              className="w-full resize-none rounded-lg border border-line bg-surface p-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button type="button" disabled={busy} onClick={() => void send("change")} className={primary}>
              Send
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAskingChange(true)}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 text-[15px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            <MessageSquareIcon className="h-4 w-4" aria-hidden="true" />
            Something else? Ask for a change
          </button>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}
      </section>

      <p className="text-center text-xs leading-relaxed text-muted">
        Sent to {decision.deciderName}. No login needed: this link answers only this question, and stops working once
        it's answered.
      </p>
    </Shell>
  );
}

function Shell({ title, from, children }: { title?: string; from?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-surface">
          <GavelIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-ink">{title || "LeanOn"}</span>
          <span className="block truncate text-xs text-muted">{from ? `One question from ${from}` : "A decision"}</span>
        </span>
      </header>
      <main className="mx-auto max-w-md space-y-5 px-4 pb-10 pt-5">{children}</main>
    </div>
  );
}
