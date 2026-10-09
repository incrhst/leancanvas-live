import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon, GavelIcon, MapPinIcon, SearchIcon, XIcon } from "lucide-react";
import { BlockDef, EvidenceState, NoteItem } from "../types/canvas";
import { EVIDENCE_CONFIG, EvidenceBadge } from "./EvidenceBadge";
import { OwnerChip } from "./OwnerControls";
import { MembersContext } from "../utils/members";
import { VERDICT_CONFIG, formatCalendarDate, isReviewOverdue } from "../utils/testFields";
import { EVIDENCE_STATES } from "../utils/evidenceStates";

interface NoteSearchProps {
  notes: NoteItem[];
  blocks: BlockDef[];
  onSelect: (noteId: string) => void;
  onClose: () => void;
}

const MAX_RESULTS = 50;

/** Splits text around the (case-insensitive) query so matches can be marked. */
function highlight(text: string, query: string) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const k = lower.indexOf(q, i);
    if (k < 0) {
      parts.push(text.slice(i));
      break;
    }
    if (k > i) parts.push(text.slice(i, k));
    parts.push(
      <mark key={k} className="rounded bg-accent-soft px-0.5 -mx-0.5 font-semibold text-ink">
        {text.slice(k, k + q.length)}
      </mark>
    );
    i = k + q.length;
  }
  return parts;
}

/** Quick search over every note on the canvas. Opens from Cmd/Ctrl+K or "/"; Enter jumps to the note. */
export function NoteSearch({ notes, blocks, onSelect, onClose }: NoteSearchProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<EvidenceState | "all">("all");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const blockTitle = useMemo(() => new Map(blocks.map((b) => [b.id, b.title])), [blocks]);
  const members = useContext(MembersContext);
  const q = query.trim();

  const results = useMemo(() => {
    const needle = q.toLowerCase();
    return notes
      .filter((n) => state === "all" || (n.evidenceState || "assumption") === state)
      .filter(
        (n) =>
          !needle ||
          n.content.toLowerCase().includes(needle) ||
          (blockTitle.get(n.block) ?? "").toLowerCase().includes(needle) ||
          (n.markets ?? []).some((m) => m.toLowerCase().includes(needle)) ||
          (n.ownerId ? (members.get(n.ownerId)?.name ?? "").toLowerCase().includes(needle) : false)
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_RESULTS);
  }, [notes, q, state, blockTitle, members]);

  const current = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current, results]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(current + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === "Enter" && results[current]) {
      e.preventDefault();
      onSelect(results[current]._id);
    }
  };

  const chip = "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search notes"
        onKeyDown={onKeyDown}
        className="flex max-h-[70vh] w-full max-w-[700px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
          <SearchIcon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search all notes…"
            aria-label="Search notes"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-muted"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
            >
              <XIcon className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted">Esc</kbd>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <button
            type="button"
            aria-pressed={state === "all"}
            onClick={() => setState("all")}
            className={`${chip} ${state === "all" ? "border-ink bg-ink text-surface" : "border-line bg-surface text-muted hover:text-ink"}`}
          >
            All states
          </button>
          {EVIDENCE_STATES.map((s) => {
            const cfg = EVIDENCE_CONFIG[s];
            const on = state === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setState(on ? "all" : s);
                  setActive(0);
                }}
                className={`${chip} ${on ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "border-line bg-surface text-muted hover:text-ink"}`}
              >
                <cfg.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        <div ref={listRef} className="min-h-[200px] flex-1 overflow-y-auto p-2">
          {results.length > 0 ? (
            <>
              <div className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {q ? "Matching notes" : "Recently changed"}
              </div>
              {results.map((n, i) => {
                const cfg = EVIDENCE_CONFIG[n.evidenceState || "assumption"];
                const isActive = i === current;
                return (
                  <button
                    key={n._id}
                    type="button"
                    data-active={isActive}
                    onClick={() => onSelect(n._id)}
                    onMouseMove={() => setActive(i)}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left ${
                      isActive ? "border-accent/30 bg-accent-soft" : "border-transparent"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      title={cfg.label}
                    >
                      <cfg.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="line-clamp-2 text-sm leading-snug text-ink">{highlight(n.content, q)}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <EvidenceBadge state={n.evidenceState || "assumption"} />
                        <span className="truncate">{highlight(blockTitle.get(n.block) ?? n.block, q)}</span>
                        <OwnerChip ownerId={n.ownerId} />
                        {n.markets && n.markets.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="h-3 w-3" aria-hidden="true" />
                            {n.markets.join(", ")}
                          </span>
                        )}
                        {n.latestResult?.verdict && (
                          <span className={`inline-flex items-center gap-1 font-semibold ${VERDICT_CONFIG[n.latestResult.verdict].text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${VERDICT_CONFIG[n.latestResult.verdict].dot}`} />
                            {VERDICT_CONFIG[n.latestResult.verdict].label}
                          </span>
                        )}
                        {n.reviewDate && (
                          <span className={`inline-flex items-center gap-1 ${isReviewOverdue(n) ? "font-semibold text-rose-700" : ""}`}>
                            <CalendarIcon className="h-3 w-3" aria-hidden="true" />
                            {isReviewOverdue(n) ? "Overdue " : "Review "}
                            {formatCalendarDate(n.reviewDate)}
                          </span>
                        )}
                        {n.decision?.status === "open" && (
                          <span className="inline-flex items-center gap-1">
                            <GavelIcon className="h-3 w-3" aria-hidden="true" />
                            Decision open
                          </span>
                        )}
                      </span>
                    </span>
                    {isActive && <span className="hidden shrink-0 pt-0.5 text-xs font-medium text-muted sm:inline">Go to note ↵</span>}
                  </button>
                );
              })}
            </>
          ) : (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-1 px-10 text-center">
              <SearchIcon className="mb-1 h-7 w-7 text-subtle" aria-hidden="true" />
              <div className="text-sm font-semibold text-ink">{q ? `Nothing matches “${q}”` : "No notes here yet"}</div>
              <div className="text-xs text-muted">{q ? "Try a shorter word, or clear the state filter." : "Add a note to a block and it shows up here."}</div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-line bg-canvas px-5 py-3 text-xs text-muted">
          <span>
            {results.length}
            {results.length === MAX_RESULTS ? "+" : ""} {results.length === 1 ? "note" : "notes"}
          </span>
          <span className="hidden gap-4 sm:flex">
            <span>↑ ↓ to move</span>
            <span>↵ to open</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Cmd/Ctrl+K opens quick search anywhere; "/" does too when not typing in a field. */
export function useNoteSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing;
      if (!combo && !slash) return;
      e.preventDefault();
      onOpen();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}

export function NoteSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Search notes (Ctrl/Cmd+K or /)"
      className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-xs text-muted hover:bg-surface-2 hover:text-ink transition-colors"
    >
      <SearchIcon className="h-3.5 w-3.5" aria-hidden="true" />
      Search notes
      <kbd className="hidden rounded border border-line bg-surface-2 px-1 text-[10px] font-medium sm:inline">/</kbd>
    </button>
  );
}
