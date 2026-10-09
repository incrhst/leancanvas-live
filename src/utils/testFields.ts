import { createContext } from "react";
import { NoteItem, Verdict } from "../types/canvas";
import { daysBetween } from "../../convex/lib/testFields";

export const VERDICT_CONFIG: Record<Verdict, { label: string; text: string; dot: string }> = {
  pass: { label: "Pass", text: "text-emerald-700", dot: "bg-emerald-500" },
  fail: { label: "Fail", text: "text-rose-700", dot: "bg-rose-500" },
  inconclusive: { label: "Inconclusive", text: "text-stone-600", dot: "bg-stone-400" },
};

/** Today in the viewer's own timezone, as YYYY-MM-DD. */
export function todayLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2026-11-08" -> "8 Nov", adding the year when it isn't this year. */
export function formatCalendarDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const value = new Date(y, m - 1, d);
  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

export function hasTest(note: NoteItem): boolean {
  return !!(note.measure || note.passMark || note.reviewDate || note.latestResult);
}

/** The review date has passed with no result recorded on or after it. */
export function isReviewOverdue(note: NoteItem): boolean {
  if (!note.reviewDate || note.reviewDate >= todayLocal()) return false;
  return !note.latestResult || note.latestResult.date < note.reviewDate;
}

/** The canvas's launch date (day 0), if it has one. Provided by the canvas and share pages. */
export const LaunchDateContext = createContext<string | undefined>(undefined);

/** Day of the plan for a calendar date, or null when there's no launch date. */
export function planDay(launchDate: string | undefined, date: string): number | null {
  return launchDate ? daysBetween(launchDate, date) : null;
}

/** "Day 30" when the canvas has a launch date and the date is on or after it, otherwise "8 Nov". */
export function formatPlanDate(launchDate: string | undefined, date: string): string {
  const day = planDay(launchDate, date);
  return day !== null && day >= 0 ? `Day ${day}` : formatCalendarDate(date);
}
