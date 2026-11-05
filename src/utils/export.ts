import { NoteItem, StressTestResult } from "../types/canvas";
import { CanvasTemplateDef } from "./canvasTemplates";

export function exportCanvasMarkdown(
  title: string,
  template: CanvasTemplateDef,
  notes: NoteItem[],
  stressTest?: StressTestResult | null
): string {
  let md = `# ${template.label}: ${title}\n\n`;
  md += `_Generated on ${new Date().toLocaleDateString()}_ \n\n---\n\n`;

  for (const block of template.blocks) {
    md += `## ${block.title}\n`;
    md += `*${block.prompt}*\n\n`;

    const blockNotes = notes.filter((n) => n.block === block.id);
    if (blockNotes.length === 0) {
      md += `_(No items recorded)_\n\n`;
    } else {
      for (const note of blockNotes) {
        md += `- [**${note.evidenceState.toUpperCase()}**] ${note.content}\n`;
        if (note.markets?.length) md += `  - Markets: ${note.markets.join(", ")}\n`;
        if (note.measure) md += `  - Measure: ${note.measure}\n`;
        if (note.passMark) md += `  - Pass mark: ${note.passMark}\n`;
        if (note.reviewDate) md += `  - Review: ${note.reviewDate}\n`;
        if (note.latestResult) {
          const verdict = note.latestResult.verdict ? ` (${note.latestResult.verdict})` : "";
          md += `  - Latest result, ${note.latestResult.date}${verdict}: ${note.latestResult.text}\n`;
        }
      }
      md += `\n`;
    }
  }

  if (stressTest) {
    md += `\n---\n\n## ${template.stressTestName} Evaluation\n\n`;
    md += `**Overall Score:** ${stressTest.overallScore} / 10\n\n`;
    md += `### Dimension Scores:\n`;
    for (const [dim, score] of Object.entries(stressTest.scores)) {
      md += `- **${template.scoreLabels[dim]?.label ?? dim}**: ${score}/10\n`;
    }

    if (stressTest.riskiestAssumptions.length > 0) {
      md += `\n### Top Riskiest Assumptions:\n`;
      stressTest.riskiestAssumptions.forEach((risk, i) => {
        md += `\n#### ${i + 1}. [${risk.block.toUpperCase()}] ${risk.assumption}\n`;
        md += `- **Why lethal:** ${risk.reason}\n`;
        md += `- **Suggested Experiment:** ${risk.suggestedExperiment}\n`;
      });
    }
  }

  return md;
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Canvas area budget for rasterised exports. Safari caps a canvas at about 16.7M pixels. */
const MAX_EXPORT_PIXELS = 12_000_000;

/** Renders an export sheet to a PNG data URL at up to 2x, staying inside the pixel budget. */
export async function renderSheetToPng(node: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const pixelRatio = Math.max(1, Math.min(2, Math.sqrt(MAX_EXPORT_PIXELS / (width * height))));

  return toPng(node, {
    width,
    height,
    pixelRatio,
    backgroundColor: "#ffffff",
    // The sheet is parked off-screen while it renders. Pin the copy to the origin so it is not clipped.
    style: { position: "static", left: "auto", top: "auto" },
  });
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function downloadSheetAsPng(node: HTMLElement, filename: string) {
  downloadDataUrl(filename, await renderSheetToPng(node));
}

/** Saves the sheet as a single-page PDF. The page is the sheet's own size, so the design is not cropped or split. */
export async function downloadSheetAsPdf(node: HTMLElement, filename: string, title: string) {
  const dataUrl = await renderSheetToPng(node);
  const { jsPDF } = await import("jspdf");
  // CSS pixels to PDF points is 72/96.
  const widthPt = node.offsetWidth * 0.75;
  const heightPt = node.offsetHeight * 0.75;
  const pdf = new jsPDF({
    unit: "pt",
    format: [widthPt, heightPt],
    orientation: widthPt >= heightPt ? "landscape" : "portrait",
    compress: true,
  });
  pdf.setProperties({ title });
  pdf.addImage(dataUrl, "PNG", 0, 0, widthPt, heightPt);
  pdf.save(filename);
}

/** exportFileName("Founders Pilot", "leancanvas", "risks", "pdf") -> "founders-pilot-risks.pdf". Uses the fallback when the title has no usable characters. */
export function exportFileName(title: string, fallback: string, suffix: string, extension: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
  return `${base}-${suffix}.${extension}`;
}
