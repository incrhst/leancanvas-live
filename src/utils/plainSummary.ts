import { EvidenceState, NoteItem, Verdict } from "../types/canvas";
import { formatCalendarDate, formatPlanDate } from "./testFields";

/**
 * A plain-language summary of a canvas: one short paragraph per block, for someone who has never
 * seen the canvas. Built from the notes alone (no AI), so every sentence traces back to a note.
 * Shared by the canvas page's export and the MCP export_canvas tool.
 */
export interface SummaryNote {
  text: string;
  state: EvidenceState;
  markets?: string[];
  result?: { text: string; verdict?: Verdict };
  decision?: { status: string; question: string; decider?: string; dueDate: string };
}

export interface SummaryInput {
  title: string;
  /** Today, YYYY-MM-DD, passed in so the summary doesn't depend on the clock it runs on */
  today: string;
  launchDate?: string;
  blocks: { title: string; notes: SummaryNote[] }[];
}

// Most settled first, so the paragraph opens with what's decided or known.
const GROUPS: { state: EvidenceState; lead: string }[] = [
  { state: "decision", lead: "We've decided" },
  { state: "contradicted", lead: "We tested and it didn't hold" },
  { state: "supported", lead: "We tested and it's holding up" },
  { state: "observed", lead: "Early signs, not yet proven" },
  { state: "assumption", lead: "We believe this but haven't tested it yet" },
  { state: "unknown", lead: "Not looked at yet" },
];

const VERDICT_WORDS: Record<Verdict, string> = {
  pass: "met the target",
  fail: "missed the target",
  inconclusive: "too early to tell",
};

const MAX_ITEMS = 3;

function clean(text: string) {
  return text.trim().replace(/\s+/g, " ").replace(/[.;:,\s]+$/, "");
}

function joinWords(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function item(note: SummaryNote) {
  let text = clean(note.text);
  if (note.markets && note.markets.length > 0) text += ` (${joinWords(note.markets)} only)`;
  if (note.result) {
    const verdict = note.result.verdict ? `, ${VERDICT_WORDS[note.result.verdict]}` : "";
    text += `, latest result: ${clean(note.result.text)}${verdict}`;
  }
  return text;
}

function sentence(lead: string, notes: SummaryNote[]) {
  const items = notes.slice(0, MAX_ITEMS).map(item);
  const more = notes.length > MAX_ITEMS ? `; and ${notes.length - MAX_ITEMS} more` : "";
  return `${lead}: ${items.join("; ")}${more}.`;
}

/** "1. Ideal Customer" -> "Ideal Customer" */
function blockName(title: string) {
  return title.replace(/^\d+\.\s*/, "");
}

export function blockParagraph(notes: SummaryNote[], launchDate?: string): string {
  if (notes.length === 0) return "Nothing written here yet.";
  const parts: string[] = [];
  for (const { state, lead } of GROUPS) {
    const inGroup = notes.filter((n) => n.state === state);
    if (inGroup.length > 0) parts.push(sentence(lead, inGroup));
  }
  for (const n of notes) {
    const d = n.decision;
    if (d?.status !== "open") continue;
    const who = d.decider ? `${d.decider.split(" ")[0]} to decide` : "a decision";
    parts.push(`Waiting on ${who} by ${formatPlanDate(launchDate, d.dueDate).replace(/^Day/, "day")}: ${clean(d.question)}?`.replace(/\?\?$/, "?"));
  }
  return parts.join(" ");
}

export function plainSummary(input: SummaryInput): string {
  const day = input.launchDate ? formatPlanDate(input.launchDate, input.today) : null;
  const when = `${formatCalendarDate(input.today)}${day && day.startsWith("Day") ? ` (${day.toLowerCase()} of the plan)` : ""}`;
  const lines = [`# ${input.title}`, "", `Where the plan stands on ${when}.`, ""];
  for (const block of input.blocks) {
    lines.push(`## ${blockName(block.title)}`, "", blockParagraph(block.notes, input.launchDate), "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

/** Builds the summary input from the notes the canvas page already has. */
export function summaryFromNotes(args: {
  title: string;
  today: string;
  launchDate?: string;
  blocks: { id: string; title: string }[];
  notes: NoteItem[];
  nameOf: (userId: string) => string | undefined;
}): SummaryInput {
  return {
    title: args.title,
    today: args.today,
    launchDate: args.launchDate,
    blocks: args.blocks.map((block) => ({
      title: block.title,
      notes: args.notes
        .filter((n) => n.block === block.id)
        .sort((a, b) => a.order - b.order)
        .map((n) => ({
          text: n.content,
          state: n.evidenceState,
          markets: n.markets,
          result: n.latestResult,
          decision: n.decision && {
            status: n.decision.status,
            question: n.decision.question,
            decider: args.nameOf(n.decision.deciderId),
            dueDate: n.decision.dueDate,
          },
        })),
    })),
  };
}
