"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import {
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
import { EditableField } from "./EditableField";
import { formatCalendarDate, localDate, todayLocal, VERDICT_CONFIG } from "../utils/testFields";

type Goal = GoalsView["goals"][number];
type Item = Goal["items"][number];
type Decision = NonNullable<Item["decision"]>;

const STATE_STYLE: Record<ItemState, { icon: React.ElementType; chip: string; bar: string }> = {
  open: { icon: CircleDashedIcon, chip: "border-stone-300 bg-stone-100 text-stone-700", bar: "bg-stone-300" },
  testing: { icon: FlaskConicalIcon, chip: "border-amber-300 bg-amber-50 text-amber-900", bar: "bg-amber-400" },
  decided: { icon: CircleCheckIcon, chip: "border-teal-300 bg-teal-50 text-teal-900", bar: "bg-teal-500" },
  done: { icon: CheckCheckIcon, chip: "border-emerald-300 bg-emerald-50 text-emerald-900", bar: "bg-emerald-600" },
};

/**
 * Fog is felt, never explained: open items sit in a haze, testing ones are partly clear, decided
 * and done ones are sharp. The haze lifts on hover or focus so nothing is ever hard to read.
 */
const FOG: Record<ItemState, string> = {
  open: "bg-gradient-to-r from-stone-100 via-surface to-stone-100 [&_.fog-text]:blur-[0.7px] [&_.fog-text]:opacity-60",
  testing: "bg-gradient-to-r from-amber-50/60 via-surface to-surface [&_.fog-text]:blur-[0.3px] [&_.fog-text]:opacity-80",
  decided: "bg-surface",
  done: "bg-surface",
};

const inputClass =
  "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none";
const buttonClass =
  "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2 disabled:opacity-50";
const primaryButtonClass =
  "inline-flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-surface hover:opacity-90 disabled:opacity-50";

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

/** "3 open, 1 testing, 5 decided, 2 done" as chips, with a bar that fills as items are decided. */
function GoalHeadline({ goal }: { goal: Goal }) {
  const total = ITEM_STATES.reduce((sum, s) => sum + goal.counts[s], 0);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5" aria-label={goal.headline}>
        {ITEM_STATES.map((s) => (
          <span key={s} className="text-xs text-muted">
            <span className="font-semibold tabular-nums text-ink">{goal.counts[s]}</span> {s}
            {s !== "done" && <span className="text-subtle">,</span>}
          </span>
        ))}
        {goal.reached && (
          <span className="ml-1 inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900">
            <CheckCheckIcon size={12} aria-hidden="true" /> Reached
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          {ITEM_STATES.map((s) =>
            goal.counts[s] ? (
              <div key={s} className={STATE_STYLE[s].bar} style={{ width: `${(goal.counts[s] / total) * 100}%` }} />
            ) : null
          )}
        </div>
      )}
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

function ItemRow({ item, goals, canEdit }: { item: Item; goals: Goal[]; canEdit: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const editItem = useMutation(api.goals.editItem);
  const markDone = useMutation(api.goals.markDone);
  const reopen = useMutation(api.goals.reopen);
  const removeItem = useMutation(api.goals.removeItem);
  const undecided = item.state === "open" || item.state === "testing";

  return (
    <li className={`group rounded-md border border-line transition-colors focus-within:[&_.fog-text]:blur-0 focus-within:[&_.fog-text]:opacity-100 hover:[&_.fog-text]:blur-0 hover:[&_.fog-text]:opacity-100 ${FOG[item.state]}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
      >
        {expanded ? <ChevronDownIcon size={14} className="mt-0.5 shrink-0 text-muted" /> : <ChevronRightIcon size={14} className="mt-0.5 shrink-0 text-muted" />}
        <span className="fog-text min-w-0 flex-1 text-sm text-ink transition-[filter,opacity] duration-300">
          {item.title}
          {item.decision && !expanded && (
            <span className="mt-0.5 block text-xs text-muted">→ {item.decision.text}</span>
          )}
        </span>
        {item.lookBackDue && (
          <span className="inline-flex items-center gap-1 rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-900">
            <HistoryIcon size={12} aria-hidden="true" /> Look back
          </span>
        )}
        {item.driver && <span className="hidden text-[11px] text-muted sm:inline">{item.driver}</span>}
        <StateChip state={item.state} />
      </button>

      {expanded && (
        <div className="space-y-2.5 border-t border-line px-2.5 py-2.5">
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

function GoalSection({
  goal,
  goals,
  canEdit,
  notesToConvert,
}: {
  goal: Goal;
  goals: Goal[];
  canEdit: boolean;
  notesToConvert: CanvasNote[];
}) {
  const addItem = useMutation(api.goals.addItem);
  const renameGoal = useMutation(api.goals.renameGoalTitle);
  const removeGoal = useMutation(api.goals.removeGoal);
  const convertNote = useMutation(api.goals.convertNote);
  const [title, setTitle] = useState("");

  return (
    <section className="space-y-2.5 rounded-lg border border-line bg-surface p-3">
      <header className="space-y-2">
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

      {goal.items.length > 0 ? (
        <ul className="space-y-1.5">
          {goal.items.map((item) => (
            <ItemRow key={item.itemId} item={item} goals={goals} canEdit={canEdit} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Nothing here yet. What needs deciding before this goal is reached?</p>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
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
    </section>
  );
}

function BasisStats({ stats }: { stats: GoalsView["basisStats"] }) {
  const rows = DECISION_BASES.filter((b) => stats[b]);
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-line bg-surface p-3">
      <h2 className="text-sm font-semibold text-ink">How our calls panned out</h2>
      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1 font-medium">Based on</th>
            {LOOK_BACK_ANSWERS.map((a) => (
              <th key={a} className="py-1 text-right font-medium">{LOOK_BACK_LABELS[a]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b} className="border-t border-line">
              <td className="py-1 text-ink">{DECISION_BASIS_LABELS[b]}</td>
              {LOOK_BACK_ANSWERS.map((a) => (
                <td key={a} className="py-1 text-right tabular-nums text-ink">{stats[b]![a]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface GoalsBoardProps {
  view: GoalsView | null | undefined;
  canEdit: boolean;
  canvasId: Id<"canvases">;
  /** Canvas notes, so an editor can turn one into an item */
  notes?: CanvasNote[];
}

/** The centre of a canvas: goals, the items that need deciding under each, and their decisions. */
export function GoalsBoard({ view, canEdit, canvasId, notes = [] }: GoalsBoardProps) {
  const addGoal = useMutation(api.goals.addGoal);
  const [goalTitle, setGoalTitle] = useState("");

  if (view === undefined) return <p className="text-xs text-muted">Loading goals…</p>;
  if (view === null) return <p className="text-xs text-muted">Goals aren&apos;t available.</p>;

  const converted = new Set<string>(view.convertedNoteIds);
  const notesToConvert = notes.filter((n) => !converted.has(n._id));

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {view.lookBacksDue.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
          <HistoryIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            {view.lookBacksDue.length === 1 ? "One call is" : `${view.lookBacksDue.length} calls are`} ready to look back on:{" "}
            {view.lookBacksDue.map((i) => i.title).join("; ")}. Open {view.lookBacksDue.length === 1 ? "it" : "each"} to say whether it panned out.
          </p>
        </div>
      )}

      {view.goals.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
          <p className="font-medium text-ink">What are you working toward?</p>
          <p className="mt-1">
            Add a goal, like &ldquo;Launch the product&rdquo;. Then list what needs deciding before you get there.
          </p>
        </div>
      )}

      {view.goals.map((goal) => (
        <GoalSection key={goal.goalId} goal={goal} goals={view.goals} canEdit={canEdit} notesToConvert={notesToConvert} />
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

      <BasisStats stats={view.basisStats} />
    </div>
  );
}
