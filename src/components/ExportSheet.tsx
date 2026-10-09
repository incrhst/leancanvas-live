import React from "react";
import { FlaskConicalIcon, LayoutGridIcon } from "lucide-react";
import { EvidenceBadge, EVIDENCE_CONFIG } from "./EvidenceBadge";
import { noteCardClass, RiskTag } from "./StickyNote";
import { statusFor } from "./RiskiestAssumptionsView";
import { riskRanksFor } from "./CanvasViewToggle";
import { blockName, CanvasTemplateDef } from "../utils/canvasTemplates";
import type { BlockDef, EvidenceState, NoteItem, RiskiestAssumption, StressTestResult } from "../types/canvas";

export type ExportKind = "canvas" | "risks";

export interface ExportSheetProps {
  kind: ExportKind;
  title: string;
  /** Extra label beside the template name, e.g. "Public view" */
  badge?: string;
  template: CanvasTemplateDef;
  notes: NoteItem[];
  stressResult: StressTestResult | null;
  exportedAt: number;
  ref?: React.Ref<HTMLDivElement>;
}

// Fixed widths keep the export identical on every screen. The canvas is wide, like the board. The risks list reads better at a narrower measure.
const CANVAS_WIDTH = 1440;
const RISKS_WIDTH = 960;

/**
 * Turns a board block's Tailwind placement (e.g. "lg:col-start-3 lg:col-span-2 lg:row-start-1")
 * into inline grid placement, so the export follows the same layout as the board.
 */
function gridPlacement(area: string): React.CSSProperties {
  const pick = (token: string) => Number(area.match(new RegExp(`lg:${token}-(\\d+)`))?.[1] ?? 1);
  return {
    gridColumn: `${pick("col-start")} / span ${pick("col-span")}`,
    gridRow: `${pick("row-start")} / span ${pick("row-span")}`,
  };
}

/**
 * Print-ready rendering of a canvas or its riskiest assumptions. It is always light and fixed-width,
 * and it is captured to PNG or PDF, so it is not responsive and does not depend on the app's layout.
 */
export function ExportSheet({
  kind,
  title,
  badge,
  template,
  notes,
  stressResult,
  exportedAt,
  ref,
}: ExportSheetProps) {
  const isRisks = kind === "risks";
  const exportedOn = new Date(exportedAt).toLocaleDateString(undefined, { dateStyle: "medium" });

  return (
    <div
      ref={ref}
      style={{ width: isRisks ? RISKS_WIDTH : CANVAS_WIDTH }}
      className="border-t-4 border-accent bg-white p-12 font-sans text-ink"
    >
      <header className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-surface">
            <LayoutGridIcon size={16} aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold text-ink">LeanCanvas Live</p>
            <p className="text-[11px] text-muted">by Incrementic</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {badge && (
              <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                {badge}
              </span>
            )}
            <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink">
              {template.label}
            </span>
          </div>
          <p className="text-[11px] text-muted">Exported {exportedOn}</p>
        </div>
      </header>

      {isRisks ? (
        <RisksBody title={title} template={template} notes={notes} stressResult={stressResult} />
      ) : (
        <CanvasBody title={title} template={template} notes={notes} stressResult={stressResult} />
      )}

      <footer className="mt-10 flex items-center justify-between border-t border-line pt-4 text-[11px] text-muted">
        <span>Generated with LeanCanvas Live · lean.incrementic.com</span>
        <span className="font-mono">Incrementic</span>
      </footer>
    </div>
  );
}

interface BodyProps {
  title: string;
  template: CanvasTemplateDef;
  notes: NoteItem[];
  stressResult: StressTestResult | null;
}

function CanvasBody({ title, template, notes, stressResult }: BodyProps) {
  const riskRanks = riskRanksFor(stressResult?.riskiestAssumptions);
  const noteLabel = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
  const stressLabel = stressResult ? ` · Stress test ${stressResult.overallScore}/10` : "";

  return (
    <>
      <div className="mt-10">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          {template.label}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink">
          {title || "Untitled canvas"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {noteLabel}
          {stressLabel}
        </p>
      </div>

      <EvidenceSummary notes={notes} />

      <section
        className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line"
        style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}
      >
        {template.blocks.map((block) => (
          <SheetBlock
            key={block.id}
            block={block}
            notes={notes.filter((n) => n.block === block.id)}
            riskRanks={riskRanks}
          />
        ))}
      </section>
    </>
  );
}

function EvidenceSummary({ notes }: { notes: NoteItem[] }) {
  const counts: Partial<Record<EvidenceState, number>> = {};
  for (const note of notes) {
    const state = note.evidenceState || "assumption";
    counts[state] = (counts[state] ?? 0) + 1;
  }
  const states = (Object.keys(EVIDENCE_CONFIG) as EvidenceState[]).filter((s) => counts[s]);
  if (states.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
      <span className="font-semibold uppercase tracking-wider text-ink">Evidence</span>
      {states.map((state) => (
        <span key={state} className="inline-flex items-center gap-1.5">
          <EvidenceBadge state={state} />
          <span className="font-medium text-ink">{counts[state]}</span>
        </span>
      ))}
    </div>
  );
}

function SheetBlock({
  block,
  notes,
  riskRanks,
}: {
  block: BlockDef;
  notes: NoteItem[];
  riskRanks: Record<string, number>;
}) {
  const isWide = block.layout === "wide";

  return (
    <section
      style={gridPlacement(block.area)}
      className={`flex min-w-0 flex-col ${block.emphasis ? "bg-surface-2" : "bg-white"}`}
    >
      <header className="border-b border-line/60 px-3.5 pb-2.5 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className={`text-[13px] font-semibold ${block.emphasis ? "text-accent" : "text-ink"}`}>
            {block.title}
          </h2>
          <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-muted">
            {notes.length}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">{block.prompt}</p>
      </header>

      <div className={`flex-1 p-2.5 ${isWide ? "grid grid-cols-3 content-start gap-2" : "flex flex-col gap-2"}`}>
        {notes.length === 0 ? (
          <p className="px-1 py-2 text-[12px] italic text-subtle">No items recorded</p>
        ) : (
          notes.map((note) => <SheetNote key={note._id} note={note} riskRank={riskRanks[note._id]} />)
        )}
      </div>
    </section>
  );
}

function SheetNote({ note, riskRank }: { note: NoteItem; riskRank?: number }) {
  return (
    <article className={`p-2.5 ${noteCardClass(note)}`}>
      {riskRank && <RiskTag rank={riskRank} />}
      <p className="text-[13px] leading-snug text-ink">{note.content}</p>
      <div className="mt-2.5 pt-1">
        <EvidenceBadge state={note.evidenceState || "assumption"} />
      </div>
    </article>
  );
}

function RisksBody({ title, template, notes, stressResult }: BodyProps) {
  if (!stressResult || stressResult.riskiestAssumptions.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-line p-10 text-center">
        <p className="text-sm font-semibold text-ink">No riskiest assumptions yet</p>
        <p className="mt-1 text-xs text-muted">Run the stress test to rank the assumptions most likely to sink this business model.</p>
      </div>
    );
  }

  const testedOn = new Date(stressResult.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const notesById = new Map(notes.map((n) => [n._id, n]));

  return (
    <>
      <div className="mt-10">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          Riskiest assumptions · {template.stressTestName}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink">
          {title || "Untitled canvas"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Ranked by the stress test on {testedOn}. Test #1 first: if it&apos;s wrong, the rest may not matter.
        </p>
      </div>

      <ScorePanel stressResult={stressResult} template={template} />

      <ol className="mt-8 space-y-4">
        {stressResult.riskiestAssumptions.map((item, idx) => (
          <RiskCard
            key={`${item.noteId ?? "general"}-${idx}`}
            rank={idx + 1}
            item={item}
            note={item.noteId ? notesById.get(item.noteId) : undefined}
            noteDeleted={!!item.noteId && !notesById.get(item.noteId)}
            resultCreatedAt={stressResult.createdAt}
            template={template}
          />
        ))}
      </ol>
    </>
  );
}

function ScorePanel({ stressResult, template }: { stressResult: StressTestResult; template: CanvasTemplateDef }) {
  const overall = stressResult.overallScore;
  const overallBar = overall >= 7 ? "bg-emerald-500" : overall >= 5 ? "bg-amber-500" : "bg-rose-500";

  return (
    <section className="mt-8 grid grid-cols-[200px_1fr] gap-8 rounded-xl border border-line bg-surface-2 p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Overall resilience</p>
        <p className="mt-1 font-display text-5xl font-bold text-ink">
          {overall}
          <span className="ml-1 text-base font-normal text-muted">/ 10</span>
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200">
          <div className={`h-full rounded-full ${overallBar}`} style={{ width: `${overall * 10}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 content-center gap-x-8 gap-y-3">
        {Object.entries(stressResult.scores).map(([key, val]) => {
          const meta = template.scoreLabels[key] || { label: key, desc: "" };
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-ink">{meta.label}</span>
                <span className="text-muted">{val} / 10</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-accent" style={{ width: `${val * 10}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Tag({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${className}`}>{children}</span>;
}

function RiskCard({
  rank,
  item,
  note,
  noteDeleted,
  resultCreatedAt,
  template,
}: {
  rank: number;
  item: RiskiestAssumption;
  note: NoteItem | undefined;
  noteDeleted: boolean;
  resultCreatedAt: number;
  template: CanvasTemplateDef;
}) {
  const status = statusFor(note);
  const changedSinceTest = !!note && note.updatedAt > resultCreatedAt;

  return (
    <li className="grid grid-cols-[44px_1fr] gap-4 rounded-xl border border-line bg-white p-5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-rose-600 font-display text-base font-bold text-white">
        {rank}
      </div>
      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {blockName(template.blocks, item.block)}
          </span>
          {status && <Tag className={status.className}>{status.label}</Tag>}
          {changedSinceTest && <Tag className="bg-stone-100 text-stone-700">Changed since test</Tag>}
          {noteDeleted && <Tag className="bg-stone-100 text-stone-600">Note deleted</Tag>}
          {!item.noteId && <Tag className="bg-stone-100 text-stone-600">Canvas-wide</Tag>}
        </div>

        <p className="font-display text-[15px] font-semibold leading-snug text-ink">
          {note ? note.content : item.assumption}
        </p>

        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-ink">Why it&apos;s lethal:</strong> {item.reason}
        </p>

        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-snug text-emerald-900">
          <FlaskConicalIcon className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            <strong>Experiment:</strong> {item.suggestedExperiment}
          </span>
        </div>

        {note && (
          <div className="flex items-center gap-2 text-[11px] text-muted">
            Evidence:
            <EvidenceBadge state={note.evidenceState} />
          </div>
        )}
      </div>
    </li>
  );
}
