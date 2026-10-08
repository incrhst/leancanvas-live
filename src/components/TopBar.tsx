import React from "react";
import Link from "next/link";
import {
  ChevronRightIcon,
  CloudIcon,
  LayoutGridIcon,
  Share2Icon,
  SparklesIcon,
  DownloadIcon,
  FileTextIcon,
} from "lucide-react";
import { Role } from "../types/canvas";

interface TopBarProps {
  title: string;
  role: Role | "anonymous";
  isPublicViewEnabled: boolean;
  onOpenShare?: () => void;
  onOpenStressTest?: () => void;
  onExportMarkdown?: () => void;
  onExportJson?: () => void;
  /** PDF and PNG export menu, rendered before the Markdown and JSON buttons */
  exportMenu?: React.ReactNode;
}

export function TopBar({
  title,
  role,
  isPublicViewEnabled,
  onOpenShare,
  onOpenStressTest,
  onExportMarkdown,
  onExportJson,
  exportMenu,
}: TopBarProps) {
  const isAnonymous = role === "anonymous" || role === "viewer";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink text-surface hover:opacity-90"
        >
          <LayoutGridIcon size={15} aria-hidden="true" />
        </Link>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <a
            href="https://incrementic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden whitespace-nowrap text-muted text-xs hover:text-incrementic-red sm:inline transition-colors"
          >
            Incrementic
          </a>
          <ChevronRightIcon size={13} className="hidden text-subtle sm:inline" aria-hidden="true" />
          <Link href="/dashboard" className="hidden whitespace-nowrap text-muted sm:inline hover:underline">
            Dashboard
          </Link>
          <ChevronRightIcon size={14} className="hidden text-subtle sm:inline" aria-hidden="true" />
          <h1 className="truncate font-semibold text-ink">{title}</h1>
        </nav>
        <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-muted md:inline-flex">
          <CloudIcon size={13} aria-hidden="true" />
          Convex live
        </span>

        {/* Role badge */}
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
            role === "owner"
              ? "bg-purple-100 text-purple-800 border-purple-300"
              : role === "editor"
              ? "bg-blue-100 text-blue-800 border-blue-300"
              : "bg-stone-100 text-stone-700 border-stone-300"
          }`}
        >
          {role.toUpperCase()}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Export buttons */}
        {exportMenu && <div className="hidden sm:block">{exportMenu}</div>}
        {onExportMarkdown && (
          <button
            type="button"
            onClick={onExportMarkdown}
            title="Export as Markdown"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-ink rounded-md border border-line bg-surface hover:bg-surface-2 transition-colors"
          >
            <FileTextIcon size={13} />
            Markdown
          </button>
        )}
        {onExportJson && (
          <button
            type="button"
            onClick={onExportJson}
            title="Export as JSON"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-ink rounded-md border border-line bg-surface hover:bg-surface-2 transition-colors"
          >
            <DownloadIcon size={13} />
            JSON
          </button>
        )}

        {/* Stress test button */}
        {onOpenStressTest && (
          <button
            type="button"
            onClick={onOpenStressTest}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-accent/30 bg-accent-soft px-3 text-xs font-semibold text-accent hover:bg-accent-soft/80 transition-colors"
          >
            <SparklesIcon size={14} />
            Stress Test
          </button>
        )}

        {/* Share modal */}
        {onOpenShare && (
          <button
            type="button"
            onClick={onOpenShare}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-white hover:bg-accent/90 transition-colors shadow-sm"
          >
            <Share2Icon size={14} />
            Share
          </button>
        )}
      </div>
    </header>
  );
}