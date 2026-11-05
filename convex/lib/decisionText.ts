/**
 * Plain wording for a decision's deadline and default, shared by the app, the emails and the
 * public answer page. No server imports, so the browser can use it too.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-11-01" -> "1 November", adding the year when it isn't `currentYear`. */
export function formatLongDate(date: string, currentYear: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d || m > 12) return date;
  return `${d} ${MONTHS[m - 1]}${y !== currentYear ? ` ${y}` : ""}`;
}

/** Ends a sentence with a full stop unless it already has one. */
function sentence(text: string) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Lower-cases the first letter so a default reads inside a sentence ("We sign" -> "we sign"). */
function inline(text: string) {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/**
 * What happens if nobody decides: "If nothing is decided by 1 November, we sign the agency."
 * Once the due date has passed on an open decision, it says the default now applies instead.
 * Null when the decision has no default.
 */
export function defaultOutcomeLine(
  decision: { defaultOutcome?: string; dueDate: string; status: string },
  today: string
): string | null {
  const outcome = decision.defaultOutcome?.trim();
  if (!outcome) return null;
  const by = formatLongDate(decision.dueDate, Number(today.slice(0, 4)));
  if (decision.status === "open" && isPastDue(decision.dueDate, today)) {
    return `Nothing was decided by ${by}, so the default now applies: ${sentence(inline(outcome))}`;
  }
  return `If nothing is decided by ${by}, ${sentence(inline(outcome))}`;
}

/** The due date ("YYYY-MM-DD") is before today: the whole due day counts as on time. */
export function isPastDue(dueDate: string, today: string) {
  return dueDate < today;
}
