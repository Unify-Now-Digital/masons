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
- **New column on an org-scoped table: check every view over that table.** Explicit-column-list
  views do not inherit new columns — edge functions selecting the column via the view fail
  with 42703. Grep edge functions for **view names**, not just table names.

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

**`CREATE OR REPLACE VIEW` silently RESETS reloptions** — `security_invoker` is dropped by the
recreate. After ANY view recreation, always re-run
`alter view public.<name> set (security_invoker = on);` and verify it stuck:
```sql
select relname, reloptions from pg_class where relname = '<name>';
```

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

### JWT verification flags per function

- `twilio-sms-webhook` — deploy with `--no-verify-jwt` (Twilio cannot send a Supabase JWT;
  a plain deploy re-enables verification and inbound breaks with 401s). Same applies to any
  future Twilio- or third-party-called webhook.
- `inbox-twilio-send` — Verify JWT **enabled** (frontend-called with user JWT); deploy normally,
  no flag.
- `ghl-webhook` — `--no-verify-jwt`; authenticates via `X-Webhook-Secret` header checked
  (constant-time) against the `GHL_WORKFLOW_WEBHOOK_SECRET` secret before any DB work.

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

## 19 Aug 2026 — portal provenance + create_quote

- PROVENANCE SOLVED: the six mystery tables, portal functions, triggers, and
  the 8-Aug hardening wave all originate in the SearsMelvin repo's
  migrations/ directory (Unify-Now-Digital/SearsMelvin, 24 files dated
  2026-08-09, PRs #135–#148, agent-authored branches: agent/*, claude/*,
  codex/*). That repo is a SECOND source of production schema changes.
  Before declaring anything "zero repo trace", grep BOTH repos.
- create_quote (their 2026-05-20 migration) org-scoped 19 Aug: person dedupe
  SELECTs gained `and organization_id = v_org` (Mason migration
  20260819120000, commit f683e4c, applied via Dashboard, read back, ACL
  verified service_role-only). REVERT RISK: re-running their 2026-05-20
  file restores the unfiltered version — coordination item.
- Portal writes use SUPABASE_SERVICE_KEY in Cloudflare Pages Functions —
  RLS is bypassed; all isolation lives inside the SQL of the functions.
- orders.stage (their add-order-stage.sql): NOT NULL default
  'quote_received', 8-value CHECK — a SECOND state machine on orders,
  separate from jobs.stage. Every Mason-created order silently gets
  'quote_received'.
- capture_quote_access_token trigger (orders, AFTER write): hashes
  edit_token into quote_access_tokens and NULLS orders.edit_token. Anything
  reading orders.edit_token reads null. Any P3 flow that stops inserting a
  quote-type order breaks the customer "Edit Your Quote" email link.
- enquiries INSERT fires trg_sync_enquiry_to_inbox →
  create_inbox_from_enquiry: creates the web-channel conversation +
  message, links person, stamps conversation.order_id. This is why portal
  people have linked conversations without Gmail sync.
- Dashboard-applied migrations from Windows files carry CRLF into the
  function body — pg_get_functiondef then shows \r\n. Harmless, but future
  diffs against LF files show every line changed. Consider LF-normalizing
  migration files before applying. 20 Aug update: CRLF can enter via the
  PASTE path even from an LF-clean file, so always read back with
  `position(e'\r' in pg_get_functiondef(...))` (expect 0). Remedy applied
  in production (20 Aug, create_quote): server-side strip —
  `do $$ ... execute replace(pg_get_functiondef('<fn>'::regprocedure), e'\r', '') ... $$;`
  then re-read-back.
- Duplicate updated_at triggers on orders (update_orders_updated_at AND
  trg_orders_updated_at, both enabled) — unresolved, housekeeping.
