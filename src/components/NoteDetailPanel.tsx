import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trash2Icon, XIcon, ChevronDownIcon, FlaskConicalIcon } from "lucide-react";
import { NoteItem, EvidenceState } from "../types/canvas";
import { EvidenceBadge, EVIDENCE_CONFIG, EVIDENCE_STATES } from "./EvidenceBadge";
import { NoteHistory } from "./NoteHistory";
import { EditableField } from "./EditableField";
import { NoteTestFields, TestFieldsPatch } from "./NoteTestFields";
import { NoteOwnerField } from "./OwnerControls";
import { NoteDecisionSection } from "./NoteDecision";
import { NoteMarketsField } from "./MarketControls";
import { hasTest } from "../utils/testFields";

/** Claim box tint per state. Full class names so Tailwind finds them; ! beats EditableField's base colours. */
const CLAIM_TINT: Record<EvidenceState, string> = {
  unknown: "!bg-surface !border-dashed !border-stone-300",
  assumption: "!bg-amber-50/70 !border-amber-300",
  observed: "!bg-blue-50/60 !border-blue-300",
  supported: "!bg-emerald-50/60 !border-emerald-300",
  contradicted: "!bg-rose-50 !border-rose-400",
  decision: "!bg-purple-50/60 !border-purple-300",
};

const NEXT_STEP: Record<EvidenceState, { title: string; body: string }> = {
  unknown: { title: "Start with your best guess", body: "If you believe this but have not checked it, mark it as an assumption." },
  assumption: { title: "Decide how you would find out", body: "A test says what to watch and what result would prove this wrong." },
  observed: { title: "Turn what you saw into a test", body: "You have seen this once. Say what to watch to be sure it holds." },
  supported: { title: "The evidence backs this", body: "Ready to commit? Ask the team to make it a decision." },
  contradicted: { title: "The evidence goes against this", body: "Rewrite the claim, or ask the team whether to drop it." },
  decision: { title: "The team has committed to this", body: "Nothing more to do here." },
};

interface NoteDetailPanelProps {
  note: NoteItem;
  blockTitle: string;
  canEdit: boolean;
  onClose: () => void;
  onUpdate: (content: string) => void;
  /** May return the save, so a result can attach its reason once the state has changed */
  onUpdateEvidence: (state: EvidenceState) => void | Promise<unknown>;
  onUpdateTest?: (patch: TestFieldsPatch) => void;
  onUpdateOwner?: (ownerId: string | null) => void;
  onUpdateMarkets?: (markets: string[] | null) => void;
  /** Market tags already used on the canvas, offered as suggestions */
  allMarkets?: string[];
  /** Adds a reason to the current user's latest change to this note */
  onAddReason?: (reason: string) => Promise<void>;
  onDelete: () => void;
  /** Set to show the note's change history (canvas members only, not the public link) */
  blockTitleOf?: (blockId: string) => string;
  /** "inline" opens the note in its place on the board instead of in the side panel */
  variant?: "panel" | "inline";
}

export function NoteDetailPanel({
  note,
  blockTitle,
  canEdit,
  onClose,
  onUpdate,
  onUpdateEvidence,
  onUpdateTest,
  onUpdateOwner,
  onUpdateMarkets,
  allMarkets = [],
  onAddReason,
  onDelete,
  blockTitleOf,
  variant = "panel",
}: NoteDetailPanelProps) {
  const inline = variant === "inline";
  const rootRef = useRef<HTMLElement>(null);
  // After a state change here, offer a line on why. Cleared when another note is opened.
  const [changedTo, setChangedTo] = useState<EvidenceState | null>(null);
  const [reason, setReason] = useState("");
  const [reasonStatus, setReasonStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [showTest, setShowTest] = useState(false);
  // Inline, the six states fold into the current one until asked for
  const [picking, setPicking] = useState(false);
  const [showMore, setShowMore] = useState<boolean | null>(null);
  const step = NEXT_STEP[note.evidenceState];
  const testPrompt = note.evidenceState === "assumption" || note.evidenceState === "observed";
  const decisionPrompt = note.evidenceState === "supported" || note.evidenceState === "contradicted";
  const testVisible = hasTest(note) || (testPrompt && showTest);
  const moreOpen = showMore ?? (!inline && !!(note.ownerId || note.markets?.length));
  const moreTopic = inline && blockTitleOf ? "owner, markets and history" : "owner and markets";
  const moreLabel = moreOpen ? `Hide ${moreTopic}` : moreTopic.charAt(0).toUpperCase() + moreTopic.slice(1);

  // Inline, keep the open note fully in view within its block (and the page)
  useEffect(() => {
    if (inline) rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [inline, note._id]);

  useEffect(() => {
    setShowTest(false);
    setPicking(false);
    setShowMore(null);
    setChangedTo(null);
    setReason("");
    setReasonStatus("idle");
  }, [note._id]);

  const changeState = (state: EvidenceState) => {
    if (state === note.evidenceState) return;
    void onUpdateEvidence(state);
    setPicking(false);
    setChangedTo(state);
    setReason("");
    setReasonStatus("idle");
  };

  // Power-user shortcuts, off while typing in a field or holding a modifier
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (!canEdit) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < EVIDENCE_STATES.length) {
        changeState(EVIDENCE_STATES[index]);
      } else if (e.key === "t" && testPrompt) {
        setShowTest(true);
      } else if (e.key === "o") {
        setShowMore(!moreOpen);
      } else {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const saveReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddReason || !reason.trim()) return;
    setReasonStatus("saving");
    try {
      await onAddReason(reason.trim());
      setReasonStatus("saved");
      setChangedTo(null);
    } catch {
      setReasonStatus("error");
    }
  };

  const Root = inline ? motion.article : motion.div;

  return (
    <Root
      ref={rootRef as React.Ref<HTMLDivElement>}
      id={inline ? `note-${note._id}` : undefined}
      aria-label={inline ? "Open note" : undefined}
      initial={inline ? { opacity: 0, scale: 0.98 } : { opacity: 0, x: 8 }}
      animate={inline ? { opacity: 1, scale: 1 } : { opacity: 1, x: 0 }}
      exit={inline ? { opacity: 0, scale: 0.98 } : { opacity: 0, x: 8 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className={
        inline
          ? "scroll-my-3 rounded-xl border-2 border-ink bg-surface shadow-lg"
          : "flex h-full flex-col bg-surface overflow-y-auto"
      }
    >
      <header
        className={
          inline
            ? "flex items-center justify-between px-3 pt-2"
            : "flex h-12 shrink-0 items-center justify-between border-b border-line px-4"
        }
      >
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{inline ? "Open note" : blockTitle}</p>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete note"
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <Trash2Icon size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close note"
            title="Close (Esc)"
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-stone-100 hover:text-ink transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>
      </header>

      <div className={inline ? "space-y-4 p-3 pt-2" : "p-4 space-y-6 flex-1"}>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted">What do we believe?</label>
          <EditableField
            multiline
            rows={3}
            required
            disabled={!canEdit}
            value={note.content}
            onCommit={onUpdate}
            className={`!p-3 !text-base ${CLAIM_TINT[note.evidenceState]}`}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">How sure are we?</p>
          {canEdit && inline && !picking ? (
            <StateToggle state={note.evidenceState} onClick={() => setPicking(true)} />
          ) : canEdit ? (
            <>
              <div className={`grid gap-2 ${inline ? "grid-cols-2" : "grid-cols-3"}`}>
                {EVIDENCE_STATES.map((state, i) => {
                  const conf = EVIDENCE_CONFIG[state];
                  const Icon = conf.icon;
                  const active = note.evidenceState === state;
                  return (
                    <button
                      key={state}
                      type="button"
                      aria-pressed={active}
                      aria-keyshortcuts={String(i + 1)}
                      onClick={() => changeState(state)}
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs transition-colors ${
                        active
                          ? `${conf.bg} ${conf.text} ${conf.border} ring-1 ring-accent font-semibold`
                          : "bg-surface border-line text-ink hover:bg-surface-2"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {conf.label}
                      <kbd aria-hidden="true" className={`${inline ? "hidden" : "hidden md:inline"} rounded border border-line bg-surface px-1 text-[10px] font-normal text-muted`}>
                        {i + 1}
                      </kbd>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted" aria-live="polite">
                {EVIDENCE_CONFIG[note.evidenceState].desc}.
              </p>
              <p className="hidden text-[11px] text-muted md:block">
                Keys: 1–6 set the state{testPrompt && !testVisible ? ", T adds a test" : ""}, O owner and markets, Esc closes.
              </p>

              {inline && (
                <button type="button" onClick={() => setPicking(false)} className="text-xs font-medium text-muted hover:text-ink">
                  Keep {EVIDENCE_CONFIG[note.evidenceState].label.toLowerCase()}
                </button>
              )}
            </>
          ) : (
            <>
              <EvidenceBadge state={note.evidenceState} />
              <p className="text-xs text-muted">Viewing in read-only mode. Sign in with editor permissions to make changes.</p>
            </>
          )}
          {canEdit && (
            <>
              {onAddReason && changedTo && (
                <form onSubmit={saveReason} className="space-y-1.5 rounded-lg border border-line bg-surface-2 p-2">
                  <label htmlFor="state-reason" className="block text-[11px] font-medium text-muted">
                    Why is it {EVIDENCE_CONFIG[changedTo].label.toLowerCase()} now? (optional)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="state-reason"
                      value={reason}
                      maxLength={280}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Day 30: $3.10 per start, above the pass mark"
                      className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button
                      type="submit"
                      disabled={!reason.trim() || reasonStatus === "saving"}
                      className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-surface disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                  {reasonStatus === "error" && (
                    <p className="text-[11px] text-rose-700">Couldn't save the reason. The note may have changed since.</p>
                  )}
                </form>
              )}
              {reasonStatus === "saved" && <p className="text-[11px] text-muted">Reason saved to history.</p>}
            </>
          )}
        </div>

        {canEdit && (
          <section aria-label="Next step" className="space-y-3 border-t border-line pt-4">
            {/* Once a test is in play it says what to do next itself */}
            {!testVisible && (
              <div className="space-y-0.5">
                <p className="text-sm text-ink">
                  <span className="font-semibold">Next step:</span> {step.title}
                </p>
                <p className="text-xs text-muted">{step.body}</p>
              </div>
            )}
            {note.evidenceState === "unknown" && (
              <button
                type="button"
                onClick={() => changeState("assumption")}
                className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90"
              >
                Mark as assumption
              </button>
            )}
            {testPrompt && !testVisible && (
              <button
                type="button"
                onClick={() => setShowTest(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90"
              >
                <FlaskConicalIcon className="h-4 w-4" aria-hidden="true" />
                Add a test
              </button>
            )}
            {testVisible && (
              <NoteTestFields
                note={note}
                canEdit={canEdit}
                onUpdate={onUpdateTest}
                onCancelNew={() => setShowTest(false)}
                onApplyResult={async (state, reasonText) => {
                  await onUpdateEvidence(state);
                  await onAddReason?.(reasonText);
                }}
              />
            )}
            {(decisionPrompt || note.decision) && <NoteDecisionSection note={note} canEdit={canEdit} />}
          </section>
        )}

        {!canEdit && (
          <>
            <NoteDecisionSection note={note} canEdit={canEdit} />
            <NoteOwnerField note={note} canEdit={canEdit} onChange={onUpdateOwner} />
            <NoteMarketsField note={note} canEdit={canEdit} allMarkets={allMarkets} onChange={onUpdateMarkets} />
            <NoteTestFields note={note} canEdit={canEdit} onUpdate={onUpdateTest} />
          </>
        )}

        {canEdit && (
          <div className="space-y-3">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setShowMore(!moreOpen)}
              className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent"
            >
              <ChevronDownIcon className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              {moreLabel}
            </button>
            {moreOpen && (
              <div className="space-y-5">
                <NoteOwnerField note={note} canEdit={canEdit} onChange={onUpdateOwner} />
                <NoteMarketsField note={note} canEdit={canEdit} allMarkets={allMarkets} onChange={onUpdateMarkets} />
                {/* Inline, history lives behind the toggle to keep the open note short */}
                {inline && blockTitleOf && <NoteHistory noteId={note._id} blockTitleOf={blockTitleOf} />}
              </div>
            )}
          </div>
        )}

        {blockTitleOf && !(inline && canEdit) && <NoteHistory noteId={note._id} blockTitleOf={blockTitleOf} />}
      </div>
    </Root>
  );
}

/** The current state as one control; opens the six choices */
function StateToggle({ state, onClick }: { state: EvidenceState; onClick: () => void }) {
  const conf = EVIDENCE_CONFIG[state];
  const Icon = conf.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`How sure are we: ${conf.label}. Change`}
      className={`-ml-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-md px-1.5 text-sm font-semibold hover:bg-surface-2 ${conf.text}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {conf.label}
      <ChevronDownIcon className="h-4 w-4 text-muted" aria-hidden="true" />
    </button>
  );
}
