# Decision Log

| # | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-11-12 | Next.js + TypeScript for the builder app | One codebase for the UI and the API; official TypeScript SDKs for both the Claude Agent SDK and the Anthropic API |
| D2 | 2026-11-12 | Generated-site framework chosen per project through **site kits** (Static, React to start) | Users can choose a framework; new frameworks are added as kit modules |
| D3 | 2026-11-12 | Provider switch: `claude-code` (local login, testing) and `anthropic-api` (production) | No API key needed during development; production runs under proper API terms |
| D4 | 2026-11-12 | Claude edits a virtual file system through custom tools; no real disk or shell access | Safety; identical behaviour across both providers; minimal edits per turn |
| D5 | 2026-11-12 | Prisma + SQLite for development, Postgres-ready | No setup needed for development; switching later is a one-line change |
| D6 | 2026-11-12 | Email + password auth (Auth.js Credentials + bcrypt) | User preference; no third-party sign-in providers |
| D7 | 2026-11-12 | ZIP export only in the MVP; deploy in phase 2 | Keeps the MVP free of external deploy tokens |
| D8 | 2026-11-12 | Default model `claude-opus-5-5`, adaptive thinking, effort set by env | Most capable default; cost is tuned with effort rather than a smaller model |
| D9 | 2026-11-12 | Server-side refusal fallback (`fallbacks: "default"`) on in `anthropic-api` | If Claude declines a request, the API retries on another model instead of failing; can be turned off |

| D10 | 2026-11-12 | Builder UI: dark + light, follows the system theme, with a toggle | User choice |
| D11 | 2026-11-12 | Static kit uses Tailwind via CDN | No build step for exported static sites; fast, consistent generation |
| D12 | 2026-11-12 | Git: `main` branch, one local commit per milestone, nothing pushed | User choice |
| D13 | 2026-11-12 | First build pass covers M0 + M1, then a check-in | Confirm the local Claude Code login works before building UI |

## Open questions

1. **Product name / branding.** Keep "AgentWebBuilder"?
2. **Templates.** Which 3–4 starter templates matter most? (Needed by M4.)
