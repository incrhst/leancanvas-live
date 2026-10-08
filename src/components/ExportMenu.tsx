import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, DownloadIcon, FileTextIcon, ImageIcon, Loader2Icon } from "lucide-react";
import { ExportKind, ExportSheet } from "./ExportSheet";
import { downloadSheetAsPdf, downloadSheetAsPng, exportFileName } from "../utils/export";
import type { CanvasTemplateDef } from "../utils/canvasTemplates";
import type { NoteItem, StressTestResult } from "../types/canvas";

type ExportFormat = "pdf" | "png";

interface ExportJob {
  kind: ExportKind;
  format: ExportFormat;
  fileName: string;
  documentTitle: string;
  exportedAt: number;
}

export interface ExportRequest {
  kind: ExportKind;
  format: ExportFormat;
}

export interface ExportMenuProps {
  title: string;
  /** Shown on the sheet beside the template name, e.g. "Public view" */
  badge?: string;
  template: CanvasTemplateDef;
  notes: NoteItem[];
  stressResult: StressTestResult | null;
  /** An export asked for by a link. It runs once, then onAutoExportHandled is called. */
  autoExport?: ExportRequest | null;
  onAutoExportHandled?: () => void;
}

const KIND_LABEL: Record<ExportKind, string> = {
  canvas: "Canvas",
  risks: "Riskiest assumptions",
};

const KIND_SUFFIX: Record<ExportKind, string> = {
  canvas: "canvas",
  risks: "riskiest-assumptions",
};

/** Reads an export request from a link's `export` param, e.g. `?export=risks-pdf`. */
export function parseExportRequest(value: string | null): ExportRequest | null {
  const match = value?.match(/^(canvas|risks)-(pdf|png)$/);
  if (!match) return null;
  return { kind: match[1] as ExportKind, format: match[2] as ExportFormat };
}

/**
 * Export dropdown for the canvas and its riskiest assumptions, as PDF or PNG.
 * Choosing an export mounts the sheet off-screen, captures it, then unmounts it.
 */
export function ExportMenu({
  title,
  badge,
  template,
  notes,
  stressResult,
  autoExport,
  onAutoExportHandled,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const hasRisks = (stressResult?.riskiestAssumptions.length ?? 0) > 0;

  // Close on an outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The sheet mounts together with the job, so it is in the DOM by the time this runs
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    (async () => {
      try {
        const node = sheetRef.current;
        if (!node) throw new Error("Export sheet did not render");
        await document.fonts.ready;
        if (job.format === "png") {
          await downloadSheetAsPng(node, job.fileName);
        } else {
          await downloadSheetAsPdf(node, job.fileName, job.documentTitle);
        }
      } catch (err) {
        console.error("Export failed", err);
        if (!cancelled) setError("Export failed. Please try again.");
      } finally {
        if (!cancelled) setJob(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job]);

  const startExport = (kind: ExportKind, format: ExportFormat) => {
    setOpen(false);
    setError(null);
    setJob({
      kind,
      format,
      fileName: exportFileName(title, template.fileSlug, KIND_SUFFIX[kind], format),
      documentTitle: `${title} · ${KIND_LABEL[kind]}`,
      exportedAt: Date.now(),
    });
  };

  // Runs an export that a link asked for, once. The page then clears the request from the URL.
  const autoExportHandled = useRef(false);
  useEffect(() => {
    if (!autoExport || autoExportHandled.current) return;
    autoExportHandled.current = true;
    if (autoExport.kind === "risks" && !hasRisks) {
      setError("This canvas has no riskiest assumptions to export yet.");
    } else {
      startExport(autoExport.kind, autoExport.format);
    }
    onAutoExportHandled?.();
  }, [autoExport, hasRisks, onAutoExportHandled]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!!job}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-60"
      >
        {job ? <Loader2Icon size={13} className="animate-spin" /> : <DownloadIcon size={13} />}
        {job ? "Exporting..." : "Export"}
        <ChevronDownIcon size={12} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-line bg-surface p-2 shadow-lg"
        >
          <ExportGroup label="Canvas" onPick={(format) => startExport("canvas", format)} />
          <div className="my-2 border-t border-line" />
          <ExportGroup
            label="Riskiest assumptions"
            disabled={!hasRisks}
            hint={hasRisks ? undefined : "Run a stress test to rank the risks first."}
            onPick={(format) => startExport("risks", format)}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="absolute right-0 top-full mt-1.5 whitespace-nowrap text-[11px] text-rose-700">
          {error}
        </p>
      )}

      {job &&
        createPortal(
          <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0 }}>
            <ExportSheet
              ref={sheetRef}
              kind={job.kind}
              title={title}
              badge={badge}
              template={template}
              notes={notes}
              stressResult={stressResult}
              exportedAt={job.exportedAt}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

function ExportGroup({
  label,
  hint,
  disabled = false,
  onPick,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onPick: (format: ExportFormat) => void;
}) {
  return (
    <div>
      <p className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => onPick("pdf")}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-subtle disabled:hover:bg-transparent"
        >
          <FileTextIcon size={13} />
          PDF
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => onPick("png")}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-subtle disabled:hover:bg-transparent"
        >
          <ImageIcon size={13} />
          PNG
        </button>
      </div>
      {hint && <p className="px-1.5 pt-1.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
