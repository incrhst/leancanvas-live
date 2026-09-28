"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LeanCanvasBoard, CANVAS_BLOCKS } from "../../../components/LeanCanvasBoard";
import { NoteDetailPanel } from "../../../components/NoteDetailPanel";
import { StressTestPanel } from "../../../components/StressTestPanel";
import { NoteItem, StressTestResult } from "../../../types/canvas";
import { GlobeIcon, SparklesIcon, LogInIcon, FileTextIcon, DownloadIcon } from "lucide-react";
import { exportCanvasMarkdown, downloadFile } from "../../../utils/export";

// Mock public data payload matching getCanvasByPublicToken query response
const PUBLIC_DEMO_NOTES: NoteItem[] = [
  {
    _id: "pub-1",
    block: "problem",
    content: "Couples spend 30+ minutes every week deciding what to cook for dinner.",
    order: 0,
    evidenceState: "observed",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-2",
    block: "problem",
    content: "Grocery lists are fragmented across multiple apps and WhatsApp chats.",
    order: 1,
    evidenceState: "supported",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-3",
    block: "customerSegments",
    content: "Dual-income couples without children (25-38).",
    order: 0,
    evidenceState: "supported",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-4",
    block: "uniqueValueProposition",
    content: "Dinner decided in 2 minutes, together.",
    order: 0,
    evidenceState: "assumption",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-5",
    block: "solution",
    content: "Tinder-style swipe meal voting + shared live pantry checklist.",
    order: 0,
    evidenceState: "assumption",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-6",
    block: "channels",
    content: "TikTok food creators & partner referral onboarding loop.",
    order: 0,
    evidenceState: "unknown",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-7",
    block: "revenueStreams",
    content: "Household subscription: $6/month after 14-day free trial.",
    order: 0,
    evidenceState: "assumption",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-8",
    block: "costStructure",
    content: "Serverless hosting & real-time sync database, creator sponsorship.",
    order: 0,
    evidenceState: "decision",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-9",
    block: "keyMetrics",
    content: "Weekly Active Households (WAH) & plans completed.",
    order: 0,
    evidenceState: "decision",
    updatedAt: Date.now(),
  },
  {
    _id: "pub-10",
    block: "unfairAdvantage",
    content: "Proprietary partner taste alignment engine.",
    order: 0,
    evidenceState: "assumption",
    updatedAt: Date.now(),
  },
];

export default function PublicSharePage() {
  const params = useParams();
  const token = (params?.token as string) || "token";

  const [notes] = useState<NoteItem[]>(PUBLIC_DEMO_NOTES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showStressTest, setShowStressTest] = useState(false);

  const selectedNote = notes.find((n) => n._id === selectedId) || null;

  const publicStressTest: StressTestResult = {
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
  };

  const handleExportMarkdown = () => {
    const md = exportCanvasMarkdown("Splitwise for Meals (Public View)", notes, publicStressTest);
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
          href={`/login?redirect=/canvas/demo-live-1`}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-ink text-surface rounded-md text-xs font-semibold hover:bg-ink/90 transition-colors shadow-sm"
        >
          <LogInIcon className="w-3.5 h-3.5" />
          Sign in to Edit or Duplicate
        </Link>
      </div>

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-base text-ink">Splitwise for Meals (Pantry & Couples)</h1>
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
