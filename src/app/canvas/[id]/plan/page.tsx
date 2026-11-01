"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowLeftIcon, CheckIcon, PauseCircleIcon, SparklesIcon, ZapIcon } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useAuth } from "../../../../components/ConvexClientProvider";
import { formatCalendarDate } from "../../../../utils/testFields";
import { daysLeft } from "../../../../utils/plan";

const IN_A_LIVE_PLAN = [
  "Tests with a measure, a pass mark and a review date",
  "Weekly check-ins that ask each driver for new evidence",
  "Decision requests the decider answers from their phone",
  "Snapshots, and what changed between them",
  "The review page for review meetings",
];

const ALWAYS_FREE = [
  "The canvas, its notes and evidence states",
  "Stress tests, share links and exports",
  "Inviting anyone, at any role",
  "Answering a decision or a check-in",
];

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * A canvas's live plan: where it stands, what it has done so far, and what keeping it running
 * costs. Any member can see it; only the canvas's creator pays.
 */
export default function PlanPage() {
  const params = useParams();
  const router = useRouter();
  const canvasId = params?.id as Id<"canvases">;
  const { user, isLoading } = useAuth();
  const info = useQuery(api.billing.forCanvas, user ? { canvasId } : "skip");

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?redirect=/canvas/${canvasId}/plan`);
  }, [isLoading, user, router, canvasId]);

  if (info === undefined) {
    return <div className="flex h-screen items-center justify-center bg-canvas text-xs text-muted">Loading plan…</div>;
  }
  if (info === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-sm text-muted">
        This canvas doesn't exist or you don't have access to it.
      </div>
    );
  }

  const { plan, value } = info;
  const price = Math.round(info.priceUsd * (1 - info.discountPercent / 100));
  const daysLive = plan ? Math.max(1, Math.floor((Date.now() - plan.liveSince) / (24 * 60 * 60 * 1000))) : 0;
  const freeForGood = plan?.status === "active" && !!plan.grant && !plan.paidUntil;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Link
          href={`/canvas/${canvasId}`}
          aria-label="Back to the canvas"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold text-ink">{info.title}</h1>
          <p className="text-xs text-muted">Plan</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section className="space-y-2 rounded-xl border border-line bg-surface p-5">
          {!plan && (
            <>
              <h2 className="font-display text-lg font-semibold text-ink">This canvas is free</h2>
              <p className="text-sm text-muted">
                It becomes a live plan when someone sets a launch date, adds a test, asks for a decision or takes a
                snapshot.
                {info.trialAvailable && ` Your first live plan runs free for ${info.trialDays} days.`}
              </p>
            </>
          )}
          {plan?.status === "trial" && plan.trialEndsAt && (
            <>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                <SparklesIcon size={18} className="text-accent" aria-hidden="true" />
                Free trial · {plural(daysLeft(plan.trialEndsAt), "day")} left
              </h2>
              <p className="text-sm text-muted">
                The trial ends on {formatCalendarDate(isoDate(plan.trialEndsAt))}. After that, check-ins stop and the
                review locks until the plan is paid for.
              </p>
            </>
          )}
          {plan?.status === "active" && (
            <>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                <ZapIcon size={18} className="text-accent" aria-hidden="true" />
                {freeForGood ? "Live plan, free" : "Live plan"}
              </h2>
              <p className="text-sm text-muted">
                {plan.paidUntil
                  ? `Running until ${formatCalendarDate(isoDate(plan.paidUntil))}.`
                  : plan.grant === "founding"
                    ? "One of your founding member plans. It runs with no end date."
                    : "It runs with no end date."}
              </p>
            </>
          )}
          {plan?.status === "paused" && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <PauseCircleIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <h2 className="font-display text-base font-semibold">The plan is paused</h2>
                <p className="text-sm">
                  {plan.trialEndsAt && !plan.paidUntil ? "Its free trial has ended." : "Its paid period has ended."}{" "}
                  The canvas and its history are all still here. Tests are visible but don't run, check-ins stop and
                  the review is locked. Open decisions can still be answered.
                </p>
              </div>
            </div>
          )}
        </section>

        {plan && (
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-ink">
              In {plural(daysLive, "day")}, this plan has
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Tests set" value={value.tests} />
              <Stat label="Results in" value={value.results} />
              <Stat label="Backed by evidence" value={value.supported} />
              <Stat label="Contradicted" value={value.contradicted} hint="Caught before you built on them" />
              <Stat label="Decisions made" value={value.decisionsMade} />
              <Stat label="Check-ins answered" value={value.checkInsAnswered} />
            </div>
          </section>
        )}

        {!freeForGood && (
          <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-ink">Keep it running</h2>
              <p className="text-ink">
                <span className="font-display text-2xl font-semibold">${price}</span>
                <span className="text-sm text-muted"> a month, for this plan</span>
                {info.discountPercent > 0 && (
                  <span className="ml-2 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink">
                    {info.discountPercent}% off
                  </span>
                )}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <List title="A live plan runs" items={IN_A_LIVE_PLAN} />
              <List title="Always free" items={ALWAYS_FREE} />
            </div>
            <p className="text-sm text-muted">
              You pay per live plan, not per person, so bringing in the decider, drivers and operators costs nothing.
            </p>
            {info.isCreator ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white opacity-60"
                >
                  Pay by card
                </button>
                <span className="text-sm text-muted">Card payments open soon.</span>
              </div>
            ) : (
              <p className="text-sm text-muted">The person who created this canvas pays for its plan.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="font-display text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {hint && value > 0 && <div className="mt-1 text-[11px] text-subtle">{hint}</div>}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink">
            <CheckIcon size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
