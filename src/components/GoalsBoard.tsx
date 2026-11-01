"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import {
  BookOpenCheckIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  FlaskConicalIcon,
  HistoryIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { GoalsView } from "../../convex/lib/goals";
import {
  DECISION_BASES,
  DECISION_BASIS_LABELS,
  DecisionBasis,
  ITEM_STATE_LABELS,
  ITEM_STATE_MEANINGS,
  ITEM_STATES,
  ItemState,
  LOOK_BACK_ANSWERS,
  LOOK_BACK_LABELS,
  LookBack,
} from "../../convex/lib/goalModel";
import { daysBetween, testStage } from "../../convex/lib/testFields";
import { EditableField } from "./EditableField";
import { formatCalendarDate, localDate, todayLocal, VERDICT_CONFIG } from "../utils/testFields";

type Goal = GoalsView["goals"][number];
type Item = Goal["items"][number];
type Decision = NonNullable<Item["decision"]>;

const STATE_STYLE: Record<ItemState, { icon: React.ElementType; chip: string; bar: string; dot: string }> = {
  open: {
    icon: CircleDashedIcon,
    chip: "border-stone-300 bg-stone-100 text-stone-700",
    // The open part of a goal's bar looks foggy: a dashed, hazy patch rather than a solid fill
    bar: "border border-dashed border-stone-400 bg-stone-200/70",
    dot: "border-2 border-stone-400 bg-transparent",
  },
  testing: { icon: FlaskConicalIcon, chip: "border-amber-300 bg-amber-50 text-amber-900", bar: "bg-amber-400/70", dot: "bg-amber-400" },
  decided: { icon: CircleCheckIcon, chip: "border-teal-300 bg-teal-50 text-teal-900", bar: "bg-teal-500/70", dot: "bg-teal-500" },
  done: { icon: CheckCheckIcon, chip: "border-emerald-300 bg-emerald-50 text-emerald-900", bar: "bg-emerald-600/80", dot: "bg-emerald-600" },
};

/**
 * Fog is felt, never explained: open items sit in a haze, testing ones are partly clear, decided
 * and done ones are sharp. The haze lifts on hover or focus so nothing is ever hard to read.
 */
const FOG: Record<ItemState, string> = {
  open: "[&_.fog-text]:blur-[0.6px] [&_.fog-text]:opacity-60",
  testing: "[&_.fog-text]:blur-[0.25px] [&_.fog-text]:opacity-80",
  decided: "",
  done: "",
};

const inputClass =
  "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none";
const buttonClass =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2 disabled:opacity-50";
const primaryButtonClass =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-surface hover:opacity-90 disabled:opacity-50";

export function StateChip({ state }: { state: ItemState }) {
  const { icon: Icon, chip } = STATE_STYLE[state];
  return (
    <span
      title={ITEM_STATE_MEANINGS[state]}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium ${chip}`}
    >
      <Icon size={12} aria-hidden="true" />
      {ITEM_STATE_LABELS[state]}
    </span>
  );
}

/** "due in 6 days", "due today", "2 days late" */
function dueIn(date: string) {
  const days = daysBetween(todayLocal(), date);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days > 0) return `due in ${days} days`;
  return days === -1 ? "1 day late" : `${-days} days late`;
}

/** The bar fills by state, open first; the open part looks foggy. Then the counts in words. */
function GoalHeadline({ goal }: { goal: Goal }) {
  const total = ITEM_STATES.reduce((sum, s) => sum + goal.counts[s], 0);
  return (
    <div className="space-y-2">
      {total > 0 && (
        <div className="flex h-4 w-full gap-px overflow-hidden rounded" aria-hidden="true">
          {ITEM_STATES.map((s) =>
            goal.counts[s] ? (
              <div key={s} className={`${STATE_STYLE[s].bar} first:rounded-l last:rounded-r`} style={{ width: `${(goal.counts[s] / total) * 100}%` }} />
            ) : null
          )}
        </div>
      )}
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink" aria-label={goal.headline}>
        {ITEM_STATES.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className="text-subtle">·</span>}
            <span>
              <span className="font-semibold tabular-nums">{goal.counts[s]}</span> {s}
            </span>
          </React.Fragment>
        ))}
        {goal.reached && (
          <span className="ml-1 inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900">
            <CheckCheckIcon size={12} aria-hidden="true" /> Reached
          </span>
        )}
      </p>
    </div>
  );
}

function DecisionRecord({ decision, superseded }: { decision: Decision; superseded?: boolean }) {
  return (
    <div className={`rounded-md border p-2.5 text-xs ${superseded ? "border-line bg-surface-2 text-muted" : "border-teal-200 bg-teal-50/50 text-ink"}`}>
      <p className={`text-sm ${superseded ? "line-through decoration-subtle" : "font-medium"}`}>{decision.text}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted">Based on</dt>
        <dd>
          {DECISION_BASIS_LABELS[decision.basis as DecisionBasis]}
          {decision.basisNote && <span className="text-muted">: {decision.basisNote}</span>}
        </dd>
        {decision.testSnapshot?.resultText && (
          <>
            <dt className="text-muted">Test</dt>
            <dd>
              {decision.testSnapshot.resultText}
              {decision.testSnapshot.verdict && (
                <span className="text-muted"> ({decision.testSnapshot.verdict})</span>
              )}
            </dd>
          </>
        )}
        <dt className="text-muted">Decided</dt>
        <dd>
          {decision.decidedBy}, {formatCalendarDate(localDate(decision.decidedAt))}
          {decision.via === "mcp" && <span className="text-muted"> (via {decision.clientName ?? "an agent"})</span>}
        </dd>
        <dt className="text-muted">Look back</dt>
        <dd>
          {decision.outcome ? (
            <>
              Panned out: <span className="font-medium">{LOOK_BACK_LABELS[decision.outcome as LookBack]}</span>
              {decision.outcomeNote && <span className="text-muted">. {decision.outcomeNote}</span>}
            </>
          ) : (
            formatCalendarDate(decision.reviewDate)
          )}
        </dd>
        {decision.linkedNotes.length > 0 && (
          <>
            <dt className="text-muted">Informed by</dt>
            <dd>{decision.linkedNotes.map((n) => n.text).join("; ")}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function DecideForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const decide = useMutation(api.goals.decide);
  const [text, setText] = useState("");
  const [basis, setBasis] = useState<DecisionBasis>(item.latestResult ? "test" : "judgment");
  const [basisNote, setBasisNote] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await decide({
        itemId: item.itemId,
        text,
        basis,
        basisNote: basisNote || undefined,
        reviewDate: reviewDate || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^.*Uncaught (ConvexError|Error): /, "").split("\n")[0] : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border border-line bg-surface-2 p-2.5">
      <label className="block text-xs font-medium text-ink">
        What was decided?
        <input className={`${inputClass} mt-1`} value={text} onChange={(e) => setText(e.target.value)} required autoFocus />
      </label>
      <fieldset>
        <legend className="text-xs font-medium text-ink">Based on</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DECISION_BASES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBasis(b)}
              disabled={b === "test" && !item.latestResult}
              title={b === "test" && !item.latestResult ? "Record a test result first" : undefined}
              className={`${basis === b ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink"} rounded-md border px-2 py-1 text-xs disabled:opacity-40`}
            >
              {DECISION_BASIS_LABELS[b]}
            </button>
          ))}
        </div>
      </fieldset>
      <input
        className={inputClass}
        placeholder="Optional: which data, whose view, why"
        value={basisNote}
        onChange={(e) => setBasisNote(e.target.value)}
      />
      <label className="block text-xs text-muted">
        Ask whether it panned out on (default: in 30 days)
        <input type="date" className={`${inputClass} mt-1`} value={reviewDate} min={todayLocal()} onChange={(e) => setReviewDate(e.target.value)} />
      </label>
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass} disabled={saving || !text.trim()}>
          <CircleCheckIcon size={13} /> Decide
        </button>
        <button type="button" className={buttonClass} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LookBackForm({ item }: { item: Item }) {
  const lookBack = useMutation(api.goals.lookBack);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-violet-950">
        <HistoryIcon size={13} aria-hidden="true" /> Did it pan out?
      </p>
      <input className={inputClass} placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-1.5">
        {LOOK_BACK_ANSWERS.map((a) => (
          <button
            key={a}
            type="button"
            className={buttonClass}
            onClick={() => lookBack({ itemId: item.itemId, outcome: a, note: note || undefined })}
          >
            {LOOK_BACK_LABELS[a]}
          </button>
        ))}
      </div>
    </div>
  );
}

function TestFields({ item, canEdit }: { item: Item; canEdit: boolean }) {
  const editItem = useMutation(api.goals.editItem);
  const hasTest = !!(item.measure || item.passMark || item.reviewDate || item.latestResult);
  const [open, setOpen] = useState(hasTest);
  const undecided = item.state === "open" || item.state === "testing";

  if (!canEdit || !undecided) {
    if (!hasTest) return null;
    return (
      <div className="text-xs text-muted">
        <span className="font-medium text-ink">Test:</span> {item.measure ?? "—"}
        {item.passMark && <> · pass at {item.passMark}</>}
        {item.reviewDate && <> · check {formatCalendarDate(item.reviewDate)}</>}
        {item.latestResult && (
          <>
            {" "}
            · latest: {item.latestResult.text}
            {item.latestResult.verdict && (
              <span className={VERDICT_CONFIG[item.latestResult.verdict].text}> ({VERDICT_CONFIG[item.latestResult.verdict].label})</span>
            )}
          </>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        <FlaskConicalIcon size={13} /> Add a test
      </button>
    );
  }

  return (
    <div className="grid gap-1.5 rounded-md border border-amber-200 bg-amber-50/50 p-2.5 sm:grid-cols-2">
      <label className="text-xs text-muted">
        What we watch
        <EditableField className={inputClass} value={item.measure ?? ""} onCommit={(v) => editItem({ itemId: item.itemId, measure: v || null })} placeholder="e.g. Signups per week" />
      </label>
      <label className="text-xs text-muted">
        What counts as success
        <EditableField className={inputClass} value={item.passMark ?? ""} onCommit={(v) => editItem({ itemId: item.itemId, passMark: v || null })} placeholder="e.g. 50 or more" />
      </label>
      <label className="text-xs text-muted">
        Check on
        <EditableField type="date" className={inputClass} value={item.reviewDate ?? ""} onCommit={(v) => editItem({ itemId: item.itemId, reviewDate: v || null })} />
      </label>
      <label className="text-xs text-muted">
        Latest result
        <EditableField
          className={inputClass}
          value={item.latestResult?.text ?? ""}
          onCommit={(v) => editItem({ itemId: item.itemId, latestResult: v ? { text: v } : null })}
          placeholder="What you saw"
        />
      </label>
      {item.latestResult && (
        <div className="flex gap-1.5 sm:col-span-2">
          {(["pass", "fail", "inconclusive"] as const).map((verdict) => (
            <button
              key={verdict}
              type="button"
              onClick={() => editItem({ itemId: item.itemId, latestResult: { text: item.latestResult!.text, date: item.latestResult!.date, verdict } })}
              className={`${item.latestResult?.verdict === verdict ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink"} rounded-md border px-2 py-0.5 text-xs`}
            >
              {VERDICT_CONFIG[verdict].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The line on the right of an item: who and when for open ones, the test date, or the basis. */
function itemMeta(item: Item, today: string) {
  if (item.state === "open") {
    const parts = [item.driver ?? (item.decideBy ? undefined : "unassigned"), item.decideBy && `decide by ${formatCalendarDate(item.decideBy)}`];
    return parts.filter(Boolean).join(" · ");
  }
  if (item.state === "testing") {
    if (testStage(item, today) === "result") return "result in, ready to decide";
    return item.reviewDate ? `test reports ${formatCalendarDate(item.reviewDate)}` : "test running";
  }
  return item.decision ? `based on: ${DECISION_BASIS_LABELS[item.decision.basis as DecisionBasis].toLowerCase()}` : "";
}

function ItemRow({
  item,
  goals,
  canEdit,
  expanded,
  onToggle,
}: {
  item: Item;
  goals: Goal[];
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [deciding, setDeciding] = useState(false);
  const editItem = useMutation(api.goals.editItem);
  const markDone = useMutation(api.goals.markDone);
  const reopen = useMutation(api.goals.reopen);
  const removeItem = useMutation(api.goals.removeItem);
  const fromItem = useMutation(api.runbooks.fromItem);
  const [runbookMade, setRunbookMade] = useState(false);
  const undecided = item.state === "open" || item.state === "testing";
  const meta = itemMeta(item, todayLocal());

  return (
    <li
      id={`item-${item.itemId}`}
      className={`rounded-md ${expanded ? "border border-line bg-surface" : ""} focus-within:[&_.fog-text]:opacity-100 focus-within:[&_.fog-text]:blur-0 hover:[&_.fog-text]:opacity-100 hover:[&_.fog-text]:blur-0 ${FOG[item.state]}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATE_STYLE[item.state].dot}`} aria-hidden="true" />
        <span className="fog-text min-w-0 flex-1 text-sm text-ink transition-[filter,opacity] duration-300">
          {item.title}
          {item.decision && item.decision.text !== item.title && (
            <span className="text-muted">: {item.decision.text}</span>
          )}
        </span>
        {item.lookBackDue && (
          <span className="inline-flex items-center gap-1 rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-900">
            <HistoryIcon size={12} aria-hidden="true" /> Look back
          </span>
        )}
        {meta && <span className="hidden shrink-0 text-xs text-muted sm:inline">{meta}</span>}
        {expanded ? <ChevronDownIcon size={14} className="shrink-0 text-muted" /> : <ChevronRightIcon size={14} className="shrink-0 text-muted" />}
      </button>

      {expanded && (
        <div className="space-y-2.5 border-t border-line px-2.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <StateChip state={item.state} />
            {meta && <span className="text-xs text-muted sm:hidden">{meta}</span>}
          </div>
          {canEdit ? (
            <EditableField
              className={inputClass}
              multiline
              rows={2}
              value={item.detail ?? ""}
              placeholder="Detail: what's unknown, what would settle it"
              onCommit={(v) => editItem({ itemId: item.itemId, detail: v || null })}
            />
          ) : (
            item.detail && <p className="text-sm text-ink">{item.detail}</p>
          )}

          {canEdit && undecided && (
            <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted">
              Decide by
              <EditableField
                type="date"
                className="w-40 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
                value={item.decideBy ?? ""}
                onCommit={(v) => editItem({ itemId: item.itemId, decideBy: v || null })}
              />
            </label>
          )}

          <TestFields item={item} canEdit={canEdit} />

          {item.contextNotes.length > 0 && (
            <div className="text-xs">
              <p className="font-medium text-ink">Context from the canvas</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                {item.contextNotes.map((n) => (
                  <li key={n.noteId}>{n.text}</li>
                ))}
              </ul>
            </div>
          )}

          {item.decision && <DecisionRecord decision={item.decision} />}
          {canEdit && item.lookBackDue && <LookBackForm item={item} />}
          {item.earlierDecisions.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">Earlier calls ({item.earlierDecisions.length})</summary>
              <div className="mt-1.5 space-y-1.5">
                {item.earlierDecisions.map((d) => (
                  <DecisionRecord key={d.recordId} decision={d} superseded />
                ))}
              </div>
            </details>
          )}

          {canEdit && deciding && <DecideForm item={item} onDone={() => setDeciding(false)} />}

          {canEdit && !deciding && (
            <div className="flex flex-wrap items-center gap-1.5">
              {undecided && (
                <button type="button" className={primaryButtonClass} onClick={() => setDeciding(true)}>
                  <CircleCheckIcon size={13} /> Make the call
                </button>
              )}
              {item.state === "decided" && (
                <button type="button" className={primaryButtonClass} onClick={() => markDone({ itemId: item.itemId })}>
                  <CheckCheckIcon size={13} /> Mark done
                </button>
              )}
              {!undecided && !runbookMade && (
                <button
                  type="button"
                  className={buttonClass}
                  title="Turn this decision into steps someone else can follow"
                  onClick={async () => {
                    await fromItem({ itemId: item.itemId });
                    setRunbookMade(true);
                  }}
                >
                  <BookOpenCheckIcon size={13} /> Write the runbook
                </button>
              )}
              {runbookMade && <span className="text-xs text-emerald-800">Draft runbook made: see the Runbooks tab.</span>}
              {!undecided && (
                <button type="button" className={buttonClass} onClick={() => reopen({ itemId: item.itemId })}>
                  <RotateCcwIcon size={13} /> Reopen
                </button>
              )}
              {goals.length > 1 && (
                <select
                  aria-label="Move to goal"
                  className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
                  value={item.goalId}
                  onChange={(e) => editItem({ itemId: item.itemId, goalId: e.target.value as Id<"goals"> })}
                >
                  {goals.map((g) => (
                    <option key={g.goalId} value={g.goalId}>
                      {g.title}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className={`${buttonClass} ml-auto text-rose-700`}
                onClick={() => {
                  if (confirm(`Delete "${item.title}" and its decision records?`)) removeItem({ itemId: item.itemId });
                }}
              >
                <Trash2Icon size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

type CanvasNote = { _id: string; content: string };

// Decided items past this many fold behind "+ N more decided"
const DECIDED_SHOWN = 2;

/** One state's items under its heading. Done starts collapsed; decided shows the first few. */
function StateGroup({
  state,
  items,
  goals,
  canEdit,
  openItemId,
  setOpenItemId,
}: {
  state: ItemState;
  items: Item[];
  goals: Goal[];
  canEdit: boolean;
  openItemId: string | null;
  setOpenItemId: (id: string | null) => void;
}) {
  const holdsOpenItem = items.some((i) => i.itemId === openItemId);
  const [showAll, setShowAll] = useState(false);
  const collapsed = state === "done" && !showAll && !holdsOpenItem;
  const folded = state === "decided" && !showAll && !holdsOpenItem && items.length > DECIDED_SHOWN + 1;
  const shown = collapsed ? [] : folded ? items.slice(0, DECIDED_SHOWN) : items;
  const label = ITEM_STATE_LABELS[state].toUpperCase();

  return (
    <div className="py-2 first:pt-0 last:pb-0">
      {state === "done" ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          aria-expanded={!collapsed}
          className="mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted hover:text-ink"
        >
          {collapsed ? <ChevronRightIcon size={12} /> : <ChevronDownIcon size={12} />}
          {label} · {items.length} {items.length === 1 ? "item" : "items"}
          {collapsed && ", collapsed"}
        </button>
      ) : (
        <h3 className="mb-1 text-[11px] font-semibold tracking-wide text-muted">{label}</h3>
      )}
      {shown.length > 0 && (
        <ul className="space-y-0.5">
          {shown.map((item) => (
            <ItemRow
              key={item.itemId}
              item={item}
              goals={goals}
              canEdit={canEdit}
              expanded={openItemId === item.itemId}
              onToggle={() => setOpenItemId(openItemId === item.itemId ? null : item.itemId)}
            />
          ))}
        </ul>
      )}
      {folded && (
        <button type="button" onClick={() => setShowAll(true)} className="ml-7 mt-0.5 text-xs text-muted hover:text-ink">
          + {items.length - DECIDED_SHOWN} more decided
        </button>
      )}
    </div>
  );
}

function GoalSection({
  goal,
  goals,
  canEdit,
  notesToConvert,
  openItemId,
  setOpenItemId,
}: {
  goal: Goal;
  goals: Goal[];
  canEdit: boolean;
  notesToConvert: CanvasNote[];
  openItemId: string | null;
  setOpenItemId: (id: string | null) => void;
}) {
  const addItem = useMutation(api.goals.addItem);
  const renameGoal = useMutation(api.goals.renameGoalTitle);
  const removeGoal = useMutation(api.goals.removeGoal);
  const convertNote = useMutation(api.goals.convertNote);
  const [title, setTitle] = useState("");

  return (
    <section className="space-y-3">
      <header className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-start gap-2">
          {canEdit ? (
            <EditableField
              required
              className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-display text-base font-semibold text-ink hover:border-line focus:border-accent focus:outline-none"
              value={goal.title}
              aria-label="Goal"
              onCommit={(v) => renameGoal({ goalId: goal.goalId, title: v })}
            />
          ) : (
            <h2 className="flex-1 font-display text-base font-semibold text-ink">{goal.title}</h2>
          )}
          {canEdit && goal.items.length === 0 && (
            <button type="button" className="p-1 text-muted hover:text-rose-700" aria-label="Delete goal" onClick={() => removeGoal({ goalId: goal.goalId })}>
              <Trash2Icon size={14} />
            </button>
          )}
        </div>
        <GoalHeadline goal={goal} />
      </header>

      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">Items</h2>
        {goal.items.length > 0 ? (
          <div className="divide-y divide-line">
            {ITEM_STATES.map((state) => {
              const items = goal.items.filter((i) => i.state === state);
              return items.length ? (
                <StateGroup
                  key={state}
                  state={state}
                  items={items}
                  goals={goals}
                  canEdit={canEdit}
                  openItemId={openItemId}
                  setOpenItemId={setOpenItemId}
                />
              ) : null;
            })}
          </div>
        ) : (
          <p className="text-xs text-muted">Nothing here yet. What needs deciding before this goal is reached?</p>
        )}

        {canEdit && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <form
              className="flex min-w-[14rem] flex-1 gap-1.5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!title.trim()) return;
                await addItem({ goalId: goal.goalId, title });
                setTitle("");
              }}
            >
              <input className={inputClass} placeholder="Something that needs deciding…" value={title} onChange={(e) => setTitle(e.target.value)} />
              <button type="submit" className={buttonClass} disabled={!title.trim()}>
                <PlusIcon size={13} /> Add
              </button>
            </form>
            {notesToConvert.length > 0 && (
              <select
                aria-label="Add from a canvas note"
                className="max-w-[16rem] rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-muted"
                value=""
                onChange={(e) => e.target.value && convertNote({ noteId: e.target.value as Id<"notes">, goalId: goal.goalId })}
              >
                <option value="">Add from a canvas note…</option>
                {notesToConvert.map((n) => (
                  <option key={n._id} value={n._id}>
                    {n.content.length > 70 ? `${n.content.slice(0, 70)}…` : n.content}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * What needs the viewer now, across every goal: calls to make (soonest first), decisions to look
 * back on, and tests whose result is in. Items with no driver count as everyone's.
 */
function NeedsYou({
  view,
  viewerId,
  canEdit,
  onOpenItem,
}: {
  view: GoalsView;
  viewerId: string;
  canEdit: boolean;
  onOpenItem: (itemId: string) => void;
}) {
  const lookBack = useMutation(api.goals.lookBack);
  const today = todayLocal();
  const mine = (i: Item) => !i.ownerId || i.ownerId === viewerId;
  const items = view.goals.flatMap((g) => g.items).filter(mine);
  const toDecide = items
    .filter((i) => (i.state === "open" || i.state === "testing") && i.decideBy && testStage(i, today) !== "result")
    .sort((a, b) => a.decideBy!.localeCompare(b.decideBy!));
  const resultsIn = items.filter((i) => i.state === "testing" && testStage(i, today) === "result");
  const lookBacks = items.filter((i) => i.lookBackDue);
  const empty = toDecide.length + resultsIn.length + lookBacks.length === 0;

  const entry = (key: string, item: Item, lead: string, sub: React.ReactNode) => (
    <li key={key}>
      <button type="button" onClick={() => onOpenItem(item.itemId)} className="w-full text-left text-sm text-ink hover:underline">
        {lead}: {item.title}
      </button>
      <div className="text-xs text-muted">{sub}</div>
    </li>
  );

  return (
    <section className="rounded-lg border-2 border-accent/60 bg-accent-soft/40 p-4">
      <h2 className="text-sm font-semibold text-ink">Needs you</h2>
      {empty ? (
        <p className="mt-2 text-xs text-muted">Nothing right now.</p>
      ) : (
        <ul className="mt-2.5 space-y-3">
          {toDecide.map((i) => entry(`d-${i.itemId}`, i, "Decide", dueIn(i.decideBy!)))}
          {resultsIn.map((i) => entry(`r-${i.itemId}`, i, "Test result in", "ready to decide"))}
          {lookBacks.map((i) =>
            entry(
              `l-${i.itemId}`,
              i,
              "Review",
              canEdit ? (
                <span className="flex items-center gap-1">
                  Did it pan out?
                  {LOOK_BACK_ANSWERS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => lookBack({ itemId: i.itemId, outcome: a })}
                      className="rounded border border-line bg-surface px-1.5 text-[11px] text-ink hover:bg-surface-2"
                    >
                      {LOOK_BACK_LABELS[a]}
                    </button>
                  ))}
                </span>
              ) : (
                "did it pan out?"
              )
            )
          )}
        </ul>
      )}
    </section>
  );
}

const TRACK_LABELS: Record<DecisionBasis, string> = { test: "Tested", data: "Data", expert: "Expert", judgment: "Judgment" };

/** How often each kind of decision panned out: yes fills the bar, partly fills it lighter. */
function TrackRecord({ stats }: { stats: GoalsView["basisStats"] }) {
  const rows = DECISION_BASES.filter((b) => stats[b]);
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Track record</h2>
      <p className="text-xs text-muted">How often decisions panned out</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          Nothing to look back on yet. Once a decision is done and its review date comes, you&apos;ll see how each kind panned out.
        </p>
      ) : (
        <dl className="mt-3 space-y-2.5">
          {rows.map((b) => {
            const { yes, no, partly } = stats[b]!;
            const total = yes + no + partly;
            return (
              <div key={b} className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2">
                <dt className="text-sm text-ink">{TRACK_LABELS[b]}</dt>
                <dd>
                  <div
                    className="flex h-3 overflow-hidden rounded-sm bg-surface-2"
                    role="img"
                    aria-label={`${yes} yes, ${partly} partly, ${no} no`}
                  >
                    <div className="bg-emerald-500/80" style={{ width: `${(yes / total) * 100}%` }} />
                    <div className="bg-emerald-300/70" style={{ width: `${(partly / total) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {yes} of {total} yes{partly ? `, ${partly} partly` : ""}
                  </p>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}

interface GoalsBoardProps {
  view: (GoalsView & { viewerId: string | null }) | null | undefined;
  canEdit: boolean;
  canvasId: Id<"canvases">;
  /** Canvas notes, so an editor can turn one into an item */
  notes?: CanvasNote[];
}

/**
 * The dashboard: each goal's card and its items by state, beside what needs you now and how past
 * decisions panned out.
 */
export function GoalsBoard({ view, canEdit, canvasId, notes = [] }: GoalsBoardProps) {
  const addGoal = useMutation(api.goals.addGoal);
  const [goalTitle, setGoalTitle] = useState("");
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  if (view === undefined) return <p className="text-xs text-muted">Loading…</p>;
  if (view === null) return <p className="text-xs text-muted">Goals aren&apos;t available.</p>;

  const converted = new Set<string>(view.convertedNoteIds);
  const notesToConvert = notes.filter((n) => !converted.has(n._id));
  const openItem = (itemId: string) => {
    setOpenItemId(itemId);
    requestAnimationFrame(() => document.getElementById(`item-${itemId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-6">
        {view.goals.length === 0 && (
          <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
            <p className="font-medium text-ink">What are you working toward?</p>
            <p className="mt-1">Add a goal, like &ldquo;Launch the product&rdquo;. Then list what needs deciding before you get there.</p>
          </div>
        )}

        {view.goals.map((goal) => (
          <GoalSection
            key={goal.goalId}
            goal={goal}
            goals={view.goals}
            canEdit={canEdit}
            notesToConvert={notesToConvert}
            openItemId={openItemId}
            setOpenItemId={setOpenItemId}
          />
        ))}

        {canEdit && (
          <form
            className="flex gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!goalTitle.trim()) return;
              await addGoal({ canvasId, title: goalTitle });
              setGoalTitle("");
            }}
          >
            <input className={inputClass} placeholder="A new goal, e.g. Launch Afforrd" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
            <button type="submit" className={primaryButtonClass} disabled={!goalTitle.trim()}>
              <PlusIcon size={13} /> Add goal
            </button>
          </form>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
        {view.viewerId && <NeedsYou view={view} viewerId={view.viewerId} canEdit={canEdit} onOpenItem={openItem} />}
        <TrackRecord stats={view.basisStats} />
      </aside>
    </div>
  );
}
