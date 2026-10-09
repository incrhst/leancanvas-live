import React, { useContext } from "react";
import { UserIcon } from "lucide-react";
import { NoteItem } from "../types/canvas";
import { CanvasMember, MembersContext, initials } from "../utils/members";

function sortedMembers(members: Map<string, CanvasMember>) {
  return [...members.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The owner's initials on a note. Renders nothing for unowned notes or where members aren't known. */
export function OwnerChip({ ownerId }: { ownerId?: string }) {
  const members = useContext(MembersContext);
  const owner = ownerId ? members.get(ownerId) : undefined;
  if (!owner) return null;
  return (
    <span
      title={`Owner: ${owner.name}`}
      aria-label={`Owner: ${owner.name}`}
      className="grid h-5 min-w-5 place-items-center rounded-full border border-line bg-surface px-1 text-[10px] font-semibold text-ink"
    >
      {initials(owner.name)}
    </span>
  );
}

/** Owner picker in the note panel; read-only text for viewers. */
export function NoteOwnerField({
  note,
  canEdit,
  onChange,
}: {
  note: NoteItem;
  canEdit: boolean;
  onChange?: (ownerId: string | null) => void;
}) {
  const members = useContext(MembersContext);
  if (members.size === 0) return null;
  const owner = note.ownerId ? members.get(note.ownerId) : undefined;

  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Owner
      </span>
      {canEdit && onChange ? (
        <select
          value={note.ownerId ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">No owner</option>
          {sortedMembers(members).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.role === "viewer" ? " (view only)" : ""}
            </option>
          ))}
          {note.ownerId && !owner && <option value={note.ownerId}>Former member</option>}
        </select>
      ) : (
        <p className="text-sm text-ink">{owner?.name ?? (note.ownerId ? "Former member" : "No owner")}</p>
      )}
    </label>
  );
}

export type OwnerFilterValue = "all" | "mine" | "unassigned" | string;

/** Narrows the canvas to one person's notes. */
export function OwnerFilter({
  value,
  currentUserId,
  onChange,
}: {
  value: OwnerFilterValue;
  currentUserId?: string;
  onChange: (value: OwnerFilterValue) => void;
}) {
  const members = useContext(MembersContext);
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted">
      <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">Show notes owned by</span>
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
        <option value="unassigned">No owner</option>
      </select>
    </label>
  );
}

export function matchesOwnerFilter(note: NoteItem, filter: OwnerFilterValue, currentUserId?: string) {
  if (filter === "all") return true;
  if (filter === "unassigned") return !note.ownerId;
  return note.ownerId === (filter === "mine" ? currentUserId : filter);
}
