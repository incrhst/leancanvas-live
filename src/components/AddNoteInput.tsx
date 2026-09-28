import React, { useState } from "react";
import { PlusIcon } from "lucide-react";

interface AddNoteInputProps {
  blockTitle: string;
  onAdd: (text: string) => void;
}

export function AddNoteInput({ blockTitle, onAdd }: AddNoteInputProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (value) onAdd(value);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        
        <PlusIcon size={13} aria-hidden="true" />
        Add note
      </button>);

  }

  return (
    <div>
      <label className="sr-only" htmlFor={`add-${blockTitle}`}>
        New note in {blockTitle}
      </label>
      <textarea
        id={`add-${blockTitle}`}
        autoFocus
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            setText("");
            setOpen(false);
          }
        }}
        placeholder="Type a note…"
        className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] leading-snug text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
      
      <p className="mt-1 px-0.5 text-[11px] text-muted">Enter to add · Esc to cancel</p>
    </div>);

}