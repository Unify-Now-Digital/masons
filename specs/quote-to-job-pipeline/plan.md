# Implementation Plan: Quote-to-Job Pipeline

**Branch**: `feature/quote-to-job-pipeline` | **Date**: 2026-08-20 | **Spec**: `specs/quote-to-job-pipeline/spec.md`
**Input**: Feature specification from `specs/quote-to-job-pipeline/spec.md`

## Summary

Portal quotes stop creating `orders` rows: `public.create_quote` is rewritten (one Dashboard
migration) to person-upsert → job at 'enquired' → enquiry (no order), with forward dedupe onto
an existing active 'enquired' job. The 30 legacy SM quote orders are cut over in the same
migration window: ensure one active job per person (23 persons — correcting for the 1-Aug
backfill's existing jobs, see F1), archive the order rows via a new additive
`orders.archived_at` column, stamp `orders.job_id` provenance, and null the conversations'
`order_id` stamps (FR-008). Frontend: exclude archived orders from the two person-orders fetches
that feed inbox bucketing (load-bearing for the badge flip — V2), and close the Grigorescu gap
(P2) by auto-creating a job inside `createOrder` when the person has none.

## Technical Context

**Language/Version**: TypeScript / React 18 / Vite (SWC); PL/pgSQL (Postgres 15+, Supabase)
**Primary Dependencies**: Supabase JS client, TanStack React Query; no new dependencies
**Storage**: Supabase Postgres — tables `jobs`, `orders`, `enquiries`, `inbox_conversations`, `people`; DB function `public.create_quote`
**Testing**: Manual verification per quickstart runbook + Dashboard read-back SELECTs; gates run by Giorgi (`npx tsc --noEmit -p tsconfig.app.json` = 55 baseline; lint 10 err/16 warn; deno gate trivially clean — no edge-function changes)
**Target Platform**: Web app (staging → production Supabase project)
**Project Type**: Web app + hand-applied SQL migration (Dashboard SQL editor, per protocol — no `supabase db push`)
**Performance Goals**: N/A (30-row backfill; per-quote RPC adds ≤2 statements)
**Constraints**: Multi-tenancy guardrails (SM org guard `3770972d-1bbd-417b-b413-297e844db285` on every DML statement; Churchill untouched); Dashboard auto-commits per statement (no wrapping transaction); shared schema with SearsMelvin repo (revert risk, accepted); `product_config` is TEXT needing `::jsonb`; LF-normalized migration bodies
**Scale/Scope**: 30 orders / 23 persons / ~43 pre-existing jobs in SM; 1 DB function; 2 fetch functions + 1 API seam + types in frontend

## Constitution Check

- **Dual router constraint**: PASS — no routing/navigation changes.
- **Module boundaries**: PASS — changes live in `src/modules/orders/` (api/hooks/types) only;
  inbox and jobsPipeline modules are read-but-not-modified. `createOrder`'s job auto-create
  imports jobsPipeline via its public `index.ts` surface if any helper is reused (or inlines the
  insert — decided at implementation to avoid a new cross-module dependency; the insert is 6
  fields).
- **Supabase + RLS**: PASS — no RLS/policy changes; `create_quote` stays SECURITY DEFINER with
  service_role-only ACL (portal path); jobs RLS already org-scoped. Read
  `specs/rls-isolation-findings.md` compliance: no views touched (if any view over `orders`
  turns out to reference the new column set — none expected — the security_invoker re-check
  rule applies).
- **Secrets**: PASS — no edge functions, no secrets.
- **Additive-first**: PASS with callouts — schema change is one nullable column; the
  destructive-ish acts are (a) `create_quote` no longer inserting orders (behavioral removal,
  decided; revert = re-run prior migration file 20260819120000) and (b) `UPDATE` of 30 order
  rows + ~23–30 conversation rows (evidence-chained, org-guarded, reversible: `archived_at` →
  null, stamps restorable from `RETURNING` output recorded in the migration).

## Project Structure

### Documentation (this feature)

```text
specs/quote-to-job-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 — V1/V2 verification results + ground truth (DONE)
├── data-model.md        # Phase 1 — schema delta, states, set arithmetic (DONE)
├── contracts/
│   └── create_quote.md  # Phase 1 — RPC contract (signature/behavior/return shape)
├── quickstart.md        # Phase 1 — cutover runbook
└── tasks.md             # Phase 2 — /tasks output (NOT created by /plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20260820TTTTTT_quote_to_job_cutover.sql   # NEW — single cutover migration (§Migration design)

src/modules/orders/
├── api/orders.api.ts        # EDIT — archived_at filter in fetchOrdersByPersonId(s); job ensure in createOrder
├── hooks/useOrders.ts       # VERIFY-ONLY — onSuccess autoAdvance already correct once job_id is stamped
└── types/…                  # EDIT — Order type gains archived_at (locate exact file at implement)

src/shared/types/database.types.ts   # EDIT — orders Row/Insert/Update + archived_at (hand-maintained)

# Read-only regression surface (no edits): src/modules/inbox/utils/inboxBuckets.ts,
# pages/UnifiedInboxPage.tsx, components/ConversationView.tsx, api/inbox.api.ts,
# api/inboxConversations.api.ts, src/modules/jobsPipeline/**
```

**Structure Decision**: single-project web app; all frontend edits inside
`src/modules/orders/` + the shared types file; one new migration file.

## Phase 0 — Verification results (complete; full detail in research.md)

- **V1 RESOLVED**: `inboxConversations.api.ts:174–182` `linkConversationToOrder` is the manual
  link-to-order API and has **zero callers** (dead export; all live linking is person-based).
  Portal stamping happens in `create_inbox_from_enquiry` (DB), not here. Untouched this cycle.
- **V2 RESOLVED — additional filter changes REQUIRED**: no orders archive mechanism exists
  anywhere (src or SQL). The bucketing fetches (`fetchOrdersByPersonIds` orders.api.ts:194,
  `fetchOrdersByPersonId` :169) filter only org+person. FR-008's stamp-nulling alone cannot flip
  the badge (the `person_id → isOrderOpen` path at inboxBuckets.ts:113 ignores conversation
  stamps). The plan therefore DEFINES the mechanism: additive `orders.archived_at` + 
  `.is('archived_at', null)` on both fetches. FR-008 stands as decided (hygiene + kills the
  `linkedOrder` path residue at inboxBuckets.ts:105 / UnifiedInboxPage.tsx:431).

### Flags — spec contradictions & decisions for Giorgi (DO NOT proceed past these silently)

- **F1 (backfill arithmetic)**: `20260801213000_jobs_backfill_sm.sql` already created one job
  per SM enquiry on 1 Aug (43 jobs; 20 quote-orders got `job_id` stamped). "Create 23 jobs" as
  a plain insert would duplicate. Plan reshapes the backfill to **ensure one active job per
  person** (partition SELECT at apply time decides create-vs-attach). SC-002 becomes an
  end-state invariant (23 persons × ≥1 active job, latest quote enquiry attached), not "23 rows
  inserted". **Needs Giorgi's ACK** — this amends a 20-Aug decision's arithmetic, not its
  intent.
- **F2 (RPC return shape)**: portal worker consumes `create_quote`'s return object; SearsMelvin
  repo unreadable from here. Plan keeps legacy keys (`order_id: null`, `edit_token` echoed) +
  new `job_id` (contracts/create_quote.md). **Needs Giorgi's ACK.**
- **F3 (orders-page visibility)**: archiving via `archived_at` + bucketing-only filters means
  the 30 archived quote orders STILL appear on the main orders page (status quo). Filtering
  them out there too is a second visible change (30 rows vanish → Arin agenda). Plan
  recommends bucketing-only this cycle. **Needs Giorgi's call.**
- **F4 (auto-created job stage, P2)**: plan creates at 'enquired' and lets the existing
  onSuccess auto-advance to 'quoted' fire (blessed-target automation, single transition
  authority). Confirm this matches the 3-Aug philosophy intent vs creating directly at a later
  stage. **Needs Giorgi's ACK.**

## Phase 1 — Design

### Migration design (ONE file: `supabase/migrations/20260820TTTTTT_quote_to_job_cutover.sql`)

LF line endings (LF-normalize before Dashboard apply). Committed with evidence-header skeleton
BEFORE apply; evidence pasted in at apply time (FR-012). Dashboard auto-commits per statement —
ordering is the safety mechanism. Org guard on every DML statement (FR-011; the single DDL
statement is tenant-neutral by nature — stated in the file). Statement order:

```text
-- ============================================================
-- Evidence header (skeleton; filled at apply time per FR-012)
--   Applied: <date, by Giorgi, Dashboard SQL editor>
--   Dry-run outputs: <pasted per statement below>
--   Rows affected + RETURNING: <pasted per statement below>
--   Read-backs: <pasted>
-- ============================================================

-- S0  PRE-FLIGHT PARTITION SELECT (run first, output pasted here):
--     For the 23 persons behind the 30 quote orders: person_id, quote-order count,
--     active-job count (exit_reason is null), latest quote enquiry id+created_at,
--     conversation ids stamped with those order ids.
--     This SELECT decides Partition A (has active job → attach) vs B (create).

-- S1  DDL: alter table public.orders add column archived_at timestamptz;
--     (additive; tenant-neutral — org guard n/a for DDL; read-back: information_schema.columns)

-- S2  CREATE OR REPLACE public.create_quote  — per contracts/create_quote.md.
--     Placed BEFORE the backfill DML so no new quote-order can arrive mid-window.
--     Preserves f683e4c org-scoped dedupe VERBATIM; read-back: pg_get_functiondef
--     + ACL check (service_role-only) + no orders INSERT present.

-- S3  Backfill B (job-less persons): INSERT INTO jobs (…) SELECT … 
--     source 'website', stage 'enquired', stage_status 'pending',
--     enquiry_id = latest quote enquiry, conversation_id via
--     external_thread_id = 'enquiry:'||e.id, created_at = e.created_at,
--     guarded: organization_id = SM AND person has no active job (NOT EXISTS)
--     AND person in the S0 set. RETURNING id, person_id.  [dry-run SELECT above it]

-- S4  Backfill A (persons with active job): UPDATE jobs SET enquiry_id = <latest
--     quote enquiry>, conversation_id = coalesce(conversation_id, <resolved>)
--     WHERE organization_id = SM AND … RETURNING id, person_id, enquiry_id.
--     Stage NOT touched.  [dry-run SELECT above it]

-- S5  Provenance: UPDATE orders SET job_id = <person's active job> WHERE
--     organization_id = SM AND order_type = 'quote' AND job_id IS NULL
--     RETURNING id.  [dry-run SELECT above it; expected ≈10 post-1-Aug rows]

-- S6  Archive: UPDATE orders SET archived_at = now() WHERE organization_id = SM
--     AND order_type = 'quote' AND archived_at IS NULL RETURNING id.
--     [dry-run SELECT above it; expected 30 — exact count from S0]

-- S7  FR-008 stamp nulling: UPDATE inbox_conversations SET order_id = NULL
--     WHERE organization_id = SM AND order_id IN
--       (SELECT id FROM orders WHERE organization_id = SM AND order_type='quote')
--     RETURNING id, person_id.  [dry-run SELECT above it]

-- S8  READ-BACK SUITE (outputs pasted):
--     a) 23 persons × active-job invariant;  b) 0 unarchived quote orders;
--     c) 0 quote orders with null job_id;    d) 0 conversations stamped with
--     archived-order ids (org-wide);         e) create_quote def + ACL;
--     f) sanity: Churchill row counts for jobs/orders/conversations UNCHANGED.
```

Notes: `stage_status 'pending'` in S3 matches the 1-Aug backfill convention for backfilled rows
(live-intake rows from the rewritten RPC use 'uncontacted', matching addToPipeline). "Latest
quote enquiry" = max `created_at` per person over enquiries joined to the 30 quote orders (all
30 have matching `enquiries.person_id`; join via `enquiries.order_id` which is still populated
on legacy rows). No `product_config::jsonb` parsing is needed in SQL — config flows through
`jobs.enquiry_id → enquiries.details` (research: Jobs schema ground truth).

Revert map (recorded in file): S1 keep (harmless) or drop column; S2 re-apply 20260819120000
(restores order-creating version — also the documented SearsMelvin revert risk); S3 delete by
RETURNING ids (jobs have no DELETE policy — service-role/Dashboard only); S4/S5/S6/S7 restore
from RETURNING output.

### create_quote rewrite

Full behavior + return-shape contract in `contracts/create_quote.md`. Key design points: person
upsert verbatim from f683e4c; forward-dedupe SELECT org-guarded + `stage = 'enquired'` +
`exit_reason is null`; enquiry insert omits `order_id`; job attach after enquiry insert
(synchronous trigger guarantees the conversation exists for the `external_thread_id` lookup);
returns legacy keys + `job_id` (F2).

### P2 — auto-create job on manual order creation

Seam: **client-side in `createOrder`** (`orders.api.ts:292`), the single insert choke point for
all three creation paths (CreateOrderDrawer, CreateInvoiceDrawer, createOrderFromQuote).
Rationale over a DB trigger: no new shared-schema surface in the SearsMelvin-collision zone,
follows the client-side 3-Aug stage-automation precedent, trivially evidenced and reverted.
Logic (pre-insert, so the order row carries `job_id` in its single INSERT):

1. If `order.job_id` already set, or `order.person_id` absent → unchanged behavior.
2. Query active jobs for (org, person): `exit_reason is null`, limit 1.
3. Exists → leave `job_id` null (linking an existing job = DEFERRED OQ-C picker; do not build).
4. None → insert job `{organization_id, person_id, source: 'manual', stage: 'enquired',
   stage_status: 'uncontacted'}` (mirrors addToPipeline.api.ts:117–128), stamp its id into the
   order payload. Failure containment: if the job insert fails, proceed with the order insert
   job-less (order creation must never fail because of automation — same doctrine as
   autoAdvanceStage.api.ts:20).
5. Existing `useCreateOrder` onSuccess (useOrders.ts:218) then auto-advances the new job to
   'quoted' with zero further change. Invoice flow later advances to 'invoiced'
   (useInvoices.ts:61).

### Frontend read-path changes

- `fetchOrdersByPersonIds` + `fetchOrdersByPersonId`: add `.is('archived_at', null)` (V2
  load-bearing change).
- `Order` type / `normalizeOrder` / `database.types.ts` orders block: add `archived_at`.
- Explicitly NOT changed: `inboxBuckets.ts` (bucketing stays order-based, FR-013),
  `create_inbox_from_enquiry` (FR-006), `linkConversationToOrder` (dead, V1), main orders-list
  fetches (F3, pending Giorgi).

### Regression checklist (order_id consumer surface — verification steps for tasks.md)

| Site | Step |
|------|------|
| `inboxBuckets.ts:62` isOrderOpen | Unit-of-eyeballs: archived orders never reach it post-filter; open-order logic itself unchanged |
| `inboxBuckets.ts:105–116` classifier | 23 persons' web conversations → 'enquiry'; a person with a REAL open order still → 'order' |
| `inboxBuckets.ts:255–269` build sets/maps | Inputs exclude archived orders; no stale ids in orderById |
| `UnifiedInboxPage.tsx:431` linkedOrder lookup | Post-S7, `c.order_id` null for quote convs → no map hit; badge shows "Enquiry" |
| `UnifiedInboxPage.tsx:524–534` orderDisplayIds | Archived orders' display ids drop from row annotations — verify no blank-row artifact |
| `ConversationView.tsx:82,144–151,261` | Enquiry conversation renders: no "Existing order" badge, no linked-order panel, relatedOrderIds empty |
| `inbox.api.ts:41–50, 73–104` message counts | Operate on `messages.order_id` (messages table) — untouched by S7; verify count UI on a real (non-quote) order conversation still works |
| `inboxConversations.api.ts:174–182` | Dead export (V1) — no action; confirm still uncalled at implement time |
| New-quote E2E (post-cutover) | Portal submit → person+job('enquired')+enquiry, no order row; conversation buckets 'enquiry'; second submit re-uses job (FR-004); submit from person with in-production job → NEW job |
| P2 E2E | Grigorescu repro: order for job-less person → job exists at 'quoted' (created 'enquired', auto-advanced); order for person WITH job → no duplicate, `job_id` stays null |

### User-visible changes (Arin call agenda — carried from spec + F3)

1. Inbox badge flip for 23 people ("Existing order" → "Enquiry") — correction, but visible.
2. "Edit Your Quote" links 404 — ACCEPTED BREAKAGE; Arin gets a WARNING with exhibits.
   **Materially stronger than "old links die" (F2 resolution, Giorgi 20 Aug): post-cutover the
   portal worker keeps EMAILING fresh "Edit Your Quote" links that 404 — customers actively
   receive broken links until the SearsMelvin side changes their email template. The fix lives
   in their repo; this goes in the Arin warning and strengthens the Wednesday shared-schema
   protocol conversation.**
3. (F3, if Giorgi opts in) 30 archived quote orders disappear from the orders page.

## Phase 2 — tasks.md (NOT generated by /plan)

/tasks must carry the protocol block verbatim: **"STOP at checkpoint tasks and WAIT for
Giorgi"**; predictions (with expected match/row counts) before every edit/apply; Giorgi runs all
gates (tsc=55 via `-p tsconfig.app.json`, lint=10/16, deno trivially clean) and ALL git
operations with explicit paths; migration file committed with evidence-header skeleton BEFORE
Dashboard apply; LF-normalize the migration body before apply; per-edit approval; flags F1–F4
resolved by Giorgi before their dependent tasks unblock.

## Progress Tracking

- [x] Phase 0: Research + mandatory verifications V1, V2 (research.md)
- [x] Phase 1: Design — data-model.md, contracts/create_quote.md, quickstart.md, this plan
- [ ] Phase 2: tasks.md (/tasks phase)
- [x] Flags F1–F4: RESOLVED by Giorgi 20 Aug — F1 ensure-per-person, S0 output pasted before
      S3/S4; F2 legacy return keys + job_id, broken-link emailing added to user-visible
      changes; F3 bucketing-only, orders-page visibility → Wednesday agenda as Arin's call;
      F4 create at 'enquired' + existing auto-advance. V3 details question RESOLVED 20 Aug
      (research.md §V3 — details clean on all 30, no S4b).
- [x] Constitution re-check after Giorgi's F1–F4 calls: no violations (F3 resolved as
      bucketing-only — no additional read-path edits this cycle)

## Complexity Tracking

No constitution violations to justify. The one judgment call — defining a new archive mechanism
(`archived_at`) rather than reusing an existing one — exists because V2 proved no existing
mechanism does (research); the simpler alternative (rely on FR-008 stamp-nulling alone) is
factually insufficient to meet SC-003.
