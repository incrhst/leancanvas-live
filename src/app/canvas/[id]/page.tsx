"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "../../../components/TopBar";
import { LeanCanvasBoard, CANVAS_BLOCKS } from "../../../components/LeanCanvasBoard";
import { NoteDetailPanel } from "../../../components/NoteDetailPanel";
import { StressTestPanel } from "../../../components/StressTestPanel";
import { ShareModal } from "../../../components/ShareModal";
import { useAuth } from "../../../components/ConvexClientProvider";
import { NoteItem, BlockId, EvidenceState, StressTestResult } from "../../../types/canvas";
import { exportCanvasMarkdown, downloadFile } from "../../../utils/export";

const INITIAL_DEMO_NOTES: NoteItem[] = [
  {
    _id: "n1",
    block: "problem",
    content: "Couples spend 30+ minutes every week arguing or deciding what to cook for dinner.",
    order: 0,
    evidenceState: "observed",
    updatedAt: Date.now() - 100000,
  },
  {
    _id: "n2",
    block: "problem",
    content: "Grocery lists are fragmented across WhatsApp, Apple Notes, and memory, causing duplicate purchases.",
    order: 1,
    evidenceState: "supported",
    updatedAt: Date.now() - 80000,
  },
  {
    _id: "n3",
    block: "customerSegments",
    content: "Dual-income couples without kids (25-38), who share home cooking duties.",
    order: 0,
    evidenceState: "supported",
    updatedAt: Date.now() - 70000,
  },
  {
    _id: "n4",
    block: "uniqueValueProposition",
    content: "Dinner decided in 2 minutes, together. The meal planner couples actually use.",
    order: 0,
    evidenceState: "assumption",
    updatedAt: Date.now() - 60000,
  },
  {
    _id: "n5",
    block: "solution",
    content: "Tinder-style swipe meal voting + shared real-time grocery checklist.",
    order: 0,
    evidenceState: "assumption",
    updatedAt: Date.now() - 50000,
  },
  {
    _id: "n6",
    block: "channels",
    content: "TikTok recipe influencers & partner-referral onboarding loop.",
    order: 0,
    evidenceState: "unknown",
    updatedAt: Date.now() - 40000,
  },
  {
    _id: "n7",
    block: "revenueStreams",
    content: "Household subscription: $6/month after 14-day free trial.",
    order: 0,
    evidenceState: "assumption",
    updatedAt: Date.now() - 30000,
  },
  {
    _id: "n8",
    block: "costStructure",
    content: "Serverless hosting & real-time sync database, marketing ads.",
    order: 0,
    evidenceState: "decision",
    updatedAt: Date.now() - 20000,
  },
  {
    _id: "n9",
    block: "keyMetrics",
    content: "Weekly Active Households (WAH) & meals planned/cooked per week.",
    order: 0,
    evidenceState: "decision",
    updatedAt: Date.now() - 10000,
  },
  {
    _id: "n10",
    block: "unfairAdvantage",
    content: "Proprietary partner-preference alignment algorithm and local grocery SKU mapping.",
    order: 0,
    evidenceState: "assumption",
    updatedAt: Date.now() - 5000,
  },
];

export default function CanvasEditorPage() {
  const params = useParams();
  const router = useRouter();
  const canvasId = (params?.id as string) || "demo-canvas";
  const { user } = useAuth();

  const [notes, setNotes] = useState<NoteItem[]>(INITIAL_DEMO_NOTES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"detail" | "stressTest" | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPublicViewEnabled, setIsPublicViewEnabled] = useState(true);
  const [publicViewToken, setPublicViewToken] = useState("pub-token-sample-123");
  const [isTesting, setIsTesting] = useState(false);
  const [stressResult, setStressResult] = useState<StressTestResult | null>({
    scores: {
      clarity: 8.5,
      desirability: 7.0,
      viability: 6.5,
      feasibility: 8.0,
      defensibility: 5.5,
      timing: 7.5,
      mission: 8.0,
    },
    overallScore: 7.3,
    riskiestAssumptions: [
      {
        noteId: "n7",
        block: "revenueStreams",
        assumption: "Couples will pay $6/mo for meal coordination rather than using a free shared note.",
        reason: "Zero friction free substitutes already exist; willingness-to-pay is untested.",
        suggestedExperiment: "Run a pre-order paywall test or ask 10 couples to prepay $15 for 3 months access.",
      },
      {
        noteId: "n10",
        block: "unfairAdvantage",
        assumption: "Local grocery SKU mapping acts as a defensible moat against larger recipe apps.",
        reason: "Grocery APIs are increasingly commoditized or restricted by big chains.",
        suggestedExperiment: "Validate partner API access with 2 regional stores before building scraper architecture.",
      },
    ],
    createdAt: Date.now(),
  });

  const selectedNote = notes.find((n) => n._id === selectedId) || null;

  // Add Note
  const handleAddNote = (block: BlockId, text: string) => {
    const newNote: NoteItem = {
      _id: `note-${Date.now()}`,
      block,
      content: text,
      order: notes.filter((n) => n.block === block).length,
      evidenceState: "assumption",
      updatedAt: Date.now(),
    };
    setNotes((prev) => [...prev, newNote]);
  };

  // Cycle Evidence State
  const handleCycleEvidence = (noteId: string) => {
    const order: EvidenceState[] = [
      "unknown",
      "assumption",
      "observed",
      "supported",
      "contradicted",
      "decision",
    ];
    setNotes((prev) =>
      prev.map((n) => {
        if (n._id !== noteId) return n;
        const currentIdx = order.indexOf(n.evidenceState);
        const nextState = order[(currentIdx + 1) % order.length];
        return { ...n, evidenceState: nextState, updatedAt: Date.now() };
      })
    );
  };

  // Update Note Content
  const handleUpdateNote = (noteId: string, content: string) => {
    setNotes((prev) =>
      prev.map((n) => (n._id === noteId ? { ...n, content, updatedAt: Date.now() } : n))
    );
  };

  // Update Note Evidence directly
  const handleUpdateEvidence = (noteId: string, state: EvidenceState) => {
    setNotes((prev) =>
      prev.map((n) => (n._id === noteId ? { ...n, evidenceState: state, updatedAt: Date.now() } : n))
    );
  };

  // Delete Note
  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n._id !== noteId));
    if (selectedId === noteId) {
      setSelectedId(null);
      setActivePanel(null);
    }
  };

  // Run Stress Test
  const handleRunStressTest = async () => {
    setIsTesting(true);
    setTimeout(() => {
      setStressResult({
        scores: {
          clarity: 8.8,
          desirability: 7.2,
          viability: 6.8,
          feasibility: 8.5,
          defensibility: 5.8,
          timing: 8.0,
          mission: 8.5,
        },
        overallScore: 7.7,
        riskiestAssumptions: [
          {
            block: "revenueStreams",
            assumption: "Couples will pay $6/mo for meal coordination rather than using a free shared note.",
            reason: "Zero friction free substitutes already exist; willingness-to-pay is untested.",
            suggestedExperiment: "Run a pre-order paywall test or ask 10 couples to prepay $15 for 3 months access.",
          },
          {
            block: "unfairAdvantage",
            assumption: "Local grocery SKU mapping acts as a defensible moat against larger recipe apps.",
            reason: "Grocery APIs are increasingly commoditized or restricted by big chains.",
            suggestedExperiment: "Validate partner API access with 2 regional stores before building scraper architecture.",
          },
        ],
        createdAt: Date.now(),
      });
      setIsTesting(false);
    }, 1500);
  };

  // Export handlers
  const handleExportMarkdown = () => {
    const md = exportCanvasMarkdown("Splitwise for Meals", notes, stressResult);
    downloadFile(`leancanvas-${canvasId}.md`, md, "text/markdown");
  };

  const handleExportJson = () => {
    const json = JSON.stringify({ canvasId, notes, stressResult }, null, 2);
    downloadFile(`leancanvas-${canvasId}.json`, json, "application/json");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-canvas text-ink overflow-hidden">
      <TopBar
        title="Splitwise for Meals (Pantry & Couples)"
        role={user ? "owner" : "editor"}
        isPublicViewEnabled={isPublicViewEnabled}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenStressTest={() => setActivePanel((curr) => (curr === "stressTest" ? null : "stressTest"))}
        onExportMarkdown={handleExportMarkdown}
        onExportJson={handleExportJson}
      />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Board */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          <LeanCanvasBoard
            notes={notes}
            selectedId={selectedId}
            canEdit={true}
            onSelect={(id) => {
              if (selectedId === id) {
                setSelectedId(null);
                setActivePanel(null);
              } else {
                setSelectedId(id);
                setActivePanel("detail");
              }
            }}
            onAdd={handleAddNote}
            onCycleEvidence={handleCycleEvidence}
            onDelete={handleDeleteNote}
          />
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
                canEdit={true}
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
                canRun={true}
                onRunTest={handleRunStressTest}
                onClose={() => setActivePanel(null)}
              />
            )}
          </aside>
        )}
      </main>

      {/* Share Modal */}
      {isShareModalOpen && (
        <ShareModal
          canvasId={canvasId}
          isPublicViewEnabled={isPublicViewEnabled}
          publicViewToken={publicViewToken}
          isOwner={true}
          onTogglePublic={async (enabled) => setIsPublicViewEnabled(enabled)}
          onCreateInvite={async (role, email) => {
            return `inv-${Date.now().toString(36)}`;
          }}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
}
