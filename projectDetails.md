# AgentWebBuilder: Product Brief

> Working name; change it before launch. Status: **planning**. Last updated: 2026-11-12.

## 1. What we're building

AgentWebBuilder is an AI website builder. A user describes a site in plain language, and Claude writes the project files. The user watches the site render in a live preview, then refines it by chatting ("make the hero darker", "add a pricing page"). When it's done, they download it as a ZIP.

Each project uses a **site kit**, chosen when the project is created: plain **Static HTML/CSS/JS** or **React (Vite)**. More frameworks (Vue, Svelte, and so on) plug in later through the same kit interface.

## 2. Who it's for

| User | Need |
|---|---|
| Small business owner / freelancer | A good-looking landing page or portfolio without writing code |
| Developer | A fast first draft of a site, with full access to the code to keep editing |
| Agency / internal team | Quick client mock-ups, starting from templates |

## 3. Core user flow

1. Sign up or log in (email + password).
2. Create a project: pick a **kit** (Static / React) and, optionally, a **template**.
3. Type a prompt. Claude streams its reply and writes or edits files through tools.
4. The live preview updates as files change, and the code view shows the file tree in an editor.
5. Iterate in chat, or edit the code by hand. Every AI turn and every manual save creates a **version**.
6. Restore any earlier version.
7. Export the project as a ZIP.

## 4. MVP scope (decided)

| Area | In the MVP |
|---|---|
| Chat | Streaming replies, multi-turn, a log of which files changed per turn |
| Generation | Claude edits a virtual project file system through tools; whole-site rewrites are avoided |
| Site kits | Static HTML/CSS/JS, React (Vite). The kit interface is built so frameworks can be added (§6) |
| Preview | Live preview in a sandboxed iframe; responsive toggle (desktop / tablet / mobile) |
| Code view | File tree + Monaco editor; manual edits are saved and versioned |
| Projects | Create / rename / delete / list; stored per user |
| Version history | One snapshot per AI turn or manual save; restore to any version |
| Export | Download the project as a ZIP |
| Accounts | Email + password (hashed); each user sees only their own projects |
| Templates | Starter templates per kit (e.g. SaaS landing, portfolio, restaurant, blog) |

**Not in the MVP (phase 2+):** one-click deploy (Vercel / Netlify), extra framework kits, image upload for building from a screenshot, custom domains, team workspaces, billing, Postgres in production.

## 5. Decisions made

| Topic | Decision |
|---|---|
| Builder app stack | **Next.js (App Router) + TypeScript**, Tailwind, shadcn/ui, Monaco |
| Generated sites | Kit selectable per project: Static, React (Vite); more kits later |
| AI provider | **Provider switch** set by an environment variable: `claude-code` (Claude Agent SDK on the developer's local Claude Code login, for **local testing only**) and `anthropic-api` (Anthropic TypeScript SDK with an API key, for **production**) |
| Model | `claude-opus-5-5` by default, with adaptive thinking; configurable in env |
| Database | **Prisma + SQLite** for development; switching to Postgres later is a one-line config change |
| Auth | **Email + password** (Auth.js Credentials provider, bcrypt hashes, JWT session cookie) |
| Deploy | **ZIP export only** in the MVP; Vercel / Netlify in phase 2 |

## 6. Selectable frameworks (kits)

A **kit** bundles everything specific to one framework:

- its starter files (the scaffold a new project begins with),
- the system-prompt rules Claude follows for that framework,
- how its preview renders,
- how it's exported (plus a generated README with run instructions).

Adding Vue or Svelte means adding a kit module. The chat, tools, storage and UI stay the same. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#5-site-kits).

## 7. Success criteria for the MVP

- From an empty project, a one-sentence prompt produces a working multi-section site in the preview in about 60 seconds or less.
- A follow-up edit ("change the accent colour to green") touches only the relevant files and shows up in the preview without a full regeneration.
- Any version can be restored, and the exported ZIP runs as-is: Static opens in a browser, React runs with `npm install && npm run dev`.
- Switching `AI_PROVIDER` between `claude-code` and `anthropic-api` needs no code change.

## 8. Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system design, provider layer, agent tools, preview, data model, API
- [docs/ROADMAP.md](docs/ROADMAP.md): phased build plan and milestones
- [docs/DECISIONS.md](docs/DECISIONS.md): decision log and open questions
