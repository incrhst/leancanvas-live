import React, { useContext } from "react";
import { UserIcon } from "lucide-react";
import { NoteItem } from "../types/canvas";
import { CanvasMember, MembersContext, initials } from "../utils/members";

/**
 * The driver is the one person doing the work on a note. Stored as the note's `ownerId`, but never
 * called "owner" on screen, so it doesn't read as the canvas owner role.
 */

function sortedMembers(members: Map<string, CanvasMember>) {
  return [...members.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The driver's initials on a note. Renders nothing for notes with no driver or where members aren't known. */
export function DriverChip({ driverId }: { driverId?: string }) {
  const members = useContext(MembersContext);
  const driver = driverId ? members.get(driverId) : undefined;
  if (!driver) return null;
  return (
    <span
      title={`Driver: ${driver.name}`}
      aria-label={`Driver: ${driver.name}`}
      className="grid h-5 min-w-5 place-items-center rounded-full border border-line bg-surface px-1 text-[10px] font-semibold text-ink"
    >
      {initials(driver.name)}
    </span>
  );
}

/** Driver picker in the note panel; read-only text for viewers. */
export function NoteDriverField({
  note,
  canEdit,
  onChange,
}: {
  note: NoteItem;
  canEdit: boolean;
  onChange?: (driverId: string | null) => void;
}) {
  const members = useContext(MembersContext);
  if (members.size === 0) return null;
  const driver = note.ownerId ? members.get(note.ownerId) : undefined;

  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Driver
      </span>
      {canEdit && onChange ? (
        <select
          value={note.ownerId ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">No driver</option>
          {sortedMembers(members).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.role === "viewer" ? " (view only)" : ""}
            </option>
          ))}
          {note.ownerId && !driver && <option value={note.ownerId}>Former member</option>}
        </select>
      ) : (
        <p className="text-sm text-ink">{driver?.name ?? (note.ownerId ? "Former member" : "No driver")}</p>
      )}
    </label>
  );
}

export type DriverFilterValue = "all" | "mine" | "unassigned" | string;

/** Narrows the canvas to the notes one person is driving. */
export function DriverFilter({
  value,
  currentUserId,
  onChange,
}: {
  value: DriverFilterValue;
  currentUserId?: string;
  onChange: (value: DriverFilterValue) => void;
}) {
  const members = useContext(MembersContext);
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted">
      <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">Show notes by driver</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent ${
          value === "all" ? "border-line bg-surface text-ink" : "border-ink bg-ink text-surface"
        }`}
      >
        <option value="all">Everyone's notes</option>
        {currentUserId && members.has(currentUserId) && <option value="mine">My notes</option>}
        {sortedMembers(members)
          .filter((m) => m.id !== currentUserId)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}'s notes
            </option>
          ))}
        <option value="unassigned">No driver</option>
      </select>
    </label>
  );
}

export function matchesDriverFilter(note: NoteItem, filter: DriverFilterValue, currentUserId?: string) {
  if (filter === "all") return true;
  if (filter === "unassigned") return !note.ownerId;
  return note.ownerId === (filter === "mine" ? currentUserId : filter);
}
