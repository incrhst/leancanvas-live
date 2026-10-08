import type { BlockDef, CanvasTemplate } from "../types/canvas";

export interface ScoreMeta {
  label: string;
  desc: string;
}

export interface CanvasTemplateDef {
  id: CanvasTemplate;
  /** Full name, e.g. "Lean Canvas" */
  label: string;
  /** Short copy for the create-canvas picker */
  description: string;
  blocks: BlockDef[];
  /** Labels for the seven stress-test scores. Keys match the stored score names, which are shared by both templates. */
  scoreLabels: Record<string, ScoreMeta>;
  /** Used in headings and buttons, e.g. "Ash Maurya Stress Test" */
  stressTestName: string;
  /** Prefix for exported file names */
  fileSlug: string;
}

const LEAN_BLOCKS: BlockDef[] = [
  {
    id: "problem",
    title: "1. Problem",
    prompt: "Top 3 problems · existing alternatives",
    area: "lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
  },
  {
    id: "solution",
    title: "4. Solution",
    prompt: "Top 3 features & capabilities",
    area: "lg:col-start-3 lg:col-span-2 lg:row-start-1",
    layout: "stack",
  },
  {
    id: "keyMetrics",
    title: "8. Key Metrics",
    prompt: "Key activities and indicators measured",
    area: "lg:col-start-3 lg:col-span-2 lg:row-start-2",
    layout: "stack",
  },
  {
    id: "uniqueValueProposition",
    title: "3. Unique Value Proposition",
    prompt: "Single, clear, compelling message",
    area: "lg:col-start-5 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
    emphasis: true,
  },
  {
    id: "unfairAdvantage",
    title: "9. Unfair Advantage",
    prompt: "Cannot easily be copied or bought",
    area: "lg:col-start-7 lg:col-span-2 lg:row-start-1",
    layout: "stack",
  },
  {
    id: "channels",
    title: "5. Channels",
    prompt: "Path to customers & distribution",
    area: "lg:col-start-7 lg:col-span-2 lg:row-start-2",
    layout: "stack",
  },
  {
    id: "customerSegments",
    title: "2. Customer Segments",
    prompt: "Target customers · early adopters",
    area: "lg:col-start-9 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
  },
  {
    id: "costStructure",
    title: "7. Cost Structure",
    prompt: "Customer acquisition, hosting, infrastructure, people",
    area: "lg:col-start-1 lg:col-span-5 lg:row-start-3",
    layout: "wide",
  },
  {
    id: "revenueStreams",
    title: "6. Revenue Streams",
    prompt: "Revenue model, lifetime value, gross margin",
    area: "lg:col-start-6 lg:col-span-5 lg:row-start-3",
    layout: "wide",
  },
];

// Same grid placement as the Lean board, so both templates lay out identically.
const GTM_BLOCKS: BlockDef[] = [
  {
    id: "idealCustomer",
    title: "1. Ideal Customer",
    prompt: "Firmographics · buyer persona · decision-maker",
    area: "lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
  },
  {
    id: "painsAndAlternatives",
    title: "2. Pains & Alternatives",
    prompt: "Top pains & jobs · what buyers use today",
    area: "lg:col-start-3 lg:col-span-2 lg:row-start-1",
    layout: "stack",
  },
  {
    id: "positioning",
    title: "3. Positioning",
    prompt: "Category · differentiation vs alternatives",
    area: "lg:col-start-3 lg:col-span-2 lg:row-start-2",
    layout: "stack",
  },
  {
    id: "messaging",
    title: "4. Value Proposition & Messaging",
    prompt: "Core promise · message per persona",
    area: "lg:col-start-5 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
    emphasis: true,
  },
  {
    id: "channels",
    title: "5. Channels",
    prompt: "How buyers discover, buy & onboard",
    area: "lg:col-start-7 lg:col-span-2 lg:row-start-1",
    layout: "stack",
  },
  {
    id: "salesMotion",
    title: "6. Sales Motion",
    prompt: "Self-serve vs sales-led · cycle · who closes",
    area: "lg:col-start-7 lg:col-span-2 lg:row-start-2",
    layout: "stack",
  },
  {
    id: "pricing",
    title: "7. Pricing & Packaging",
    prompt: "Price points · packaging · willingness to pay",
    area: "lg:col-start-9 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
  },
  {
    id: "launchPlan",
    title: "8. 90-Day Launch Plan",
    prompt: "Milestones · experiments · owners",
    area: "lg:col-start-1 lg:col-span-5 lg:row-start-3",
    layout: "wide",
  },
  {
    id: "keyMetrics",
    title: "9. Success Metrics",
    prompt: "Pipeline, CAC, conversion & retention targets",
    area: "lg:col-start-6 lg:col-span-5 lg:row-start-3",
    layout: "wide",
  },
];

const LEAN_SCORE_LABELS: Record<string, ScoreMeta> = {
  clarity: { label: "Clarity", desc: "Sharpness of problem & UVP" },
  desirability: { label: "Desirability", desc: "Customer urgency & demand" },
  viability: { label: "Viability", desc: "Unit economics & margin" },
  feasibility: { label: "Feasibility", desc: "Ease of technical delivery" },
  defensibility: { label: "Defensibility", desc: "True unfair advantage" },
  timing: { label: "Timing", desc: "Market catalysts & why now" },
  mission: { label: "Mission", desc: "Strategic coherence" },
};

const GTM_SCORE_LABELS: Record<string, ScoreMeta> = {
  clarity: { label: "Positioning clarity", desc: "Sharp ICP & core message" },
  desirability: { label: "Buyer pull", desc: "Urgency & active demand" },
  viability: { label: "Unit economics", desc: "Pricing & acquisition payback" },
  feasibility: { label: "Execution", desc: "Can the team run the plan" },
  defensibility: { label: "Differentiation", desc: "Holds against alternatives" },
  timing: { label: "Channel timing", desc: "Why this window is open" },
  mission: { label: "Plan coherence", desc: "ICP, message & channels aligned" },
};

export const CANVAS_TEMPLATES: Record<CanvasTemplate, CanvasTemplateDef> = {
  lean: {
    id: "lean",
    label: "Lean Canvas",
    description: "The business model on one page: problem, solution, metrics and costs. Best for validating a new venture.",
    blocks: LEAN_BLOCKS,
    scoreLabels: LEAN_SCORE_LABELS,
    stressTestName: "Ash Maurya Stress Test",
    fileSlug: "leancanvas",
  },
  gtm: {
    id: "gtm",
    label: "GTM Canvas",
    description: "How you reach and win buyers: ideal customer, positioning, channels, sales motion, pricing and a 90-day launch.",
    blocks: GTM_BLOCKS,
    scoreLabels: GTM_SCORE_LABELS,
    stressTestName: "GTM Stress Test",
    fileSlug: "gtmcanvas",
  },
};

export const CANVAS_TEMPLATE_LIST: CanvasTemplateDef[] = [CANVAS_TEMPLATES.lean, CANVAS_TEMPLATES.gtm];

/** Canvases created before templates have no template and are treated as Lean. */
export function getCanvasTemplate(id?: string | null): CanvasTemplateDef {
  return CANVAS_TEMPLATES[id === "gtm" ? "gtm" : "lean"];
}

/** Block title without its "1. " numbering. Falls back to the raw id for a block the template does not have. */
export function blockName(blocks: BlockDef[], blockId: string): string {
  const title = blocks.find((b) => b.id === blockId)?.title ?? blockId;
  return title.replace(/^\d+\.\s*/, "");
}
