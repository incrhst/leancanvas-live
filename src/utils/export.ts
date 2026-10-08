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
