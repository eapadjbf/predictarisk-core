# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Auth (cyber-analyzer) env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (embedded at build time)
- Admin user deletion (api-server) secret: `SUPABASE_SERVICE_ROLE_KEY` (server-only; never sent to the client). The server reads the Supabase URL from `SUPABASE_URL` or falls back to `VITE_SUPABASE_URL`.
- Supabase schema/RLS: run `artifacts/cyber-analyzer/supabase-setup.sql` in the Supabase SQL Editor; promote an admin with the `update ... set role='admin'` line at the bottom

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

CyberGuard Analyzer — a Portuguese-origin, fully English-language cybersecurity event
analysis tool (artifact slug: `cyber-analyzer`). Users pick a sector, upload an Excel
event log, and get an OpenAI-driven risk analysis on a SOC-terminal dark dashboard:
risk scoring, top events, exploit probabilities, loss potential, security controls,
filtering, an AI voice assistant, PDF reports, a compliance tab, and a forecast.

The **Executive View** tab reframes the same `analysisResult` data (no extra API calls)
for CEO/CFO/Board in plain business language — no technical jargon (CVE/SIEM/IOC/EDR/
DDoS/XSS are scrubbed). It shows a security posture + financial-exposure summary, a
board-level risk statement, a priority action plan, compliance RAG exposure, and trend
indicators.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
