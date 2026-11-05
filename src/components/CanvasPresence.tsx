"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { XIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { initials } from "../utils/members";
import { findArrivals, HEARTBEAT_MS } from "../utils/presence";

export interface PresentPerson {
  userId: string;
  userName: string;
  userAvatar?: string;
}

const MAX_AVATARS = 3;
const NOTICE_MS = 6000;

function PersonAvatar({ person, className }: { person: PresentPerson; className: string }) {
  const shape = `shrink-0 rounded-full ${className}`;
  if (person.userAvatar) {
    return <img src={person.userAvatar} alt="" referrerPolicy="no-referrer" className={`${shape} object-cover`} />;
  }
  return (
    <span className={`${shape} grid place-items-center bg-ink text-[9px] font-semibold text-surface`} aria-hidden="true">
      {initials(person.userName)}
    </span>
  );
}

function ArrivalNotice({ person, onDismiss }: { person: PresentPerson; onDismiss: (userId: string) => void }) {
  const reduce = useReducedMotion();

  // The clock only runs while the tab is showing, so someone away from it still sees who came by when they return.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(() => onDismiss(person.userId), NOTICE_MS);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [person.userId, onDismiss]);

  return (
    <motion.div
      layout={!reduce}
      className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-line bg-surface p-2.5 shadow-lg"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.18 }}
    >
      <PersonAvatar person={person} className="h-7 w-7" />
      <p className="min-w-0 flex-1 text-xs text-ink">
        <span className="font-semibold">{person.userName}</span> opened this canvas
      </p>
      <button type="button" aria-label="Dismiss" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => onDismiss(person.userId)}>
        <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

/** Who else is here, for the top bar, and a notice as each new person arrives. */
export function PresenceView({ others, arrivals, onDismiss }: { others: PresentPerson[]; arrivals: PresentPerson[]; onDismiss: (userId: string) => void }) {
  const shown = others.slice(0, MAX_AVATARS);
  const extra = others.length - shown.length;
  const names = others.map((p) => p.userName).join(", ");

  return (
    <>
      {others.length > 0 && (
        <div role="img" aria-label={`Also here: ${names}`} title={`Also here: ${names}`} className="hidden items-center -space-x-1.5 sm:flex">
          {shown.map((person) => (
            <PersonAvatar key={person.userId} person={person} className="h-6 w-6 ring-2 ring-surface" />
          ))}
          {extra > 0 && <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-[10px] font-medium text-muted ring-2 ring-surface">+{extra}</span>}
        </div>
      )}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-16 z-40 flex w-[min(300px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {arrivals.map((person) => (
            <ArrivalNotice key={person.userId} person={person} onDismiss={onDismiss} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

/** Tells a canvas you're on it while its tab is showing, and shows you who else is. Signed-in members only. */
export function CanvasPresence({ canvasId, currentUserId }: { canvasId: Id<"canvases">; currentUserId: string }) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const everyone = useQuery(api.presence.getPresence, { canvasId });
  const [arrivals, setArrivals] = useState<PresentPerson[]>([]);
  // Null until the first answer: people already here when you arrive aren't news.
  const lastSeen = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    const beat = () => {
      // A missed beat only means showing as away for a moment; the next one puts it right.
      if (!document.hidden) heartbeat({ canvasId }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [canvasId, heartbeat]);

  const others = useMemo(() => (everyone ?? []).filter((p) => p.userId !== currentUserId), [everyone, currentUserId]);

  useEffect(() => {
    if (!everyone) return;
    const seen = lastSeen.current;
    if (seen) {
      const fresh = findArrivals(seen, others);
      if (fresh.length) setArrivals((current) => [...current.filter((a) => !fresh.some((f) => f.userId === a.userId)), ...fresh]);
    }
    const next = new Map(seen ?? []);
    for (const person of others) next.set(person.userId, person.updatedAt);
    lastSeen.current = next;
  }, [everyone, others]);

  const dismiss = useCallback((userId: string) => setArrivals((current) => current.filter((a) => a.userId !== userId)), []);

  return <PresenceView others={others} arrivals={arrivals} onDismiss={dismiss} />;
}
