# Research: quote-to-job-pipeline (plan phase, 2026-08-20)

All findings below are from actual reads of this repo on branch `feature/quote-to-job-pipeline`.
Predictions were stated before each verification read per protocol; outcomes noted.

## V1 — inboxConversations.api.ts:179 (RESOLVED)

**Prediction**: manual link-conversation-to-order feature, survives untouched. **Outcome:
confirmed, and stronger than predicted.**

- The write path is `linkConversationToOrder(conversationId, orderId)` at
  `src/modules/inbox/api/inboxConversations.api.ts:174–182`. It sets `order_id` (line 179) and
  `enquiry_stage: 'order_created'` via `updateConversation`.
- **Caller trace: ZERO callers.** A repo-wide grep for `linkConversationToOrder` finds only the
  definition. `LinkConversationModal` and all linking UI use `linkConversation` /
  `linkConversations` (person-linking, `person_id` + `link_state`), never the order variant.
- The portal/enquiry machinery stamps `inbox_conversations.order_id` inside the DB function
  `create_inbox_from_enquiry` (trigger on enquiries INSERT), not through this API.
- **Verdict**: dead export belonging to the manual-link surface. Out of scope; untouched. No
  regression risk from this cycle. (Optional housekeeping — deleting the dead export — is NOT in
  scope.)

## V2 — Archive semantics vs inbox fetch (RESOLVED, with a spec-contradicting finding)

**Prediction**: soft archive column exists; inbox fetch probably does not filter it. **Outcome:
half right — the fetch filters nothing, and NO orders archive mechanism exists at all.**

- **There is no established archive mechanism for orders.** Case-insensitive grep for
  `archiv` across `src/**` matches only inbox conversations (`status: 'archived'` on
  `inbox_conversations`, inboxConversations.api.ts:157–168) and `jobsPipeline/ExitedJobsList`
  (jobs exit via `exit_reason`/`exited_at`). Across `supabase/**/*.sql`: zero matches. The
  `orders` table has no `archived_at`/`is_archived`; its nullable `status` column is never
  filtered anywhere in `src/modules/orders/`.
- **Exact fetch call sites feeding bucketing** (both unfiltered beyond org + person):
  - `fetchOrdersByPersonIds` — `src/modules/orders/api/orders.api.ts:194–217`. Filters:
    `.eq('organization_id', …)`, `.in('person_id', …)`, `.order('created_at', desc)`. **No
    status/archive/type filter.** Feeds `UnifiedInboxPage.tsx:396` (`useOrdersByPersonIds`,
    `src/modules/orders/hooks/useOrders.ts:177`) → `buildPersonHasOpenOrdersSet` /
    `buildOrderById` (UnifiedInboxPage.tsx:408/412).
  - `fetchOrdersByPersonId` — `orders.api.ts:169–188`, same filter shape. Feeds
    `ConversationView.tsx:82` (`useOrdersByPersonId`) → `personHasOpenOrders` (:144) and
    `linkedOrder` (:145–151).
- **Consequence for the badge flip**: FR-008's conversation-stamp nulling alone does NOT flip
  the badge. The classifier's second path (`inboxBuckets.ts:113`) goes
  `person_id → orders → isOrderOpen` — independent of `conversation.order_id`. Any soft-archived
  order still returned by these fetches keeps `isOrderOpen` true (`installation_date` null →
  open, inboxBuckets.ts:62–63). **Additional filter changes ARE required**: the archive marker
  must exist on orders AND both fetches must exclude archived rows. (Conversely, the fetch
  filter alone would also flip the `linkedOrder` path — `orderById.get(...)` misses,
  UnifiedInboxPage.tsx:431 — but FR-008 stands as decided: dangling-reference hygiene.)
- **Recommended mechanism** (defined by this plan, since none exists): additive
  `orders.archived_at timestamptz null` column; archived = non-null. Rejected alternatives:
  reusing `orders.status` (values un-governed, portal also writes `stage` — a second state
  machine per supabase/CLAUDE.md; overloading invites collisions) and copy-to-archive-table +
  delete (violates the spec's explicit "archived, not deleted").

## F1 — FLAG: a jobs backfill for SM already ran on 1 Aug (spec contradiction)

`supabase/migrations/20260801213000_jobs_backfill_sm.sql` (applied 01 Aug 2026):

- Inserted **one job per enquiry** for the whole SM org: 43 jobs — 23 at 'enquired', 20 at
  'quoted' (`stage = case when e.order_id is not null then 'quoted' else 'enquired' end`),
  `stage_status 'pending'`, `conversation_id` joined via
  `external_thread_id = 'enquiry:' || e.id`.
- Stamped `orders.job_id` on 20 quote-orders (read-back: "0 quote-orders with null job_id" at
  that date).

**The spec's backfill decision ("30 orders → 23 new jobs, one per person") was made without
accounting for these existing jobs.** As of 1 Aug, every then-existing quote order's person
already HAS a job (at 'quoted'); only post-1-Aug quotes (~2/week × ~3 weeks ≈ 5–10 orders) lack
jobs. A plain 23-job INSERT would create duplicates. The backfill must be an **idempotent
"ensure exactly one active job per person"** with a pre-apply partition SELECT (run live in
Dashboard) splitting the 30 orders' 23 persons into: (a) has active job → attach latest enquiry,
(b) job-less → create job. SC-002 must be read as the END-STATE invariant (23 persons × 1 active
job each), not "23 rows inserted". **Giorgi decision checkpoint** — carried into plan.md.

Also note: some 1-Aug jobs may since have been exited or advanced; the partition SELECT is the
ground truth at apply time, not this file.

## Jobs schema ground truth

From `src/shared/types/database.types.ts:1786–1886` and
`supabase/migrations/20260801210000_jobs_pipeline_schema.sql` (authoritative for CHECKs):

- Columns: `id`, `organization_id` (NOT NULL, FK), `person_id` (nullable, FK people),
  `conversation_id` (nullable, FK inbox_conversations), `enquiry_id` (nullable, FK enquiries),
  `source` (NOT NULL, CHECK in `('website','email','whatsapp','sms','ghl','manual')` — amended
  1 Aug to include 'sms'), `stage` (NOT NULL default 'enquired', CHECK in
  `('enquired','quoted','invoiced','confirmed','in_production','fixed','complete')`),
  `stage_status` (nullable text, NO CHECK — observed values: 'pending' (1-Aug backfill),
  'uncontacted' (addToPipeline.api.ts:125)), `paid_at`, `exit_reason` (CHECK
  `('lost','closed','dormant','on_hold','cancelled')`), `exited_at`, `wake_at`, timestamps.
  Constraints: `jobs_exit_pairs` (`exit_reason` null ⇔ `exited_at` null),
  `jobs_dormant_needs_wake`.
- **"Active job" predicate**: `exit_reason is null` (matches partial index
  `jobs_org_stage_idx`; no DELETE policy by design — jobs exit, never delete).
- **Jobs carry NO product/config columns.** A job's quote configuration lives through
  `jobs.enquiry_id → enquiries.details` (jsonb). `create_quote` already writes the full product
  object to `enquiries.details` (v_product, current function line 109) — identical JSON to
  `orders.product_config` (which is `v_product::text`). So "update job config to latest" =
  repoint `jobs.enquiry_id` at the newest enquiry; and the backfill does NOT need to parse
  `orders.product_config::jsonb` to give jobs their config — the enquiry linkage carries it.
  FR-010's `::jsonb`/slug-lookup/inscription/deceased-name rules apply to the FRONTEND
  pre-population read (jobs UI / future job→order conversion), not to migration SQL.
- Existing job-creation code path (P2 mirror source): `addConversationToPipeline`
  (`src/modules/jobsPipeline/api/addToPipeline.api.ts:85–145`): org-scoped person resolve →
  insert job `{organization_id, person_id, conversation_id, source, stage: 'enquired',
  stage_status: 'uncontacted'}` → link conversation.
- Stage automation: `autoAdvanceJobStage` (`autoAdvanceStage.api.ts`) — forward-only, blessed
  targets 'quoted'|'invoiced', atomic UPDATE guarded by `exit_reason is null` + earlier-stage
  IN-list. Fired from `useOrders.ts:218` (order created → 'quoted') and `useInvoices.ts:61`
  (invoice created → 'invoiced') — **only when `data.job_id` is non-null**. This is exactly the
  Grigorescu gap: order created for job-less person ⇒ `order.job_id` null ⇒ no job, no advance.

## Current create_quote (rewrite baseline)

`supabase/migrations/20260819120000_org_scope_create_quote_person_dedupe.sql` (f683e4c, applied
19 Aug, ACL service_role-only, SECURITY DEFINER, `search_path = public, pg_temp`):

1. Person upsert — org-scoped dedupe SELECTs (`where email = v_email and organization_id =
   v_org`) with unique_violation fallback; **preserve verbatim** (FR-002).
2. Cemetery resolve (id, else name ilike best-effort) — keep unchanged.
3. Orders INSERT (`order_type 'quote'`, `product_config = v_product::text`, edit_token, …) —
   **REMOVE** (FR-001).
4. Enquiries INSERT (`details = v_product`, `order_id = v_order_id`) — keep, minus `order_id`.
5. Returns `{person_id, order_id, enquiry_id, edit_token}`.

**F2 — FLAG: return-shape compatibility.** The portal worker (SearsMelvin repo, not readable
from this workspace) consumes this return object. Dropping `order_id`/`edit_token` keys could
break the worker's submit path even though the edit LINK breakage is accepted. Recommendation:
keep all legacy keys — `order_id: null`, `edit_token` echoed (it is no longer persisted
anywhere; the capture trigger is starved as decided) — and add `job_id`. Documented in
`contracts/create_quote.md`.

Trigger context (supabase/CLAUDE.md, verified 19–20 Aug): enquiries INSERT fires
`trg_sync_enquiry_to_inbox → create_inbox_from_enquiry` **synchronously** — the conversation
exists as soon as the enquiry INSERT statement completes. The new function can therefore stamp
`jobs.conversation_id` after the enquiry insert by selecting
`inbox_conversations where external_thread_id = 'enquiry:' || v_enq_id` (same join key the 1-Aug
backfill used). `create_inbox_from_enquiry` itself needs NO change (FR-006).

## Order-creation seam (P2)

- **Single insert choke point**: `createOrder` (`src/modules/orders/api/orders.api.ts:292–301`)
  — the only `.from('orders').insert` in src. Reached via `useCreateOrder`
  (`useOrders.ts:190–197`) from `CreateOrderDrawer.tsx:289`, `CreateInvoiceDrawer.tsx:426`, and
  via `createOrderFromQuote` (`orders.api.ts:363–378`, calls `createOrder`).
- `useCreateOrder`/`useCreateOrderFromQuote` onSuccess already fire
  `autoAdvanceJobStage(…, 'quoted')` when `data.job_id` is set (useOrders.ts:218/:257).
- **Recommended seam**: inside `createOrder` (API layer), pre-insert: when `order.job_id` is
  absent and `person_id` present, query active jobs for the person (org-scoped,
  `exit_reason is null`); if NONE, insert a job (`source: 'manual'`, `stage: 'enquired'`,
  `stage_status: 'uncontacted'` — mirrors addToPipeline) and stamp its id into the order insert
  payload. The existing onSuccess auto-advance to 'quoted' then fires with zero further change.
  If a job EXISTS but `order.job_id` is null → leave null (that linking choice is the DEFERRED
  OQ-C person-wide job picker).
  - Rejected: DB trigger on orders INSERT (adds shared-schema surface in the
    SearsMelvin-collision zone, harder to evidence/roll back, and Mason's 3-Aug stage-automation
    precedent is client-side); per-drawer logic (three call sites, guaranteed drift).

## Inbox classifier + consumers (ground truth, re-verified this session)

- `classifyConversation` (`inboxBuckets.ts:94–117`): cemetery signals → `linkedOrder` present →
  'order' (:105–110) → `person_id && personHasOpenOrders` → 'order' (:113) → 'enquiry' (:116).
- `isOrderOpen` (:62–68): null/unparseable/future `installation_date` → open; else open until
  `second_payment_date`.
- The 30 quote orders' conversations were stamped with `order_id` by
  `create_inbox_from_enquiry`, so TODAY they classify via the `linkedOrder` path (:105), not
  only :113. Both paths must go quiet for the flip: FR-008 nulling kills :105 stale-stamp
  residue; the archived_at fetch filter kills both (:105 via orderById miss, :113 via
  personHasOpenOrders false).
- Consumer surface for regression checklist:
  - `inbox.api.ts:41–50` `fetchMessagesByOrder`, `:73–104` `fetchMessageCountsByOrders` — read
    `messages.order_id` (messages table), NOT conversations; unaffected by stamp-nulling.
    Post-cutover they're simply not called for archived orders (ids no longer surfaced).
  - `inboxConversations.api.ts:174–182` — dead export (V1). Untouched.
  - `ConversationView.tsx:145–151` `linkedOrder`; `:144` `personHasOpenOrders`; `:82`
    `useOrdersByPersonId`; `:261` `relatedOrderIds`.
  - `UnifiedInboxPage.tsx:428–444` classifier loop (`:431` orderById lookup);
    `:524–534` `orderDisplayIdsByPersonId` (row annotations — archived orders drop out).
  - `inboxBuckets.ts:255–269` `buildPersonHasOpenOrdersSet` / `buildOrderById`.

## Orders table facts relevant to migration

- `orders.job_id` exists (nullable, FK jobs; `20251223041858_add_job_id_to_orders.sql` +
  pipeline schema) — backfill can stamp provenance on archived rows.
- `orders.stage` NOT NULL default 'quote_received' (SearsMelvin's second state machine) — no
  interaction with this cycle; do not touch.
- `orders.is_test` boolean exists — not an archive mechanism; do not overload.
- `product_config` TEXT (database.types.ts:2845) — `::jsonb` cast required on any SQL read
  (spec ground truth; not needed by the backfill given enquiry-linkage carries config).
- `enquiries`: `person_id` NOT NULL (:554), `order_id` nullable (:552, Insert optional :572),
  `details Json | null` (:548) — all confirmed in current types file.

## V3 — Legacy enquiries.details verification (RESOLVED 20 Aug, Giorgi-run Dashboard SELECT)

Question: does `enquiries.details` hold the full config on the LEGACY enquiries behind the 30
quote orders (the plan routes job config through `jobs.enquiry_id → enquiries.details`,
avoiding SQL-side `product_config` parsing)?

**Prediction**: all 30 match. **Outcome: 28 match / 2 DIFFER — and the plan stands unchanged,
because `enquiries.details` is the CLEAN side on all 30 rows.**

- Q1/Q2 (org-guarded read-only, run by Giorgi in Dashboard, 20 Aug): join `enquiries.order_id =
  orders.id` over the 30 SM quote orders returned exactly 30 rows. Rollup: **28 `match`**
  (`details::jsonb = product_config::jsonb`), **2 `DIFFER`** — orders 251/252, one person
  (`27c7b7ac…`).
- **251/252 diff analysis**: edit-link artifacts. The customer edited post-submission; the
  portal's edit path updated `product_config` CORRUPTLY — `size` truncated at an escaped quote
  (`"Standard (6'6`), and `price`/`type`/`image`/`permit_fee`/`addonLineItems` nulled — while
  `enquiries.details` retained the original complete submission.
- **NEW FINDING (exhibit)**: the portal edit-quote path corrupts `orders.product_config`
  (quote-escaping bug). Goes into (a) the Arin warning — the retired feature is one that
  DAMAGES data, strengthening the case — and (b) the SearsMelvin findings list for the
  Wednesday shared-schema conversation (fix, if any, lives in their repo; moot for new quotes
  post-cutover since neither the order row nor the edit path will exist).
- Consequence for the plan: NO S4b repair statement, no frontend fallback to archived order
  rows. `enquiries.details` is authoritative for job config on all 30; the details-based config
  flow (Jobs schema ground truth section above) is confirmed correct — and for 251/252 it is
  MORE correct than `product_config`.
- Side note for backlog: 251/252 `details` show `type: "Kerb Sets"` (hidden by the
  `product_config` truncation) — reference datum for the kerb-reactivation backlog item.

## S5 post-hoc audit (T023 finding, 20 Aug)

S5 provenance stamping wired archived orders into job_id consumers — job-orders path audited
post-hoc, PersonOrdersPanel sole consumer, filtered 20 Aug; lesson: **any backfill that ADDS a
linkage must re-audit consumers of the linked column.** Detail: `fetchOrdersByJobId`
(orders.api.ts) had no archived_at filter; pre-S5 no quote order carried job_id, so the V2
sweep could not have caught it — the exposure was created by the backfill itself. Material
angle: archived quote orders (null invoice_id) summoned PersonOrdersPanel's "Create invoice"
button and were preloaded into the drawer (live Stripe invoice). Option (c) — deliberately
showing archived quotes as job history — goes to the Wednesday agenda beside F3.

## Gates baseline (memory, for quickstart)

`npx tsc --noEmit -p tsconfig.app.json` = 55 pre-existing errors, 0 new allowed; lint = 10
errors/16 warnings baseline; deno check applies only if edge functions change — **this cycle
touches no edge functions**, so the deno gate is trivially clean.
