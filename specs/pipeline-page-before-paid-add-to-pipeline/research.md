# Research: Pipeline Page (Before Paid) + Add to Pipeline

All findings verified on disk 2026-08-02 (branch `feature/pipeline-page-before-paid-add-to-pipeline`).
Parent spec: `specs/status_v2-implementation-spec.md` §4–5. Schema ground truth read from
`supabase/migrations/20260801210000_jobs_pipeline_schema.sql` (per Giorgi's /plan instruction —
not guessed).

## R1. Schema ground truth (resolves the spec's open assumption)

`public.jobs` (applied 01 Aug, Dashboard):

- Columns: `id`, `organization_id` (NOT NULL → organizations), `person_id` (→ people),
  `conversation_id` (→ inbox_conversations), `enquiry_id` (→ enquiries), `source` (NOT NULL,
  check: `'website'|'email'|'whatsapp'|'ghl'|'manual'`), `stage` (NOT NULL default `'enquired'`,
  check: `'enquired'|'quoted'|'invoiced'|'confirmed'|'in_production'|'fixed'|'complete'`),
  `stage_status` (free text, nullable), `paid_at`, `exit_reason` (check:
  `'lost'|'closed'|'dormant'|'on_hold'|'cancelled'`), `exited_at`, `wake_at`, `created_at`,
  `updated_at`.
- Constraints: `jobs_dormant_needs_wake` (`exit_reason <> 'dormant' OR wake_at IS NOT NULL`),
  `jobs_exit_pairs` (`(exit_reason IS NULL) = (exited_at IS NULL)`) — the UI must write
  `exit_reason` + `exited_at` together, and `wake_at` with dormant.
- RLS: `jobs_org_select/insert/update` via `user_is_member_of_org(organization_id)`. **No DELETE
  policy** — deletes fail at the DB even if attempted.
- Indexes: `jobs_org_stage_idx` (org, stage) WHERE exit_reason IS NULL — serves the board;
  `jobs_org_exited_idx` (org, exit_reason) WHERE exit_reason IS NOT NULL — serves the Exited view.
- Trigger `trg_jobs_updated_at` maintains `updated_at` (never send it from the client).
- Link columns on other tables: `orders.job_id`, `invoices.job_id` (nullable FK → jobs, partial
  indexes). Confirms the user-provided pre-answer exactly.

Backfill state (`20260801213000_jobs_backfill_sm.sql`): 43 SM jobs (23 enquired / 20 quoted), all
with `person_id` + `conversation_id` + `enquiry_id`, source `'website'`, **`stage_status =
'pending'`**. So live `stage_status` values are at least `'pending'` (backfill) and
`'uncontacted'` (new intake) — the pill must render arbitrary text and tolerate NULL.

## R2. Module name & route — collision with existing `jobs` and `pipeline` modules

**Decision**: new module `src/modules/jobsPipeline/`, page component `JobsPipelinePage`, React
Query key namespace `['jobsPipeline', …]`. The route **keeps path `inquiries`** under
`/dashboard`; only the element and sidebar label change.

**Rationale** (all three names one might reach for are taken):

- `src/modules/jobs/` exists: a legacy installation-scheduling page (`JobsPage`, route
  `/dashboard/jobs`, hidden sidebar entry, `jobsKeys = ['jobs', …]`). Its hand-written `Job`
  interface (`useJobs.ts:6-25`: `scheduled_date`, `estimated_duration`, `is_test`, …) does NOT
  match the new `jobs` table.
- `src/modules/pipeline/` exists: an order-stage board (`PipelinePage`, route
  `/dashboard/pipeline`, hidden sidebar entry labeled 'Pipeline') over `useOrdersList`.
- Keeping URL `/dashboard/inquiries` satisfies the spec edge case (old deep links land on the new
  page), avoids touching the existing hidden `/dashboard/pipeline` route, and matches parent-spec
  D7 ("Pipeline page takes route + sidebar slot"). URL rename can ride the post-cutover cleanup.

**Alternatives rejected**: reusing `src/modules/pipeline` (it's a different, live order-stage
board); route `/dashboard/pipeline` (collides); naming the module `pipeline2`/`salesPipeline`
(less discoverable than `jobsPipeline`, which matches the parent spec's own "jobs pipeline" name).

## R3. Pre-existing conflict: legacy code already queries `.from('jobs')` — OUT OF SCOPE, flagged

`src/modules/jobs/hooks/useJobs.ts`, `src/modules/jobs/utils/jobTransform.ts`,
`src/modules/logistics/hooks/useScheduleData.ts` (lines 63, 120, 129), and
`src/modules/logistics/api/logistics.api.ts:94` query `jobs` expecting the old scheduling shape
(`status`, `scheduled_date`, `is_test`, …). Before 01 Aug the table did not exist (those queries
42P01'd); now they hit the new pipeline table and fail differently (42703 on missing columns).
Both routes are hidden sidebar entries — pre-existing breakage, not introduced or worsened by this
feature. **No fix in this feature**; logged for the parent spec's cleanup list. This feature's
query keys (`jobsPipeline`) deliberately avoid the legacy `['jobs', …]` cache namespace.

## R4. Routing & sidebar swap points

- `src/app/router.tsx` — inquiries is the only lazy route (lines 9-11, 82-89):
  `lazy(() => import("@/modules/inquiries")…)`, `<Route path="inquiries" element={<Suspense…><InquiriesPage/></Suspense>}/>`
  nested under `/dashboard`. Swap: import `JobsPipelinePage` from `@/modules/jobsPipeline`
  (static import, matching every other module; the lazy wrapper was inquiries-specific) and point
  `path="inquiries"` at it. The old `InquiriesPage` import is removed from the router but the
  module's files stay in the tree (FR-001).
- `src/components/layout/Sidebar.tsx` — `NavItem` model at lines 12-26; 'Inquiries' entry at lines
  160-169 in the 'AI Workflows' section (`ai: true`, inline SVG icon). Swap: relabel to
  'Pipeline', keep `to: '/dashboard/inquiries'`. Whether it stays in 'AI Workflows' or moves to
  the main section: keep the slot as-is (spec: "takes the sidebar slot"), drop the `ai: true`
  flag since the new board has no AI scoring.

## R5. Data access patterns (org scoping, client typing)

- Org id: `useOrganization()` from `@/shared/context/OrganizationContext` (`organizationId:
  string | null`); queries include it in the React Query key and add
  `.eq('organization_id', organizationId)` explicitly; hooks disable until org resolves. RLS
  remains the security boundary (AC-003).
- The Supabase client (`src/shared/lib/supabase.ts:36-38`) is `createClient<any>` on purpose
  ("generated types are a partial snapshot"). Consequence: extending `database.types.ts` (FR-012)
  is documentation parity, not runtime typing — the module defines its own local types in
  `src/modules/jobsPipeline/types/` (same pattern as `src/modules/inquiries/types/inquiries.ts`).
- Board query embeds relations in one select (PostgREST embedded resources work FK-named even on
  an `any` client):
  `.from('jobs').select('*, person:people(id, first_name, last_name, email, phone), conversation:inbox_conversations(id, primary_handle, channel)')`.

## R6. `database.types.ts` insertion points (FR-012)

`src/shared/types/database.types.ts` — standard `supabase gen types` layout, tables alphabetical.

- `jobs` entry: between `invoices` (ends line 1691) and `memorials` (line 1692). Relationships
  convention: one entry per view exposing the referenced PK — so `jobs_person_id_fkey` gets
  entries for `customer_scores`, `customers`, AND `people` (mirroring `enquiries_person_id_fkey`,
  lines 525-587); `organization_id`, `conversation_id`, `enquiry_id` get single entries.
- `orders.job_id`: alphabetical slot between `is_test` and `latitude` in Row/Insert/Update, plus
  an `orders_job_id_fkey` Relationships entry (referencedRelation `jobs`).
- `invoices.job_id`: slot between `issue_date` and `locked_at`, plus `invoices_job_id_fkey`.
- Do NOT add `job_id` to view types (`orders_with_balance`, etc.) — explicit-column-list views
  don't inherit new columns (supabase/CLAUDE.md).
- There is no `src/integrations/supabase/` (root CLAUDE.md's alias example is stale);
  `src/shared/lib/supabase.ts` is the only client.

## R7. Conversation channel → `jobs.source` mapping

`InboxConversation.channel` is `'email' | 'sms' | 'whatsapp' | 'web'`
(`src/modules/inbox/types/inbox.types.ts:24-49`). **Mapping corrected by Giorgi 02 Aug** —
`'web'`-channel conversations are the trigger-created website-enquiry conversations (so source
`'website'`, despite the "GHL" UI relabel), and `jobs_source_check` has been extended in
production to include `'sms'`. Mapping applied at job creation:

| conversation.channel | jobs.source |
|---|---|
| `email` | `email` |
| `whatsapp` | `whatsapp` |
| `ghl` | `ghl` |
| `web` | `website` |
| `sms` | `sms` |
| anything unrecognized | `manual` |

The constraint change should be reflected in a migration record file per the migration-evidence
discipline (Giorgi applies/records these by hand — not this feature's code).

## R8. Add-to-pipeline person resolution (dedupe + creation)

Existing precedent: `src/modules/inbox/components/AddToCustomersDialog.tsx` — client-side,
org-scoped duplicate check over the org's people list:
`normalizeEmail` (trim+lowercase) and `phoneLast10` (strip non-digits, last 10, only when ≥7
digits), lines 46-48 / 133-143. The org scoping is by construction (list fetched with
`.eq('organization_id', organizationId)`).

**Decisions**:

- Dedupe: same two matchers, same normalization, applied to an org-scoped `people` fetch
  (`id, first_name, last_name, email, phone` for the current org only). Never a global query —
  satisfies FR-010 and the spec's never-leak scenario.
- Handle classification: handle contains `@` → treat as email; else if it yields ≥7 digits →
  treat as phone; else neither (dedupe finds nothing, per spec edge case).
- Person creation is single-click (no dialog — spec scenarios are one-action): `first_name` =
  email local-part for email handles, else the raw handle; `last_name` = `''` (column is NOT
  NULL); `email`/`phone` from the classified handle; `organization_id` stamped. Display quality
  is acceptable because every display site falls back
  `first_name+last_name → email → phone → primary_handle`.
- Write path: the `jobsPipeline` module's own `api/` does the `people` insert and lookup directly
  (modules own their data access) rather than deep-importing
  `src/modules/customers/hooks/useCustomers.ts` internals — the existing inbox→customers deep
  import is grandfathered, not a pattern to extend (constitution: module boundaries).

## R9. Conversation update payload

`linkConversation` (`src/modules/inbox/api/inboxConversations.api.ts:184-203`) is the template:
`.update({ person_id, link_state: 'linked', link_meta: {} }).eq('id', …).eq('organization_id', …)`.
`updated_at` must never appear in the payload — commit `53e8eb1` (2026-07-06) removed exactly
that from `inbox-twilio-send` after a silent-reject incident; the `InboxConversation` TS type
still declares `updated_at` but it is not writable. (FR-011.)

## R10. Invoiced gate + invoice total display

**Decision**: one org-scoped query for the board:
`.from('invoices').select('id, job_id, amount, deleted_at, status').eq('organization_id', org).not('job_id', 'is', null)`,
reduced client-side to `Map<job_id, {count, totalAmount}>` excluding rows with `deleted_at`
set. Gate: move-to-Invoiced enabled iff the job has ≥1 such invoice, checked from this map at
render and re-checked inside the move mutation (fresh select) before writing — covers the
stale-cache case. Total display: `formatGbpDecimal(invoice.amount)` from
`@/shared/lib/formatters` — `amount` is decimal GBP pounds (per root CLAUDE.md; do not touch the
pence fields, and don't re-derive balance logic — `invoiceRemaining.ts` exists if balances are
ever needed). Voided-Stripe nuance (`isVoidedStripeInvoice`) deliberately ignored in V1: any
non-deleted invoice with the `job_id` counts (spec: gate applies to the move, not retroactively).

## R11. Board, moves, exit semantics

- Board query: `.eq('organization_id', org).is('exit_reason', null).is('paid_at', null)` —
  matches `jobs_org_stage_idx`. Columns Enquired/Quoted/Invoiced filter `stage` client-side; jobs
  in post-paid stages with `paid_at` null shouldn't exist pre-§3.3, but any such row is shown in
  no column (defensive: only the three stages render).
- Moves: ordered stages `['enquired','quoted','invoiced']`; forward/back one step via buttons
  (no drag-and-drop — nothing in the spec requires it and the old board was read-only). Update
  payload: `{ stage }` only.
- Exit: modal with radio Lost/Closed/Dormant + date picker shown only for Dormant (required).
  Payload: `{ exit_reason, exited_at: new Date().toISOString(), wake_at: dormant ? date : null }`
  — satisfies both check constraints. `on_hold`/`cancelled` are post-paid exits, not offered
  pre-paid (D3).
- Exited view: `.eq('organization_id', org).not('exit_reason', 'is', null)` (uses
  `jobs_org_exited_idx`), same person/conversation embeds, client-side filter by exit reason
  (minimum per spec), ordered `exited_at desc`. No delete affordance anywhere; no un-exit in V1
  (not in spec).

## R12. Inbox button placement & navigation

- `ConversationHeader` (`src/modules/inbox/components/ConversationHeader.tsx`) has unused
  `secondaryActionButtonLabel`/`tertiaryActionButtonLabel` slots (props 9-15, rendered 39-73);
  "Add to pipeline" uses the secondary slot, wired from `ConversationView.tsx` (which already
  wires the primary 'Link person'/'Change link' action at lines 293-321). `CustomerConversationView`
  (grouped view) is a stretch goal — primary placement is `ConversationView`.
- Button visibility needs "does this conversation have a job?": per-conversation query
  `.from('jobs').select('id').eq('conversation_id', id).limit(1)` (RLS-scoped), keyed
  `['jobsPipeline','conversationJob', conversationId]`; the mutation re-checks before insert
  (spec concurrency edge case, best-effort V1).
- Card click → conversation: navigate to `/dashboard/inbox?conversation=<id>`, landing in the
  grouped Customers view. History (Phase 3 live review): originally the param only worked with
  `?view=flat` — the flat view's `selectedConversationId` seed (`UnifiedInboxPage.tsx:101-108`)
  was the sole consumer, and the grouped default's separate `customersSelection` state ignored
  the param and auto-selected the most-recent row. Giorgi's decision: grouped view is the
  destination, so UnifiedInboxPage now also carries a one-shot ref
  (`customersDeepLinkConversationIdRef`) that resolves the param to its customer row (via
  `row.conversationIds`) inside the existing auto-select effect; absent/unresolvable param falls
  back to today's default behavior unchanged. Jobs with `conversation_id` null (possible for
  future manual jobs; all 43 backfilled rows have one) render a non-clickable card.

## R13. UI kit

Match the existing board: gardens tokens (`gardens-tx/-txm/-txs`, `gardens-bdr`, `gardens-page`,
`gardens-sidebar(-hover)`, `gardens-acc/-acc-lt`) as used in
`src/modules/inquiries/components/InquiriesBoard.tsx:44-54` / `InquiryCard.tsx:36-39,119-120`,
plus the gardens component kit `{ Card, Btn, Icon, Pill } from '@/shared/components/gardens'`
(used by the existing PipelinePage). Modal: shadcn `Dialog`; date input: existing date-picker
primitive. Filtered-list reference for the Exited view: `InquiriesFilters` (filter bar style) —
`OrdersPage` is the heavier tabbed/table reference if needed.

## R14. Testing & verification approach

No automated test harness for UI in this repo (parent spec gates are: tsc
`-p tsconfig.app.json` against the 59-error baseline, lint, on-disk grep verification, manual
verification). Plan follows: typecheck + lint gates, manual test script in a test org (write
flows), read-only verification against SM prod data (43 jobs render, SC-001) — no writes to
Churchill/Sears Melvin (AC-004).
