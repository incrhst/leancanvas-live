"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowLeftIcon, CheckCircle2Icon, GavelIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../components/ConvexClientProvider";
import { DecisionAnswer, DecisionCard } from "../../components/NoteDecision";

const ANSWERED_LABEL: Record<DecisionAnswer, string> = {
  approve: "Approved",
  reject: "Rejected",
  change: "Sent back with your comment",
};

/**
 * Every decision waiting on the signed-in person, across canvases, answerable from a phone.
 * Decision request emails link here.
 */
export default function DecisionsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const open = useQuery(api.decisions.myOpenDecisions, user ? {} : "skip");
  const [answered, setAnswered] = useState<{ question: string; answer: DecisionAnswer }[]>([]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?redirect=/decisions");
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
        </Link>
        <h1 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <GavelIcon size={16} aria-hidden="true" />
          Decisions for you
        </h1>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-4">
        {answered.map((a, i) => (
          <p
            key={i}
            className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            <CheckCircle2Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>{ANSWERED_LABEL[a.answer]}:</strong> {a.question}
            </span>
          </p>
        ))}

        {open === undefined ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : open.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
            Nothing waiting on you.
          </p>
        ) : (
          open.map((d) => (
            <DecisionCard
              key={d.noteId}
              decision={d}
              onAnswered={(answer) => setAnswered((prev) => [...prev, { question: d.question, answer }])}
            />
          ))
        )}
      </main>
    </div>
  );
}
