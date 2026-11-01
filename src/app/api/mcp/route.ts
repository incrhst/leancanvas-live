import { NextRequest, NextResponse } from "next/server";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { api } from "../../../../convex/_generated/api";
import { GTM_BLOCK_IDS, LEAN_BLOCK_IDS } from "../../../../convex/lib/canvasTemplates";
import { getCanvasTemplate } from "../../../utils/canvasTemplates";
import { EVIDENCE_GLOSSARY, EVIDENCE_STATES } from "../../../utils/evidenceStates";
import { plainSummary, SummaryNote } from "../../../utils/plainSummary";
import { todayLocal } from "../../../utils/testFields";
import { VERDICT_EVIDENCE, daysBetween, testStage, todayUtc } from "../../../../convex/lib/testFields";
import {
  DECISION_BASES,
  ITEM_STATE_MEANINGS,
  ITEM_STATES,
  LOOK_BACK_ANSWERS,
} from "../../../../convex/lib/goalModel";

const ALL_BLOCK_IDS = [...new Set([...LEAN_BLOCK_IDS, ...GTM_BLOCK_IDS])];
const EVIDENCE_STATE_PROPERTY = {
  type: "string",
  enum: EVIDENCE_STATES,
  description: `How well the note is evidenced: ${EVIDENCE_GLOSSARY}`,
};

// Optional test fields, shared by add_note and update_note. On update_note, null clears a field.
const TEST_FIELD_PROPERTIES = {
  measure: {
    type: ["string", "null"],
    description: "What we watch to test this note, e.g. 'Cost per budget-tool start, by post'",
  },
  passMark: {
    type: ["string", "null"],
    description: "What counts as success, e.g. 'Below $2 per start'",
  },
  reviewDate: {
    type: ["string", "null"],
    description: "When the result is checked, as YYYY-MM-DD",
  },
  reviewDay: {
    type: "integer",
    description:
      "Alternative to reviewDate: the day of the plan, counted from the canvas's launchDate (day 0), e.g. 30. Needs a launchDate.",
  },
  latestResult: {
    type: ["object", "null"],
    description: "The most recent result. Replaces the previous one, which stays in the note's history.",
    properties: {
      text: { type: "string", description: "What was seen, in a line or two" },
      date: { type: "string", description: "YYYY-MM-DD; defaults to today (UTC)" },
      verdict: {
        type: "string",
        enum: ["pass", "fail", "inconclusive"],
        description: "How the result compares with the pass mark",
      },
    },
    required: ["text"],
  },
};

const RUNBOOK_FIELD_PROPERTIES = {
  title: { type: "string" },
  trigger: { type: ["string", "null"], description: "When to use it, e.g. 'Primary supplier misses a delivery by more than 24 hours'" },
  ownerUserId: { type: ["string", "null"], description: "Who owns it: a userId from list_canvas_members" },
  steps: { type: "array", items: { type: "string" }, description: "The steps in order (replaces all steps), at most 40" },
  noteIds: { type: "array", items: { type: "string" }, description: "Canvas notes it codifies (replaces the list)" },
  itemIds: { type: "array", items: { type: "string" }, description: "Goal items whose decisions it rests on (replaces the list)" },
  sopId: { type: ["string", "null"], description: "The SOP it belongs to; null takes it out" },
  reviewDate: { type: ["string", "null"], description: "When to review it, YYYY-MM-DD" },
};

const LAUNCH_DATE_PROPERTY = {
  type: "string",
  description:
    "Day 0 of the plan, as YYYY-MM-DD. Review dates then also read as days of the plan (reviewDay), e.g. day 30.",
};

const DRIVER_PROPERTY = {
  type: ["string", "null"],
  description:
    "The note's driver: the one person doing the work on it. A userId from list_canvas_members (viewers can be drivers too). null clears it.",
};

const MARKETS_PROPERTY = {
  type: ["array", "null"],
  items: { type: "string" },
  description:
    "Markets where the note holds, e.g. ['Jamaica']. Leave a note untagged when it applies everywhere, so a result from one market doesn't read as true in all of them. Up to 5; [] or null clears.",
};

const REASON_PROPERTY = {
  type: "string",
  description: "Optional one line on why, kept in the note's history",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

const TOOLS_MANIFEST = [
  {
    name: "list_canvases",
    description: "List the canvases (Lean or GTM) the signed-in user owns or collaborates on (returns canvasId, title, template, role and URL)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_canvas",
    description: "Create a new canvas for a startup, project, or business idea: a Lean Canvas (default) or a GTM Canvas",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the canvas (e.g. 'AI Bookkeeping for Freelancers')",
        },
        description: {
          type: "string",
          description: "Optional one-sentence summary of the business model or problem being solved",
        },
        template: {
          type: "string",
          enum: ["lean", "gtm"],
          default: "lean",
          description:
            "'lean' for a Lean Canvas (business model: problem, solution, metrics, costs), or 'gtm' for a go-to-market canvas (ideal customer, positioning, channels, sales motion, pricing, 90-day launch plan)",
        },
        seedNotes: {
          type: "boolean",
          description: "Whether to initialize with standard starter notes (default: true)",
          default: true,
        },
        launchDate: LAUNCH_DATE_PROPERTY,
      },
      required: ["title"],
    },
  },
  {
    name: "update_canvas",
    description: "Change a canvas's title, description or launch date. Pass only what changes.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        launchDate: {
          type: ["string", "null"],
          description: `${LAUNCH_DATE_PROPERTY.description} null clears it.`,
        },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "get_canvas",
    description:
      "Fetch a canvas (Lean or GTM) with all of its blocks and sticky notes, including each note's evidence state and, where set, its test (measure, passMark, reviewDate, latestResult). Each note shows its driver (the person doing the work on it) and market tags if it has them; pass driverUserId to see the notes one person is driving, or market to see what holds in one market. If the canvas has a launchDate, it also returns currentDay and each note's reviewDay (days since launch). Each note has a stage (guess, tested, repeatable, codified) and blockStages gives each block's stage: that of its least runnable note.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: {
          type: "string",
          description: "The canvasId returned by list_canvases or create_canvas",
        },
        driverUserId: {
          type: "string",
          description: "Only return notes this userId is driving, or 'unassigned' for notes with no driver",
        },
        market: {
          type: "string",
          description: "Only return notes that hold in this market: tagged with it, or untagged (which means every market)",
        },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "list_canvas_members",
    description:
      "List everyone with access to a canvas (userId, name, email, role). Use a userId as a note's driver in add_note or update_note, as a decider in request_decision, or to filter get_canvas.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "add_note",
    description:
      `Add a new sticky note to a block of a canvas. The block must belong to the canvas's template. ` +
      `Lean blocks: ${LEAN_BLOCK_IDS.join(", ")}. GTM blocks: ${GTM_BLOCK_IDS.join(", ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        block: {
          type: "string",
          enum: ALL_BLOCK_IDS,
        },
        content: { type: "string" },
        evidenceState: { ...EVIDENCE_STATE_PROPERTY, default: "assumption" },
        driverUserId: DRIVER_PROPERTY,
        markets: MARKETS_PROPERTY,
        ...TEST_FIELD_PROPERTIES,
        reason: REASON_PROPERTY,
      },
      required: ["canvasId", "block", "content"],
    },
  },
  {
    name: "update_note",
    description:
      "Reword a note, move it to another block of the same canvas, change its evidence state, stage or driver, or set its test " +
      "(measure, passMark, reviewDate, latestResult). Pass only what changes; null clears a test field. " +
      "Tests go: plan (measure, passMark and reviewDate or reviewDay) → record what was seen at the review (latestResult with a verdict) → " +
      "act on it (a pass points to 'supported', a fail to 'contradicted'; set evidenceState with the result as the reason, in the same call if you like). " +
      "To run a new test after a result, pass latestResult: null with the new plan. list_tests shows where each test is. " +
      "Use this instead of adding a second note when refining one. Every change is kept in the note's history.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "The noteId from get_canvas" },
        content: { type: "string", description: "New text for the note" },
        block: {
          type: "string",
          enum: ALL_BLOCK_IDS,
          description: "Move the note to this block (it goes to the end). Must belong to the canvas's template.",
        },
        evidenceState: EVIDENCE_STATE_PROPERTY,
        stage: {
          type: "string",
          enum: ["guess", "tested", "repeatable"],
          description:
            "How runnable this part of the business is: guess (untested), tested (tried by hand), repeatable (worked more than once, steps written down). 'codified' can't be set here: it comes from a live runbook linking the note.",
        },
        driverUserId: DRIVER_PROPERTY,
        markets: MARKETS_PROPERTY,
        ...TEST_FIELD_PROPERTIES,
        reason: REASON_PROPERTY,
        link: { type: "string", description: "Optional link backing the change, kept in the note's history" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "delete_note",
    description: "Remove a note from its canvas. Its history, including its last text, stays readable through get_note_history.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        reason: REASON_PROPERTY,
      },
      required: ["noteId"],
    },
  },
  {
    name: "get_note_history",
    description:
      "List every change to a note, newest first: who made it, when, whether it came from the app or an agent, what changed from and to, and the reason if one was given. Works for deleted notes too.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "request_decision",
    description:
      "Ask someone to decide on a note: a canvas member (deciderUserId), or anyone without an account by deciderName and deciderEmail (they never see the canvas, only this question; if the email belongs to a member, the member is asked). They're emailed a link that answers it from their phone with no sign-in, even with view-only access; it works only for this decision and stops once it's made or withdrawn. Give a defaultOutcome so they see what happens if nobody decides by the due date (it is shown, never applied for them), and options to offer named choices instead of approve / reject. Name any option that only puts the decision off (e.g. 'Decide after day 3') in deferOptions: choosing it answers the request but leaves the note's evidence state as it was, so the canvas doesn't claim it's settled. A note can have one open request at a time.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        question: { type: "string", description: "The yes/no question to decide, in one line" },
        deciderUserId: { type: "string", description: "Who decides, if they're on the canvas: a userId from list_canvas_members" },
        deciderName: {
          type: "string",
          description: "Who decides, if they have no account: their name. Pass with deciderEmail instead of deciderUserId",
        },
        deciderEmail: { type: "string", description: "Where to email the answer link for someone without an account" },
        dueDate: { type: "string", description: "When it's needed by, as YYYY-MM-DD" },
        dueDay: {
          type: "integer",
          description: "Alternative to dueDate: the day of the plan, counted from the canvas's launchDate",
        },
        defaultOutcome: {
          type: "string",
          description:
            "What happens if nobody decides by the due date, e.g. 'We sign the agency'. Shown as 'If nothing is decided by 1 November, we sign the agency.'",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description:
            "2 to 4 short choices instead of approve / reject, e.g. ['Sign the agency', 'Build in-house', 'Ask me Friday']",
        },
        deferOptions: {
          type: "array",
          items: { type: "string" },
          description:
            "Which of options put the decision off instead of making it, e.g. ['Ask me Friday']. Choosing one records the answer but doesn't mark the note as a decision. At least one option must not defer.",
        },
      },
      required: ["noteId", "question"],
    },
  },
  {
    name: "answer_decision",
    description:
      "Answer a decision request addressed to you. approve or reject makes the note a decision (on a request with options, use choose with the option as choice instead; an option listed in the request's deferOptions records your answer but leaves the note as it is); change sends it back to whoever asked, with your comment, and leaves the note as it is. Works with view-only access.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        answer: { type: "string", enum: ["approve", "reject", "change", "choose"] },
        choice: { type: "string", description: "With answer 'choose': one of the request's options" },
        comment: { type: "string", description: "Optional for approve and reject; required for change" },
      },
      required: ["noteId", "answer"],
    },
  },
  {
    name: "withdraw_decision",
    description: "Cancel an open decision request on a note.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        reason: REASON_PROPERTY,
      },
      required: ["noteId"],
    },
  },
  {
    name: "list_decisions",
    description:
      "With a canvasId: every note on that canvas with a decision request, open or answered, soonest due first. Without: the open decisions waiting on you across all your canvases.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
      },
    },
  },
  {
    name: "create_snapshot",
    description:
      "Freeze a canvas as it is now under a label, e.g. 'Day 30', so it can be compared with later. Take one before each review.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        label: { type: "string", description: "Short name, e.g. 'Day 0' or 'Day 30 review'" },
      },
      required: ["canvasId", "label"],
    },
  },
  {
    name: "list_snapshots",
    description: "List a canvas's snapshots, newest first, with their snapshotId, label, date and day of the plan.",
    inputSchema: {
      type: "object",
      properties: { canvasId: { type: "string" } },
      required: ["canvasId"],
    },
  },
  {
    name: "compare_snapshots",
    description:
      "Compare two snapshots, or a snapshot and the canvas now: which notes were added, removed, or changed (text, block, evidence state, test fields, driver, decision status), field by field.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        from: { type: "string", description: "The earlier snapshotId" },
        to: { type: "string", description: "The later snapshotId, or 'current' for the canvas now (default)" },
      },
      required: ["canvasId", "from"],
    },
  },
  {
    name: "get_review",
    description:
      "The review-meeting view of a canvas, and nothing else: every note with a test and how its latest result compares with its pass mark (missed, no result yet, unclear, met; overdue reviews flagged), the open decisions, and what changed since a snapshot (the latest one unless sinceSnapshotId is given). Use it to prepare or run a day-30/60/90 review.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        sinceSnapshotId: { type: "string", description: "Compare with this snapshot instead of the latest" },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "list_check_ins",
    description:
      "The weekly check-in questions waiting on you: for each note you're driving, has there been new evidence this week? Answer each with answer_check_in.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "answer_check_in",
    description:
      "Answer a weekly check-in on a note you're driving (works with view-only access). hasEvidence false records 'no new evidence'. hasEvidence true needs a one-line text, which becomes the note's latest result. Both go into the note's history.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        hasEvidence: { type: "boolean" },
        text: { type: "string", description: "One line on the new evidence (required if hasEvidence is true)" },
        verdict: {
          type: "string",
          enum: ["pass", "fail", "inconclusive"],
          description: "Optional: how the new result compares with the pass mark",
        },
        date: { type: "string", description: "YYYY-MM-DD; defaults to today (UTC)" },
      },
      required: ["noteId", "hasEvidence"],
    },
  },
  {
    name: "send_check_in",
    description:
      "Send this week's check-in for a canvas now rather than waiting for the Monday email: each note's driver is emailed once about the notes they're driving. Notes already asked about this week are skipped.",
    inputSchema: {
      type: "object",
      properties: { canvasId: { type: "string" } },
      required: ["canvasId"],
    },
  },
  {
    name: "list_tests",
    description:
      "Every test on a canvas and where it is: 'running' (waiting for its review date), 'due' or 'overdue' (the review date has come and no result is recorded since), " +
      "or 'result' (a result is in). For results whose verdict points to a different evidence state than the note has, suggestedEvidenceState says which. " +
      "Record results and act on them with update_note.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        stage: {
          type: "string",
          enum: ["running", "due", "overdue", "result"],
          description: "Only tests at this stage ('due' includes overdue ones)",
        },
        driverUserId: { type: "string", description: "Only tests on notes this user is driving, or 'unassigned'" },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "update_evidence_state",
    description: "Update the empirical evidence state of a note",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        evidenceState: EVIDENCE_STATE_PROPERTY,
        reason: REASON_PROPERTY,
      },
      required: ["noteId", "evidenceState"],
    },
  },
  {
    name: "run_stress_test",
    description:
      "Run the 7-dimension AI stress test on a canvas (Ash Maurya methodology for Lean Canvases, go-to-market criteria for GTM Canvases)",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "export_canvas",
    description:
      "Export a canvas. format 'summary' returns, right away, a plain-language summary with one short paragraph per block for a non-technical reader (what's decided, what held up, what didn't, what's still untested, what's waiting on a decision). format 'pdf' or 'png' returns a link that downloads the canvas, or its riskiest assumptions, as a file; the user opens it while signed in and the download starts once the canvas loads. The riskiest assumptions need a stress test first.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        view: {
          type: "string",
          enum: ["canvas", "riskiest_assumptions"],
          default: "canvas",
          description:
            "'canvas' for the full board, or 'riskiest_assumptions' for the ranked risks from the latest stress test",
        },
        format: {
          type: "string",
          enum: ["pdf", "png", "summary"],
          default: "pdf",
          description: "'summary' for plain-language text (canvas view only), or 'pdf' / 'png' for a file",
        },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "list_runbooks",
    description:
      "How much of the business runs without the founder: each block's stage (guess, tested, repeatable, codified), SOPs, and runbooks with their trigger, owner, steps, linked notes and decisions, run stats (worked / didn't / partly, and keepsFailingAt: a step that failed at least twice in the last 5 runs) and recent runs. needsAttention lists live runbooks failing at the same step or due for review. A step that keeps failing usually means a canvas problem: wrong segment, channel or price.",
    inputSchema: { type: "object", properties: { canvasId: { type: "string" } }, required: ["canvasId"] },
  },
  {
    name: "create_sop",
    description: "Add an SOP (standard operating procedure): a named group of runbooks several people follow, e.g. 'Acquisition' or 'Event day'.",
    inputSchema: {
      type: "object",
      properties: { canvasId: { type: "string" }, title: { type: "string" }, description: { type: "string" } },
      required: ["canvasId", "title"],
    },
  },
  {
    name: "update_sop",
    description: "Rename an SOP or change its description (null clears it).",
    inputSchema: {
      type: "object",
      properties: { sopId: { type: "string" }, title: { type: "string" }, description: { type: ["string", "null"] } },
      required: ["sopId"],
    },
  },
  {
    name: "delete_sop",
    description: "Delete an SOP. Its runbooks stay, ungrouped.",
    inputSchema: { type: "object", properties: { sopId: { type: "string" } }, required: ["sopId"] },
  },
  {
    name: "create_runbook",
    description:
      "Write a runbook: a play written so someone else, or an agent, can run it and get roughly the same result. It starts as a draft. Pass exactly one of canvasId (from scratch, needs title), fromNoteId (a canvas note: its text becomes the title and it stays linked) or fromItemId (a decided goal item: the decision becomes the title and is what the runbook rests on). Only write runbooks for plays that have worked more than once; a box still being searched gets experiments, not runbooks.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        fromNoteId: { type: "string" },
        fromItemId: { type: "string" },
        ...RUNBOOK_FIELD_PROPERTIES,
      },
    },
  },
  {
    name: "update_runbook",
    description:
      "Change a runbook (pass only what changes; null clears a field) or move it between draft, live and retired with status. Going live needs steps, and every linked note must be at least 'repeatable' (don't scale a guess); it then marks those notes 'codified'. Retiring it, or unlinking a note, drops notes with no other live runbook back to 'repeatable'.",
    inputSchema: {
      type: "object",
      properties: {
        runbookId: { type: "string" },
        status: { type: "string", enum: ["draft", "live", "retired"] },
        ...RUNBOOK_FIELD_PROPERTIES,
      },
      required: ["runbookId"],
    },
  },
  {
    name: "delete_runbook",
    description: "Delete a runbook and its run log. Notes it codified drop back to 'repeatable' unless another live runbook codifies them.",
    inputSchema: { type: "object", properties: { runbookId: { type: "string" } }, required: ["runbookId"] },
  },
  {
    name: "log_run",
    description:
      "Record one use of a live runbook: whether it worked (yes, no, partly), the step where it went wrong if it didn't fully work (1-based), and what it produced (numbers, e.g. '12 leads, 3 booked'). Any canvas member can log a run, viewers included.",
    inputSchema: {
      type: "object",
      properties: {
        runbookId: { type: "string" },
        outcome: { type: "string", enum: ["yes", "no", "partly"] },
        failedStep: { type: "integer", description: "1-based step number where it went wrong" },
        numbers: { type: "string" },
        note: { type: "string" },
      },
      required: ["runbookId", "outcome"],
    },
  },
  {
    name: "list_goals",
    description:
      "The heart of a canvas: its goals, each with a headline count of items (open, testing, decided, done) and the items under it. " +
      `Item states: ${ITEM_STATES.map((st) => `${st} = ${ITEM_STATE_MEANINGS[st]}`).join("; ")}. ` +
      "Each item shows its test (if any), linked canvas notes, its current decision record (what was decided, basis, who, when, review date, look-back outcome) and earlier, superseded decisions. " +
      "Also returns lookBacksDue (done items whose review date has come and nobody has said whether it panned out) and basisStats (how often each kind of basis panned out).",
    inputSchema: { type: "object", properties: { canvasId: { type: "string" } }, required: ["canvasId"] },
  },
  {
    name: "create_goal",
    description: "Add a goal to a canvas: a big outcome the team is working toward, e.g. 'Launch Afforrd'.",
    inputSchema: {
      type: "object",
      properties: { canvasId: { type: "string" }, title: { type: "string" } },
      required: ["canvasId", "title"],
    },
  },
  {
    name: "update_goal",
    description: "Rename a goal.",
    inputSchema: {
      type: "object",
      properties: { goalId: { type: "string" }, title: { type: "string" } },
      required: ["goalId", "title"],
    },
  },
  {
    name: "delete_goal",
    description: "Delete a goal that has no items. Move or delete its items first.",
    inputSchema: { type: "object", properties: { goalId: { type: "string" } }, required: ["goalId"] },
  },
  {
    name: "add_item",
    description:
      "Add an item under a goal: something that needs a decision before the goal can be reached. It starts open, or testing if you give it a test (measure, passMark, reviewDate, latestResult).",
    inputSchema: {
      type: "object",
      properties: {
        goalId: { type: "string" },
        title: { type: "string", description: "The question or choice, in plain words, e.g. 'Which channel do we launch on?'" },
        detail: { type: "string" },
        decideBy: { type: ["string", "null"], description: "When the call should be made by, YYYY-MM-DD. null clears it." },
        decideByDay: { type: "integer", description: "Alternative to decideBy: a day of the plan, counted from the canvas's launchDate" },
        driverUserId: { ...DRIVER_PROPERTY, description: "The one person doing the work on it. A userId from list_canvas_members." },
        contextNoteIds: { type: "array", items: { type: "string" }, description: "Canvas notes to keep with it as context or evidence" },
        ...TEST_FIELD_PROPERTIES,
      },
      required: ["goalId", "title"],
    },
  },
  {
    name: "update_item",
    description:
      "Change an item's title, detail, driver, linked notes or test, or move it to another goal (goalId). Pass only what changes (including decideBy, the date the call should be made by); null clears a field. An undecided item follows its test: adding one makes it testing, clearing it makes it open. To decide, use decide_item.",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        goalId: { type: "string", description: "Move the item to this goal (same canvas)" },
        title: { type: "string" },
        detail: { type: ["string", "null"] },
        decideBy: { type: ["string", "null"], description: "When the call should be made by, YYYY-MM-DD. null clears it." },
        decideByDay: { type: "integer", description: "Alternative to decideBy: a day of the plan, counted from the canvas's launchDate" },
        driverUserId: DRIVER_PROPERTY,
        contextNoteIds: { type: "array", items: { type: "string" }, description: "Replaces the linked notes; [] clears them" },
        ...TEST_FIELD_PROPERTIES,
      },
      required: ["itemId"],
    },
  },
  {
    name: "delete_item",
    description: "Delete an item and its decision records. Linked canvas notes stay.",
    inputSchema: { type: "object", properties: { itemId: { type: "string" } }, required: ["itemId"] },
  },
  {
    name: "decide_item",
    description:
      "Make the call on an open or testing item. Writes its decision record and moves it to decided. Testing is optional: an item can go straight from open to decided. Judgment calls are valid.",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        decision: { type: "string", description: "What was decided, in a line or two" },
        basis: {
          type: "string",
          enum: [...DECISION_BASES],
          description: "What the call rests on: test (needs the item's test to have a result), data (existing data), expert (an expert's view), judgment (a judgment call)",
        },
        basisNote: { type: "string", description: "Optional line on the basis, e.g. which data or whose view" },
        linkedNoteIds: { type: "array", items: { type: "string" }, description: "Canvas notes that informed it" },
        decidedByUserId: { type: "string", description: "Who made the call, if not you. A userId from list_canvas_members." },
        decidedByName: { type: "string", description: "Who made the call, for someone without an account" },
        reviewDate: { type: "string", description: "When to ask whether it panned out, YYYY-MM-DD. Defaults to 30 days from today." },
        reviewDay: { type: "integer", description: "Alternative to reviewDate: a day of the plan, counted from the canvas's launchDate" },
      },
      required: ["itemId", "decision", "basis"],
    },
  },
  {
    name: "mark_item_done",
    description: "The decision on a decided item has been acted on. Moves it to done.",
    inputSchema: { type: "object", properties: { itemId: { type: "string" } }, required: ["itemId"] },
  },
  {
    name: "reopen_item",
    description:
      "Take a decided or done item back to open (or testing, if it has a test). Its decision record stays as an earlier decision.",
    inputSchema: { type: "object", properties: { itemId: { type: "string" } }, required: ["itemId"] },
  },
  {
    name: "record_look_back",
    description:
      "Say whether a done item's decision panned out: yes, no or partly, with an optional note. Ask this once its review date has come (list_goals shows lookBacksDue).",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        outcome: { type: "string", enum: [...LOOK_BACK_ANSWERS] },
        note: { type: "string" },
      },
      required: ["itemId", "outcome"],
    },
  },
  {
    name: "convert_note_to_item",
    description:
      "Turn a canvas note into an item under a goal. Its test and driver carry over and the note stays linked as context. If the note's decision request was answered, that answer becomes the item's decision record and the item is decided.",
    inputSchema: {
      type: "object",
      properties: { noteId: { type: "string" }, goalId: { type: "string" } },
      required: ["noteId", "goalId"],
    },
  },
];

const UNAUTHORIZED_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
  "WWW-Authenticate":
    'Bearer error="invalid_token", resource_metadata="https://lean.incrementic.com/.well-known/oauth-protected-resource"',
};

function unauthorized(id: unknown, message: string) {
  return new NextResponse(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code: -32001, message } }),
    { status: 401, headers: UNAUTHORIZED_HEADERS }
  );
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** A string sets a field, null clears it, anything else leaves it alone. */
function nullableStr(value: unknown): string | null | undefined {
  return value === null ? null : optStr(value);
}

/** The driver an agent passed, under its current name or the older ownerUserId (still accepted). */
function driverArg(args: Record<string, unknown>): unknown {
  return args.driverUserId !== undefined ? args.driverUserId : args.ownerUserId;
}

/** An array of strings sets the tags, null clears them, anything else leaves them alone. */
function marketsArg(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
}

/** An array of strings, or undefined for anything else. */
function strArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
}

function runbookFieldArgs(args: Record<string, unknown>) {
  return {
    title: optStr(args.title),
    trigger: nullableStr(args.trigger),
    ownerUserId: nullableStr(args.ownerUserId),
    steps: strArray(args.steps),
    noteIds: strArray(args.noteIds),
    itemIds: strArray(args.itemIds),
    sopId: nullableStr(args.sopId),
    reviewDate: nullableStr(args.reviewDate),
  };
}

function testFieldArgs(args: Record<string, unknown>) {
  const result = args.latestResult as Record<string, unknown> | null | undefined;
  return {
    measure: nullableStr(args.measure),
    passMark: nullableStr(args.passMark),
    reviewDate: nullableStr(args.reviewDate),
    reviewDay: typeof args.reviewDay === "number" ? args.reviewDay : undefined,
    latestResult:
      result === null
        ? null
        : result && typeof result === "object"
          ? {
              text: str(result.text),
              date: optStr(result.date),
              verdict: optStr(result.verdict) as any, // validated by Convex
            }
          : undefined,
  };
}

/** The plain-language summary, built from get_canvas so it says exactly what the canvas says. */
async function exportSummary(accessToken: string, canvasId: string, view: string) {
  if (view && view !== "canvas") throw new Error("The summary covers the whole canvas; use view 'canvas'");
  const canvas = await fetchQuery(api.mcp.getCanvas, { accessToken, canvasId });
  const template = getCanvasTemplate(canvas.template);
  const blocks = template.blocks.map((block) => ({
    title: block.title,
    notes: (canvas.blocks[block.id] ?? []).map(
      (n): SummaryNote => ({
        text: n.text,
        state: n.evidenceState,
        markets: n.markets,
        result: n.latestResult,
        decision: n.decision && {
          status: n.decision.status,
          question: n.decision.question,
          decider: n.decision.decider.name,
          dueDate: n.decision.dueDate,
          defaultOutcome: n.decision.defaultOutcome,
        },
      })
    ),
  }));
  const summary = plainSummary({
    title: canvas.title,
    today: todayLocal(),
    launchDate: canvas.launchDate,
    blocks,
  });
  return { canvasId: canvas.canvasId, title: canvas.title, format: "summary", summary };
}

/** The tests on a canvas by stage, built from get_canvas with the same stage rules as the app. */
async function listTests(accessToken: string, args: Record<string, unknown>) {
  const canvas = await fetchQuery(api.mcp.getCanvas, {
    accessToken,
    canvasId: str(args.canvasId),
    driverUserId: optStr(driverArg(args)),
  });
  const today = todayUtc();
  const only = optStr(args.stage);
  const tests = Object.entries(canvas.blocks).flatMap(([block, notes]) =>
    notes.flatMap((n) => {
      const base = testStage(n, today);
      if (!base) return [];
      const stage = base === "due" && n.reviewDate && n.reviewDate < today ? "overdue" : base;
      if (only && only !== stage && !(only === "due" && stage === "overdue")) return [];
      const verdict = stage === "result" ? n.latestResult?.verdict : undefined;
      const points = verdict && verdict !== "inconclusive" ? VERDICT_EVIDENCE[verdict] : undefined;
      return [
        {
          noteId: n.noteId,
          block,
          text: n.text,
          evidenceState: n.evidenceState,
          driver: n.driver,
          stage,
          measure: n.measure,
          passMark: n.passMark,
          reviewDate: n.reviewDate,
          reviewDay: n.reviewDay,
          daysUntilReview: n.reviewDate ? daysBetween(today, n.reviewDate) : undefined,
          latestResult: n.latestResult,
          suggestedEvidenceState: points && points !== n.evidenceState ? points : undefined,
        },
      ];
    })
  );
  const count = (s: string) => tests.filter((t) => t.stage === s).length;
  return {
    canvasId: canvas.canvasId,
    title: canvas.title,
    today,
    currentDay: canvas.currentDay,
    counts: { running: count("running"), due: count("due"), overdue: count("overdue"), result: count("result") },
    tests,
  };
}

async function callTool(accessToken: string, toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case "list_canvases":
      return await fetchQuery(api.mcp.listCanvases, { accessToken });
    case "get_canvas":
      return await fetchQuery(api.mcp.getCanvas, {
        accessToken,
        canvasId: str(args.canvasId),
        driverUserId: optStr(driverArg(args)),
        market: optStr(args.market),
      });
    case "list_canvas_members":
      return await fetchQuery(api.mcp.listMembers, { accessToken, canvasId: str(args.canvasId) });
    case "list_tests":
      return await listTests(accessToken, args);
    case "create_canvas": {
      const result = await fetchMutation(api.mcp.createCanvas, {
        accessToken,
        title: str(args.title),
        description: str(args.description) || undefined,
        seedNotes: typeof args.seedNotes === "boolean" ? args.seedNotes : undefined,
        template: (str(args.template) || undefined) as any, // validated by Convex
        launchDate: optStr(args.launchDate),
      });
      const label = getCanvasTemplate(str(args.template)).label;
      return {
        success: true,
        ...result,
        message: `Created new ${label}. View and collaborate in realtime at ${result.url}`,
      };
    }
    case "update_canvas":
      return await fetchMutation(api.mcp.updateCanvas, {
        accessToken,
        canvasId: str(args.canvasId),
        title: optStr(args.title),
        description: optStr(args.description),
        launchDate: nullableStr(args.launchDate),
      });
    case "add_note":
      return await fetchMutation(api.mcp.addNote, {
        accessToken,
        canvasId: str(args.canvasId),
        block: args.block as any, // validated by Convex
        content: str(args.content),
        evidenceState: (args.evidenceState as any) || undefined,
        reason: optStr(args.reason),
        driverUserId: nullableStr(driverArg(args)),
        markets: marketsArg(args.markets),
        ...testFieldArgs(args),
      });
    case "update_note":
      return await fetchMutation(api.mcp.updateNote, {
        accessToken,
        noteId: str(args.noteId),
        content: optStr(args.content),
        block: optStr(args.block) as any, // validated by Convex
        evidenceState: optStr(args.evidenceState) as any, // validated by Convex
        stage: optStr(args.stage) as any, // validated by Convex
        reason: optStr(args.reason),
        link: optStr(args.link),
        driverUserId: nullableStr(driverArg(args)),
        markets: marketsArg(args.markets),
        ...testFieldArgs(args),
      });
    case "delete_note":
      return await fetchMutation(api.mcp.deleteNote, {
        accessToken,
        noteId: str(args.noteId),
        reason: optStr(args.reason),
      });
    case "get_note_history":
      return await fetchQuery(api.mcp.getNoteHistory, { accessToken, noteId: str(args.noteId) });
    case "request_decision":
      return await fetchMutation(api.mcp.requestDecision, {
        accessToken,
        noteId: str(args.noteId),
        question: str(args.question),
        deciderUserId: optStr(args.deciderUserId),
        deciderName: optStr(args.deciderName),
        deciderEmail: optStr(args.deciderEmail),
        dueDate: optStr(args.dueDate),
        dueDay: typeof args.dueDay === "number" ? args.dueDay : undefined,
        defaultOutcome: optStr(args.defaultOutcome),
        options: Array.isArray(args.options) ? args.options.map(String) : undefined,
        deferOptions: Array.isArray(args.deferOptions) ? args.deferOptions.map(String) : undefined,
      });
    case "answer_decision":
      return await fetchMutation(api.mcp.answerDecision, {
        accessToken,
        noteId: str(args.noteId),
        answer: args.answer as any, // validated by Convex
        choice: optStr(args.choice),
        comment: optStr(args.comment),
      });
    case "withdraw_decision":
      return await fetchMutation(api.mcp.withdrawDecision, {
        accessToken,
        noteId: str(args.noteId),
        reason: optStr(args.reason),
      });
    case "list_decisions":
      return await fetchQuery(api.mcp.listDecisions, { accessToken, canvasId: optStr(args.canvasId) });
    case "create_snapshot":
      return await fetchMutation(api.mcp.createSnapshot, {
        accessToken,
        canvasId: str(args.canvasId),
        label: str(args.label),
      });
    case "list_snapshots":
      return await fetchQuery(api.mcp.listCanvasSnapshots, { accessToken, canvasId: str(args.canvasId) });
    case "compare_snapshots":
      return await fetchQuery(api.mcp.compareCanvasSnapshots, {
        accessToken,
        canvasId: str(args.canvasId),
        from: str(args.from),
        to: optStr(args.to),
      });
    case "get_review":
      return await fetchQuery(api.mcp.getReview, {
        accessToken,
        canvasId: str(args.canvasId),
        sinceSnapshotId: optStr(args.sinceSnapshotId),
      });
    case "list_check_ins":
      return await fetchQuery(api.mcp.listCheckIns, { accessToken });
    case "answer_check_in":
      return await fetchMutation(api.mcp.answerCheckIn, {
        accessToken,
        noteId: str(args.noteId),
        hasEvidence: args.hasEvidence === true,
        text: optStr(args.text),
        verdict: optStr(args.verdict) as any, // validated by Convex
        date: optStr(args.date),
      });
    case "send_check_in":
      return await fetchMutation(api.mcp.sendCheckIn, { accessToken, canvasId: str(args.canvasId) });
    case "update_evidence_state":
      return await fetchMutation(api.mcp.updateEvidenceState, {
        accessToken,
        noteId: str(args.noteId),
        evidenceState: args.evidenceState as any, // validated by Convex
        reason: optStr(args.reason),
      });
    case "run_stress_test":
      return await fetchAction(api.mcp.runStressTest, { accessToken, canvasId: str(args.canvasId) });
    case "export_canvas":
      if (args.format === "summary") return await exportSummary(accessToken, str(args.canvasId), str(args.view));
      return await fetchQuery(api.mcp.exportCanvas, {
        accessToken,
        canvasId: str(args.canvasId),
        view: (str(args.view) || "canvas") as any, // validated by Convex
        format: (str(args.format) || "pdf") as any, // validated by Convex
      });
    case "list_runbooks":
      return await fetchQuery(api.mcp.listRunbooks, { accessToken, canvasId: str(args.canvasId) });
    case "create_sop":
      return await fetchMutation(api.mcp.createSopForAgent, {
        accessToken,
        canvasId: str(args.canvasId),
        title: str(args.title),
        description: optStr(args.description),
      });
    case "update_sop":
      return await fetchMutation(api.mcp.updateSopForAgent, {
        accessToken,
        sopId: str(args.sopId),
        title: optStr(args.title),
        description: nullableStr(args.description),
      });
    case "delete_sop":
      return await fetchMutation(api.mcp.deleteSopForAgent, { accessToken, sopId: str(args.sopId) });
    case "create_runbook":
      return await fetchMutation(api.mcp.createRunbookForAgent, {
        accessToken,
        canvasId: optStr(args.canvasId),
        fromNoteId: optStr(args.fromNoteId),
        fromItemId: optStr(args.fromItemId),
        ...runbookFieldArgs(args),
      });
    case "update_runbook":
      return await fetchMutation(api.mcp.updateRunbookForAgent, {
        accessToken,
        runbookId: str(args.runbookId),
        status: optStr(args.status) as any, // validated by Convex
        ...runbookFieldArgs(args),
      });
    case "delete_runbook":
      return await fetchMutation(api.mcp.deleteRunbookForAgent, { accessToken, runbookId: str(args.runbookId) });
    case "log_run":
      return await fetchMutation(api.mcp.logRunForAgent, {
        accessToken,
        runbookId: str(args.runbookId),
        outcome: args.outcome as any, // validated by Convex
        failedStep: typeof args.failedStep === "number" ? args.failedStep : undefined,
        numbers: optStr(args.numbers),
        note: optStr(args.note),
      });
    case "list_goals":
      return await fetchQuery(api.mcp.listGoals, { accessToken, canvasId: str(args.canvasId) });
    case "create_goal":
      return await fetchMutation(api.mcp.createGoalForAgent, {
        accessToken,
        canvasId: str(args.canvasId),
        title: str(args.title),
      });
    case "update_goal":
      return await fetchMutation(api.mcp.updateGoalForAgent, {
        accessToken,
        goalId: str(args.goalId),
        title: str(args.title),
      });
    case "delete_goal":
      return await fetchMutation(api.mcp.deleteGoalForAgent, { accessToken, goalId: str(args.goalId) });
    case "add_item":
      return await fetchMutation(api.mcp.addItemForAgent, {
        accessToken,
        goalId: str(args.goalId),
        title: str(args.title),
        detail: nullableStr(args.detail),
        decideBy: nullableStr(args.decideBy),
        decideByDay: typeof args.decideByDay === "number" ? args.decideByDay : undefined,
        driverUserId: nullableStr(args.driverUserId),
        contextNoteIds: strArray(args.contextNoteIds),
        ...testFieldArgs(args),
      });
    case "update_item":
      return await fetchMutation(api.mcp.updateItemForAgent, {
        accessToken,
        itemId: str(args.itemId),
        goalId: optStr(args.goalId),
        title: optStr(args.title),
        detail: nullableStr(args.detail),
        decideBy: nullableStr(args.decideBy),
        decideByDay: typeof args.decideByDay === "number" ? args.decideByDay : undefined,
        driverUserId: nullableStr(args.driverUserId),
        contextNoteIds: strArray(args.contextNoteIds),
        ...testFieldArgs(args),
      });
    case "delete_item":
      return await fetchMutation(api.mcp.deleteItemForAgent, { accessToken, itemId: str(args.itemId) });
    case "decide_item":
      return await fetchMutation(api.mcp.decideItemForAgent, {
        accessToken,
        itemId: str(args.itemId),
        decision: str(args.decision),
        basis: args.basis as any, // validated by Convex
        basisNote: optStr(args.basisNote),
        linkedNoteIds: strArray(args.linkedNoteIds),
        decidedByUserId: optStr(args.decidedByUserId),
        decidedByName: optStr(args.decidedByName),
        reviewDate: optStr(args.reviewDate),
        reviewDay: typeof args.reviewDay === "number" ? args.reviewDay : undefined,
      });
    case "mark_item_done":
      return await fetchMutation(api.mcp.markItemDoneForAgent, { accessToken, itemId: str(args.itemId) });
    case "reopen_item":
      return await fetchMutation(api.mcp.reopenItemForAgent, { accessToken, itemId: str(args.itemId) });
    case "record_look_back":
      return await fetchMutation(api.mcp.recordLookBackForAgent, {
        accessToken,
        itemId: str(args.itemId),
        outcome: args.outcome as any, // validated by Convex
        note: optStr(args.note),
      });
    case "convert_note_to_item":
      return await fetchMutation(api.mcp.convertNoteForAgent, {
        accessToken,
        noteId: str(args.noteId),
        goalId: str(args.goalId),
      });
    default:
      return undefined;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  // When Claude tests if authentication is required, returning 401 with WWW-Authenticate triggers "Sign in now" detection!
  if (!authHeader) {
    return new NextResponse(
      JSON.stringify({
        error: "unauthorized",
        message: "Authentication required to access CriticalDash MCP tools",
      }),
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "WWW-Authenticate":
            'Bearer error="unauthorized", resource_metadata="https://lean.incrementic.com/.well-known/oauth-protected-resource"',
        },
      }
    );
  }

  // Discovery manifest including OAuth 2.1 authentication info
  return NextResponse.json(
    {
      name: "criticaldash",
      version: "0.1.0",
      description: "CriticalDash Model Context Protocol endpoint for Claude Connectors",
      protocol: "mcp/sse",
      endpoints: {
        http: "https://lean.incrementic.com/api/mcp",
        sse: "https://lean.incrementic.com/api/mcp/sse",
      },
      authentication: {
        type: "oauth2",
        issuer: "https://lean.incrementic.com",
        authorization_endpoint: "https://lean.incrementic.com/api/oauth/authorize",
        token_endpoint: "https://lean.incrementic.com/api/oauth/token",
        scopes: ["canvases:read", "canvases:write"],
      },
      tools: TOOLS_MANIFEST,
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const accessToken = bearerToken(req);

  // When Claude probes the connector with POST initialize, it checks for 401 Unauthorized + WWW-Authenticate to detect OAuth!
  if (!authHeader) {
    return new NextResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Unauthorized: OAuth authentication required",
        },
      }),
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "WWW-Authenticate":
            'Bearer error="unauthorized", resource_metadata="https://lean.incrementic.com/.well-known/oauth-protected-resource"',
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    if (!accessToken || !(await fetchQuery(api.mcp.verifyToken, { accessToken }))) {
      return unauthorized(id, "Invalid or expired access token");
    }

    // Handle JSON-RPC / MCP protocol methods
    if (method === "initialize") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "criticaldash",
              version: "0.1.0",
            },
            instructions:
              "CriticalDash revolves around decisions. Each canvas has goals; each goal has items that need a decision before the goal is reached. " +
              "Items move open -> testing (optional, while a test runs) -> decided -> done. Start with list_goals. " +
              "Record calls with decide_item (basis: test, data, expert or judgment), mark them done once acted on, and on the review date ask whether they panned out (record_look_back). " +
              "Canvas notes are context and evidence; convert_note_to_item turns one into an item. " +
              "Each note also has a stage on the way from guess to runbook: guess -> tested -> repeatable (update_note stage) -> codified (a live runbook links it). " +
              "Turn plays that work into runbooks (create_runbook, grouped into SOPs), make them live with update_runbook, and log every run with log_run. list_runbooks shows how much of the business runs without the founder.",
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (method === "notifications/initialized") {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }

    if (method === "tools/list") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            tools: TOOLS_MANIFEST,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};

      let resultText = "";
      let isError = false;

      try {
        const result = await callTool(accessToken, toolName, args);
        if (result === undefined) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32601,
                message: `Tool not found: ${toolName}`,
              },
            },
            { status: 404, headers: CORS_HEADERS }
          );
        }
        resultText = JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof ConvexError && err.data === "INVALID_ACCESS_TOKEN") {
          return unauthorized(id, "Invalid or expired access token");
        }
        isError = true;
        resultText =
          err instanceof ConvexError && typeof err.data === "string"
            ? err.data
            : `Error: ${err instanceof Error ? err.message : "tool call failed"}`;
      }

      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: resultText,
              },
            ],
            isError,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // Default response for unhandled ping or standard methods
    if (method === "ping") {
      return NextResponse.json({ jsonrpc: "2.0", id, result: {} }, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not supported: ${method}` },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error", data: err?.message },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
