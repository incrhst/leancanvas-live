# LeanCanvas Live

Realtime multiplayer collaborative canvases by **Incrementic** (`lean.incrementic.com`), powered by Next.js 15, Convex, and AI stress-testing. Choose a **Lean Canvas** or a **GTM Canvas** for each new canvas.

- **Canonical Domain**: [https://lean.incrementic.com](https://lean.incrementic.com)
- **Brand System**: Incrementic Design System (Sora, Inter, IBM Plex Mono, `#EA5148`)

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

For non-technical users, connecting LeanCanvas to Claude takes just one click:

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

## Access Control Matrix

| Actor | View Canvas | Edit Canvas | Comment | Invite Others | Run Stress Test | Answer Decisions / Check-ins |
|---|---|---|---|---|---|---|
| **Anonymous** | Yes (via `/share/[token]`) | **No** | No | No | No | Only with the decider's emailed link (`/d/[token]`), for that one decision |
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
- `/invite/[token]`: Magic invite acceptance flow (requires authentication before joining)

---

## Convex Functions

- `canvases:createCanvas`: Create canvas (optional `template`, default `lean`) and default workspace with owner membership
- `canvases:getCanvas`: Secure query for authenticated members
- `canvases:getCanvasByPublicToken`: Sanitized read-only query for public sharing
- `canvases:setPublicView`: Enable/disable public read-only link and regenerate token (Owner only)
- `notes:addNote`, `updateNote`, `deleteNote`, `reorderNotes`: Editor+ only mutations
- `stressTests:runStressTest`: Convex action running 7-dimension scoring & riskiest assumption analysis
- `invites:createInvite`, `acceptInvite`: Magic link generation and authenticated acceptance

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
