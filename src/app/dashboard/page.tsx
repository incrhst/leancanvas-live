"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/ConvexClientProvider";
import { AgentConnectInstructions } from "../../components/AgentConnectInstructions";
import {
  PlusIcon,
  LayoutGridIcon,
  CalendarIcon,
  ArrowRightIcon,
  LogOutIcon,
  SparklesIcon,
} from "lucide-react";

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const canvases = useQuery(api.canvases.listMyCanvases, user ? {} : "skip");
  const createCanvas = useMutation(api.canvases.createCanvas);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?redirect=/dashboard");
  }, [isLoading, user, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setCreateError(null);
    try {
      const canvasId = await createCanvas({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
      });
      setIsCreating(false);
      setNewTitle("");
      setNewDesc("");
      router.push(`/canvas/${canvasId}`);
    } catch (err) {
      console.error(err);
      setCreateError("Could not create the canvas. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Top navigation */}
      <header className="border-b border-line bg-surface px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-incrementic-red text-white font-bold flex items-center justify-center text-sm shadow-sm font-display">
            LC
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base text-ink font-display">My Canvases</span>
            <a
              href="https://incrementic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline font-mono text-[11px] text-muted hover:text-incrementic-red transition-colors"
            >
              by Incrementic ↗
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-muted">
            {user ? (
              <>Signed in as <strong className="text-ink">{user.email}</strong></>
            ) : (
              <Link href="/login" className="text-accent underline">Sign in</Link>
            )}
          </span>
          {user && (
            <button
              onClick={logout}
              title="Sign out"
              className="text-muted hover:text-rose-600 transition-colors"
            >
              <LogOutIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl w-full mx-auto px-6 py-10 space-y-8 flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Workspaces & Canvases</h1>
            <p className="text-xs text-muted">
              Select an existing business model canvas or initialize a new one.
            </p>
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-incrementic-red text-white rounded-lg text-sm font-semibold hover:bg-incrementic-red/90 shadow-sm transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Canvas
          </button>
        </div>

        {/* Instructions for connecting an agent */}
        <AgentConnectInstructions />

        {/* Modal for creating canvas */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl border border-line space-y-4">
              <h2 className="text-base font-semibold text-ink">Create New Lean Canvas</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">Canvas Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B2B Compliance Copilot"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Brief 1-sentence description"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                {createError && <p className="text-xs text-rose-600">{createError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 text-sm text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-60"
                  >
                    {isSubmitting ? "Creating..." : "Create Canvas"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Canvas List */}
        {canvases === undefined ? (
          <p className="text-xs text-muted">Loading canvases...</p>
        ) : canvases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center space-y-2">
            <LayoutGridIcon className="w-6 h-6 text-muted mx-auto" />
            <p className="text-sm font-semibold text-ink">No canvases yet</p>
            <p className="text-xs text-muted">Click &quot;New Canvas&quot; to start your first Lean Canvas.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {canvases.map((c) => (
            <Link
              key={c._id}
              href={`/canvas/${c._id}`}
              className="group rounded-2xl bg-surface border border-line p-5 space-y-3 hover:border-accent hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                    {c.status}
                  </span>
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {formatDistanceToNow(c.updatedAt, { addSuffix: true })}
                  </span>
                </div>
                <h3 className="font-semibold text-ink group-hover:text-accent transition-colors line-clamp-1">
                  {c.title}
                </h3>
                <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                  {c.description || "Lean canvas model"}
                </p>
              </div>

              <div className="pt-3 border-t border-line/60 flex items-center justify-between text-xs text-accent font-medium">
                <span>Open Canvas</span>
                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
        )}
      </main>

      {/* Discreet footer */}
      <footer className="border-t border-line bg-surface/60 py-4 px-6 text-center text-[11px] text-muted flex items-center justify-center gap-1">
        <span>A project of</span>
        <a
          href="https://incrementic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-ink hover:text-incrementic-red underline transition-colors"
        >
          Incrementic
        </a>
        <span>— The shortest distance to your next big thing.</span>
      </footer>
    </div>
  );
}
