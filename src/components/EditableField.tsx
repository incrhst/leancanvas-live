import React, { useEffect, useRef, useState } from "react";

interface EditableFieldProps {
  value: string;
  /** Called with the trimmed value when it changes: on blur for text, on pick for dates */
  onCommit: (value: string) => void;
  /** Blank input reverts instead of committing */
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "date";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * An input that keeps a local draft while focused and otherwise follows `value`, so changes
 * made elsewhere (another person, an agent) show up without clobbering what's being typed.
 */
export function EditableField({
  value,
  onCommit,
  required = false,
  multiline = false,
  rows = 3,
  type = "text",
  placeholder,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: EditableFieldProps) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  const commit = (next: string) => {
    const trimmed = next.trim();
    if (required && !trimmed) {
      setDraft(value);
      return;
    }
    if (trimmed !== value) onCommit(trimmed);
  };

  const shared = {
    value: draft,
    disabled,
    placeholder,
    "aria-label": ariaLabel,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      if (type !== "date") commit(draft);
    },
    className: `w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-85 ${className}`,
  };

  if (multiline) {
    return (
      <textarea
        {...shared}
        rows={rows}
        onChange={(e) => setDraft(e.target.value)}
        className={`${shared.className} resize-none leading-snug`}
      />
    );
  }

  return (
    <input
      {...shared}
      type={type}
      onChange={(e) => {
        setDraft(e.target.value);
        if (type === "date") commit(e.target.value);
      }}
    />
  );
}
