# Roadmap

Each milestone ends with something you can run and check. Milestones are built in order.

## Phase 1: MVP

### M0: Scaffold ✅ (2026-11-12)
- Next.js 16 + TypeScript + Tailwind 4, ESLint, `git init` (shadcn/ui moved to M2, where the UI is built)
- Prisma + SQLite schema (see [ARCHITECTURE §7](ARCHITECTURE.md#7-data-model-prisma-sketch)), seed script
- `.env.example`, a README with the setup steps
- **Check:** `npm run dev` shows a placeholder home page; `npx prisma studio` shows the tables

### M1: AI core (provider switch + tools) ✅ (2026-11-12; `claude-code` checked end to end; `anthropic-api` waiting on an API key)
- `AgentProvider` interface and the `AgentEvent` types
- File tools with zod schemas and path/size guards; an in-memory store for tests
- `ClaudeCodeProvider` (Agent SDK, local login) and `AnthropicApiProvider` (TS SDK, streaming manual loop)
- A CLI smoke script: `npm run agent:try -- "make a bakery landing page"` writes files to `./.tmp-site`
- **Check:** the same prompt works with `AI_PROVIDER=claude-code` and with `AI_PROVIDER=anthropic-api`

### M2: Builder UI (Static kit) ✅ (2026-11-12)
- Resizable layout: chat | tabs (Preview / Code)
- `POST /api/projects/:id/chat` as an SSE stream; streaming chat bubbles; "files changed" chips; a stop button
- Static preview route + sandboxed iframe + device-size toggle
- File tree + Monaco editor with save
- Projects saved in SQLite under the demo user (accounts arrive in M3); simple project list + "new project" form on `/`
- **Check:** prompt, watch the site appear, then ask for an edit and see it reflected

### M3: Projects, versions, accounts ✅ (2026-11-12)
- Email/password register + login (own session module, see D19), protected pages and API routes, rate-limited login
- Dashboard: list / create (pick a kit) / rename / delete projects
- One version per AI turn and per manual save; history panel with restore
- ~~Chat history saved and replayed as context~~ (done in M2)
- **Check:** two users can't see each other's projects; restoring v1 brings back the original files

### M4a: Easiest flow + mobile ✅ (2026-11-12)
- Prompt-first home: type what you want, then "Build it" creates and names the project and sends the first message
- Template cards start a project instantly from ready-made files
- Mobile builder: one view at a time with a bottom tab bar (Chat · Preview · Code · History); "View preview" after each change
- Rename a project by clicking its name in the builder header

### M4c: GitHub + deploy ✅ (2026-11-12; built, waiting on a real GitHub/Vercel token for an end-to-end test)
- Connect GitHub with a fine-grained personal access token (encrypted at rest); OAuth "Connect GitHub" button later
- "Publish" button: push the project to a repo, then deploy to **GitHub Pages** or **Vercel** (user picks)
- Claude gets an allowlisted set of GitHub MCP tools in chat (import a repo, open a PR), switched on per project

### M4b: React preview, templates, export ✅ (2026-11-12; React templates pending regeneration)
- `react-vite` kit + live preview, built on the server with esbuild (see D27); build errors show an "Ask Claude to fix" button
- Templates: 3–4 per kit, picked in the "new project" dialog
- ZIP export (with a run README for each kit)
- **Check:** an exported React ZIP runs with `npm install && npm run dev`; a Static ZIP opens in a browser

### M5: Hardening
- Rate limiting, per-turn usage display, friendlier error messages
- Production guard on the `claude-code` provider; separate preview origin config
- A small set of saved prompts to compare output quality between versions

## Phase 2: After the MVP
- One-click deploy: **Vercel** and/or **Netlify**, using user-provided tokens
- More kits: **Vue (Vite)**, **Svelte (Vite)**, Astro
- Build from an image: upload a screenshot or mock-up and Claude recreates the layout
- Postgres + content-addressed file storage
- Team workspaces, sharing a project by link, custom domains, billing
