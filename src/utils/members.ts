import { createContext } from "react";
import { Role } from "../types/canvas";

export interface CanvasMember {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Canvas members by user id, for showing note owners. Empty on the public share link. */
export const MembersContext = createContext<Map<string, CanvasMember>>(new Map());

/** "Ana Brown" -> "AB", "ana@x.com" -> "A". */
export function initials(name: string): string {
  const words = name.split(/[\s@._-]+/).filter(Boolean);
  if (name.includes("@")) return (words[0]?.[0] ?? "?").toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}
