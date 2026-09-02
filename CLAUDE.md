# Mason — working rules for Claude Code

Read fully before any action. Rules are checkable; `reviewer` grades every diff against them.
Real org UUIDs, project ref, and environment specifics live in `CLAUDE.local.md` (gitignored). Never dictate them from memory; read the file.

## What this is

Multi-tenant SaaS for memorial masonry businesses: inbox (email/WhatsApp), quote-to-job pipeline, orders, map/logistics, invoicing and finance, Stripe payments and reconciliation, permit/proof tracking, reporting. Every business row is scoped by `organization_id`.

Two live orgs hold real customer and money data: **Churchill** (live production) and **Sears Melvin** (launched, taking real orders). Treat both as customer-facing. Several test/leftover orgs also exist; see `CLAUDE.local.md`. Tests and automation write only to the **E2E org**.

Stack: React 18 + Vite (SWC), TypeScript, Tailwind, shadcn/Radix, TanStack Query, React Hook Form + Zod, React Router v6, Supabase/PostgREST, Deno edge functions, Stripe (per-org), Revolut, GHL, WhatsApp (Twilio), Gmail, Google Maps + Leaflet. Import alias `@/` → `src/`.

Repo: `src/pages/` (Dashboard.tsx hosts nested routes), `src/modules/<feature>/{api,components,hooks,types}`, `src/components/ui/`, `src/shared/lib/supabase.ts` (client), `src/shared/types/database.types.ts` (generated types), `supabase/` (see `supabase/CLAUDE.md`). The SearsMelvin portal at `../SearsMelvin` writes to the same database.

## Roles

- **Giorgi** approves every edit, runs all gates, performs all git operations, executes all database writes, decides product and architecture. Flags to Arin only when he chooses. Live-money actions on real customer records are flagged by default.
- **CC (you)** proposes edits with grep evidence and expected match counts, always shows the diff, applies only after approval, runs read-only investigation, never runs git, never writes to the database, never reports gate results as fact — you may run `tsc` via hook and show output, but Giorgi's run is the gate.
- **`auditor`** subagent: read-only evidence. **`reviewer`** subagent: diff vs these rules.

## Session protocol

- Start: read `docs/handoff.md`, `docs/findings.md`, `docs/backlog.md`. State the tripwire count.
- Every feature block starts read-only: plan mode, `auditor` dispatch, live-data check via Supabase MCP before claiming any bug is live.
- Tripwire: a "surprise" is any prediction miss (counts, gate deltas, behaviour). 2 = heightened caution and say so. 3 = propose stopping. Giorgi may override; log the override in `docs/handoff.md`.
- Flag a risk once, plainly. Do not repeat cautions. Do not steer Giorgi away from tasks.
- End: update `docs/handoff.md` as a diff (edit in place), not a rewrite.

## Git

- CC never runs any `git` command. Hooks enforce this.
- One concern per commit. Stage by explicit path. Never `git add .` or `-A`.
- `git status` before and after staging. Giorgi writes commit messages.
- Branch from `staging`; PRs target `staging`.
- Migrations are committed and pushed **before** Dashboard apply. Edge functions committed before deploy (rollback must exist on remote).

## Gates (Giorgi runs)

- `npm run gate` green before every commit. Targets: tsc 0 errors, lint 0 errors / 0 warnings.
- `vite build` transpiles only; a green build says nothing about types. Typecheck is a separate step (`gate:tsc`, which must point at the app tsconfig — bare `tsc --noEmit` may check nothing here).
- Until targets are reached: tsc checked by item-diff against `specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt` with `--strip-trailing-cr`; never by count. Delete the baseline the day tsc hits 0.
- Browser verify on staging (or Playwright MCP) before commit for any UI change; name the specific record/card checked.

## Database

- Real-data queries **include only the two live orgs** via explicit `organization_id IN ('<SM>', '<CHURCHILL>')` (placeholders; substitute from `CLAUDE.local.md` at paste time). Never rely on excluding test orgs.
- Single Supabase project serves staging and production. There is no separate staging database.
- Writes follow: SELECT-first (with predicted count) → org-guarded write → `RETURNING` → read-back. All four, every time. Dashboard "Success. No rows returned" proves nothing.
- Destructive operations: dry-run first, ID-scoped, org-guarded, read-back to zero.
- Schema changes are applied by hand in the Dashboard SQL editor, statement by statement. No `BEGIN/COMMIT` gates. No `supabase db push`.
- `supabase/migrations/` is the record of truth. Backfill or correction migrations record rows-affected and the read-back output in the migration's comment block — using **only IDs, invoice/order numbers, and counts**. Never name or email columns. See the correction note in `20260607152534` for the pattern.
- Edge functions deploy by CLI only: `supabase functions deploy <name>` with the `--no-verify-jwt` flag where the function requires it — a plain deploy silently re-enables JWT verification and breaks those functions with 401s. Check `supabase/CLAUDE.md` per function.
- No real org UUIDs, project refs, or keys in any tracked file. Placeholders only.
- Customer names and emails are PII: never in migrations, tests, docs, commit messages, or logs.
- `CREATE OR REPLACE VIEW` resets `security_invoker`. After any view change, re-apply `ALTER VIEW … SET (security_invoker = on)` and read back. `SECURITY DEFINER` is forbidden on views over org-scoped tables. Read `specs/rls-isolation-findings.md` before touching org-scoped views or RLS.
- `product_config` is TEXT; cast `::jsonb`. Column is `organization_id`; table is `people`.
- "Unused by Mason" ≠ "unused." Check `../SearsMelvin` before any drop, rename, or grant change.

## Money units

- `amount` = decimal GBP pounds. `intended_deposit_pence`, `amount_remaining`, `amount_paid` = bigint pence, returned as JS strings by PostgREST — `Number()` before arithmetic; never multiply by 100 again.
- Canonical helpers: `src/modules/finance/utils/invoiceRemaining.ts` (`invoiceRemainingPence`, `formatInvoiceRemaining`). Use them; do not re-derive.

## Frontend

- Tab panels: `forceMount` with class-based hiding. Never conditional rendering (preserves orders-count effect, refs, panel-local drawer state).
- Never pass a function-valued `className` through a Radix `asChild` trigger.
- Job/order/invoice mutations invalidate the person-keyed probe queries (`useJobsByPersonId` etc.), not only board keys.
- Order/invoice reads filter `archived_at IS NULL` unless explicitly showing archived.
- Every data fetch is org-guarded at the query layer, not the component.
- Order insert in `OrderFormInline`/`CreateInvoiceDrawer` is an explicit field list (`orderData` literal). A new form field that is not added there silently never persists. The `orderLike` `Pick<>` is calculation-only.
- Removing a field from an UPDATE form (`EditInvoiceDrawer`): delete the key, do not set it null. Create forms keep explicit nulls.
- Use design tokens; no ad-hoc colour/size classes once the token pass lands (see `docs/ux/tokens.md`).

## Investigation discipline

- Evidence first: file:line, query + row count, match counts. Then the proposal.
- Predictions before apply: expected tsc/lint delta, files touched, blast radius.
- Before any `replace_all`: `grep -A` the literal and state expected match count per edit. Same text at different indent is a known trap.
- `grep -c` counts lines, not occurrences. Case-sensitive grep under-reports JSX additions; use `-i` or line counts.
- A code path existing is not evidence any row exercises it. Verify population before claiming a live bug.

## Domain facts (verified; re-verify before relying on them in new work)

- `enquiries.details.price` already includes `addonLineItems`. Do not add them again.
- `orders.value` is main-product-only; excludes options and permits.
- Churchill currently has zero jobs; pipeline features are SM-only in practice.
- `payment_method` no longer defaults to `'Credit Card'` (removed in `57dbd4e`); historical rows still carry it.
- Stripe credentials are per-org, encrypted in `organization_stripe_config`; mode per org via `live_payments_enabled`. No environment-level Stripe key exists.

## Spec Kit

- `create-new-feature.sh` sanitises the name (spaces → hyphens) and emits `specs/<name>/spec.md`.
- Feature specs live at `specs/<feature-name>/spec.md`. Standing findings documents may sit at `specs/` root (moving them to `docs/` is backlog).
- After any rename, grep for stale path references.

## Output style

- Short. No restating what Giorgi already knows. No repeated cautions.
