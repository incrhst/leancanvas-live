"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import {
  AlertTriangleIcon,
  ArchiveIcon,
  BookOpenCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CirclePlayIcon,
  FolderIcon,
  HistoryIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { RunbooksView } from "../../convex/lib/runbooks";
import {
  RUN_OUTCOME_LABELS,
  RUN_OUTCOMES,
  RunOutcome,
  Stage,
  STAGE_LABELS,
  STAGES,
} from "../../convex/lib/runbookModel";
import { EditableField } from "./EditableField";
import { StageChip, STAGE_STYLE } from "./StageControls";
import { formatCalendarDate, localDate } from "../utils/testFields";
import type { BlockDef } from "../types/canvas";

type Runbook = RunbooksView["runbooks"][number];
type View = RunbooksView & { role: string | null };

const inputClass =
  "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none";
const buttonClass =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2 disabled:opacity-50";
const primaryButtonClass =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-surface hover:opacity-90 disabled:opacity-50";

const STATUS_STYLE: Record<Runbook["status"], string> = {
  draft: "border-dashed border-stone-400 bg-stone-100 text-stone-700",
  live: "border-emerald-300 bg-emerald-50 text-emerald-900",
  retired: "border-stone-300 bg-surface-2 text-muted",
};
const STATUS_LABEL: Record<Runbook["status"], string> = { draft: "Draft", live: "Live", retired: "Retired" };

function errorText(err: unknown) {
  return err instanceof Error ? err.message.replace(/^.*Uncaught (ConvexError|Error): /, "").split("\n")[0] : "Couldn't save";
}

/** Which parts of the business run without you: each box by stage, worst first. */
function RunnableMap({ view, blocks }: { view: View; blocks: BlockDef[] }) {
  const titleOf = (id: string) => blocks.find((b) => b.id === id)?.title ?? id;
  const rows = [...view.blockStages].sort(
    (a, b) => STAGES.indexOf(a.stage as Stage) - STAGES.indexOf(b.stage as Stage)
  );
  const codified = rows.filter((r) => r.stage === "codified").length;
  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-ink">How much runs without you</h2>
        <p className="text-sm text-ink">
          <span className="font-semibold tabular-nums">{codified}</span> of {rows.length} boxes codified
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Add notes to the canvas first. Every box starts as a guess.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.block} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5">
              <span className={`h-3 w-3 shrink-0 rounded-sm ${STAGE_STYLE[r.stage as Stage].swatch}`} aria-hidden="true" />
              <span className={`min-w-0 flex-1 truncate text-sm ${r.stage === "guess" ? "text-muted" : "text-ink"}`}>
                {titleOf(r.block)}
              </span>
              <span className="whitespace-nowrap text-[11px] text-muted">
                {STAGE_LABELS[r.stage as Stage]} · {r.codified}/{r.notes}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted">
        A box is only as runnable as its least runnable note. {STAGES.map((s) => STAGE_LABELS[s]).join(" → ")}: codified
        means a live runbook covers it.
      </p>
    </section>
  );
}

function Attention({ view, onOpen }: { view: View; onOpen: (id: string) => void }) {
  if (view.attention.length === 0) return null;
  return (
    <section className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-950">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <AlertTriangleIcon size={15} aria-hidden="true" /> Needs attention
      </h2>
      <ul className="space-y-1.5 text-sm">
        {view.attention.map((r) => (
          <li key={r.runbookId}>
            <button type="button" className="text-left hover:underline" onClick={() => onOpen(r.runbookId)}>
              {r.title}
            </button>
            <span className="text-xs text-rose-900/80">
              {r.stats.keepsFailingAt !== null &&
                ` · keeps failing at step ${r.stats.keepsFailingAt}. Is the segment, channel or price right?`}
              {r.reviewDue && ` · review due ${formatCalendarDate(r.reviewDate!)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Follow the steps, tick them off, then say how it went. The first unticked step is where it broke. */
function RunForm({ runbook, onDone }: { runbook: Runbook; onDone: () => void }) {
  const logRun = useMutation(api.runbooks.logRunbookRun);
  const [done, setDone] = useState<boolean[]>(runbook.steps.map(() => false));
  const [numbers, setNumbers] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstOpen = done.findIndex((d) => !d);

  const submit = async (outcome: RunOutcome) => {
    setError(null);
    try {
      await logRun({
        runbookId: runbook.runbookId,
        outcome,
        failedStep: outcome === "yes" || firstOpen < 0 ? undefined : firstOpen + 1,
        numbers: numbers || undefined,
        note: note || undefined,
      });
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="space-y-2.5 rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950">
        <CirclePlayIcon size={13} aria-hidden="true" /> Running it
      </p>
      <ol className="space-y-1">
        {runbook.steps.map((step, i) => (
          <li key={i}>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={done[i]}
                onChange={(e) => setDone(done.map((d, j) => (j === i ? e.target.checked : d)))}
              />
              <span className={done[i] ? "text-muted line-through" : ""}>
                <span className="tabular-nums text-muted">{i + 1}.</span> {step}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <input className={inputClass} placeholder="What it produced, e.g. 12 leads, 3 booked" value={numbers} onChange={(e) => setNumbers(e.target.value)} />
      <input className={inputClass} placeholder="Anything to note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {firstOpen >= 0 && <p className="text-[11px] text-muted">If it didn&apos;t fully work, step {firstOpen + 1} is logged as where it broke.</p>}
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {RUN_OUTCOMES.map((o) => (
          <button key={o} type="button" className={o === "yes" ? primaryButtonClass : buttonClass} onClick={() => submit(o)}>
            {RUN_OUTCOME_LABELS[o]}
          </button>
        ))}
        <button type="button" className={`${buttonClass} ml-auto`} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function RunbookRow({
  runbook,
  view,
  canEdit,
  canRun,
  expanded,
  onToggle,
}: {
  runbook: Runbook;
  view: View;
  canEdit: boolean;
  canRun: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const edit = useMutation(api.runbooks.editRunbook);
  const setStatus = useMutation(api.runbooks.setStatus);
  const remove = useMutation(api.runbooks.removeRunbook);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { stats } = runbook;
  const linkedNoteIds = runbook.notes.map((n) => n.noteId as string);
  const unlinkedNotes = view.noteStages.filter((n) => !linkedNoteIds.includes(n.noteId));

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <li id={`runbook-${runbook.runbookId}`} className={`rounded-md ${expanded ? "border border-line bg-surface" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
      >
        <BookOpenCheckIcon size={14} className={runbook.status === "live" ? "text-emerald-700" : "text-muted"} aria-hidden="true" />
        <span className={`min-w-0 flex-1 text-sm ${runbook.status === "retired" ? "text-muted line-through" : "text-ink"}`}>
          {runbook.title}
        </span>
        {stats.keepsFailingAt !== null && runbook.status === "live" && (
          <span className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-900">
            <AlertTriangleIcon size={12} aria-hidden="true" /> Step {stats.keepsFailingAt}
          </span>
        )}
        {stats.total > 0 && (
          <span className="hidden text-xs text-muted sm:inline">
            {stats.yes} of {stats.total} worked
          </span>
        )}
        {runbook.owner && <span className="hidden text-xs text-muted md:inline">{runbook.owner}</span>}
        <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[runbook.status]}`}>
          {STATUS_LABEL[runbook.status]}
        </span>
        {expanded ? <ChevronDownIcon size={14} className="text-muted" /> : <ChevronRightIcon size={14} className="text-muted" />}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-line px-3 py-3">
          {canEdit ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted sm:col-span-2">
                Title
                <EditableField required className={inputClass} value={runbook.title} onCommit={(v) => act(() => edit({ runbookId: runbook.runbookId, title: v }))} />
              </label>
              <label className="text-xs text-muted sm:col-span-2">
                When to use it
                <EditableField
                  className={inputClass}
                  value={runbook.trigger ?? ""}
                  placeholder="e.g. Within a day of every event"
                  onCommit={(v) => act(() => edit({ runbookId: runbook.runbookId, trigger: v || null }))}
                />
              </label>
              <label className="text-xs text-muted sm:col-span-2">
                Steps, one per line
                <EditableField
                  multiline
                  rows={Math.max(3, runbook.steps.length + 1)}
                  className={inputClass}
                  value={runbook.steps.join("\n")}
                  placeholder={"Export the attendee list\nEmail each organiser within a day\nBook a call with anyone who replies"}
                  onCommit={(v) => act(() => edit({ runbookId: runbook.runbookId, steps: v.split("\n") }))}
                />
              </label>
              <label className="text-xs text-muted">
                SOP
                <select
                  className={inputClass}
                  value={runbook.sopId ?? ""}
                  onChange={(e) => act(() => edit({ runbookId: runbook.runbookId, sopId: (e.target.value || null) as Id<"sops"> | null }))}
                >
                  <option value="">Not in an SOP</option>
                  {view.sops.map((s) => (
                    <option key={s.sopId} value={s.sopId}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Review on
                <EditableField
                  type="date"
                  className={inputClass}
                  value={runbook.reviewDate ?? ""}
                  onCommit={(v) => act(() => edit({ runbookId: runbook.runbookId, reviewDate: v || null }))}
                />
              </label>
            </div>
          ) : (
            <>
              {runbook.trigger && (
                <p className="text-sm text-ink">
                  <span className="text-muted">When: </span>
                  {runbook.trigger}
                </p>
              )}
              {runbook.steps.length > 0 && (
                <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink">
                  {runbook.steps.map((s, i) => (
                    <li key={i} className={stats.keepsFailingAt === i + 1 ? "text-rose-800" : ""}>
                      {s}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}

          <div className="space-y-1.5 text-xs">
            <p className="font-medium text-ink">Codifies these canvas notes</p>
            {runbook.notes.length === 0 && <p className="text-muted">None yet.</p>}
            <ul className="space-y-1">
              {runbook.notes.map((n) => (
                <li key={n.noteId} className="flex items-center gap-2">
                  <StageChip stage={n.stage as Stage} small />
                  <span className="min-w-0 flex-1 text-ink">{n.text}</span>
                  {canEdit && (
                    <button
                      type="button"
                      className="text-muted hover:text-rose-700"
                      aria-label="Unlink note"
                      onClick={() =>
                        act(() =>
                          edit({
                            runbookId: runbook.runbookId,
                            noteIds: linkedNoteIds.filter((id) => id !== n.noteId) as Id<"notes">[],
                          })
                        )
                      }
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && unlinkedNotes.length > 0 && (
              <select
                aria-label="Link a canvas note"
                className="max-w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted"
                value=""
                onChange={(e) =>
                  e.target.value &&
                  act(() => edit({ runbookId: runbook.runbookId, noteIds: [...linkedNoteIds, e.target.value] as Id<"notes">[] }))
                }
              >
                <option value="">Link a canvas note…</option>
                {unlinkedNotes.map((n) => (
                  <option key={n.noteId} value={n.noteId}>
                    {STAGE_LABELS[n.stage as Stage]} · {n.text.length > 60 ? `${n.text.slice(0, 60)}…` : n.text}
                  </option>
                ))}
              </select>
            )}
          </div>

          {runbook.items.length > 0 && (
            <div className="space-y-1 text-xs">
              <p className="font-medium text-ink">Rests on these decisions</p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted">
                {runbook.items.map((i) => (
                  <li key={i.itemId}>
                    {i.title}
                    {i.decision && <span className="text-ink">: {i.decision}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {running && <RunForm runbook={runbook} onDone={() => setRunning(false)} />}

          {runbook.recentRuns.length > 0 && (
            <details className="text-xs" open={stats.keepsFailingAt !== null}>
              <summary className="cursor-pointer text-muted">
                <HistoryIcon size={12} className="mr-1 inline" aria-hidden="true" />
                Run log: {stats.yes} worked, {stats.partly} partly, {stats.no} didn&apos;t
              </summary>
              <ul className="mt-1.5 space-y-1">
                {runbook.recentRuns.map((r) => (
                  <li key={r.runId} className="flex flex-wrap gap-x-2 text-ink">
                    <span className={r.outcome === "yes" ? "text-emerald-800" : r.outcome === "no" ? "text-rose-800" : "text-amber-800"}>
                      {RUN_OUTCOME_LABELS[r.outcome as RunOutcome]}
                    </span>
                    {r.failedStep && <span className="text-muted">at step {r.failedStep}</span>}
                    {r.numbers && <span>{r.numbers}</span>}
                    {r.note && <span className="text-muted">{r.note}</span>}
                    <span className="text-muted">
                      · {r.ranBy ?? "Unknown"}
                      {r.via === "mcp" ? ` via ${r.clientName ?? "an agent"}` : ""}, {formatCalendarDate(localDate(r.at))}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {error && <p className="text-xs text-rose-700">{error}</p>}

          <div className="flex flex-wrap items-center gap-1.5">
            {canRun && runbook.status === "live" && !running && (
              <button type="button" className={primaryButtonClass} onClick={() => setRunning(true)}>
                <CirclePlayIcon size={13} /> Run it
              </button>
            )}
            {canEdit && runbook.status === "draft" && (
              <button type="button" className={primaryButtonClass} onClick={() => act(() => setStatus({ runbookId: runbook.runbookId, status: "live" }))}>
                <BookOpenCheckIcon size={13} /> Make it live
              </button>
            )}
            {canEdit && runbook.status === "live" && (
              <button type="button" className={buttonClass} onClick={() => act(() => setStatus({ runbookId: runbook.runbookId, status: "retired" }))}>
                <ArchiveIcon size={13} /> Retire
              </button>
            )}
            {canEdit && runbook.status === "retired" && (
              <button type="button" className={buttonClass} onClick={() => act(() => setStatus({ runbookId: runbook.runbookId, status: "draft" }))}>
                <RotateCcwIcon size={13} /> Back to draft
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className={`${buttonClass} ml-auto text-rose-700`}
                onClick={() => {
                  if (confirm(`Delete "${runbook.title}" and its run log?`)) act(() => remove({ runbookId: runbook.runbookId }));
                }}
              >
                <Trash2Icon size={13} /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function SopSection({
  sop,
  runbooks,
  view,
  canEdit,
  canRun,
  openId,
  setOpenId,
}: {
  sop: View["sops"][number] | null;
  runbooks: Runbook[];
  view: View;
  canEdit: boolean;
  canRun: boolean;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const editSop = useMutation(api.runbooks.editSop);
  const removeSop = useMutation(api.runbooks.removeSop);
  const addRunbook = useMutation(api.runbooks.addRunbook);
  const [title, setTitle] = useState("");
  const live = runbooks.filter((r) => r.status === "live").length;

  return (
    <section className="space-y-2 rounded-lg border border-line bg-surface p-4">
      <header className="flex items-start gap-2">
        <FolderIcon size={16} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {sop && canEdit ? (
            <EditableField
              required
              aria-label="SOP"
              className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 font-display text-base font-semibold text-ink hover:border-line focus:border-accent focus:outline-none"
              value={sop.title}
              onCommit={(v) => editSop({ sopId: sop.sopId, title: v })}
            />
          ) : (
            <h2 className="font-display text-base font-semibold text-ink">{sop ? sop.title : "Not in an SOP"}</h2>
          )}
          {sop?.description && <p className="px-1 text-xs text-muted">{sop.description}</p>}
        </div>
        <span className="pt-1 text-xs text-muted">
          {live} live of {runbooks.length}
        </span>
        {sop && canEdit && (
          <button
            type="button"
            aria-label="Delete SOP"
            className="p-1 text-muted hover:text-rose-700"
            onClick={() => {
              if (confirm(`Delete the SOP "${sop.title}"? Its runbooks stay, ungrouped.`)) removeSop({ sopId: sop.sopId });
            }}
          >
            <Trash2Icon size={14} />
          </button>
        )}
      </header>

      {runbooks.length > 0 ? (
        <ul className="space-y-0.5">
          {runbooks.map((r) => (
            <RunbookRow
              key={r.runbookId}
              runbook={r}
              view={view}
              canEdit={canEdit}
              canRun={canRun}
              expanded={openId === r.runbookId}
              onToggle={() => setOpenId(openId === r.runbookId ? null : r.runbookId)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">No runbooks here yet.</p>
      )}

      {canEdit && (
        <form
          className="flex gap-1.5 border-t border-line pt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const id = await addRunbook({ canvasId: view.canvasId, title, sopId: sop?.sopId });
            setTitle("");
            setOpenId(id);
          }}
        >
          <input className={inputClass} placeholder="A play that works more than once…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className={buttonClass} disabled={!title.trim()}>
            <PlusIcon size={13} /> Runbook
          </button>
        </form>
      )}
    </section>
  );
}

interface RunbooksBoardProps {
  view: View | null | undefined;
  blocks: BlockDef[];
  canEdit: boolean;
  /** Any signed-in member can log runs */
  canRun: boolean;
}

/** SOPs and their runbooks, beside a map of how much of the business runs without you. */
export function RunbooksBoard({ view, blocks, canEdit, canRun }: RunbooksBoardProps) {
  const addSop = useMutation(api.runbooks.addSop);
  const [sopTitle, setSopTitle] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  if (view === undefined) return <p className="text-xs text-muted">Loading…</p>;
  if (view === null) return <p className="text-xs text-muted">Runbooks aren&apos;t available.</p>;

  const open = (id: string) => {
    setOpenId(id);
    requestAnimationFrame(() => document.getElementById(`runbook-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };
  const ungrouped = view.runbooks.filter((r) => !r.sopId);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        {view.runbooks.length === 0 && view.sops.length === 0 && (
          <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
            <p className="font-medium text-ink">Write down what already works.</p>
            <p className="mt-1">
              A runbook is a play written so someone else, or an agent, can run it and get the same result. Start from a
              canvas note marked repeatable, or a decided goal item, or add one below. Group them into SOPs as they grow.
            </p>
          </div>
        )}
        {view.sops.map((sop) => (
          <SopSection
            key={sop.sopId}
            sop={sop}
            runbooks={view.runbooks.filter((r) => r.sopId === sop.sopId)}
            view={view}
            canEdit={canEdit}
            canRun={canRun}
            openId={openId}
            setOpenId={setOpenId}
          />
        ))}
        {(ungrouped.length > 0 || canEdit) && (
          <SopSection
            sop={null}
            runbooks={ungrouped}
            view={view}
            canEdit={canEdit}
            canRun={canRun}
            openId={openId}
            setOpenId={setOpenId}
          />
        )}
        {canEdit && (
          <form
            className="flex gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!sopTitle.trim()) return;
              await addSop({ canvasId: view.canvasId, title: sopTitle });
              setSopTitle("");
            }}
          >
            <input className={inputClass} placeholder="A new SOP, e.g. Acquisition or Event day" value={sopTitle} onChange={(e) => setSopTitle(e.target.value)} />
            <button type="submit" className={primaryButtonClass} disabled={!sopTitle.trim()}>
              <PlusIcon size={13} /> Add SOP
            </button>
          </form>
        )}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
        <Attention view={view} onOpen={open} />
        <RunnableMap view={view} blocks={blocks} />
      </aside>
    </div>
  );
}
