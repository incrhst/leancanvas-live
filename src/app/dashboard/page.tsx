"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/ConvexClientProvider";
import { AgentConnectInstructions } from "../../components/AgentConnectInstructions";
import { DecisionsWaitingChip } from "../../components/NoteDecision";
import { CheckInsWaitingChip } from "../../components/CheckIn";
import { CANVAS_TEMPLATE_LIST, getCanvasTemplate } from "../../utils/canvasTemplates";
import type { CanvasTemplate } from "../../types/canvas";
import {
  PlusIcon,
  LayoutGridIcon,
  CalendarIcon,
  ArrowRightIcon,
  LogOutIcon,
  SparklesIcon,
  UsersIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

type SortKey = "updated" | "created" | "title" | "people";
type OwnershipFilter = "all" | "owned" | "shared";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "updated", label: "Recently updated" },
  { id: "created", label: "Recently created" },
  { id: "title", label: "Name (A–Z)" },
  { id: "people", label: "Most people" },
];

const SORT_STORAGE_KEY = "dashboard.sort";

const selectClass =
  "rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent";

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
  const [newTemplate, setNewTemplate] = useState<CanvasTemplate>("lean");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");
  const [templateFilter, setTemplateFilter] = useState<CanvasTemplate | "all">("all");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?redirect=/dashboard");
  }, [isLoading, user, router]);

  // Remember the chosen sort per browser; storage can be unavailable (private mode)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved && SORT_OPTIONS.some((o) => o.id === saved)) setSortKey(saved as SortKey);
    } catch {}
  }, []);

  const changeSort = (key: SortKey) => {
    setSortKey(key);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, key);
    } catch {}
  };

  const isFiltered = search.trim() !== "" || ownership !== "all" || templateFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setOwnership("all");
    setTemplateFilter("all");
  };

  const visibleCanvases = useMemo(() => {
    if (!canvases) return [];
    const q = search.trim().toLowerCase();
    const filtered = canvases.filter((c) => {
      if (ownership === "owned" && c.role !== "owner") return false;
      if (ownership === "shared" && c.role === "owner") return false;
      if (templateFilter !== "all" && getCanvasTemplate(c.template).id !== templateFilter) return false;
      if (q && !`${c.title} ${c.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "created":
          return b._creationTime - a._creationTime;
        case "title":
          return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        case "people":
          return b.memberCount - a.memberCount || b.updatedAt - a.updatedAt;
        default:
          return b.updatedAt - a.updatedAt;
      }
    });
  }, [canvases, search, ownership, templateFilter, sortKey]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setCreateError(null);
    try {
      const canvasId = await createCanvas({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        template: newTemplate,
      });
      setIsCreating(false);
      setNewTitle("");
      setNewDesc("");
      setNewTemplate("lean");
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
          {user && <DecisionsWaitingChip />}
          {user && <CheckInsWaitingChip />}
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
              <h2 className="text-base font-semibold text-ink">Create New Canvas</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-ink">Template</span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CANVAS_TEMPLATE_LIST.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={newTemplate === t.id}
                        onClick={() => setNewTemplate(t.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          newTemplate === t.id
                            ? "border-accent bg-accent-soft"
                            : "border-line bg-white hover:border-accent/50"
                        }`}
                      >
                        <span className="block text-xs font-semibold text-ink">{t.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{t.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
            <p className="text-xs text-muted">Click &quot;New Canvas&quot; to start your first canvas.</p>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search canvases</span>
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or description"
                className="w-full rounded-lg border border-line bg-surface py-2 pl-8 pr-3 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by ownership"
                value={ownership}
                onChange={(e) => setOwnership(e.target.value as OwnershipFilter)}
                className={selectClass}
              >
                <option value="all">All canvases</option>
                <option value="owned">Owned by me</option>
                <option value="shared">Shared with me</option>
              </select>
              <select
                aria-label="Filter by template"
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value as CanvasTemplate | "all")}
                className={selectClass}
              >
                <option value="all">All templates</option>
                {CANVAS_TEMPLATE_LIST.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <select
                aria-label="Sort canvases"
                value={sortKey}
                onChange={(e) => changeSort(e.target.value as SortKey)}
                className={selectClass}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isFiltered && (
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span>
                Showing {visibleCanvases.length} of {canvases.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <XIcon className="h-3 w-3" />
                Clear filters
              </button>
            </div>
          )}

          {visibleCanvases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center space-y-2">
              <SearchIcon className="w-6 h-6 text-muted mx-auto" />
              <p className="text-sm font-semibold text-ink">No canvases match</p>
              <p className="text-xs text-muted">Try a different search or clear the filters.</p>
            </div>
          ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {visibleCanvases.map((c) => (
            <Link
              key={c._id}
              href={`/canvas/${c._id}`}
              className="group rounded-2xl bg-surface border border-line p-5 space-y-3 hover:border-accent hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                      {c.status}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700">
                      {getCanvasTemplate(c.template).label}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {formatDistanceToNow(c.updatedAt, { addSuffix: true })}
                  </span>
                </div>
                <h3 className="font-semibold text-ink group-hover:text-accent transition-colors line-clamp-1">
                  {c.title}
                </h3>
                <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                  {c.description || getCanvasTemplate(c.template).label}
                </p>
              </div>

              <div className="pt-3 border-t border-line/60 flex items-center justify-between text-xs text-accent font-medium">
                <span>Open Canvas</span>
                <span className="flex items-center gap-3">
                  <span
                    className="flex items-center gap-1 text-[11px] font-normal text-muted"
                    title={`${c.memberCount} ${c.memberCount === 1 ? "person" : "people"} on this canvas`}
                  >
                    <UsersIcon className="w-3 h-3" />
                    {c.memberCount}
                  </span>
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          ))}
        </div>
          )}
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
