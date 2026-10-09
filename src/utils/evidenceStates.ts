import { EvidenceState } from "../types/canvas";

export const EVIDENCE_STATES: EvidenceState[] = [
  "unknown",
  "assumption",
  "observed",
  "supported",
  "contradicted",
  "decision",
];

/** What each evidence state means. Shown in the legend and given to agents in the MCP tool descriptions. */
export const EVIDENCE_MEANINGS: Record<EvidenceState, { label: string; desc: string }> = {
  unknown: { label: "Unknown", desc: "Not looked at yet" },
  assumption: { label: "Assumption", desc: "We believe it, but haven't tested it" },
  observed: { label: "Observed", desc: "Seen at least once, not yet proven" },
  supported: { label: "Supported", desc: "Tested, and the evidence backs it" },
  contradicted: { label: "Contradicted", desc: "Tested, and the evidence goes against it" },
  decision: { label: "Decision", desc: "The team has committed to this" },
};

/** "unknown = not looked at yet; assumption = …", for tool descriptions. */
export const EVIDENCE_GLOSSARY = EVIDENCE_STATES.map(
  (state) => `${state} = ${EVIDENCE_MEANINGS[state].desc.toLowerCase()}`
).join("; ");
