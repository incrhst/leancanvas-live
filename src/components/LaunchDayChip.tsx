import React, { useEffect, useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { formatCalendarDate, planDay, todayLocal } from "../utils/testFields";

interface LaunchDayChipProps {
  launchDate?: string;
  /** Editors can set, change or clear the launch date */
  onChange?: (launchDate: string | null) => void;
}

function dayLabel(launchDate: string) {
  const day = planDay(launchDate, todayLocal())!;
  if (day >= 0) return `Day ${day}`;
  return `Launch in ${-day} day${day === -1 ? "" : "s"}`;
}

/**
 * Where the plan is today ("Day 12"), counted from the canvas's launch date (day 0).
 */
export function LaunchDayChip({ launchDate, onChange }: LaunchDayChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!launchDate && !onChange) return null;

  const chipClass =
    "inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium";
  const title = launchDate ? `Launched ${formatCalendarDate(launchDate)} (day 0)` : "Set the launch date (day 0)";

  if (!onChange) {
    return (
      <span className={`${chipClass} border-line bg-surface-2 text-ink`} title={title}>
        <CalendarIcon size={12} aria-hidden="true" />
        {dayLabel(launchDate!)}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-expanded={open}
        className={`${chipClass} ${
          launchDate ? "border-line bg-surface-2 text-ink" : "border-dashed border-line text-muted"
        } hover:bg-surface-2 transition-colors`}
      >
        <CalendarIcon size={12} aria-hidden="true" />
        {launchDate ? dayLabel(launchDate) : <span className="hidden sm:inline">Set launch date</span>}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 space-y-2 rounded-lg border border-line bg-surface p-3 shadow-lg">
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-muted">Launch date (day 0)</span>
            <input
              type="date"
              value={launchDate ?? ""}
              onChange={(e) => e.target.value && onChange(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <p className="text-[11px] text-muted">Review dates show as days of the plan, like “Day 30”.</p>
          {launchDate && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="text-[11px] text-muted underline hover:text-rose-600"
            >
              Clear launch date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
