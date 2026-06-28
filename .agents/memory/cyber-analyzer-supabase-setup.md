---
name: cyber-analyzer Supabase setup dependency
description: Why cyber-analyzer auth flows can't be fully agent-verified, and how swapped creds manifest.
---

# cyber-analyzer Supabase auth: verification limits

The cyber-analyzer auth (login/register/admin) depends on a **user-owned Supabase
project**. Two things block fully autonomous end-to-end verification:

- **`supabase-setup.sql` must be applied by the user** in the Supabase SQL Editor.
  The agent cannot apply it: it only has the anon key + PostgREST, which cannot run
  DDL. If it isn't applied you'll see, via the REST API: `analyses` table 404
  (PGRST205), `org_has_free_capacity` RPC 404 (PGRST202), and `profiles` returning
  `42P17 infinite recursion detected in policy` (an older recursive RLS policy).
- **Email confirmation is required** (`/auth/v1/settings` → `mailer_autoconfirm:false`),
  so register→confirm→login needs real inbox access — a manual user step.

**Why:** the live DB state lives in the user's Supabase, not the repl; the agent has
no SQL/admin access to it, only the browser-safe anon key.

**How to apply:** verify schema state read-only by hitting
`<url>/rest/v1/profiles?select=*&limit=0`, `.../analyses...`, and
`POST /rest/v1/rpc/org_has_free_capacity`. To verify connectivity without creating
data, hit `<url>/auth/v1/settings` (expect 200). Don't drive real `signUp` against
the user's project — it creates real auth users and sends real emails.

## Swapped-credentials gotcha
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are easy to paste into each other.
When swapped, the client built an invalid URL → app shows **"Failed to fetch"** /
`ENOTFOUND`. The new Supabase key formats make detection easy: URL contains
`.supabase.co`/`https://`; the publishable (anon) key starts `sb_publishable_`,
service-role starts `sb_secret_`, legacy keys start `eyJ`. `src/lib/supabase.ts`
now auto-corrects a swap by detecting which value is the URL by shape, so the app
connects regardless of which env var holds which value.
