import React from "react";
import Link from "next/link";
import { LayoutGridIcon, Share2Icon, SparklesIcon, CameraIcon, PresentationIcon } from "lucide-react";
import { Role } from "../types/canvas";

interface TopBarProps {
  title: string;
  role: Role | "anonymous";
  isPublicViewEnabled: boolean;
  onOpenShare?: () => void;
  onOpenStressTest?: () => void;
  onOpenSnapshots?: () => void;
  /** Link to review mode */
  reviewHref?: string;
  /** Export menu: PDF, PNG and the text exports */
  exportMenu?: React.ReactNode;
  /** Shown after the title, e.g. the launch day chip */
  status?: React.ReactNode;
}

// Secondary actions stay quiet so Share is the one button that stands out
const quietButton =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink transition-colors";

export function TopBar({
  title,
  role,
  onOpenShare,
  onOpenStressTest,
  onOpenSnapshots,
  reviewHref,
  exportMenu,
  status,
}: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3 sm:gap-4 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          title="All canvases"
          aria-label="All canvases"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink text-surface hover:opacity-90"
        >
          <LayoutGridIcon size={15} aria-hidden="true" />
        </Link>
        <h1 title={title} className="min-w-0 truncate text-sm font-semibold text-ink">
          {title}
        </h1>

        {/* Owners are the norm; only say so when you're not one */}
        {role !== "owner" && (
          <span className="hidden shrink-0 text-[11px] text-muted sm:inline">
            {role === "editor" ? "Can edit" : "View only"}
          </span>
        )}
        {status && <div className="flex shrink-0 items-center gap-1.5">{status}</div>}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {exportMenu && <div className="hidden sm:block">{exportMenu}</div>}

        {reviewHref && (
          <Link
            href={reviewHref}
            title="Review mode: tests and results, open decisions, and changes since the last snapshot"
            className={quietButton}
          >
            <PresentationIcon size={14} />
            <span className="hidden lg:inline">Review</span>
          </Link>
        )}

        {onOpenSnapshots && (
          <button type="button" onClick={onOpenSnapshots} title="Snapshots: freeze the canvas and compare" className={quietButton}>
            <CameraIcon size={14} />
            <span className="hidden lg:inline">Snapshots</span>
          </button>
        )}

        {onOpenStressTest && (
          <button type="button" onClick={onOpenStressTest} title="Stress test" className={quietButton}>
            <SparklesIcon size={14} />
            <span className="hidden lg:inline">Stress test</span>
          </button>
        )}

        {onOpenShare && (
          <button
            type="button"
            onClick={onOpenShare}
            title="Share"
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors shadow-sm sm:px-3"
          >
            <Share2Icon size={14} />
            <span className="hidden sm:inline">Share</span>
          </button>
        )}
      </div>
    </header>
  );
}
