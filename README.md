# CriticalDash

Realtime multiplayer collaborative canvases by **Incrementic** (`lean.incrementic.com`), powered by Next.js 15, Convex, and AI stress-testing. Choose a **Lean Canvas** or a **GTM Canvas** for each new canvas.

- **Canonical Domain**: [https://lean.incrementic.com](https://lean.incrementic.com)
- **Brand System**: Incrementic Design System (Sora, Inter, IBM Plex Mono, `#EA5148`)

---

## Goals, items and decisions

Everything revolves around the decision record. Each canvas has **goals** (big outcomes, e.g. "Launch Afforrd"). Each goal has **items**: things that need a decision before the goal is reached. An item is **Open** (nobody knows yet), **Testing** (a test is running), **Decided** (a call has been made) or **Done** (the call was acted on). Testing is optional.

- Every **decision record** keeps what was decided, its basis (test result, existing data, expert view or judgment call), linked notes, who decided and when, and a review date.
- On the review date of a done item, CriticalDash asks: **did it pan out?** (Yes, No, Partly). The goals view counts how often each kind of basis panned out.
- The **Goals** tab is the first view of every canvas, for members and on the public link. Open items look hazy and turn sharp once decided.
- Canvas notes are context and evidence. An editor can turn a note into an item ("Add from a canvas note"): its test and driver carry over, and an answered decision request becomes the item's decision record.

## From guess to runbook

Every canvas note has a **stage**: guess → tested → repeatable → codified. A canvas box is only as runnable as its least runnable note, so the canvas shows which parts of the business run without you and which are still experiments.

- **Runbooks** are plays written so someone else, or an agent, can run them: trigger, owner, ordered steps, linked canvas notes and the goal decisions they rest on. They start as drafts; **SOPs** group them.
- A runbook can go live only when its steps are written and every linked note is at least repeatable ("don't scale a guess"). Going live marks those notes **codified**; retiring it drops them back to repeatable. Codified is never set by hand.
- Every **run** logs whether it worked (yes, no, partly), the step where it broke and what it produced. A runbook that fails at the same step twice in its last five runs is flagged: usually a canvas problem showing up in operations.
- Start a runbook from a repeatable note ("Write the runbook") or a decided goal item. The **Runbooks** tab holds SOPs, runbooks, the run log and the "how much runs without you" map. Any member, viewers included, can log a run.

---

## Canvas Templates

Each canvas has one template, chosen when it is created and fixed after that. Existing canvases with no template are Lean Canvases.

| Template | Blocks | Stress test |
|---|---|---|
| **Lean** (`lean`) | Problem, Customer Segments, Unique Value Proposition, Solution, Channels, Revenue Streams, Cost Structure, Key Metrics, Unfair Advantage | Ash Maurya methodology |
| **GTM** (`gtm`) | Ideal Customer, Pains & Alternatives, Positioning, Value Proposition & Messaging, Channels, Sales Motion, Pricing & Packaging, 90-Day Launch Plan, Success Metrics | Go-to-market criteria |

Both templates use the same 7 stress-test scores, so the stored results and the riskiest-assumptions view work the same way. Only the labels and the prompt change. The GTM blocks are based on common go-to-market frameworks (ideal customer profile, positioning, channels, sales motion, pricing, and launch plan), since there is no single standard GTM canvas.

---

## Tech Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide
- **Backend & Realtime**: Convex (Database, Queries, Mutations, Actions, Auth, Real-time)
- **Email Delivery**: Resend (`RESEND_API_KEY`, `RESEND_FROM`)
- **Deployment**: Vercel (Git-connected to `incrhst/leancanvas-live`)

---

## Connecting to Claude (No-Code Connector URL)

For non-technical users, connecting CriticalDash to Claude takes just one click:

1. In Claude, go to **Settings › Connectors** (or **Add MCP Server**).
2. Click **Add Connector**.
3. Enter the hosted MCP URL:
   ```text
   https://lean.incrementic.com/api/mcp
   ```
4. Click **Save / Connect**. That’s it! Claude will automatically discover the tools.

---

### Available MCP Tools for Claude
When configured, Claude has access to:
- `list_canvases()`: Lists your canvases with their `template`, role, and URL.
- `list_goals({ canvasId })`: Goals with headline counts (open, testing, decided, done), their items, decision records, look-backs that are due, and how each kind of basis panned out.
- `create_goal`, `update_goal`, `delete_goal`: Manage goals (a goal with items can't be deleted).
- `add_item({ goalId, title, detail, driverUserId, contextNoteIds, measure, passMark, reviewDate, latestResult })`, `update_item`, `delete_item`: Manage items. Adding a test makes an open item testing.
- `decide_item({ itemId, decision, basis, basisNote, linkedNoteIds, decidedByUserId | decidedByName, reviewDate | reviewDay })`: Writes the decision record; the item becomes decided.
- `mark_item_done`, `reopen_item`: Move a decided item to done, or take it back to open (the old record is kept as an earlier call).
- `record_look_back({ itemId, outcome: yes | no | partly, note })`: Did a done item's decision pan out?
- `convert_note_to_item({ noteId, goalId })`: Turns a canvas note into an item.
- `update_note({ noteId, stage })`: Sets a note's stage to guess, tested or repeatable (codified comes from a live runbook). `get_canvas` returns each note's stage and `blockStages`.
- `list_runbooks({ canvasId })`: Block stages, SOPs, runbooks with run stats, and runbooks that need attention.
- `create_sop`, `update_sop`, `delete_sop`: Manage SOPs.
- `create_runbook({ canvasId | fromNoteId | fromItemId, title, trigger, ownerUserId, steps, noteIds, itemIds, sopId, reviewDate })`, `update_runbook({ runbookId, status, ... })`, `delete_runbook`: Manage runbooks and move them between draft, live and retired.
- `log_run({ runbookId, outcome, failedStep, numbers, note })`: Records one use of a live runbook.
- `create_canvas({ title, description, template, seedNotes, launchDate })`: Initializes a new canvas (`template`: `lean` by default, or `gtm`) and returns the direct collaboration URL.
- `update_canvas({ canvasId, title, description, launchDate })`: Changes a canvas's title, description or launch date. The launch date (`YYYY-MM-DD`) is day 0 of the plan; `null` clears it.
- `get_canvas({ canvasId, driverUserId, market })`: Fetches full structured canvas, blocks, and current notes with evidence states, drivers and tests (`measure`, `passMark`, `reviewDate`, `latestResult`). With a launch date it also returns `currentDay` and each note's `reviewDay`. `driverUserId` (or `"unassigned"`) narrows it to the notes one person is driving; `market` to the notes that hold in one market (tagged with it, or untagged, which means every market).
- `list_canvas_members({ canvasId })`: Lists everyone with access (userId, name, email, role). Use a userId as a note's `driverUserId` (the driver is the person doing the work on the note; viewers can be drivers) or a decision's `deciderUserId`.
- `add_note({ canvasId, block, content, evidenceState, driverUserId, markets, measure, passMark, reviewDate, reviewDay, latestResult, reason })`: Inserts a note into a block of the canvas's template. A block from the other template is rejected.
- `update_note({ noteId, content, block, evidenceState, driverUserId, markets, measure, passMark, reviewDate, reviewDay, latestResult, reason, link })`: Rewords a note, moves it to another block of the same template, changes its state, or sets its test. Pass only what changes; `null` clears a test field. Dates are `YYYY-MM-DD`, or give `reviewDay` (e.g. `30`) on a canvas with a launch date; `latestResult` is `{ text, date?, verdict? }` with verdict `pass`, `fail` or `inconclusive`.
- `delete_note({ noteId, reason })`: Removes a note. Its history stays readable.
- `get_note_history({ noteId })`: Lists every change to a note, newest first: who, when, app or agent, from and to, and the reason. Works for deleted notes.
- `request_decision({ noteId, question, deciderUserId, dueDate | dueDay, defaultOutcome, options })`: Asks one canvas member to decide on a note. They're emailed a link (`/d/[token]`) that answers it from a phone with no account or sign-in, even with view-only access. `defaultOutcome` is what happens if nobody decides by the due date ("If nothing is decided by 1 November, we sign the agency."); it is shown everywhere the decision is, and never applied for them. `options` gives 2 to 4 named choices instead of approve / reject.
- `answer_decision({ noteId, answer, choice, comment })`: The named decider answers `approve`, `reject`, `choose` with one of the request's options as `choice` (all three make the note a `decision`), or `change` (needs a comment; sends it back with the note unchanged).
- `withdraw_decision({ noteId, reason })`: Cancels an open request.
- `list_decisions({ canvasId })`: Decision requests on a canvas, or, without `canvasId`, the open ones waiting on you.
- `create_snapshot({ canvasId, label })`: Freezes the canvas under a label, e.g. `Day 30`.
- `list_snapshots({ canvasId })`: The canvas's snapshots, newest first.
- `compare_snapshots({ canvasId, from, to })`: Notes added, removed or changed between two snapshots; `to` defaults to `current` (the canvas now).
- `get_review({ canvasId, sinceSnapshotId })`: The review-meeting view, also at `/canvas/[id]/review`: tests grouped by how the latest result compares with the pass mark (missed, no result yet, too early, met), overdue reviews, open decisions, and what changed since the latest (or given) snapshot.
- `list_check_ins()`: The weekly check-in questions waiting on you.
- `answer_check_in({ noteId, hasEvidence, text, verdict, date })`: No records "no new evidence"; yes needs a line, which becomes the note's latest result. Works for view-only drivers.
- `send_check_in({ canvasId })`: Sends this week's check-in now. Otherwise a cron sends it every Monday at 13:00 UTC (8am Jamaica) to the driver of every note that is unproven (unknown, assumption, observed) or has a test, and isn't a decision.
- `update_evidence_state({ noteId, evidenceState, reason })`: Updates state (`unknown`, `assumption`, `observed`, `supported`, `contradicted`, `decision`).
- `run_stress_test({ canvasId })`: Triggers the 7-dimension diagnostic (Ash Maurya for Lean, go-to-market criteria for GTM) and extracts top riskiest assumptions.
- `export_canvas({ canvasId, view, format })`: Returns a link that downloads the canvas (`view: "canvas"`) or its riskiest assumptions (`view: "riskiest_assumptions"`, needs a stress test first) as a PDF or PNG (`format`). The file is rendered in the browser, so open the link while signed in. `format: "summary"` instead returns plain-language text right away: one short paragraph per block for a non-technical reader.

---

## Paywall: live plans

Drawing a canvas is free. Running it as a **live plan** is paid, per plan, not per person (`convex/lib/billing.ts`, `convex/lib/plans.ts`).

- **Free, always:** the canvas, notes, evidence states, stress tests, share links, exports, inviting anyone, and answering a decision or a check-in.
- **A live plan runs:** tests (measure, pass mark, review date, results), weekly check-ins, decision requests, snapshots, result links and the review page.
- **Going live:** a canvas becomes a live plan the first time someone sets a launch date, sets a test, asks for a decision or takes a snapshot. That uses one of the creator's founding free plans if they have one, else their free trial (30 days, one per account), else it's refused with a `PLAN_REQUIRED` error that links to `/canvas/[id]/plan`.
- **When a trial or paid period ends,** a scheduled check pauses the plan. The canvas stays editable and its history readable; tests stop, check-ins stop, the review locks, and open decisions can still be answered.
- **Payments** go through DIME PAY's hosted checkout (`convex/payments.ts`, `convex/lib/dimepay.ts`): $29 a month per plan, less the account's discount; each payment adds 30 days. The creator is sent to DIME PAY and back to the plan page; the plan is marked paid only after LeanOn fetches the order from DIME PAY and checks its id, amount, currency and status. The webhook (`<CONVEX_SITE_URL>/dimepay/webhook`, set in the DIME PAY dashboard) only says which order to check.
  - Convex env: `DIMEPAY_CLIENT_KEY`, `DIMEPAY_SECRET_KEY`, `DIMEPAY_ENV` (`sandbox` by default, or `production`), and optionally `DIMEPAY_PAID_STATUSES` (order statuses that mean paid; default `COMPLETE,COMPLETED,PAID,SUCCESS,SUCCEEDED`). Without the keys, the Pay button says card payments open soon.
  - The order fields follow DIME PAY's docs and the community Laravel SDK. Confirm them on the first sandbox payment: if a paid order isn't recognised, the Convex logs show its status.
- **Before the paywall ships,** run `npx convex run billing:grandfatherLivePlans` (repeat with the returned `cursor` until `isDone`) so canvases already used as plans keep running free.

### Admin MCP tools

Set `ADMIN_EMAILS` (comma-separated) in the Convex environment. Admins who connect the normal connector (`/api/mcp`) also see these tools; everyone else is refused and never sees them listed.

- `admin_find_account({ email })`: allowances and the plan on each canvas they created.
- `admin_update_account({ email, founding, trialDays, trialsAllowed, trialsUsed, freeLivePlans, discountPercent, note })`: change what an account is allowed; `null` restores the default. Applies to plans that go live from then on.
- `admin_list_founding_members()` and `admin_list_plans({ status })`.
- `admin_set_canvas_plan({ canvasId, action, days, until, note })`: `extend_trial`, `activate` (free until a date, for some days, or with no end), `pause` or `reset`.

---

## Access Control Matrix

| Actor | View Canvas | Edit Canvas | Comment | Invite Others | Run Stress Test | Answer Decisions / Check-ins |
|---|---|---|---|---|---|---|
| **Anonymous** | Yes (via `/share/[token]`) | **No** | No | No | No | Only with the decider's emailed link (`/d/[token]`), for that one decision. Can send a test result with a note's result link or a driver's check-in link (`/r/[token]`); it waits for an editor to accept it |
| **Authenticated Viewer** | Yes | No | Yes | No | No | Yes, when they're the named decider (decisions) or the note's driver (check-ins) |
| **Authenticated Editor** | Yes | Yes | Yes | Yes (Editor / Viewer) | Yes | Yes, when they're the named decider (decisions) or the note's driver (check-ins) |
| **Owner** | Yes | Yes | Yes | Yes | Yes | Yes, when they're the named decider (decisions) or the note's driver (check-ins) |

---

## Routes

- `/`: Landing page with features & call to action
- `/login`: Magic link authentication with automatic return URL redirect
- `/dashboard`: Workspace canvases list & creation modal
- `/canvas/[id]`: Full multiplayer collaborative editor with sticky note evidence cycling
- `/share/[token]`: Public read-only view for anonymous users (editing and stress-test triggers strictly disabled)
- `/decisions`: The signed-in user's open decisions, across canvases
- `/d/[token]`: Public answer page for one decision, from the request email. No sign-in. The token is stored hashed, works for that one request only, and stops working once the request is answered or withdrawn, when an editor sends a new link or turns it off, or when the decider leaves the canvas
- `/r/[token]`: Public result page for one note's test: what we watch, the pass mark, a box for the result (a number or a line), an optional "did it pass?" and name. No account or sign-in. Two kinds of link open it: a shareable link an editor gets from the note (copy, or share to WhatsApp or email), which takes results as often as the test needs until an editor makes a new one or turns it off; and one link per question in the weekly check-in email, which answers that question once (a result, or "nothing new") and stops. A result sent this way never changes the note by itself: it waits on the note, marked "via link, no account", and the operator is emailed. An editor accepts it (it becomes the latest result; the evidence state is still theirs to change) or rejects it. Each link takes at most 10 results an hour, and a note stops taking more once 20 are waiting
- `/invite/[token]`: Magic invite acceptance flow (requires authentication before joining)

---

## Convex Functions

- `canvases:createCanvas`: Create canvas (optional `template`, default `lean`) and default workspace with owner membership
- `canvases:getCanvas`: Secure query for authenticated members
- `canvases:getCanvasByPublicToken`: Sanitized read-only query for public sharing
- `goals:view`, `goals:viewByPublicToken`: The goals view for members, and read-only on the public link
- `goals:addGoal`, `renameGoalTitle`, `removeGoal`, `addItem`, `editItem`, `removeItem`, `decide`, `markDone`, `reopen`, `lookBack`, `convertNote`: Editor+ only
- `runbooks:view`, `runbooks:viewByPublicToken`: The runbooks view for members, and read-only on the public link
- `runbooks:addSop`, `editSop`, `removeSop`, `addRunbook`, `editRunbook`, `setStatus`, `removeRunbook`, `fromNote`, `fromItem`: Editor+ only; `runbooks:logRunbookRun`: any member
- `canvases:setPublicView`: Enable/disable public read-only link and regenerate token (Owner only)
- `notes:addNote`, `updateNote`, `deleteNote`, `reorderNotes`: Editor+ only mutations
- `stressTests:runStressTest`: Convex action running 7-dimension scoring & riskiest assumption analysis
- `invites:createInvite`, `acceptInvite`: Magic link generation and authenticated acceptance
- `resultLinks:replaceLink`, `forNote`, `accept`, `reject`: A note's result link and the results waiting on it (Editor+ only)
- `resultLinks:getByLink`, `submitByLink`: The public result page; no sign-in

---

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Run Convex backend
npx convex dev

# 3. Run Next.js frontend
pnpm dev

# Tests (convex-test + vitest)
pnpm test
```

Open [http://localhost:3000](http://localhost:3000) or deploy to [https://lean.incrementic.com](https://lean.incrementic.com).
