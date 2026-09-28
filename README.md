# LeanCanvas Live

Realtime multiplayer collaborative Lean Canvas by **Incrementic** (`lean.incrementic.com`), powered by Next.js 15, Convex, and AI stress-testing.

- **Canonical Domain**: [https://lean.incrementic.com](https://lean.incrementic.com)
- **Brand System**: Incrementic Design System (Sora, Inter, IBM Plex Mono, `#EA5148`)

---

## Tech Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide
- **Backend & Realtime**: Convex (Database, Queries, Mutations, Actions, Auth, Real-time)
- **Email Delivery**: Resend (`RESEND_API_KEY`, `RESEND_FROM`)
- **Deployment**: Vercel (Git-connected to `incrhst/leancanvas-live`)

---

## Setting Up MCP (Model Context Protocol) for Claude

You can connect Claude (Desktop, Claude Code, or Cursor) to LeanCanvas Live via MCP to inspect, edit, or stress-test your canvases directly from your Claude conversation.

### 1. Claude Desktop Configuration
Add the LeanCanvas MCP server entry to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "leancanvas": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/leanon/mcp/server.ts"],
      "env": {
        "CONVEX_URL": "https://<your-deployment>.convex.cloud",
        "LEANCANVAS_API_TOKEN": "<your-auth-token-or-session-secret>"
      }
    }
  }
}
```

### 2. Available MCP Tools for Claude
When configured, Claude has access to:
- `get_canvas({ canvasId })`: Fetches full structured canvas, blocks, and current notes with evidence states.
- `add_note({ canvasId, block, content, evidenceState })`: Inserts a note into any of the 9 blocks.
- `update_evidence({ noteId, evidenceState })`: Updates state (`unknown`, `assumption`, `observed`, `supported`, `contradicted`, `decision`).
- `run_stress_test({ canvasId })`: Triggers the Ash Maurya 7-dimension diagnostic and extracts top riskiest assumptions.
- `export_canvas({ canvasId, format })`: Returns Markdown or JSON for documentation and agent workflows.

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

- `canvases:createCanvas`: Create canvas and default workspace with owner membership
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
