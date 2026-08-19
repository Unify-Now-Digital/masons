# Feature Specification: Quote-to-Job Pipeline

**Feature Branch**: `feature/quote-to-job-pipeline`
**Created**: 2026-08-20
**Status**: Draft
**Input**: User description: "Combined P2/P3 cycle: portal quotes become pipeline jobs instead of order rows, and manual order creation auto-creates missing jobs."

> **Decision status**: All decisions in this spec were MADE by Giorgi (19–20 Aug 2026). They are
> requirements, not open questions — do not reopen them during planning or implementation.
> Ground-truth findings below are stated as facts with sources; do not re-derive them unless a
> task explicitly requires verification.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Portal quote creates a pipeline job, not an order (Priority: P1)

A customer submits a quote through the Sears Melvin portal. Instead of creating a phantom
`order_type='quote'` order row, the system upserts the person (org-scoped), creates a job at the
'enquired' pipeline stage linked to that **person** (not the conversation), and records an
enquiries row. No order row is created.

**Why this priority**: This is the P3(a) core — quote orders polluting the orders table are the
root cause of the inbox mislabeling and the blocked order-type enum enforcement. Everything else
in this cycle depends on `create_quote` no longer inserting orders.

**Independent Test**: Submit a portal quote for a brand-new person in the SM org; verify a person
row, a job at 'enquired' linked to that person, and an enquiries row exist — and that no new
`orders` row was created.

**Acceptance Scenarios**:

1. **Given** a new visitor with no existing person row in the SM org, **When** they submit a
   portal quote, **Then** a person is created, a job at 'enquired' stage linked to that person is
   created, an enquiries row is created with `order_id` omitted (null), and no orders row exists.
2. **Given** an existing SM person (matched by the f683e4c org-scoped dedupe), **When** they
   submit a quote and they have **no** job at 'enquired' stage, **Then** a new job at 'enquired'
   is created and the enquiry attached to it.
3. **Given** an existing SM person **with** a job currently at 'enquired' stage, **When** they
   submit another quote, **Then** the enquiry is attached to that existing job and the job's
   config is updated to the latest quote's configuration (forward dedupe rule).
4. **Given** an existing SM person whose only jobs are at stages **later** than 'enquired' (e.g.
   in production), **When** they submit a quote, **Then** a **new** job is created — a fresh quote
   from someone in production is a new memorial (later-stage jobs never match).
5. **Given** a quote submitted post-cutover, **When** its inbox conversation is created via
   `create_inbox_from_enquiry`, **Then** the conversation is created with null `order_id`,
   `link_state` resolves 'linked' via `person_id`, and the conversation buckets as 'enquiry'
   (person has no orders) with zero frontend change.
6. **Given** a person in a *different* organization with the same contact details, **When** an SM
   quote is submitted, **Then** dedupe MUST NOT match cross-tenant — the f683e4c org-scoping
   (`and organization_id = v_org` on both dedupe SELECTs) is preserved.

---

### User Story 2 - Manual order creation auto-creates a missing job (Priority: P2)

Staff create an order for a person who has no job in the pipeline. The system auto-creates the
job so the order is never orphaned from the pipeline (matching the 3-Aug stage-automation
philosophy). Repro case: Richard Grigorescu (Arin WhatsApp video).

**Why this priority**: Independent of the quote rewrite; fixes a live workflow gap staff hit
today, but the quote path (P1) is the structural change this cycle exists for.

**Independent Test**: Create an order for a person with no job; verify a job now exists for that
person. Create an order for a person who already has a job; verify no duplicate job is created.

**Acceptance Scenarios**:

1. **Given** a person with no job, **When** staff create an order for them, **Then** a job is
   auto-created for that person.
2. **Given** a person who already has a job, **When** staff create an order, **Then** no
   additional job is created.

---

### User Story 3 - Backfill: existing quote orders become jobs (Priority: P1, same cutover window as Story 1)

The 30 existing SM `order_type='quote'` orders are converted into 23 jobs — one per distinct
person — with the latest quote's `product_config` as the job's primary pre-population source.
Original order rows are archived (not deleted), preserving earlier quotes.

**Why this priority**: Must land in the **same coordinated migration window** as the
`create_quote` rewrite (single cutover; ~2 quotes/week arrival rate means no stragglers). Leaving
quote orders behind would leave the inbox mislabels and block the enum enforcement.

**Independent Test**: After backfill, verify 23 jobs exist for the 23 distinct persons behind the
30 quote orders, all 30 order rows are archived, and read-back SELECTs match the predicted
counts.

**Acceptance Scenarios**:

1. **Given** the 30 SM quote orders (person source: `orders.person_id`, populated on all 30 and
   matching `enquiries.person_id` on all 30 — verified 20 Aug), **When** the backfill runs,
   **Then** exactly 23 jobs are created, one per distinct person.
2. **Given** a person with multiple quote orders (all 5 multi-quote clusters verified 20 Aug as
   same-memorial comparison shopping — identical inscriptions/locations, minutes apart), **When**
   backfilled, **Then** they get **one** job pre-populated from their **latest** quote's
   `product_config`; earlier quotes remain accessible via the archived order rows.
3. **Given** the backfill migration, **When** applied, **Then** it follows the full evidence
   chain: SELECT-first → guarded statements → `RETURNING` → read-back, with rows-affected counts
   and read-back output recorded in the migration comment block (migration evidence discipline).
4. **Given** the backfill completes, **When** the inbox is viewed, **Then** the 23 affected
   people's conversations flip from "Existing order" to "Enquiry" (see User-visible changes).

### Edge Cases

- **Quote with empty/unparseable inscription**: deceased-name field stays empty — it is a
  suggestion, not a fact (evidence: many inscriptions empty; multi-person inscriptions such as
  Liddell + daughter Winifred; order 257 has three names).
- **Quote whose product slug has no `products` match**: fall back to `custom_product_name`
  (ground truth: `products.product_id` is null on all portal orders; `sku` holds display name).
- **Concurrent quote submissions from the same new person**: person upsert must run first so the
  NOT NULL `enquiries.person_id` (database.types.ts:554) is always satisfiable; enquiry insert
  simply omits nullable `order_id` (database.types.ts:552, Insert optional :572).
- **Customer clicks an old "Edit Your Quote" link post-cutover**: link dies with a 404 at the
  SearsMelvin API (quotes.js:237 resolves token_hash→order_id; no order row → 404, no
  corruption). This is ACCEPTED BREAKAGE — see Assumptions/Risks.
- **SearsMelvin repo re-runs `2026-05-20-create-quote-rpc.sql`**: it would restore the unfiltered
  order-creating `create_quote`. Documented revert risk; mitigation is the Wednesday
  shared-schema protocol conversation (this spec notes the risk, does not solve it).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `public.create_quote` MUST be rewritten via a Mason migration (`CREATE OR REPLACE`,
  applied via Supabase Dashboard per protocol) to perform: org-scoped person upsert → job at
  'enquired' stage linked to the person → enquiries row. It MUST NOT insert into `orders`.
- **FR-002**: The rewrite MUST preserve the f683e4c org-scoping — `and organization_id = v_org`
  on **both** person-dedupe SELECTs (cross-tenant isolation).
- **FR-003**: The enquiry insert MUST omit `order_id` (nullable) and MUST run after the person
  upsert so NOT NULL `person_id` is satisfied.
- **FR-004** (forward dedupe): On quote submission, if the person has an existing job at
  'enquired' stage, the enquiry MUST attach to that job and the job's config MUST update to the
  latest quote; otherwise a new job MUST be created. Jobs at later stages MUST NOT match.
- **FR-005**: The `capture_quote_access_token` trigger and `quote_access_tokens` table
  (SearsMelvin repo, `2026-08-09-finalize-quote-access-tokens.sql`) MUST NOT be modified — the
  trigger fires only on orders insert/update of `edit_token` and is simply starved.
- **FR-006**: `create_inbox_from_enquiry` MUST NOT be changed — it stamps `e.order_id` through to
  `inbox_conversations.order_id`, null passes gracefully, and `link_state` resolves 'linked' via
  `person_id` (live function body verified 20 Aug).
- **FR-007** (P2): Creating an order for a person with no job MUST auto-create a job for that
  person.
- **FR-008** (backfill): The 30 SM `order_type='quote'` orders MUST be backfilled to 23 jobs —
  one per distinct person (`orders.person_id` as person source) — pre-populated from the latest
  quote's `product_config`, with order rows **archived, not deleted**, in the same migration
  window as FR-001 (single coordinated cutover). The backfill MUST also null the `order_id`
  stamp on the affected `inbox_conversations` rows (the 23 people's enquiry conversations).
  Rationale: SC-003's badge flip must not depend on archive semantics — a dangling `order_id`
  that still resolves in the inbox orders fetch would keep `isOrderOpen` true and the badge
  stuck at 'Existing order'. Nulling the stamps also removes dangling references feeding
  inbox.api.ts message counts.
- **FR-010** (pre-population): Job pre-population from `product_config` MUST cast the TEXT column
  with `::jsonb` on every read (bare `->>` throws 42883); resolve product identity by slug →
  `products.id`, falling back to `custom_product_name`; read inscription from BOTH
  `orders.inscription_text` and the config's `inscription` key; and treat parsed deceased name as
  an editable suggestion, empty when unparseable.
- **FR-011**: Every backfill statement MUST carry the org guard
  `organization_id = '3770972d-1bbd-417b-b413-297e844db285'` (Sears Melvin). Churchill has zero
  portal quotes — the backfill is SM-only.
- **FR-012**: The backfill migration MUST record apply-time evidence: rows-affected counts,
  `RETURNING` output, and read-back SELECT results pasted into the migration comment block.
- **FR-013**: Inbox bucketing MUST remain order-based; jobs MUST NOT feed the classifier this
  cycle (possible future enhancement — noted, not built).

(FR-009 is intentionally absent this cycle — see Scope decisions: backward stage moves deferred.)

### Architectural Constraints *(mandatory when relevant)*

- **AC-002 (Module boundaries)**: Any frontend changes live in the owning module
  (`src/modules/...`); no cross-feature deep imports.
- **AC-003 (RLS as boundary)**: Authorization enforced in the database via RLS; the org-scoped
  dedupe (FR-002) is part of the tenant boundary. Read `specs/rls-isolation-findings.md` before
  touching org-scoped views or RLS.
- **AC-004 (Migration protocol)**: No `supabase db push`. Migration files committed to
  `supabase/migrations/` with evidence headers BEFORE Dashboard apply; bodies LF-normalized
  before apply (CRLF learning 19 Aug); Giorgi applies via Dashboard SQL editor and runs all
  gates (tsc baseline 55, lint 10/16, deno clean); all git operations by Giorgi.
- **AC-005 (Shared schema)**: `create_quote` and its triggers are shared with the SearsMelvin
  portal repo. Their `2026-05-20-create-quote-rpc.sql`, if re-run, reverts the rewrite. Mason
  does not modify SearsMelvin repo artifacts.

### Key Entities *(include if feature involves data)*

- **Person**: org-scoped contact; dedupe target of the quote upsert; the anchor jobs link to.
- **Job**: pipeline work item with a stage ('enquired' is the entry stage); linked to a person,
  NOT to a conversation. One per memorial.
- **Enquiry**: record of a quote submission; `person_id` NOT NULL, `order_id` nullable and
  omitted post-cutover; attaches to a job under the forward dedupe rule.
- **Order (order_type='quote')**: legacy phantom rows the portal used to create; 30 exist in SM;
  archived by the backfill; the type value becomes eligible for enum enforcement afterwards.
- **product_config**: TEXT column holding JSON (requires `::jsonb` cast). Verified shape:
  top-level `slug`, `name`, `type`, `size`, `colour`, `font`, `price`, `addons[]`,
  `addonLineItems[{name,price}]`, `inscription`, `letterColour`, `infillType`/`infillColour`,
  `permit_fee`, `image`. Column-type migration to jsonb is OUT of scope.
- **Inbox conversation**: linked to person; `order_id` stays null for enquiries; bucketed by
  `inboxBuckets.ts` on person-has-open-orders, not on channel or `link_state`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Post-cutover, portal quote submissions create zero `orders` rows; each results in
  exactly one enquiries row and exactly one job link (new job, or existing 'enquired' job per
  FR-004).
- **SC-002**: Backfill read-back shows exactly 23 jobs for the 23 distinct persons and all 30
  quote order rows archived; evidence recorded in the migration file. (F1, 20 Aug: read as
  END-STATE invariant — 23 persons each with ≥1 active job attached to their latest quote
  enquiry; create-vs-attach split recorded by the S0 partition SELECT — not "23 rows
  inserted".)
- **SC-003**: The 23 affected people's inbox conversations show "Enquiry" (not "Existing order")
  after backfill; new post-cutover enquiries bucket as 'enquiry' with zero frontend change.
- **SC-004**: Creating an order for a job-less person yields a job 100% of the time (Richard
  Grigorescu repro passes); no duplicate jobs for persons who already have one.
- **SC-005**: Zero cross-tenant person matches from quote dedupe (org-scoping preserved);
  Churchill data untouched by the entire cycle.
- **SC-006**: `orders` table is clear of live `order_type='quote'` rows, unblocking the
  order-type enum enforcement follow-up (ghost `orders_order_type_check`: migration exists,
  constraint doesn't).

## User-visible changes *(must go on the Arin call agenda)*

- **Inbox badge flip**: 23 people's conversations currently show "Existing order" (because
  `isOrderOpen` at inboxBuckets.ts:62 returns true when `installation_date` is null, so all 30
  quote orders count as open today). The backfill flips them to "Enquiry". This is a CORRECTION
  of a mislabel but a VISIBLE change — Arin must be told before cutover.
- **"Edit Your Quote" links die** (ACCEPTED BREAKAGE): customer edit links resolve
  token_hash→order_id at the SearsMelvin API (quotes.js:237); with no order row they 404. No data
  corruption. Arin receives a **WARNING** (not a permission request), with exhibits documented.

## Ground-truth findings ledger *(facts with sources — do not re-derive)*

- Inbox classifier reads neither channel nor `link_state`; null-`order_id` web conversation →
  'order' bucket iff `personHasOpenOrders`, else 'enquiry' (inboxBuckets.ts:113, fallback :116).
- Backlog item "rename 'Existing order'→'Enquiry' at inboxBuckets.ts:15" is **CLOSED as WRONG
  FIX** — the label is genuinely order-fed; the backfill fixes the mislabeled cases.
- Linkage drift finding (documented, NOT in scope to fix): the portal writes `orders.person_id`;
  Mason uses the `order_people` join table.
- `order_id` consumer surface (regression checklist for plan phase): inbox.api.ts:45, 80–98
  (message counts by order_id); inboxConversations.api.ts:179 (write path — VERIFY during plan
  whether manual-link feature or enquiry machinery); ConversationView.tsx:147;
  UnifiedInboxPage.tsx:431; inboxBuckets.ts `buildOrderById`:265–269.
- VERIFY during plan: what the established archive mechanism does to live read paths — grep the
  inbox orders fetch and confirm archived orders are excluded from the list feeding
  `buildOrderById` / `buildPersonHasOpenOrdersSet`.
- `enquiries.order_id` nullable / Insert optional (database.types.ts:552/:572);
  `enquiries.person_id` NOT NULL (:554).
- `product_config` bare-column `->>` throws 42883; `::jsonb` cast required (verified).

## Scope decisions

**In scope this cycle**: FR-001…FR-013 above (create_quote rewrite, P2 auto-job, backfill,
pre-population, single coordinated cutover).

**Deferred (separate tasks — do not build)**:
- OQ-C person-wide job picker.
- FR-009 allow-with-confirm backward stage moves.

**Immediate follow-up (not this cycle)**: enforce the order-type enum / remove 'quote'
(`orders_order_type_check` currently a ghost constraint).

**Future enhancement (noted only)**: job-fed inbox bucketing.

## Assumptions

- ~2 quotes/week arrival rate makes a single coordinated cutover window (rewrite + backfill
  together) safe with no straggler handling needed.
- The archive mechanism for order rows follows the established archive-don't-drop approach
  already in use in this codebase.
- The SearsMelvin repo is out of Mason's control; the revert risk from
  `2026-05-20-create-quote-rpc.sql` is accepted and mitigated socially (Wednesday shared-schema
  protocol conversation), not technically.
- Sears Melvin is LIVE with real orders — all writes follow the same live-money caution as
  Churchill; every migration statement is org-guarded to SM
  (`3770972d-1bbd-417b-b413-297e844db285`).
- Protocol carriers for tasks.md (to be written verbatim into tasks.md at the /tasks phase):
  "STOP at checkpoint tasks and WAIT for Giorgi"; predictions before every apply; Giorgi runs
  all gates (tsc=55, lint=10/16, deno clean); all git by Giorgi with explicit paths; migration
  files committed with evidence headers BEFORE Dashboard apply; LF-normalize migration bodies
  before apply.
