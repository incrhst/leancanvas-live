import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trash2Icon, XIcon, ChevronDownIcon } from "lucide-react";
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
  onUpdateEvidence: (state: EvidenceState) => void;
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
}: NoteDetailPanelProps) {
  // After a state change here, offer a line on why. Cleared when another note is opened.
  const [changedTo, setChangedTo] = useState<EvidenceState | null>(null);
  const [reason, setReason] = useState("");
  const [reasonStatus, setReasonStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [showTest, setShowTest] = useState(false);
  const [showMore, setShowMore] = useState<boolean | null>(null);
  const step = NEXT_STEP[note.evidenceState];
  const testPrompt = note.evidenceState === "assumption" || note.evidenceState === "observed";
  const decisionPrompt = note.evidenceState === "supported" || note.evidenceState === "contradicted";
  const testVisible = hasTest(note) || (testPrompt && showTest);
  const moreOpen = showMore ?? !!(note.ownerId || note.markets?.length);

  useEffect(() => {
    setShowTest(false);
    setShowMore(null);
    setChangedTo(null);
    setReason("");
    setReasonStatus("idle");
  }, [note._id]);

  const changeState = (state: EvidenceState) => {
    if (state === note.evidenceState) return;
    onUpdateEvidence(state);
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className="flex h-full flex-col bg-surface overflow-y-auto"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{blockTitle}</p>
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
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-stone-100 hover:text-ink transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6 flex-1">
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
          {canEdit ? (
            <>
              <div className="grid grid-cols-3 gap-2">
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
                      <kbd aria-hidden="true" className="hidden rounded border border-line bg-surface px-1 text-[10px] font-normal text-muted md:inline">
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
          ) : (
            <>
              <EvidenceBadge state={note.evidenceState} />
              <p className="text-xs text-muted">Viewing in read-only mode. Sign in with editor permissions to make changes.</p>
            </>
          )}
        </div>

        {canEdit && (
          <section
            aria-label="Next step"
            className={`space-y-3 rounded-xl border p-4 ${EVIDENCE_CONFIG[note.evidenceState].card}`}
          >
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Next step</p>
              <p className="text-sm font-semibold text-ink">{step.title}</p>
              <p className="text-xs text-muted">{step.body}</p>
            </div>
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
                className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90"
              >
                Add a test
              </button>
            )}
            {testVisible && <NoteTestFields note={note} canEdit={canEdit} onUpdate={onUpdateTest} />}
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
              {moreOpen ? "Hide owner and markets" : "Owner and markets"}
            </button>
            {moreOpen && (
              <div className="space-y-5">
                <NoteOwnerField note={note} canEdit={canEdit} onChange={onUpdateOwner} />
                <NoteMarketsField note={note} canEdit={canEdit} allMarkets={allMarkets} onChange={onUpdateMarkets} />
              </div>
            )}
          </div>
        )}

        {blockTitleOf && <NoteHistory noteId={note._id} blockTitleOf={blockTitleOf} />}
      </div>
    </motion.div>
  );
}