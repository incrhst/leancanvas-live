"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { TopBar } from "../../../components/TopBar";
import { CanvasBoard } from "../../../components/CanvasBoard";
import { NoteDetailPanel } from "../../../components/NoteDetailPanel";
import { LaunchDayChip } from "../../../components/LaunchDayChip";
import { DecisionsWaitingChip } from "../../../components/NoteDecision";
import { CheckInsWaitingChip } from "../../../components/CheckIn";
import { SnapshotsPanel } from "../../../components/SnapshotsPanel";
import { noteMatchesEvidence, useEvidenceFilter } from "../../../utils/evidenceFilter";
import { EvidenceLegend } from "../../../components/EvidenceLegend";
import { matchesOwnerFilter, OwnerFilter, OwnerFilterValue } from "../../../components/OwnerControls";
import { MarketFilter, marketsOf, matchesMarketFilter } from "../../../components/MarketControls";
import { CanvasMember, MembersContext } from "../../../utils/members";
import { todayLocal } from "../../../utils/testFields";
import { LaunchDateContext } from "../../../utils/launchDate";
import { plainSummary, summaryFromNotes } from "../../../utils/plainSummary";
import { StressTestPanel } from "../../../components/StressTestPanel";
import { ShareModal } from "../../../components/ShareModal";
import { RiskiestAssumptionsView } from "../../../components/RiskiestAssumptionsView";
import { CanvasView, CanvasViewToggle, riskRanksFor } from "../../../components/CanvasViewToggle";
import { useAuth } from "../../../components/ConvexClientProvider";
import { NoteItem, BlockId, EvidenceState, StressTestResult } from "../../../types/canvas";
import { NoteSearch, NoteSearchButton, useNoteSearchShortcut } from "../../../components/NoteSearch";
import { ExportMenu, parseExportRequest } from "../../../components/ExportMenu";
import { exportCanvasMarkdown, downloadFile } from "../../../utils/export";
import { getCanvasTemplate } from "../../../utils/canvasTemplates";

type NoteBlock = Doc<"notes">["block"];
export default function CanvasEditorPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: CanvasView = searchParams.get("view") === "risks" ? "risks" : "canvas";
  const setView = (next: CanvasView) => {
    router.replace(next === "risks" ? `${pathname}?view=risks` : pathname, { scroll: false });
  };
  // An export a link asked for, e.g. ?export=risks-pdf. The param is cleared once it has run.
  const exportRequest = parseExportRequest(searchParams.get("export"));
  const clearExportRequest = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("export");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const canvasId = (params?.id as string) as Id<"canvases">;
  const { user, isLoading } = useAuth();

  const data = useQuery(api.canvases.getCanvas, isLoading ? "skip" : { canvasId });
  const latestStressTest = useQuery(api.stressTests.getLatestStressTest, data ? { canvasId } : "skip");
  const addNote = useMutation(api.notes.addNote);
  const updateNote = useMutation(api.notes.updateNote);
  const deleteNote = useMutation(api.notes.deleteNote);
  const addReasonToLatestChange = useMutation(api.notes.addReasonToLatestChange);
  const setPublicView = useMutation(api.canvases.setPublicView);
  const updateCanvasMeta = useMutation(api.canvases.updateCanvasMeta);
  const setPublicViewPassword = useMutation(api.canvases.setPublicViewPassword);
  const createInvite = useMutation(api.invites.createInvite);
  const runStressTest = useAction(api.stressTests.runStressTest);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"detail" | "stressTest" | "snapshots" | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilterValue>("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const evidence = useEvidenceFilter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useNoteSearchShortcut(() => setIsSearchOpen(true));

  const notes: NoteItem[] = data?.notes ?? [];
  const role = data?.currentUserRole ?? "viewer";
  const canEdit = role === "owner" || role === "editor";
  const stressResult: StressTestResult | null = latestStressTest ?? null;
  const selectedNote = notes.find((n) => n._id === selectedId) || null;
  const riskRanks = riskRanksFor(stressResult?.riskiestAssumptions);
  const members = useMemo(
    () => new Map<string, CanvasMember>((data?.members ?? []).map((m) => [m.id, m])),
    [data?.members]
  );
  const allMarkets = marketsOf(notes);
  const visibleNotes = notes.filter(
    (n) => matchesOwnerFilter(n, ownerFilter, user?.id) && matchesMarketFilter(n, marketFilter)
  );

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
  const template = getCanvasTemplate(canvas.template);

  // Add Note
  const handleAddNote = (block: BlockId, text: string) => {
    // While showing one person's notes, new notes are theirs, so they don't vanish from view
    const owner = ownerFilter === "mine" ? user?.id : ownerFilter === "all" || ownerFilter === "unassigned" ? undefined : ownerFilter;
    void addNote({ canvasId, block: block as NoteBlock, content: text, ownerId: owner as Id<"users"> | undefined });
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
  const handleExportSummary = () => {
    const summary = plainSummary(
      summaryFromNotes({
        title: canvas.title,
        today: todayLocal(),
        launchDate: canvas.launchDate,
        blocks: template.blocks,
        notes,
        nameOf: (userId) => members.get(userId)?.name,
      })
    );
    downloadFile(`${template.fileSlug}-${canvasId}-summary.txt`, summary, "text/plain");
  };

  const handleExportMarkdown = () => {
    const md = exportCanvasMarkdown(canvas.title, template, notes, stressResult);
    downloadFile(`${template.fileSlug}-${canvasId}.md`, md, "text/markdown");
  };

  const handleExportJson = () => {
    const json = JSON.stringify({ canvasId, title: canvas.title, template: template.id, notes, stressResult }, null, 2);
    downloadFile(`${template.fileSlug}-${canvasId}.json`, json, "application/json");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-canvas text-ink overflow-hidden">
      <TopBar
        title={canvas.title}
        role={user ? role : "anonymous"}
        isPublicViewEnabled={canvas.isPublicViewEnabled}
        status={
          <>
            <LaunchDayChip
              launchDate={canvas.launchDate}
              onChange={canEdit ? (launchDate) => void updateCanvasMeta({ canvasId, launchDate }) : undefined}
            />
            {user && <DecisionsWaitingChip />}
            {user && <CheckInsWaitingChip />}
          </>
        }
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenStressTest={() => setActivePanel((curr) => (curr === "stressTest" ? null : "stressTest"))}
        reviewHref={user ? `/canvas/${canvasId}/review` : undefined}
        onOpenSnapshots={user ? () => setActivePanel((curr) => (curr === "snapshots" ? null : "snapshots")) : undefined}
        onExportMarkdown={handleExportMarkdown}
        onExportSummary={handleExportSummary}
        onExportJson={handleExportJson}
        exportMenu={
          <ExportMenu
            title={canvas.title}
            template={template}
            notes={notes}
            stressResult={stressResult}
            // Wait for the stress test to load, so a risks export sees the real result
            autoExport={latestStressTest !== undefined ? exportRequest : null}
            onAutoExportHandled={clearExportRequest}
          />
        }
      />

      <MembersContext.Provider value={members}>
        <LaunchDateContext.Provider value={canvas.launchDate}>
          <main className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
            {/* Board */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CanvasViewToggle
                  view={view}
                  riskCount={stressResult?.riskiestAssumptions.length ?? 0}
                  onChange={setView}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <NoteSearchButton onClick={() => setIsSearchOpen(true)} />
                {view === "canvas" && (
                  <>
                    <MarketFilter markets={allMarkets} value={marketFilter} onChange={setMarketFilter} />
                    <OwnerFilter value={ownerFilter} currentUserId={user?.id} onChange={setOwnerFilter} />
                  </>
                )}
                </div>
              </div>
              {view === "canvas" && (
              <EvidenceLegend
                filter={evidence.filter}
                notes={visibleNotes}
                onToggle={evidence.toggle}
                onShowNeedsEvidence={evidence.showNeedsEvidence}
                onClear={evidence.clear}
                onModeChange={evidence.setMode}
              />
              )}
              {view === "risks" ? (
                <RiskiestAssumptionsView
                  blocks={template.blocks}
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
              <CanvasBoard
                blocks={template.blocks}
                riskRanks={riskRanks}
                notes={visibleNotes}
                evidenceFilter={evidence.filter}
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
                      template.blocks.find((b) => b.id === selectedNote.block)?.title || selectedNote.block
                    }
                    canEdit={canEdit}
                    onClose={() => {
                      setSelectedId(null);
                      setActivePanel(null);
                    }}
                    onUpdate={(content) => handleUpdateNote(selectedNote._id, content)}
                    onUpdateEvidence={(state) => handleUpdateEvidence(selectedNote._id, state)}
                    onUpdateTest={(patch) => void updateNote({ noteId: selectedNote._id as Id<"notes">, ...patch })}
                    onUpdateOwner={(ownerId) =>
                      void updateNote({ noteId: selectedNote._id as Id<"notes">, ownerId: ownerId as Id<"users"> | null })
                    }
                    onUpdateMarkets={(markets) =>
                      void updateNote({ noteId: selectedNote._id as Id<"notes">, markets })
                    }
                    allMarkets={allMarkets}
                    onAddReason={(reason) =>
                      addReasonToLatestChange({ noteId: selectedNote._id as Id<"notes">, reason })
                    }
                    onDelete={() => handleDeleteNote(selectedNote._id)}
                    blockTitleOf={(blockId) => template.blocks.find((b) => b.id === blockId)?.title || blockId}
                  />
                )}

                {activePanel === "snapshots" && (
                  <SnapshotsPanel
                    canvasId={canvasId}
                    canEdit={canEdit}
                    isOwner={role === "owner"}
                    launchDate={canvas.launchDate}
                    blockTitleOf={(blockId) => template.blocks.find((b) => b.id === blockId)?.title || blockId}
                    onClose={() => setActivePanel(null)}
                    onOpenNote={(noteId) => {
                      setView("canvas");
                      setSelectedId(noteId);
                      setActivePanel("detail");
                    }}
                  />
                )}

                {activePanel === "stressTest" && (
                  <StressTestPanel
                    template={template}
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
        </LaunchDateContext.Provider>
      </MembersContext.Provider>

      {isSearchOpen && (
        <MembersContext.Provider value={members}>
        <NoteSearch
          notes={notes}
          blocks={template.blocks}
          onClose={() => setIsSearchOpen(false)}
          onSelect={(noteId) => {
            const note = notes.find((n) => n._id === noteId);
            // Reveal a note the current filters would hide
            if (note && !visibleNotes.includes(note)) {
              setOwnerFilter("all");
              setMarketFilter("all");
            }
            if (note && evidence.filter.mode === "hide" && !noteMatchesEvidence(note, evidence.filter)) {
              evidence.clear();
            }
            setIsSearchOpen(false);
            setView("canvas");
            setSelectedId(noteId);
            setActivePanel("detail");
            setTimeout(() => {
              document.getElementById(`note-${noteId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
            }, 80);
          }}
        />
        </MembersContext.Provider>
      )}

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
