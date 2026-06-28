---
name: Supabase signUp metadata trust boundary
description: Why a handle_new_user trigger must never copy role/plan from raw_user_meta_data
---

# Supabase signUp metadata is attacker-controlled

`supabase.auth.signUp({ options: { data: {...} } })` writes that object verbatim
into `auth.users.raw_user_meta_data`. Anyone can call signUp directly with the
public anon key and put **any** values there.

**Rule:** A `handle_new_user()` trigger (or any code that builds a `profiles`
row from `raw_user_meta_data`) must hardcode privilege fields — `role = 'user'`,
`plan = 'free'` — and only copy non-privileged display fields (name, org, job
title, sector). Promotion to admin / paid happens only through trusted
server-side updates gated by `is_admin()`.

**Why:** Copying `role`/`plan` from metadata lets a crafted signUp payload
self-assign `role='admin'` (bypassing every admin-only RLS policy, since
`is_admin()` reads `profiles.role`) and `plan='paid'` (bypassing the free-tier
user cap). Found in code review of the cyber-analyzer auth system.

**Also:** RLS `with check` on tenant tables (e.g. `analyses`) must verify the
row's `organisation_name` matches the caller's own org, not just
`user_id = auth.uid()` — otherwise a client can inject rows tagged with another
tenant's org name.
