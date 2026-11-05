import { useCallback, useMemo, useState } from "react";
import type { EvidenceState, NoteItem } from "../types/canvas";

/** Whether notes outside the filter fade back (layout stays put) or leave the canvas. */
export type EvidenceFilterMode = "dim" | "hide";

/** The states that still need work: not looked at, or believed but untested. */
export const NEEDS_EVIDENCE: EvidenceState[] = ["unknown", "assumption"];

export interface EvidenceFilter {
  /** Selected states. Empty means no filter: every note shows normally. */
  active: EvidenceState[];
  mode: EvidenceFilterMode;
}

export const NO_EVIDENCE_FILTER: EvidenceFilter = { active: [], mode: "dim" };

export function noteMatchesEvidence(note: NoteItem, filter?: EvidenceFilter) {
  if (!filter || filter.active.length === 0) return true;
  return filter.active.includes(note.evidenceState || "assumption");
}

/** Filter state for the canvas, shared by the owner page and the public share page. */
export function useEvidenceFilter() {
  const [active, setActive] = useState<EvidenceState[]>([]);
  const [mode, setMode] = useState<EvidenceFilterMode>("dim");

  const toggle = useCallback(
    (state: EvidenceState) =>
      setActive((cur) => (cur.includes(state) ? cur.filter((s) => s !== state) : [...cur, state])),
    []
  );
  const showNeedsEvidence = useCallback(() => setActive(NEEDS_EVIDENCE), []);
  const clear = useCallback(() => setActive([]), []);
  const filter = useMemo<EvidenceFilter>(() => ({ active, mode }), [active, mode]);

  return { filter, toggle, showNeedsEvidence, clear, setMode };
}
