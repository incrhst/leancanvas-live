# LeanCanvas Live

Realtime multiplayer collaborative Lean Canvas powered by Next.js 15, Convex, and AI stress-testing.

## Tech Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide
- **Backend & Realtime**: Convex (Database, Queries, Mutations, Actions, Auth, Real-time)
- **Deployment**: Vercel (Git-connected)

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

Open [http://localhost:3000](http://localhost:3000) to view the app.
