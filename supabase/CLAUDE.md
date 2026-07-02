# supabase/ — backend conventions

Applies to migrations, edge functions, and database functions in this folder. See the root
`CLAUDE.md` for the multi-tenancy guardrails (no `db push`; migrations via Dashboard SQL editor;
edge functions via CLI; never write to Churchill/Sears Melvin without approval).

## Migrations

- File format: `YYYYMMDDHHmmss_short_description.sql`
- Applied by hand via the **Supabase Dashboard SQL editor** — never `supabase db push`. The
  migration file is the record of truth; I run it in the dashboard.
- Always enable RLS on new tables.
- Separate policy per operation (select/insert/update/delete) and role (anon/authenticated).
- Lowercase SQL keywords.
- New business tables must carry `organization_id` and be covered by tenant-isolation RLS.

## Views — MUST set `security_invoker = on`

On Postgres 15+ a view **without** `security_invoker` runs with the **view owner's** privileges
and **bypasses the caller's RLS** — leaking cross-tenant data. This is a confirmed pen-test
finding (`specs/rls-isolation-findings.md`; 4 org-scoped views leaked Sears Melvin financials).

Every view over an org-scoped table must be created with:
```sql
create view public.<name> with (security_invoker = on) as ...;
-- or for an existing view:
alter view public.<name> set (security_invoker = on);
```
Service-role edge functions bypass RLS regardless, so this only tightens authenticated
frontend reads — it does not break backend jobs.

## Destructive statements in the Dashboard SQL editor

The Dashboard SQL editor **auto-commits each statement** — there is no wrapping transaction to
roll back. Safe destructive pattern (always show me the diff/output at each step):

1. **Dry-run SELECT** — run the exact WHERE clause as a `SELECT` first; confirm the row set and
   count are what you expect.
2. **Plain ID-scoped DELETE** — delete by explicit primary-key IDs (or the verified
   `organization_id`-scoped predicate), never an open-ended or clever predicate.
3. **Re-verify SELECT** — re-run the SELECT and confirm zero (or the expected) rows remain.

## Edge functions

- Deploy via **Supabase CLI only** (`supabase functions deploy <name>`).
- Use `Deno.serve()` (not the deprecated std `serve`).
- Import npm packages with `npm:` prefix + version (e.g. `npm:express@4.18.2`).
- Pre-populated env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_DB_URL`.
- Shared utilities go in `supabase/functions/_shared/`.
- Service-role key bypasses RLS — enforce tenant scoping explicitly in function code.

## Database functions

- Default to `SECURITY INVOKER`.
- Always set `search_path = ''` and use fully-qualified table names.
- Mark `IMMUTABLE` / `STABLE` where possible.

## RLS policies

- Use `(select auth.uid())` instead of `auth.uid()` (performance).
- SELECT: `USING`, no `WITH CHECK`
- INSERT: `WITH CHECK`, no `USING`
- UPDATE: both `USING` and `WITH CHECK`
- DELETE: `USING`, no `WITH CHECK`
