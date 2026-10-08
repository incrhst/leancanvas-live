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

## Alternative: Local Claude Desktop Config (JSON)
If you prefer adding it to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "leancanvas": {
      "command": "npx",
      "args": ["-y", "tsx", "mcp/server.ts"],
      "env": {
        "CONVEX_URL": "https://lean.incrementic.com"
      }
    }
  }
}
```

### 2. Available MCP Tools for Claude
When configured, Claude has access to:
- `list_canvases()`: Lists your canvases with their `template`, role, and URL.
- `create_canvas({ title, description, template, seedNotes })`: Initializes a new canvas (`template`: `lean` by default, or `gtm`) and returns the direct collaboration URL.
- `get_canvas({ canvasId })`: Fetches full structured canvas, blocks, and current notes with evidence states.
- `add_note({ canvasId, block, content, evidenceState })`: Inserts a note into a block of the canvas's template. A block from the other template is rejected.
- `update_evidence_state({ noteId, evidenceState })`: Updates state (`unknown`, `assumption`, `observed`, `supported`, `contradicted`, `decision`).
- `run_stress_test({ canvasId })`: Triggers the 7-dimension diagnostic (Ash Maurya for Lean, go-to-market criteria for GTM) and extracts top riskiest assumptions.

---

## Access Control Matrix

| Actor | View Canvas | Edit Canvas | Comment | Invite Others | Run Stress Test |
|---|---|---|---|---|---|
| **Anonymous** | Yes (via `/share/[token]`) | **No** | No | No | No |
| **Authenticated Viewer** | Yes | No | Yes | No | No |
| **Authenticated Editor** | Yes | Yes | Yes | Yes (Editor / Viewer) | Yes |
| **Owner** | Yes | Yes | Yes | Yes | Yes |

---

## Routes

- `/`: Landing page with features & call to action
- `/login`: Magic link authentication with automatic return URL redirect
- `/dashboard`: Workspace canvases list & creation modal
- `/canvas/[id]`: Full multiplayer collaborative editor with sticky note evidence cycling
- `/share/[token]`: Public read-only view for anonymous users (editing and stress-test triggers strictly disabled)
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
```

Open [http://localhost:3000](http://localhost:3000) or deploy to [https://lean.incrementic.com](https://lean.incrementic.com).
