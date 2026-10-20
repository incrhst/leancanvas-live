# Alignment map: LeanOn spec vs the code today

Phase 0 of the alignment spec (18 October 2026). For each concept in the spec: what exists, the gap, the risk. Nothing has been changed yet. Read against commit `7959741`.

The code was read in full on the backend (`convex/`) and the MCP route (`src/app/api/mcp/route.ts`). The four acceptance canvases were read live through the MCP, read-only.

## The short version

1. **The data model is closer than the spec assumes in some places, and further away in one place that matters.** Notes, owners, tests, results, review dates, decision requests, weekly check-ins, a review page, snapshots and a public share link all exist. What does not exist is any way to refer to **a person without an account**. Every owner, decider and check-in is a `users` id. Principle 2 ("no account to respond") touches almost every phase, so it was the main design decision before Phase 1. Decided: a `people` table, with signed per-item links as the login. See [Gap 1](#gap-1-people-without-accounts).
2. **Decisions live inside the note** (`notes.decision`), one per note. A new request overwrites the old one, and withdrawing deletes it. The spec's decisions have options, several basis notes, defaults and routes, so they need their own table. The old field can stay readable.
3. **A result is one value** (`latestResult`), so a new result overwrites the last one. Scenario 7 ("fails twice") and the "results[]" in 4.2 need a results table. Past results survive only as text diffs in `noteHistory`, which can be partly back-filled.
4. **The real canvases break three assumptions in the spec.** Afforrd GTM (team) has no launch date. Only 2 of its 5 grey notes are phrased as questions. RotiStreak's "Pay upfront online" is agreed only by colour: no decision record exists. Details are under [Scenarios](#acceptance-scenarios-against-the-real-data).
5. **There is no automated test setup.** Phase acceptance checks need one. I propose `convex-test` and `vitest`, as the Convex guidelines recommend.

## Where things live

| Area | Files |
| :-- | :-- |
| Schema | `convex/schema.ts` |
| Notes: add, update, delete, history | `convex/notes.ts`, `convex/lib/history.ts` |
| Tests on notes | `convex/lib/testFields.ts`, `src/utils/testFields.ts`, `src/components/NoteTestFields.tsx` |
| Decision requests | `convex/lib/decisions.ts`, `convex/decisions.ts`, `src/components/NoteDecision.tsx`, `src/app/decisions/page.tsx` |
| Weekly check-ins | `convex/lib/checkIns.ts`, `convex/checkIns.ts`, `convex/crons.ts`, `src/app/check-in/page.tsx` |
| Review meeting | `convex/lib/review.ts`, `convex/review.ts`, `src/app/canvas/[id]/review/page.tsx` |
| Snapshots | `convex/lib/snapshots.ts`, `convex/snapshots.ts` |
| Public share link | `convex/canvases.ts` (`getCanvasByPublicToken`, password unlock), `src/app/share/[token]/page.tsx` |
| Email | `convex/lib/notify.ts`, `convex/email.ts` (Resend) |
| Roles | `convex/lib/auth.ts` (`owner`, `editor`, `viewer`), `convex/invites.ts` |
| Templates and blocks | `convex/lib/canvasTemplates.ts` (`lean`, `gtm`) |
| MCP | `src/app/api/mcp/route.ts` (tool list and dispatch) calling `convex/mcp.ts` (one function per tool, bearer token checked) |
| Plain-language summary | `src/utils/plainSummary.ts` |
| Focus / riskiest view | `src/components/RiskiestAssumptionsView.tsx` (fed by the AI stress test, `convex/stressTests.ts`) |

## Concept by concept

Legend: **Exists** = usable as is; **Partial** = there but needs extending; **New** = nothing there today.

### Roles (spec section 3)

| Spec | Today | Gap | Risk |
| :-- | :-- | :-- | :-- |
| Operator | Canvas role `owner` (or creator). Editors can also do almost everything. | Decide whether "operator" means canvas owner only, or owner plus editors. The console (F) and orphan list hang on it. | Low. |
| Owner (no account to respond) | `notes.ownerId: Id<"users">`. Owners must be canvas members, viewers allowed. | No way to own a note without an account. | **High.** See Gap 1. |
| Decider (no account) | `decision.deciderId: Id<"users">`, must be a member. Answering needs sign-in at `/decisions`. | Same. | **High.** |
| Guest | Public share link: read-only, optional password, no identity. | No write path and no identity, so a guest answer cannot be attributed. | Medium. |

### 4.1 Note

| Field | Today | Gap | Risk |
| :-- | :-- | :-- | :-- |
| `confidence` | `evidenceState` (6 values). | New field, back-filled by the section 5 mapping. Keep `evidenceState` written alongside until clients move. | Medium. Two fields can drift. Proposal: in Phase 1, `evidenceState` stays the stored field the UI writes, and `confidence` plus `agreed` are derived and stored on every write. Flip which one is primary once the UI uses `confidence`. |
| Agreed marker | `evidenceState === "decision"`. Also set when a decider **rejects** (`answerDecisionForUser` sets `"decision"` for both approve and reject). | New `agreed: boolean` (or a decided Decision linked). The rejected case shows that "decision" today means "a call was made", not "we do this". | Medium. Back-fill should not mark rejected requests as agreed. On the four canvases no decision requests exist, so nothing is affected today. |
| `ownerId` | Exists. | Needs to accept a no-account person (Gap 1). | High. |
| `markets` | Exists. | None. | None. |
| `routeId`, `parked` | Nothing. | New, optional. Hidden unless the canvas has a route. | Low in storage. Medium for every query that lists notes: each one must skip parked notes for viewers. There are about 10 such queries (canvas, share, review, check-ins, snapshots, export, MCP `get_canvas`, `list_tests`, stress test, summary). |

### 4.2 Test

| Field | Today | Gap | Risk |
| :-- | :-- | :-- | :-- |
| `measure`, `passMark` | On the note (`testFieldsSchema`). | None. Keep the test on the note, not in its own table: one test per note is how every canvas uses it. | Low. |
| `ifFails` | Nothing. RotiStreak keeps it in the note text ("Below 25% two Roti Days in a row means fix the offer, not the list"). | New optional string on the note, next to the test fields. Existing text is **not** auto-extracted. Offer it as a suggestion only. | Low. |
| `checkpointId` | `reviewDate` only. `reviewDay` is derived from `launchDate` in the MCP. | New. When set, `reviewDate` is derived from the checkpoint and kept in step, so old clients still read a date. | Medium. An event checkpoint that moves must re-date every linked test. |
| `results[]` | `latestResult` (one: `{text, date, verdict?}`). Check-in answers overwrite it. | New `results` table (note, date, text, verdict, source: `manual`, `check_in`, `chat`, `guest`, `integration`, author or person). `latestResult` stays as a cached copy of the newest. Back-fill: one row from each `latestResult`, plus older ones parsed from `noteHistory` `latestResult` diffs where possible. | Medium. History stores results as formatted strings. Parsing is best effort and should be labelled "recovered from history". |
| Verdict → state | `VERDICT_EVIDENCE` (pass → supported, fail → contradicted), offered as `suggestedEvidenceState` in `list_tests`. Not applied automatically. | Same idea maps to confidence (pass → known, fail → broken). Keep it a suggestion. | Low. |

### 4.3 Checkpoint

| Today | Gap | Risk |
| :-- | :-- | :-- |
| No checkpoint table. Nearest things: `reviewDate` per note, `launchDate` per canvas, snapshots labelled "Day 30", and the review page, which lists every test on the canvas rather than those due at one moment. | New `checkpoints` table: `canvasId`, `label`, `kind` (`date` or `event`), `date`, `isGate`, `unlocks` (phase label, checkpoint id, or canvas id), `status`, `outcome {verdict, label, by, at}`. Status `due` is computed from the date in queries, and a daily cron writes it for notifications. Suggestions: cluster distinct `reviewDate`s per canvas and propose one checkpoint each. Never insert without the operator confirming. | Medium. The cron in `convex/crons.ts` uses `crons.weekly`, which the Convex guidelines say not to use. New crons should use `crons.cron`. Move the old one when it is next touched. |

On reviewing a checkpoint, take a snapshot automatically, labelled with the checkpoint. The "notes that changed confidence because of this checkpoint" list in surface D then comes from the existing `compareSnapshots`.

### 4.4 Decision

| Spec field | Today (`notes.decision`) | Gap |
| :-- | :-- | :-- |
| Own record | Embedded in the note, one at a time. Overwritten on re-request, deleted on withdraw. | New `decisions` table. |
| `question` | Exists. | None. |
| `options[]` | Fixed: approve, reject, change. | New. Legacy requests become two options (Approve, Reject). "Change" maps to "talk it through first" in surface B, which is the same idea. |
| `deciderId` | `Id<"users">`, member only. | Person reference (Gap 1). |
| `dueAt` | `dueDate` string. | Rename in the new table, keep date strings (the code uses calendar dates everywhere, deliberately). |
| `defaultOptionId`, `defaultText` | Nothing. | New. |
| `status` | `open`, `approved`, `rejected`, `changes_requested`. | Map to `open`, `decided`, `defaulted`, `withdrawn`. `changes_requested` becomes `open` with the decider's comment, back with the operator. |
| `basis[]` | The single note the decision sits on. | New. A small array of note ids is fine here (bounded, a handful). |
| `checkpointId`, `flag` | Nothing. | New. |
| `answer` | `status`, `comment`, `answeredAt`. No channel. | Add `optionId`, `by` (person), `channel` (`app`, `link`, `mcp`, `meeting`), `defaulted: true` when nobody chose. |
| Suggested decisions | Nothing. | New `status: "suggested"` on the same table (or a `suggestions` list on the operator console). Created by migration and confirmed by the operator. Not visible to anyone else. |

Migration: copy each `notes.decision` into the table, with the note as its single basis. Leave `notes.decision` in place and readable. Write both for one release, then stop writing the embedded field. None of the four acceptance canvases has a decision request today, so the copy is only for other canvases.

Risk: medium. `answer_decision` and `request_decision` are used by agents. They keep their current arguments (`noteId`, `answer: approve|reject|change`) and are translated to the new record.

### 4.5 Route

Nothing exists. Storage only in Phase 1: a `routes` table (`canvasId`, `decisionId`, `label`, optional costs text) and `notes.routeId`. Choosing an option sets `parked` on the other routes' notes. Low risk while it stays out of the UI, which the spec asks for anyway.

### 4.6 Owner rule

| Today | Gap |
| :-- | :-- |
| Owners are optional. `get_canvas` can filter `ownerUserId: "unassigned"`. Check-ins only go to owned notes, so unowned notes are silently skipped. | Team vs solo: count `canvasMembers` (plus creator, as `listCanvasMembers` does). Solo canvases treat the operator as owner by **reading**, not by writing `ownerId` on every note, so adding a second member later turns orphans on cleanly. Orphan list: operator only. One prompt before each checkpoint. |

Open point: is a canvas with one account member and one **no-account** owner (once Gap 1 exists) a team canvas? I would say yes.

### 4.7 Rules that connect them

| Rule | Today | Gap |
| :-- | :-- | :-- |
| Fail on a basis note flags a decided decision | Nothing. | Run when a result is recorded (inside the same mutation that writes the result). Must also treat **agreed notes with no decision record** as decided, or scenario 4 never fires (see below). |
| `ifFails` shown at checkpoint | Nothing. | Display only, from the note. |
| Checkpoint due on its date | Nothing. | Daily cron. |

### Section 5: states

| Old `evidenceState` | Count on Afforrd GTM (team) | Count on RotiStreak GTM | New confidence | Notes |
| :-- | --: | --: | :-- | :-- |
| unknown | 5 | 3 | guessed | Plus a suggested decision. See the question-text problem below. |
| assumption | 7 | 24 | guessed, or testing when the note has a test with a review date ahead | "Checkpoint ahead" can't be used at migration time (no checkpoints yet), so use `reviewDate >= today`. |
| observed | 1 | 9 | testing | |
| supported | 0 | 0 | known | |
| contradicted | 0 | 0 | broken | |
| decision | 17 | 10 | from the test result if any, else guessed; plus `agreed` | RotiStreak's "Pay upfront online" becomes broken + agreed. |

Viewer labels (Needs a call / Testing / Agreed) are a pure function of confidence, agreed and open decisions. That fits in `src/utils/` next to `evidenceStates.ts`, shared by the share page and the MCP.

`src/utils/plainSummary.ts` already writes the plan in plain words grouped by state. It is the natural base for the guest view (E) once it groups by the three viewer labels.

### Section 6: surfaces

| Surface | Today | Gap |
| :-- | :-- | :-- |
| A. Sit-down view | `/canvas/[id]/review` lists tests, open decisions and changes since a snapshot. Read-only. | Options side by side, "Decide now" and "Send to their phone" from one screen. New page or a mode of the review page. |
| B. Decider's daily question | `/decisions` lists open decisions, signed-in only. Email per request, no daily limit. | Signed per-person link, no-account answer, one a day, "N of M decided". |
| C. Your week | `/check-in` asks owners about every owned note weekly, signed-in only. No cap. | Cap at three across decisions, due tests and stale notes. Link-based. |
| D. Checkpoint review | Review page is canvas-wide, with no outcome stored. | Per checkpoint; `ifFails`; flagged decisions; outcome stored; decider can complete it from a link. |
| E. Guest view | `/share/[token]`: full board, read-only, optional password, search. | Plain-question block labels, three-state colours, and a question addressed to the guest with an answer written as a result with source `guest`. |
| F. Operator console | Nothing. | New. Orphans, flagged decisions, upcoming checkpoints, suggestions. |

### Section 7: channels and signed links

| Today | Gap |
| :-- | :-- |
| Email through Resend (`AUTH_RESEND_KEY`). Sender defaults to `LeanCanvas <onboarding@resend.dev>` unless `AUTH_EMAIL_FROM` is set. Every link in an email points to a signed-in page. Users without an email are skipped silently. | A `links` table on the same pattern as `oauthCodes` and `invites`: store a SHA-256 hash of a random token, plus person, action (`answer_decision`, `answer_check_in`, `review_checkpoint`, `guest_answer`), target id, `expiresAt`, `usedAt`. Hashed tokens in a table are easier to revoke and scope than JWTs, and match how the code already handles secrets. Send step: one function that takes a person and a message and picks a channel. Email first; a "copy link" button for WhatsApp. |

### Section 8: MCP

All 23 existing tools stay. Changes:

| Tool | Change |
| :-- | :-- |
| `get_canvas` | Add `confidence`, `agreed`, `ifFails`, `checkpointId`, `routeId` (only when set). Hide parked notes unless asked. Keep `evidenceState`. |
| `add_note`, `update_note` | Accept `confidence`, `ifFails`, `checkpointId`, `routeId`. `evidenceState` keeps working. Give a clear error if both disagree. |
| `request_decision` | Accept `options`, `dueDate`/`dueDay` (keep both), `default`, `basis`, `checkpointId`, and a decider as either `deciderUserId` or a person contact. Current calls keep working. |
| `answer_decision` | Accept `optionId` as well as `approve`/`reject`/`change`. |
| `list_decisions` | Add status, default, flag, options. Read from the new table. |
| `list_tests` | Add `ifFails`, checkpoint, and the full result history on request. |
| `get_review` | Accept `checkpointId`. |
| New | `create_checkpoint`, `list_checkpoints`, `review_checkpoint`, `list_orphans`, `suggest_checkpoints` (returns suggestions, creates nothing), `confirm_suggestion`. |
| `update_evidence_state` | Keep, mark deprecated in its description. |

Tools are defined by hand in `route.ts` and implemented in `convex/mcp.ts`. Each new tool touches both files.

### Section 9: templates

| Spec | Today | Gap |
| :-- | :-- | :-- |
| Lean and GTM templates | Both exist, fixed at creation. | Default checkpoint suggestions per template (two-week cycles for Lean). |
| Focus view | "Riskiest assumptions" view, driven by the AI stress test. | Could be driven by confidence and tests instead of only by the stress test. Product call. |
| Lean-to-GTM links | Nothing. Afforrd and RotiStreak each have a separate Lean and GTM canvas. | `notes.restsOn: noteId[]` across canvases, read-only display. |
| Cross-canvas gates | Nothing. Autosites says it in prose. | `checkpoints.unlocks: {canvasId}` and a "waiting on" banner on the gated canvas. |

## Acceptance scenarios against the real data

| # | Scenario | What the data says | Consequence |
| :-- | :-- | :-- | :-- |
| 1 | Afforrd migration | 30 notes, 1 owned (David, "Every post starts with the budget question"), 2 members (David owner, Celene editor), so it is a team canvas with **29 orphans**. 17 purple notes. 5 grey notes. **Only 2 of the 5 grey notes are questions** ("Pass marks for day 30: …?" and "Who follows up …?"). The ad cap, what a sale is worth and the before-launch asks are statements. Also **no `launchDate`** on this canvas. | The rule "grey notes whose text is a question" would miss 3 of the 5. Proposal: every grey note becomes a suggested decision; question wording only changes how the suggestion reads. With no launch date, no day-30/60/90 checkpoints can be suggested. The operator needs to set one, or confirm dates by hand. |
| 2 | Afforrd route decision | Nothing to check yet. | Needs Phases 1 and 2. Run on a copy. |
| 3 | Afforrd decider flow | Celene has an account. A founder decider (Daren is named in the notes) does not. | Needs Gap 1. |
| 4 | RotiStreak flag | "Pay upfront online via DimePay" is `decision` (purple) with a **fail** result (4 of 19 paid online), review date 15 Nov. **There is no decision request on it**: `list_decisions` is empty for the canvas. | The flag rule must treat an agreed note as an implicit decided decision, or migration must create a "decided" record for every purple note (17 + 10 records on two canvases). I recommend the first: flag the agreed note directly, and create a record only when someone acts. |
| 5 | RotiStreak solo | 1 member (David). | Works with the count rule. |
| 6 | RotiStreak checkpoints | Review dates: 14 Oct, 8 Nov, 15 Nov, 8 Dec, 20 Dec, 31 Dec, 31 Mar, 30 Jun. That matches the spec. Launch date 9 Oct, today is day 9. 14 Oct has passed. Its result ("1 order so far") is dated 9 Oct, before the Roti Day. | Clustering by exact date gives the spec's list. The "kitchen gate" is a note on 15 Nov, not a checkpoint. Marking 15 Nov as a gate is the operator's call, suggested from the word "gate" at most. 14 Oct should be suggested as already due. |
| 7 | RotiStreak ifFails | The 25% rule is in the text of "Per-Roti Day conversion" (review 31 Dec, result inconclusive, ~28%). "Two Roti Days in a row" is counted per Roti Day, not per checkpoint, and needs two results. | Needs the results table. `ifFails` is text the operator writes. The "twice in a row" trigger is not something the model can evaluate unless results are per event. For now: show `ifFails` when the **latest two** results are both fail. |
| 8 | Autosites cross-canvas gate | The gate is clause (a) of one purple note on Autosites GTM ("Day-90 decisions to make … (a) open the floor …"), review day 90 = 31 Jan 2027. That note holds **four** decisions (a–d). The gate opens on readiness (self-serve setup plus card billing), **not on a date**. Open Source GTM has launch date 1 Feb 2027, "assumed; moves with the floor gate". | Checkpoint on Autosites GTM: "Day 90 floor gate", `kind: event`, expected 31 Jan, `isGate`, `unlocks: Open Source GTM`. Splitting the four-decision note into four decisions is the operator's job. Should the gated canvas's launch date move when the gate moves? That is a product question. |
| 9 | Guest | The share link exists and is read-only. | Needs signed links plus the results table. |

One more data point: Autosites GTM has a grey note, "Not before day 90: paid ads, … Parked, not rejected." It is not a decision waiting to be made. It is a deliberate deferral, and it uses the word "parked" in a different sense from routes. With the "every grey note" rule it would be suggested as a decision. The operator dismisses it once. That is acceptable, but it shows why suggestions must never be created silently.

## Gap 1: people without accounts

Everything that names a person (`ownerId`, `deciderId`, check-in `userId`, history `userId`) is `Id<"users">`, and access checks run `getCanvasRole`. Options:

- **A. A `people` table per canvas** (`canvasId`, `name`, `email?`, `phone?`, `userId?`). Owners and deciders point to a person. A person with an account links through `userId`. Existing `ownerId` values get one person each, back-filled. The cleanest model, but every owner and decider field changes type. Old fields stay readable alongside.
- **B. Shadow user rows** with `isAnonymous: true` (the users table already has the field), plus a membership row with a new role such as `contact`. Least code change, because ids stay `Id<"users">`. But it mixes contacts with sign-in accounts, and Convex Auth may later try to match them by email when the real person signs up. Merging is then fiddly.
- **C. Contacts only on decisions and links**, with owners still needing accounts. Smallest, but it fails principle 2 for owners and surface C.

**Decided (David, 18 October 2026): option A.** The design below aims for the lowest friction that is still safe.

### People

- A person is a name plus one way to reach them: `people` (`canvasId`, `name`, `email?`, `phone?`, `userId?`, `stoppedAt?`).
- The operator adds people inline at the moment they are needed ("Who decides?": a name and a number). There is no invite, no joining step and no role to pick.
- Owners and deciders point to a person. A person with an account is linked through `userId`. When someone signs up with a verified email that matches a person, link them automatically; their history comes with them.
- A canvas counts as a team canvas when it has two or more people, with or without accounts.

### The link is the login

- Each message carries **one link per person per item**. The link allows only the action it was sent for (answer this decision, add a result to this test, review this checkpoint). It never opens the canvas.
- `links` table: hashed token (as `oauthCodes` already does), `personId`, `action`, target id, `expiresAt`, `usedAt`.
- Expiry: answering closes when the item closes (decided, defaulted, withdrawn). The page stays viewable for 7 days after that. Sending again replaces the old link.
- An answer can be changed for one hour without asking. After that the page says to talk to the operator.
- After the first tap, a cookie scoped to that person and canvas lets the same phone show "2 things waiting for you" without a new link. This is a convenience only; nothing depends on it.

### Forwarded links

- The page says "Answering as Daren. Not you?" Tapping "Not you?" records the answer as from someone else and flags it on the operator console. It does not block them.
- Every answer records its channel (`link`, `app`, `mcp`, `meeting`).
- Decisions the operator marks **high stakes** (money, contracts) ask for a 6-digit code sent to the person's contact before the answer counts. This is off by default.

### Channels

- WhatsApp: a "Copy message" button with ready-written text and the link, sent from the operator's own phone. No API or setup. Native sending waits for the shared messaging decision.
- Email: Resend, from a real sender on our domain (question 6), with the person's name in the subject.
- Every message has a one-tap "Stop these messages" link (sets `stoppedAt`). The daily question cap is per person.

### What the person sees

One screen: the question, the default and its date, two or three large buttons, "Talk it through first", an optional comment, then "Done. 3 of 5 decided." No navigation, no canvas and no product chrome. It must load fast on a weak phone connection.

### Owners and guests

- Owners without accounts answer check-ins, add results to their tests and answer decisions from links. Editing notes still needs an account.
- Guests on the general share link type only their name (and a contact if they want a reply). Guests addressed by name get a personal link and type nothing.
- Guest answers count at once as results with source `guest`. The operator console marks them unconfirmed, with one tap to accept or remove. This answers question 5 without blocking guests.

### Guardrails

- Messages are rate-limited per canvas and per address, so edit access cannot be used to message strangers in bulk.
- Contact details are visible to operators only.

### Not doing

Passwords, magic-link sign-in that creates an account, one-time codes on every answer, app installs, and "accept the invite" steps. Each costs more drop-off than the risk it removes. The one exception is high-stakes decisions.

## Risks across the work

1. **Two state fields drifting** while `evidenceState` and `confidence` coexist. Mitigation: one write path (`updateNoteForUser`) computes both. Never patch either directly.
2. **Every note listing must learn about `parked`.** Mitigation: one helper (`liveNotes(ctx, canvasId, {forViewer})`) used by all of them, added in Phase 1 before routes have any UI.
3. **No test harness.** Mitigation: add `convex-test` and `vitest` in Phase 1 and write each acceptance scenario as a test against seeded copies of the real canvases.
4. **"Run migrations against copies."** There is no canvas-copy function today. Snapshots are frozen copies, not live canvases. Phase 1 needs an internal `duplicateCanvas` (notes, members, test fields, decisions) or a separate dev deployment loaded from an export. The first is simpler and also useful for the Lean-to-GTM hand-over.
5. **Email to people with no account** opens the app to abuse (anyone with edit access can make it email any address). Mitigation: rate-limit sends per canvas and per address, and include a one-click "stop these emails" link.
6. **Scope creep toward project management** (principle 6). The obvious pressure points are routes with costs, and "notes that need an update" in Your week. Keep both minimal.

## Questions for David

From the spec (section 12), with what the code suggests:

1. **Default decision deadline**: the code always requires a due date today (`request_decision` rejects calls without one). Keep requiring it. That avoids needing a canvas default.
2. **Should a defaulted decision auto-apply its route?** Code-neutral. Recording only is safer, and parking notes is reversible either way.
3. **Who sees parked route notes?** Code-neutral.
4. **Daily question limit**: per decider is no harder to build than fixed.
5. **Guest answers need approval?** The `results.source = "guest"` field lets the operator console show them as "unconfirmed" without blocking them.
6. **Email sender**: Resend is wired in; sender identity is `AUTH_EMAIL_FROM` (default `LeanCanvas <onboarding@resend.dev>`). Which domain and name should decision links come from?

New, from this survey:

7. ~~**People without accounts**: option A, B or C above.~~ Decided: option A, with the design under [Gap 1](#gap-1-people-without-accounts).
8. **Operator** means canvas owner only, or owners plus editors?
9. **Grey notes as suggestions**: suggest every grey note (catches all 5 on Afforrd), or only question-shaped ones (catches 2)?
10. **Agreed notes with no decision record** (RotiStreak's 10, Afforrd's 17): flag them directly on a failed test (recommended), or create a decided record for each at migration?
11. **Rejected decision requests** currently turn the note purple. Should migration treat them as "agreed" or not? (No real canvas has one today.)
12. **Cross-canvas gates**: when the gate moves, should the gated canvas's launch date move with it?
13. **Naming**: the code, emails and MCP server call the product "LeanCanvas" (`leancanvas-live`). Is "LeanOn" a rename to carry through, or only the spec's name?

## Proposed Phase 1 shape (for review, not started)

- Schema, all fields optional: `notes.confidence`, `notes.agreed`, `notes.ifFails`, `notes.checkpointId`, `notes.routeId`, `notes.parked`. New tables: `people`, `links`, `decisions`, `results`, `checkpoints`, `routes`.
- One internal migration per step, idempotent, run per canvas through the scheduler (the pattern `checkIns.startWeek` already uses), first against duplicated canvases.
- `updateNoteForUser` and the result-writing paths become the only writers of confidence, agreed and results.
- MCP: extend existing tools in a backwards-compatible way, and add the checkpoint and orphan tools.
- Tests: `convex-test` scenarios 1, 4, 5 and 6 (migration-side) pass on copies of the real canvases.
