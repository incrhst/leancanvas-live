"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LeanCanvasBoard, CANVAS_BLOCKS } from "../../../components/LeanCanvasBoard";
import { NoteDetailPanel } from "../../../components/NoteDetailPanel";
import { StressTestPanel } from "../../../components/StressTestPanel";
import { NoteItem, StressTestResult } from "../../../types/canvas";
import { GlobeIcon, SparklesIcon, LogInIcon, FileTextIcon, DownloadIcon } from "lucide-react";
import { exportCanvasMarkdown, downloadFile } from "../../../utils/export";

export default function PublicSharePage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const data = useQuery(api.canvases.getCanvasByPublicToken, { token });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showStressTest, setShowStressTest] = useState(false);

  if (data === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-xs text-muted">
        Loading shared canvas...
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-canvas px-4 text-center">
        <h1 className="text-lg font-semibold text-ink">Link unavailable</h1>
        <p className="text-xs text-muted max-w-sm">
          This public link is invalid or has been disabled by the canvas owner.
        </p>
      </div>
    );
  }

  const notes: NoteItem[] = data.notes;
  const publicStressTest: StressTestResult | null = data.latestStressTest;
  const selectedNote = notes.find((n) => n._id === selectedId) || null;

  const handleExportMarkdown = () => {
    const md = exportCanvasMarkdown(`${data.canvas.title} (Public View)`, notes, publicStressTest);
    downloadFile(`leancanvas-public.md`, md, "text/markdown");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-canvas text-ink overflow-hidden">
      {/* Top Banner: Read Only Notice */}
      <div className="bg-amber-100 border-b border-amber-300/80 px-4 py-2 flex items-center justify-between text-xs text-amber-950 font-medium">
        <div className="flex items-center gap-2">
          <GlobeIcon className="w-4 h-4 text-amber-700" />
          <span>
            <strong>Public Read-Only View:</strong> You are viewing a shared snapshot. Anonymous editing is disabled.
          </span>
        </div>
        <Link
          href={`/login?redirect=/canvas/${data.canvas._id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-ink text-surface rounded-md text-xs font-semibold hover:bg-ink/90 transition-colors shadow-sm"
        >
          <LogInIcon className="w-3.5 h-3.5" />
          Sign in to Edit or Duplicate
        </Link>
      </div>

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-base text-ink">{data.canvas.title}</h1>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-300">
            VIEWER (READ-ONLY)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-ink rounded-md border border-line bg-surface hover:bg-surface-2 transition-colors"
          >
            <FileTextIcon size={13} />
            Export Markdown
          </button>

          <button
            type="button"
            onClick={() => setShowStressTest((prev) => !prev)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-accent/30 bg-accent-soft px-3 text-xs font-semibold text-accent hover:bg-accent-soft/80 transition-colors"
          >
            <SparklesIcon size={14} />
            View Stress Test Scores
          </button>
        </div>
      </header>

      {/* Main Board (canEdit = false) */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          <LeanCanvasBoard
            notes={notes}
            selectedId={selectedId}
            canEdit={false} // Strictly read-only for anonymous users
            onSelect={(id) => setSelectedId((curr) => (curr === id ? null : id))}
          />
        </div>

        {/* Read-only side panel */}
        {(selectedNote || showStressTest) && (
          <aside className="w-full shrink-0 border-t border-line bg-surface lg:h-full lg:w-[360px] lg:border-l lg:border-t-0 shadow-sm z-10 flex flex-col">
            {showStressTest ? (
              <StressTestPanel
                result={publicStressTest}
                isRunning={false}
                canRun={false} // Anonymous users cannot run mutations or trigger AI actions
                onRunTest={() => {}}
                onClose={() => setShowStressTest(false)}
              />
            ) : selectedNote ? (
              <NoteDetailPanel
                note={selectedNote}
                blockTitle={
                  CANVAS_BLOCKS.find((b) => b.id === selectedNote.block)?.title || selectedNote.block
                }
                canEdit={false} // Read-only
                onClose={() => setSelectedId(null)}
                onUpdate={() => {}}
                onUpdateEvidence={() => {}}
                onDelete={() => {}}
              />
            ) : null}
          </aside>
        )}
      </main>
    </div>
  );
}
