import { NoteItem, StressTestResult } from "../types/canvas";
import { CANVAS_BLOCKS } from "../components/LeanCanvasBoard";

export function exportCanvasMarkdown(
  title: string,
  notes: NoteItem[],
  stressTest?: StressTestResult | null
): string {
  let md = `# Lean Canvas: ${title}\n\n`;
  md += `_Generated on ${new Date().toLocaleDateString()}_ \n\n---\n\n`;

  for (const block of CANVAS_BLOCKS) {
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
    md += `\n---\n\n## Ash Maurya Stress Test Evaluation\n\n`;
    md += `**Overall Score:** ${stressTest.overallScore} / 10\n\n`;
    md += `### Dimension Scores:\n`;
    for (const [dim, score] of Object.entries(stressTest.scores)) {
      md += `- **${dim}**: ${score}/10\n`;
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
