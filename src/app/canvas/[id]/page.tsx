"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { TopBar } from "../../../components/TopBar";
import { LeanCanvasBoard, CANVAS_BLOCKS } from "../../../components/LeanCanvasBoard";
import { NoteDetailPanel } from "../../../components/NoteDetailPanel";
import { StressTestPanel } from "../../../components/StressTestPanel";
import { ShareModal } from "../../../components/ShareModal";
import { RiskiestAssumptionsView } from "../../../components/RiskiestAssumptionsView";
import { CanvasView, CanvasViewToggle, riskRanksFor } from "../../../components/CanvasViewToggle";
import { useAuth } from "../../../components/ConvexClientProvider";
import { NoteItem, BlockId, EvidenceState, StressTestResult } from "../../../types/canvas";
import { exportCanvasMarkdown, downloadFile } from "../../../utils/export";

type NoteBlock = Doc<"notes">["block"];
const EVIDENCE_CYCLE: EvidenceState[] = [
  "unknown",
  "assumption",
  "observed",
  "supported",
  "contradicted",
  "decision",
];

export default function CanvasEditorPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: CanvasView = searchParams.get("view") === "risks" ? "risks" : "canvas";
  const setView = (next: CanvasView) => {
    router.replace(next === "risks" ? `${pathname}?view=risks` : pathname, { scroll: false });
  };
  const canvasId = (params?.id as string) as Id<"canvases">;
  const { user, isLoading } = useAuth();

  const data = useQuery(api.canvases.getCanvas, isLoading ? "skip" : { canvasId });
  const latestStressTest = useQuery(api.stressTests.getLatestStressTest, data ? { canvasId } : "skip");
  const addNote = useMutation(api.notes.addNote);
  const updateNote = useMutation(api.notes.updateNote);
  const deleteNote = useMutation(api.notes.deleteNote);
  const setPublicView = useMutation(api.canvases.setPublicView);
  const setPublicViewPassword = useMutation(api.canvases.setPublicViewPassword);
  const createInvite = useMutation(api.invites.createInvite);
  const runStressTest = useAction(api.stressTests.runStressTest);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"detail" | "stressTest" | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const notes: NoteItem[] = data?.notes ?? [];
  const role = data?.currentUserRole ?? "viewer";
  const canEdit = role === "owner" || role === "editor";
  const stressResult: StressTestResult | null = latestStressTest ?? null;
  const selectedNote = notes.find((n) => n._id === selectedId) || null;
  const riskRanks = riskRanksFor(stressResult?.riskiestAssumptions);

  if (isLoading || data === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-xs text-muted">
        Loading canvas...
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
        <h1 className="text-lg font-semibold text-ink">Canvas not found</h1>
        <p className="text-xs text-muted max-w-sm">
          This canvas doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        {user ? (
          <Link href="/dashboard" className="text-sm text-accent underline">Back to dashboard</Link>
        ) : (
          <Link href={`/login?redirect=/canvas/${canvasId}`} className="text-sm text-accent underline">
            Sign in to open it
          </Link>
        )}
      </div>
    );
  }

  const { canvas } = data;

  // Add Note
  const handleAddNote = (block: BlockId, text: string) => {
    void addNote({ canvasId, block: block as NoteBlock, content: text });
  };

  // Cycle Evidence State
  const handleCycleEvidence = (noteId: string) => {
    const note = notes.find((n) => n._id === noteId);
    if (!note) return;
    const nextState = EVIDENCE_CYCLE[(EVIDENCE_CYCLE.indexOf(note.evidenceState) + 1) % EVIDENCE_CYCLE.length];
    void updateNote({ noteId: noteId as Id<"notes">, evidenceState: nextState });
  };

  // Update Note Content
  const handleUpdateNote = (noteId: string, content: string) => {
    void updateNote({ noteId: noteId as Id<"notes">, content });
  };

  // Update Note Evidence directly
  const handleUpdateEvidence = (noteId: string, state: EvidenceState) => {
    void updateNote({ noteId: noteId as Id<"notes">, evidenceState: state });
  };

  // Delete Note
  const handleDeleteNote = (noteId: string) => {
    void deleteNote({ noteId: noteId as Id<"notes"> });
    if (selectedId === noteId) {
      setSelectedId(null);
      setActivePanel(null);
    }
  };

  // Run Stress Test
  const handleRunStressTest = async () => {
    setIsTesting(true);
    try {
      await runStressTest({ canvasId });
    } catch (err) {
      console.error(err);
    } finally {
      setIsTesting(false);
    }
  };

  // Export handlers
  const handleExportMarkdown = () => {
    const md = exportCanvasMarkdown(canvas.title, notes, stressResult);
    downloadFile(`leancanvas-${canvasId}.md`, md, "text/markdown");
  };

  const handleExportJson = () => {
    const json = JSON.stringify({ canvasId, title: canvas.title, notes, stressResult }, null, 2);
    downloadFile(`leancanvas-${canvasId}.json`, json, "application/json");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-canvas text-ink overflow-hidden">
      <TopBar
        title={canvas.title}
        role={user ? role : "anonymous"}
        isPublicViewEnabled={canvas.isPublicViewEnabled}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenStressTest={() => setActivePanel((curr) => (curr === "stressTest" ? null : "stressTest"))}
        onExportMarkdown={handleExportMarkdown}
        onExportJson={handleExportJson}
      />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Board */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3">
          <CanvasViewToggle
            view={view}
            riskCount={stressResult?.riskiestAssumptions.length ?? 0}
            onChange={setView}
          />
          {view === "risks" ? (
            <RiskiestAssumptionsView
              result={stressResult}
              notes={notes}
              canEdit={canEdit}
              canRun={canEdit}
              isRunning={isTesting}
              onRunTest={handleRunStressTest}
              onUpdateEvidence={handleUpdateEvidence}
              onOpenNote={(noteId) => {
                setView("canvas");
                setSelectedId(noteId);
                setActivePanel("detail");
              }}
            />
          ) : (
          <LeanCanvasBoard
            riskRanks={riskRanks}
            notes={notes}
            selectedId={selectedId}
            canEdit={canEdit}
            onSelect={(id) => {
              if (selectedId === id) {
                setSelectedId(null);
                setActivePanel(null);
              } else {
                setSelectedId(id);
                setActivePanel("detail");
              }
            }}
            onAdd={canEdit ? handleAddNote : undefined}
            onCycleEvidence={canEdit ? handleCycleEvidence : undefined}
            onDelete={canEdit ? handleDeleteNote : undefined}
          />
          )}
        </div>

        {/* Side Panel (Note Detail or Stress Test) */}
        {activePanel && (
          <aside className="w-full shrink-0 border-t border-line bg-surface lg:h-full lg:w-[360px] lg:border-l lg:border-t-0 shadow-sm z-10 flex flex-col">
            {activePanel === "detail" && selectedNote && (
              <NoteDetailPanel
                note={selectedNote}
                blockTitle={
                  CANVAS_BLOCKS.find((b) => b.id === selectedNote.block)?.title || selectedNote.block
                }
                canEdit={canEdit}
                onClose={() => {
                  setSelectedId(null);
                  setActivePanel(null);
                }}
                onUpdate={(content) => handleUpdateNote(selectedNote._id, content)}
                onUpdateEvidence={(state) => handleUpdateEvidence(selectedNote._id, state)}
                onDelete={() => handleDeleteNote(selectedNote._id)}
              />
            )}

            {activePanel === "stressTest" && (
              <StressTestPanel
                result={stressResult}
                isRunning={isTesting}
                canRun={canEdit}
                onRunTest={handleRunStressTest}
                onClose={() => setActivePanel(null)}
                onViewRisks={() => {
                  setView("risks");
                  setActivePanel(null);
                }}
              />
            )}
          </aside>
        )}
      </main>

      {/* Share Modal */}
      {isShareModalOpen && (
        <ShareModal
          canvasId={canvasId}
          isPublicViewEnabled={canvas.isPublicViewEnabled}
          publicViewToken={canvas.publicViewToken}
          isOwner={role === "owner"}
          hasPassword={canvas.hasPublicViewPassword}
          onTogglePublic={async (enabled) => {
            await setPublicView({ canvasId, enabled });
          }}
          onSetPassword={async (password) => {
            await setPublicViewPassword({ canvasId, password });
          }}
          onCreateInvite={async (inviteRole, email) => {
            const { token } = await createInvite({ canvasId, role: inviteRole, email });
            return token;
          }}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
}
