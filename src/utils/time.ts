import { formatDistanceToNowStrict } from "date-fns";

export function formatRelative(timestamp: number): string {
  if (Date.now() - timestamp < 60_000) return "Just now";
  return `${formatDistanceToNowStrict(timestamp)} ago`;
}

export function truncate(text: string, max = 28): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}