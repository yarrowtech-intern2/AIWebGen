# AgentWebBuilder

An AI website builder: describe a site, and Claude builds it by editing a virtual project, then refines it as you chat. See [projectDetails.md](projectDetails.md) for the product brief and [docs/](docs/) for the architecture, roadmap and decision log.

**Status:** M0–M4 are done: AI core, builder (chat, live preview for static and React, code editor, history), accounts, templates, ZIP export, and GitHub/Vercel publishing. Next is M5 (hardening).

## Requirements

- Node.js 20+ (developed on 24)
- PostgreSQL 14+ running locally
- For local testing: the [Claude Code](https://code.claude.com) CLI, logged in (`claude`, then log in once)
- For production: an Anthropic API key

## Setup

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # set DATABASE_URL to your local Postgres
createdb agentwebbuilder    # or create it in pgAdmin
npm run db:migrate          # creates the tables
npm run db:seed             # demo user: demo@example.com / demo12345 (development only)
npm run dev                 # http://localhost:3000
```

## Use the builder

1. `npm run dev`, then open http://localhost:3000 and create an account (or log in as the demo user)
2. Create a project (Static kit), then describe your site in the chat
3. Watch the Preview tab update as Claude writes files. Switch to Code to view or edit them (Ctrl+S saves)
4. Keep chatting to change the site. Stop cancels a running turn
5. The History tab lists every version; Restore brings back an earlier one (as a new version)
6. **Publish** puts the site online on GitHub Pages or Vercel. Connect the account once with a token; the dialog walks you through creating one
7. **GitHub on** (above the chat box) lets Claude use your GitHub: "import my repo X", "push this to a branch and open a PR"

## Try the AI agent from the terminal

```bash
npm run agent:try -- "a landing page for a bakery in Kolkata"
npm run agent:try -- "make the hero darker"                 # follow-up edit on the same project
npm run agent:try -- --kit react-vite --fresh "a portfolio for a photographer"
```

The output goes to `.tmp-site/`. For a static site, open `index.html`. For a React site, run `npm install && npm run dev` inside the folder.

## AI provider switch

| `AI_PROVIDER` | Auth | Use for |
|---|---|---|
| `claude-code` | Your local Claude Code login (Claude Agent SDK); no key needed | Local testing only. It refuses to start when `NODE_ENV=production` |
| `anthropic-api` | `ANTHROPIC_API_KEY` (Anthropic TypeScript SDK) | Production |

Other settings: `AI_MODEL` (default `claude-opus-5-5`), `AI_EFFORT` (`low`…`max`, default `medium`), `AI_MAX_STEPS`, and `AI_FALLBACKS` (`anthropic-api` only; when Claude declines a request, the API retries it on a fallback model. On by default.)

Both providers drive the same file tools (`list_files`, `read_file`, `write_file`, `edit_file`, `delete_file`) against a virtual project. Claude has no shell and no access to the real disk.

## Deploy to Render (free)

[render.yaml](render.yaml) is a Render Blueprint for a free Node web service. The database is a free [Neon](https://neon.tech) Postgres.

1. Create a Neon project (region: the same as the Render service) and copy its **direct** connection string (not the "pooled" one)
2. Push the repo to GitHub
3. In Render: **New -> Blueprint**, then pick the repo
4. Paste the Neon string as `DATABASE_URL` and your key as `ANTHROPIC_API_KEY`. `AUTH_SECRET` is generated
5. Apply. Every deploy builds, then runs `prisma migrate deploy` and `next start`

The free service sleeps after 15 minutes without traffic; the next visit takes about a minute to wake it.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | Type-check / ESLint |
| `npm run agent:try -- "<prompt>"` | Run one agent turn from the terminal |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |

## Code map

```
src/kits/            site kits (static, react-vite): starter files + framework rules
src/server/ai/       provider layer, tools, prompts, runner
  providers/         claude-code.ts (Agent SDK) · anthropic-api.ts (Messages API)
src/app/               pages (/, /project/[id]), API routes, /preview file server
src/components/builder chat, preview and code panels
src/server/projects/   file stores (memory, DB) and project service
src/server/auth/      sessions, passwords, rate limiting
src/proxy.ts          login redirects
src/server/db.ts     Prisma client (PostgreSQL via adapter-pg)
prisma/              schema, migrations, seed
scripts/agent-try.ts terminal smoke test
```
