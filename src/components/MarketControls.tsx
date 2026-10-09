import React, { useState } from "react";
import { MapPinIcon, XIcon } from "lucide-react";
import { NoteItem } from "../types/canvas";

/** Every market tag used on a canvas, sorted. */
export function marketsOf(notes: NoteItem[]): string[] {
  const byKey = new Map<string, string>();
  for (const note of notes) for (const m of note.markets ?? []) byKey.set(m.toLowerCase(), m);
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * A market view shows the notes tagged with that market plus untagged ones, since an untagged
 * note applies everywhere. Notes tagged only for other markets are hidden.
 */
export function matchesMarketFilter(note: NoteItem, market: string) {
  if (market === "all" || !note.markets || note.markets.length === 0) return true;
  return note.markets.some((m) => m.toLowerCase() === market.toLowerCase());
}

/** The note's market tags, on the card. */
export function MarketTags({ markets }: { markets?: string[] }) {
  if (!markets || markets.length === 0) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1" aria-label={`Holds in: ${markets.join(", ")}`}>
      <MapPinIcon className="h-3 w-3 text-muted" aria-hidden="true" />
      {markets.map((m) => (
        <span key={m} className="rounded border border-line bg-surface px-1.5 text-[10px] font-medium text-ink">
          {m}
        </span>
      ))}
    </p>
  );
}

/** Tag editor in the note panel. Untagged means the note holds in every market. */
export function NoteMarketsField({
  note,
  canEdit,
  allMarkets,
  onChange,
}: {
  note: NoteItem;
  canEdit: boolean;
  allMarkets: string[];
  onChange?: (markets: string[] | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const markets = note.markets ?? [];
  if (!canEdit || !onChange) {
    if (markets.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <Label />
        <MarketTags markets={markets} />
      </div>
    );
  }

  const add = () => {
    const tag = draft.trim();
    setDraft("");
    if (!tag || markets.some((m) => m.toLowerCase() === tag.toLowerCase())) return;
    onChange([...markets, tag]);
  };
  const suggestions = allMarkets.filter((m) => !markets.some((t) => t.toLowerCase() === m.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <Label />
      {markets.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {markets.map((m) => (
            <li key={m} className="inline-flex items-center gap-0.5 rounded border border-line bg-surface pl-1.5 text-xs text-ink">
              {m}
              <button
                type="button"
                onClick={() => onChange(markets.length > 1 ? markets.filter((t) => t !== m) : null)}
                aria-label={`Remove ${m}`}
                className="grid h-5 w-5 place-items-center text-muted hover:text-rose-600"
              >
                <XIcon size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {markets.length < 5 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-1.5"
        >
          <input
            value={draft}
            maxLength={30}
            list={`markets-${note._id}`}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={markets.length === 0 ? "Holds everywhere. Add a market, e.g. Jamaica" : "Add another market"}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <datalist id={`markets-${note._id}`}>
            {suggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="shrink-0 rounded-lg border border-line px-2.5 text-xs font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}

function Label() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
      <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
      Markets
    </span>
  );
}

/** Narrows the canvas to what holds in one market. Hidden until a note has a market tag. */
export function MarketFilter({
  markets,
  value,
  onChange,
}: {
  markets: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (markets.length === 0) return null;
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted">
      <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">Show notes that hold in</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="Shows notes tagged with this market, plus untagged notes, which hold everywhere"
        className={`rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent ${
          value === "all" ? "border-line bg-surface text-ink" : "border-ink bg-ink text-surface"
        }`}
      >
        <option value="all">All markets</option>
        {markets.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  );
}
