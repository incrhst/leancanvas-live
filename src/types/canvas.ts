export type CanvasTemplate = "lean" | "gtm";

export type BlockId =
  | "problem"
  | "customerSegments"
  | "uniqueValueProposition"
  | "solution"
  | "channels"
  | "revenueStreams"
  | "costStructure"
  | "keyMetrics"
  | "unfairAdvantage"
  | "idealCustomer"
  | "painsAndAlternatives"
  | "positioning"
  | "messaging"
  | "salesMotion"
  | "pricing"
  | "launchPlan";

export type EvidenceState =
  | "unknown"
  | "assumption"
  | "observed"
  | "supported"
  | "contradicted"
  | "decision";

export type Role = "owner" | "editor" | "viewer";
export type NoteTone = "yellow" | "pink" | "blue" | "green";

export interface Collaborator {
  id: string;
  name: string;
  initials: string;
  tone: NoteTone;
  color: string;
  online: boolean;
  location?: BlockId;
  lastSeen?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

export interface Note {
  id: string;
  blockId: BlockId;
  text: string;
  authorId: string;
  votes: string[];
  comments: Comment[];
  createdAt: number;
}

export interface Activity {
  id: string;
  authorId: string;
  action: string;
  target: string;
  createdAt: number;
}

export interface TypingState {
  blockId: BlockId;
  authorId: string;
}

export interface BlockDef {
  id: BlockId;
  title: string;
  prompt: string;
  area: string;
  layout: "stack" | "wide";
  emphasis?: boolean;
}

export type Verdict = "pass" | "fail" | "inconclusive";

export interface LatestResult {
  text: string;
  /** YYYY-MM-DD */
  date: string;
  verdict?: Verdict;
}

export interface NoteItem {
  _id: string;
  canvasId?: string;
  block: BlockId;
  content: string;
  order: number;
  evidenceState: EvidenceState;
  measure?: string;
  passMark?: string;
  /** YYYY-MM-DD */
  reviewDate?: string;
  latestResult?: LatestResult;
  ownerId?: string;
  createdBy?: string;
  updatedAt: number;
}

export interface StressTestScores {
  clarity: number;
  desirability: number;
  viability: number;
  feasibility: number;
  defensibility: number;
  timing: number;
  mission: number;
}

export interface RiskiestAssumption {
  noteId?: string | null;
  block: string;
  assumption: string;
  reason: string;
  suggestedExperiment: string;
}

export interface StressTestResult {
  _id?: string;
  scores: StressTestScores;
  overallScore: number;
  riskiestAssumptions: RiskiestAssumption[];
  createdAt: number;
}