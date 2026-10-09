"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { CanvasBoard } from "../../../components/CanvasBoard";
import { NoteDetailPanel } from "../../../components/NoteDetailPanel";
import { LaunchDayChip } from "../../../components/LaunchDayChip";
import { noteMatchesEvidence, useEvidenceFilter } from "../../../utils/evidenceFilter";
import { EvidenceLegend } from "../../../components/EvidenceLegend";
import { LaunchDateContext } from "../../../utils/launchDate";
import { StressTestPanel } from "../../../components/StressTestPanel";
import { RiskiestAssumptionsView } from "../../../components/RiskiestAssumptionsView";
import { CanvasView, CanvasViewToggle, riskRanksFor } from "../../../components/CanvasViewToggle";
import { NoteItem, StressTestResult } from "../../../types/canvas";
import { GlobeIcon, SparklesIcon, LogInIcon, FileTextIcon, DownloadIcon, LockIcon } from "lucide-react";
import { NoteSearch, NoteSearchButton, useNoteSearchShortcut } from "../../../components/NoteSearch";
import { ExportMenu } from "../../../components/ExportMenu";
import { exportCanvasMarkdown, downloadFile } from "../../../utils/export";
import { getCanvasTemplate } from "../../../utils/canvasTemplates";

export default function PublicSharePage() {
  const params = useParams();
  const token = (params?.token as string) || "";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: CanvasView = searchParams.get("view") === "risks" ? "risks" : "canvas";
  const setView = (next: CanvasView) => {
    router.replace(next === "risks" ? `${pathname}?view=risks` : pathname, { scroll: false });
  };

  const grantKey = `leancanvas_share_grant_${token}`;
  const [grant, setGrant] = useState<string | undefined>(undefined);
  const [grantLoaded, setGrantLoaded] = useState(false);
  const data = useQuery(
    api.canvases.getCanvasByPublicToken,
    grantLoaded ? { token, grant } : "skip"
  );
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showStressTest, setShowStressTest] = useState(false);
  const evidence = useEvidenceFilter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useNoteSearchShortcut(() => setIsSearchOpen(true));

  // Restore a viewing pass from this browser session, if any
  useEffect(() => {
    try {
      setGrant(sessionStorage.getItem(grantKey) ?? undefined);
    } catch {
      // storage unavailable; the viewer just re-enters the password
    }
    setGrantLoaded(true);
  }, [grantKey]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch("/api/share/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = (await res.json()) as
        | { ok: true; grant: string }
        | { ok: false; reason: "invalid" | "rate_limited" | "unavailable" };
      if ("grant" in result) {
        try {
          sessionStorage.setItem(grantKey, result.grant);
        } catch {
          // ignore
        }
        setGrant(result.grant);
        setPassword("");
      } else if (result.reason === "rate_limited") {
        setUnlockError("Too many attempts. Please wait a few minutes and try again.");
      } else if (result.reason === "invalid") {
        setUnlockError("Incorrect password.");
      } else {
        setUnlockError("This link is no longer available.");
      }
    } catch (err) {
      console.error(err);
      setUnlockError("Something went wrong. Please try again.");
    } finally {
      setUnlocking(false);
    }
  };

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

  if ("passwordRequired" in data) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas px-4">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-2xl bg-surface border border-line p-8 shadow-sm space-y-5"
        >
          <div className="text-center space-y-1">
            <div className="inline-flex w-10 h-10 rounded-xl bg-accent-soft text-accent items-center justify-center mb-2">
              <LockIcon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-ink">Password required</h1>
            <p className="text-xs text-muted">
              The owner has protected this shared canvas. Enter the password to view it.
            </p>
          </div>
          <input
            type="password"
            autoFocus
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          {unlockError && <p className="text-xs text-rose-600">{unlockError}</p>}
          <button
            type="submit"
            disabled={unlocking}
            className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-60 transition-colors"
          >
            {unlocking ? "Checking..." : "View canvas"}
          </button>
        </form>
      </div>
    );
  }

  const notes: NoteItem[] = data.notes;
  const publicStressTest: StressTestResult | null = data.latestStressTest;
  const selectedNote = notes.find((n) => n._id === selectedId) || null;
  const template = getCanvasTemplate(data.canvas.template);

  const handleExportMarkdown = () => {
    const md = exportCanvasMarkdown(`${data.canvas.title} (Public View)`, template, notes, publicStressTest);
    downloadFile(`${template.fileSlug}-public.md`, md, "text/markdown");
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
          <LaunchDayChip launchDate={data.canvas.launchDate} />
        </div>

        <div className="flex items-center gap-2">
          <ExportMenu
            title={data.canvas.title}
            badge="Public view"
            template={template}
            notes={notes}
            stressResult={publicStressTest}
          />

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
      <LaunchDateContext.Provider value={data.canvas.launchDate}>
        <main className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CanvasViewToggle
                view={view}
                riskCount={publicStressTest?.riskiestAssumptions.length ?? 0}
                onChange={setView}
              />
              <NoteSearchButton onClick={() => setIsSearchOpen(true)} />
            </div>
            {view === "canvas" && (
              <EvidenceLegend
                filter={evidence.filter}
                notes={notes}
                onToggle={evidence.toggle}
                onShowNeedsEvidence={evidence.showNeedsEvidence}
                onClear={evidence.clear}
                onModeChange={evidence.setMode}
              />
            )}
            {view === "risks" ? (
              <RiskiestAssumptionsView
                blocks={template.blocks}
                result={publicStressTest}
                notes={notes}
                onOpenNote={(noteId) => {
                  setView("canvas");
                  setSelectedId(noteId);
                }}
              />
            ) : (
            <CanvasBoard
              blocks={template.blocks}
              riskRanks={riskRanksFor(publicStressTest?.riskiestAssumptions)}
              notes={notes}
              evidenceFilter={evidence.filter}
              selectedId={selectedId}
              canEdit={false} // Strictly read-only for anonymous users
              onSelect={(id) => setSelectedId((curr) => (curr === id ? null : id))}
            />
            )}
          </div>

          {/* Read-only side panel */}
          {(selectedNote || showStressTest) && (
            <aside className="w-full shrink-0 border-t border-line bg-surface lg:h-full lg:w-[360px] lg:border-l lg:border-t-0 shadow-sm z-10 flex flex-col">
              {showStressTest ? (
                <StressTestPanel
                  template={template}
                  result={publicStressTest}
                  isRunning={false}
                  canRun={false} // Anonymous users cannot run mutations or trigger AI actions
                  onRunTest={() => {}}
                  onClose={() => setShowStressTest(false)}
                  onViewRisks={() => {
                    setView("risks");
                    setShowStressTest(false);
                  }}
                />
              ) : selectedNote ? (
                <NoteDetailPanel
                  note={selectedNote}
                  blockTitle={
                    template.blocks.find((b) => b.id === selectedNote.block)?.title || selectedNote.block
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
      </LaunchDateContext.Provider>

      {isSearchOpen && (
        <NoteSearch
          notes={notes}
          blocks={template.blocks}
          onClose={() => setIsSearchOpen(false)}
          onSelect={(noteId) => {
            const note = notes.find((n) => n._id === noteId);
            if (note && evidence.filter.mode === "hide" && !noteMatchesEvidence(note, evidence.filter)) {
              evidence.clear();
            }
            setIsSearchOpen(false);
            setView("canvas");
            setShowStressTest(false);
            setSelectedId(noteId);
            setTimeout(() => {
              document.getElementById(`note-${noteId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
            }, 80);
          }}
        />
      )}
    </div>
  );
}
