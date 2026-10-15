# Work model: discovery map (Phase 0)

Read-only discovery for `design_handoff_mason_visual_pass/SPEC-work-model.md`. No app code changed. Every claim below is cited `file:line` against the current state of `feat/work-model-0-discovery`. Where code and generated types disagree, or where a migration exists but is **not applied**, that is called out explicitly rather than assumed.

## Decisions (approved by Arin, 15 Oct 2026)

Binding for Phase A onward. Later phases may not contradict these without a new approval.

1. Reply timers come only from `src/shared/lib/replySla.ts` (`REPLY_SLA_HOURS = { Sales: 24, CS: 24, Permits: 48, Finance: 72 }`). The spec's `SLA` table in B.1 (stage-keyed hours) applies only to **chase/stage** timers (how long a stage has sat), never to the reply-SLA clock.
2. Dead sales jobs close as **`abandoned`**, not `lost`. Canonical sales stages are `enquiry`, `quoted`, `won`, `abandoned`; terminal = `won` + `abandoned`. This supersedes the spec's own A.2 sales list (`enquiry, quoted, won, lost`) and its "Not in scope" line naming `abandoned` — both are overridden by this decision for Phase A onward.
3. Keep the PR #51 colours (`--g-na-*` warm palette, Waiting = slate). Do not apply the README 1.1 hexes.
4. Dark mode is a separate later PR. New work uses only `--g-*` tokens, no hardcoded hexes.
5. CS is its own lane (`'cs'`, verb `reply`, 24h SLA) — not merged into sales. **Note:** this means Phase A.1's `Lane` type (`'sales' | 'permit' | 'proof' | 'payment'`) and A.2's `STAGES` record, as literally written in the spec, are incomplete — both must be extended to include `'cs'` and its stages. See "Notes for Phase A" below.
6. The UI labels the payment lane "Payments"; the code keeps the `Finance` key (`REPLY_SLA_HOURS.Finance`).
7. Clicking an order or person always opens the side panel (`useOpenOrder`/`useOpenPerson`), never navigates.
8. Finance stays on one screen at xl (PR #52, merged); the Phase F Owed list scrolls inside its own box.

---

## 1. Sources table

| Lane | Hook / query | Stage field(s) | Date fields for SLA | Owner field | Value field |
|---|---|---|---|---|---|
| **sales** | `fetchActiveJobs`/`fetchAfterPaidJobs`/`fetchExitedJobs` (`src/modules/jobsPipeline/api/jobsPipeline.api.ts:16-54`), wrapped by `useOpportunities` (`src/modules/jobsPipeline/hooks/useOpportunities.ts:10-46`); Today's own pull via `todayRules.ts:22-70` (`salesItems`) | `jobs.stage: JobStage` (free text in DB, closed union client-side) — `src/modules/jobsPipeline/types/jobsPipeline.types.ts:6-13`; `jobs.exit_reason: JobExitReason` — `:23` | `inbox_conversations.last_inbound_at`/`last_outbound_at` (via the job's linked conversation, `todayRules.ts:30-31`); `jobs.created_at` as `sinceAt` (`todayRules.ts:46`) | **None.** No `assigned_to`/owner column on `jobs` (confirmed absent from Row shape, `database.types.ts:1792-1809`) | `enquiries.details->>price` (`jobsPipeline.types.ts:58-65`); `orderTotal(order)` = `orders.value + orders.permit_cost` (`receivables.ts:27`) once an order exists; Gmail-quote extraction `extractQuoteAmount` as highest-priority source, falling back to `MEDIAN_VALUE = 2400` (`opportunities.ts:25,92-97,217-243`) |
| **cs** (own lane, decision 5) | Same `jobs`/`inbox_conversations` tables, filtered to **post-paid** job stages; `todayRules.ts:72-104` (`csItems`), `OPEN_ORDER_STAGES = {confirmed, in_production, fixed}` (`todayRules.ts:72`) | Derived, not stored — "CS" = a `jobs.stage` in the post-paid set, not a column value of its own. Also touches `orders.proof_status === 'Received'` (`todayRules.ts:99`) | Same `inbox_conversations.last_inbound_at`/`last_outbound_at`, matched by `order_id` (`todayRules.ts:80-82`); `orders.created_at` as `sinceAt` (`todayRules.ts:83`) | None | `orderTotal(order)` (same helper as sales) |
| **permit** | Today-only: `todayRules.ts:114-136` (`permitItems`), reading `order_permits` via `useBrandData.ts:35`. Orders-list column reads `orders.permit_status` directly (`orderColumnDefinitions.tsx:20-26`) | **Two parallel, non-interchangeable vocabularies** — see §2. `orders.permit_status` (5 live CHECK values) and `order_permits.permit_phase` (5 different-worded values) | `order_permits.sent_at/.submitted_at/.approved_at/.returned_at` (`database.types.ts:2378-2437`); Today also reads `order_permits.next_action/.waiting_on/.stage_entered_at` (`todayRules.ts:121,124,128-132`) — **these three columns do not appear in the generated `database.types.ts` Row for `order_permits`, and no migration adds them** (see Gaps §5) | None on `order_permits`. `orders.assigned_to` exists generically but is never read alongside permit logic | `orderTotal(order)` — `orders.value + orders.permit_cost`, always folded together (`receivables.ts:27`, confirmed consistent across `orderColumnDefinitions.tsx`, `orderPanel.ts`) |
| **proof** | `orders.proof_status` read in Orders list/sidebar (`orderColumnDefinitions.tsx:27-28`, `OrderDetailsSidebar.tsx:163-169`). **Separate** Proof-Agent system (`order_proofs` table) read only on the Jobs page (`src/modules/jobs/pages/JobsPage.tsx:27,118`) | Two parallel systems — see §2. `orders.proof_status` (8 values incl. one legacy) vs `order_proofs.state` (`ProofState`, 7 values) | `order_proofs.sent_at/.approved_at/.changes_requested_at` (`src/modules/proofs/types/proofs.types.ts:33,35,37`). **`orders.proof_status` has no dedicated stage-entered timestamp at all** — only generic `updated_at` | `order_proofs.approved_by: 'staff_manual' \| 'customer_email' \| 'customer_whatsapp'` (`proofs.types.ts:16,36`) — exists only on the Proof-Agent system, not on `orders.proof_status` | Same `orderTotal(order)` |
| **payment** | Two independent systems — `receivables()`/`financeKpis()` (`src/modules/finance/receivables.ts:109,221`, per-order) and `useFinanceTotals`/`fetchFinanceTotals` (`src/modules/finance/api/finance.api.ts:35`, aggregate stat-strip, reads `orders_with_balance` view + `invoices` table directly) | `invoices.status` (free text; TS union `'draft'\|'pending'\|'paid'\|'overdue'\|'cancelled'`, `invoicing.types.ts:11`, but `'draft'`/`'cancelled'` never written in code); no DB enum (see §Unmapped). Payment "stage" (deposit_due/balance_due/etc.) is **entirely derived**, not a column — see §2 | `invoices.due_date`, `issue_date`, `created_at`, `paid_at` (`invoiceRemaining.ts`); `orders.deposit_date`, `orders.installation_date` (`receivables.ts:106,120,127-133`). **No "last reminder/chase sent" field exists anywhere** (grepped, zero matches) | **None.** `invoices.user_id` exists but is never read/rendered anywhere (`invoicing.api.ts:34` fetches it; no UI consumer found) | `invoices.amount` (GBP decimal) / `amount_remaining`, `amount_paid`, `intended_deposit_pence` (bigint-as-string pence) — canonical helpers in `src/modules/finance/utils/invoiceRemaining.ts` (`invoiceRemainingPence`, `formatInvoiceRemaining`). **`receivables.ts` runs a second, independent GBP-decimal computation that never calls into this file** — the two can diverge (see Gaps §5) |

### Where CS conversations come from, and lane recommendation

There is **no `'cs'` literal, channel, or category column anywhere in the schema or code.** The only conversation-level classifier is the AI ranker's `ai_category: 'sales' | 'support' | 'admin' | 'other'` (`src/modules/inbox/types/inbox.types.ts:57`, DB check at `supabase/migrations/20260910120000_add_inbox_ai_rank_fields.sql:47-48`), labelled `"Support"` (not "CS") in `NeedsAttentionPanel.tsx:70-78` — informational only, drives one chip, not the Hub's CS lane.

What the app actually calls "CS" today is **structural, not tagged**: a conversation/order counts as CS when its linked `jobs.stage` is post-paid (`confirmed`/`in_production`/`fixed`), vs. Sales when it's pre-paid (`enquired`/`quoted`/`invoiced`) — `todayRules.ts:21-28,72`. This split is corroborated by `src/shared/priority/lanes.ts:3-4` ("Sales = Enquiries, CS = Customers").

**Recommendation: keep CS as its own lane** (now locked in by Decision 5). The existing Sales/CS split is already a clean, consistently-applied job-stage boundary across `todayRules.ts`, `customerPriority.ts`, and `opportunities.ts` — folding CS into Sales would require re-deriving that boundary as a `Stage` value instead of a lane, which the rest of the code doesn't do anywhere. One consequence to flag for Phase A: because CS has no stored stage column, `fromConversation()`/a CS adapter will need to derive `stage` the same way `csItems()` does (post-paid job-stage bucket + a sub-branch on complaint/fixing-date/proof-received), not read it off a single field.

---

## 2. Stage mapping

### Sales (canonical: `enquiry`, `quoted`, `won`, `abandoned` — per Decision 2)

| Existing value | Source | Canonical stage | Note |
|---|---|---|---|
| `jobs.stage = 'enquired'` | `jobsPipeline.types.ts:7` | `enquiry` | |
| `jobs.stage = 'quoted'` | `:8` | `quoted` | |
| `jobs.stage = 'invoiced'` | `:9` | `won` | Deal won once an order/invoice exists; matches `BEFORE_PAID_STAGES` ending here |
| `jobs.stage = 'confirmed'` / `'in_production'` / `'fixed'` / `'complete'` | `:10-13` | *(out of sales lane — this is the CS lane's territory, post-paid; `AFTER_PAID_STAGES`, `:20`)* | Not a sales stage once paid; sales lane should treat these as terminal (`won`) and hand off to CS |
| `jobs.exit_reason = 'lost'` | `:23,26` | `abandoned` | Decision 2: all dead-job exits now close as `abandoned`, not `lost` |
| `jobs.exit_reason = 'closed'` | `:23,26` | `abandoned` | |
| `jobs.exit_reason = 'dormant'` | `:23,26` | `abandoned` | |
| `jobs.exit_reason = 'cancelled'` | `:23,29` | `abandoned` | |
| `jobs.exit_reason = 'on_hold'` | `:23,29` | **unmapped** | Not terminal — a pause, not a close. No canonical equivalent in A.2's 4-stage sales list. Flag for Phase A: either add a 5th sales stage or treat as a transient flag on `enquiry`/`quoted` |
| `jobs.exit_reason = 'abandoned'` | `supabase/migrations/20261014203000_jobs_exit_reason_abandoned.sql` | `abandoned` | **Migration written, explicitly marked "NOT APPLIED — needs Arin's approval" (line 1).** The literal `'abandoned'` is **not yet a legal value** in the live `jobs_exit_reason_check` constraint. Decision 2 cannot ship until this migration is applied — flag prominently for Phase A/Giorgi |
| `enquiries.status` (free text, no enum, no CHECK found) | `database.types.ts:559` | **unmapped — unknown value set** | No Postgres enum, no hand-written TS union either. A live-data check (Supabase MCP, per CLAUDE.md) is needed before Phase A can map this column with confidence |
| `inbox_conversations.status = 'open'/'archived'/'closed'` | `inbox.types.ts:29` | not a sales stage | This is conversation lifecycle (open/archived/closed inbox thread), orthogonal to sales stage — do not conflate |
| `inbox_conversations.enquiry_stage = 'new'/'in_progress'/'order_created'` | `inbox.types.ts:43` | `new`→`enquiry`, `in_progress`→`enquiry`/`quoted` (ambiguous), `order_created`→`won` | Coarser 3-value triage field, separate from `jobs.stage`; `in_progress` doesn't map cleanly 1:1 |
| `InquiryPipelineStage` (`'new'\|'quoted'\|'order_created'`, unrouted `inquiries` module) | `inquiries/types/inquiries.ts:3` | n/a | **Dead code path** — this module is not mounted on any route (`src/app/router.tsx:80-82` comment: "Old module: src/modules/inquiries (unrouted)"). Exclude from the mapping; do not build adapters against it |

### Permit (canonical: `not_started`, `form_sent`, `with_family`, `submitted`, `approved`, `rejected`)

Two parallel, non-interchangeable vocabularies exist — flag this duplication itself as a finding.

| Existing value | Source | Canonical stage | Note |
|---|---|---|---|
| `orders.permit_status = 'not_started'` | live CHECK, `orders.types.ts:56` | `not_started` | |
| `orders.permit_status = 'form_sent'` | | `form_sent` | |
| `orders.permit_status = 'customer_completed'` | | **unmapped — gap in canonical set** | Family has completed and returned the form, but it hasn't been submitted to the cemetery yet. Canonical jumps straight from `form_sent`/`with_family` to `submitted`; there's no slot for "back in our hands, not yet submitted." Needs a decision in Phase A: fold into `with_family` (wrong — family no longer holds it) or into `submitted` (wrong — not yet sent to cemetery), or add a stage |
| `orders.permit_status = 'pending'` | | `submitted` | Best fit: pending cemetery decision |
| `orders.permit_status = 'approved'` | | `approved` | |
| *(no live value)* | — | `rejected` | **Canonical stage with no backing DB value.** Neither `orders.permit_status` nor `order_permits.permit_phase` has a rejected/returned-incomplete value today. The not-yet-applied migration `20261014120000_permit_pack_fields.sql:17-21` would add `'returned_incomplete'` (among others) — also **not applied**. Until then, `rejected` cannot be derived from stored data at all |
| `order_permits.permit_phase = 'form_needed'` | `supabase/migrations/20260419120100_permits_five_stage_migration.sql:48-50` | `not_started` | Different vocabulary from `orders.permit_status`, same 5-stage shape |
| `order_permits.permit_phase = 'with_customer'` | | `with_family` | |
| `order_permits.permit_phase = 'completing'` | | `with_family` | |
| `order_permits.permit_phase = 'submitted'` | | `submitted` | |
| `order_permits.permit_phase = 'approved'` | | `approved` | |

### Proof (canonical: `not_started`, `drafting`, `sent`, `changes_requested`, `approved`)

Two parallel systems again: `orders.proof_status` (read by Orders module) and `order_proofs.state` (read only by the Jobs page; no write-back between the two — confirmed by grep, zero cross-references).

| Existing value | Source | Canonical stage | Note |
|---|---|---|---|
| `orders.proof_status = 'NA'` | `proofStatus.ts:9` | **unmapped** | Likely "no proof required for this order type" — semantically distinct from `not_started` (which implies a proof IS needed but hasn't begun). Verify meaning before mapping |
| `orders.proof_status = 'Not_Received'` | | `not_started` (tentative) | Exact semantics not confirmed from code alone — flag for live-data/product check before Phase A locks this mapping |
| `orders.proof_status = 'In_Progress'` (legacy) | `proofStatus.ts:6-7` | `drafting` | Explicitly documented as legacy: "still valid on rows, shown read-only, never offered." `docs/findings.md:429-448` records an in-flight (not yet executed) cleanup to drop this value entirely |
| `orders.proof_status = 'Received'` | | **unmapped — ambiguous** | Could mean "customer's inscription/photo received" (→ feeds `drafting`) or "proof received back from customer" (→ feeds `changes_requested`/`approved`). Don't guess; confirm with Giorgi/product before Phase A |
| `orders.proof_status = 'Sent'` | | `sent` | |
| `orders.proof_status = 'Revision'` | | `changes_requested` | |
| `orders.proof_status = 'Approved'` | | `approved` | |
| `orders.proof_status = 'Lettered'` | | **unmapped — beyond canonical** | Post-approval, stone physically lettered. Canonical proof stages end at `approved`; `Lettered` is a later production step, not a proof stage. Exclude from the proof lane entirely — it belongs to order production/stone tracking, not this spec's proof workflow |
| `order_proofs.state = 'not_started'` | `proofs.types.ts:5-12` | `not_started` | |
| `order_proofs.state = 'generating'` | | `drafting` | |
| `order_proofs.state = 'draft'` | | `drafting` | |
| `order_proofs.state = 'sent'` | | `sent` | |
| `order_proofs.state = 'changes_requested'` | | `changes_requested` | |
| `order_proofs.state = 'approved'` | | `approved` | |
| `order_proofs.state = 'failed'` | | **unmapped** | Technical/rendering failure, not a workflow stage — needs its own handling (retry/error UI), not a `Stage` value |

### Payment (canonical: `not_invoiced`, `deposit_due`, `deposit_paid`, `balance_due`, `paid`)

**No column stores these five stages directly.** They are entirely derived, and the derivation differs between the two parallel payment systems (`receivables.ts` vs `invoiceRemaining.ts`/`finance.api.ts`) — this is itself the most significant mapping gap in the whole document.

| Existing signal | Source | Canonical stage (derived) | Note |
|---|---|---|---|
| No deposit recorded (`orders.deposit_date`/`jobPaidAt` blank), order won | `nextAction.ts:92-93` | `not_invoiced` | Matches the spec's A.4 decision-table row for `payment / not_invoiced` |
| `invoices.status = 'pending'`, no deposit yet | `invoicing.types.ts:11`, `finance.api.ts:69-74` | `deposit_due` | |
| `invoice_payments.status = 'paid'` or `order_payments.status = 'matched'` for the deposit portion | `receivables.ts:63,67` | `deposit_paid` | No single flag marks "this was the deposit" vs "this was the balance" — inferred from amount and order stage, not stored |
| `orders.stone_status = 'In Stock'`, balance unpaid, `installation_date` within `BALANCE_WINDOW_DAYS` (21d) | `nextAction.ts:104-113` | `balance_due` | |
| `invoices.status = 'paid'` | `invoiceAmounts.ts:4` (`DerivedInvoiceStatus`) | `paid` | Ambiguous at the order level: an invoice can be `'paid'` while it was only the deposit invoice — `'paid'` on one invoice row does not necessarily mean the **order** has reached canonical `paid`. Needs order-level aggregation, not a per-invoice read |
| `invoices.status = 'overdue'` | `finance.api.ts:74` (queried as if stored) **vs.** `invoiceTransform.ts:69-75` (computed, comment: "never written, only computed") | n/a — **urgency, not a stage** | Two code paths disagree on whether `'overdue'` is ever persisted. Treat as an urgency/SLA flag on top of `deposit_due`/`balance_due`, never as its own canonical stage |
| `invoices.status = 'void'` / `stripe_invoice_status = 'void'`/`'uncollectible'` | `receivables.ts:187`, `invoiceRemaining.ts:34` | **unmapped** | Administrative/cancelled state, not a workflow stage. Excluded from receivables entirely (`reconciliationFlags`, `receivables.ts:187`) |
| `invoices.status = 'draft'` / `'cancelled'` | TS union only, `invoicing.types.ts:11` | **unmapped — not actually used** | Grepped: never compared/assigned anywhere in `.ts`/`.tsx` logic. Exists in the type, not in practice |
| Unmatched bank line | (no single field — reconciliation flags, `receivables.ts:179,182-208`) | n/a | Spec's A.4 row `payment / unmatched bank line → reconcile` has no direct stage; it's an exception flag layered on top of the stage model, not a stage itself |

### Unmapped values — summary

- `jobs.exit_reason = 'on_hold'` (sales) — a pause, not a canonical terminal state.
- `enquiries.status` — no enum, no CHECK constraint found; unknown live value set, needs a live-data check.
- `orders.permit_status = 'customer_completed'` — gap between `with_family` and `submitted`.
- Canonical permit `rejected` — no backing DB value exists in either permit vocabulary today.
- `orders.proof_status`: `'NA'`, `'Received'`, `'Lettered'` — ambiguous or out-of-scope for the canonical 5-stage proof model.
- `order_proofs.state = 'failed'` — technical error state, not a workflow stage.
- Payment lane as a whole — no column stores `not_invoiced`/`deposit_due`/`deposit_paid`/`balance_due`/`paid` directly; all derived, and derived two different ways in `receivables.ts` vs the Invoicing-tab stat system.
- `invoices.status = 'void'`, `'draft'`, `'cancelled'` — administrative or unused, not workflow stages.
- `'abandoned'` as a stored `jobs.exit_reason` value — migration written, **not applied**.

---

## 3. Existing ranking

19 ranking/sort functions found that influence which work item a user sees first; 14 are materially distinct comparator algorithms (the other 5 are thin wrappers/pass-throughs or de-duped bucket splits over one of the 14).

| # | Function | File:line | Primary key(s) | Tie-break(s) |
|---|---|---|---|---|
| 1 | `compareItems` (Hub) | `src/modules/today/todayModel.ts:119` | 7-tier `Tier` enum (`:23-31`) | **differs per tier**: value desc (QuietQuote) / newest-`lastInAt` (NewEnquiry, WaitingOnUs) / longest-quiet (everything else), then `key` asc |
| 2 | `abandoned.sort` (Hub clean-up card) | `todayModel.ts:164` | `quietDays` desc | — |
| 3 | `closeOrRequote.sort` (Hub clean-up card) | `todayModel.ts:165` | `valueGbp` desc | `quietDays` desc |
| 4 | `todayList` (Pipeline "Today" section) | `src/modules/jobsPipeline/utils/opportunities.ts:159` | `familyWroteRank` (0/1/2) | colour rank (red/amber/blue/green) → continuous `score` desc (`value × p(win) × recency × engagement`) |
| 5 | `rest` sort (Pipeline "Other open deals") | `src/modules/jobsPipeline/components/OpportunitiesView.tsx:106` | `score` desc | — |
| 6 | `byValue` (Pipeline revive/abandoned sections) | `opportunities.ts:166` | `value` desc | — |
| 7 | `upNext` (Pipeline board "Up next") | `src/modules/jobsPipeline/utils/pipelineView.ts:100` | gone-quiet group boundary | `jobValue` desc → `quietDays` desc |
| 8 | `ExitedJobsList` sort | `src/modules/jobsPipeline/components/ExitedJobsList.tsx:38` | `isDueToWake` boolean | stable (`exited_at` desc) |
| 9 | `receivables` sort (Finance "Owed to us") | `src/modules/finance/receivables.ts:151` | colour rank (red/amber/blue/green) | `remaining` desc |
| 10 | `chaseQueue` (sections module, finance-adjacent) | `src/modules/sections/sectionsView.ts:83` | overdue due-date asc | issue-age desc when no due date |
| 11 | Invoicing workspace default sort | `src/modules/invoicing/components/InvoiceWorkspace.tsx:278` | due date asc | fetch order (stable) |
| 12 | `sortOrdersByMode('stone')`/`compareStoneThenAge` (Orders default) | `src/modules/orders/utils/orderDefaultSort.ts:21` | stone-not-ordered boolean | `createdAt` asc |
| 13 | `SortableOrdersTable` header-click sort | `src/modules/orders/components/SortableOrdersTable.tsx:288` | user-chosen column | type-specific asc/desc |
| 14 | `groupOrdersByNextAction` (Orders "Needs action") | `src/modules/orders/utils/orderNextAction.ts:31` | 3-bucket split (needs_us/waiting/nothing_due) | preserves incoming sort order within each bucket — **not an independent rank** |
| 15 | `customerPriorityList` (shared CS/Customers — feeds both Inbox PriorityList and Hub CS lane) | `src/shared/priority/customerPriority.ts:107` | 6-tier urgency ladder | numeric `urgency` sub-rank; also dedupes to one row per `personId` first |
| 16 | `selectNeedsAttentionAll` (Inbox "needs attention" bubble — a 3rd, separate conversation-priority scheme) | `src/modules/inbox/utils/needsAttention.ts:115` | AI `ai_priority` score desc | newest message first; dedupes one conversation per person |
| 17 | `byScoreDesc` (Inquiries board, per-column) | `src/modules/inquiries/components/InquiriesBoard.tsx:20` | AI `EnquiryScore.score` desc | stable; unscored rows last |
| 18 | `autoSchedule` sort (Logistics — drives install scheduling order, not a UI list) | `src/modules/logistics/utils/autoSchedule.ts:81` | priority weight (high/medium/low) | `createdAt` asc → `location` string asc |
| 19 | `topTodos` (sections module) | `src/modules/sections/sectionsView.ts:318` | precomputed `rank` desc | — ⚠️ **dead/unwired**: referenced only by its own test file, no page calls it |

**Inbox `PriorityList.tsx` itself does no ranking** — it's a pure renderer of rows already ranked upstream by `#15` (`customerPriorityList`, CS scope) or `#4`'s wrapper `enquiryPriorityRows` (Sales scope), glued together by `useSharedPriority` (`src/shared/priority/useSharedPriority.ts:10-19`). This confirms `#4` and `#15` are the only two ranking algorithms genuinely **shared** across screens today; the Hub's own `compareItems` (`#1`) is used only when the Hub isn't shared-fed (Permits/Finance lanes).

Count for the spec's "remove the other ranking functions, or make them wrap `rank()`" instruction: **19 functions found; all 19 are candidates for replacement/wrapping except `#14` (`groupOrdersByNextAction`, a grouping step, not a comparator) and `#18` (`autoSchedule`, drives physical logistics scheduling, out of scope for a UI work-item list).**

---

## 4. Existing next-action logic

**30 distinct decision points** found: 24 distinct `Record<key,string>`-style lookup tables (25 counting one exact duplicate), plus 6 branch-based functions that originate verb/label strings without a lookup table.

### Lookup tables (24 distinct; #15/#16 below are an exact duplicate)

| # | Table | File:line |
|---|---|---|
| 1 | `NEXT_ACTION_LABEL` | `src/shared/lib/nextAction.ts:39-45` |
| 2 | `ACTION_VERB` | `src/shared/nextAction.ts:28-36` |
| 3 | `VERB_ICON` | `src/shared/nextAction.ts:39-42` |
| 4 | `ACTION_COLOUR_CLASS` | `src/shared/nextAction.ts:45-50` |
| 5 | `VERB_LABEL` | `src/modules/today/TodayPage.tsx:79` |
| 6 | `PREPARED` | `src/modules/today/TodayPage.tsx:42` |
| 7 | `RANK_RULE` | `src/modules/today/TodayPage.tsx:32-40` |
| 8 | `TIER_LABEL` | `src/modules/today/todayModel.ts:32-40` |
| 9 | `PERMIT_VERB` | `src/modules/today/todayRules.ts:106-112` |
| 10 | `ORDER_GROUP_LABEL` | `src/modules/orders/utils/orderNextAction.ts:25-29` |
| 11 | `ORDER_STAGE_LABEL` | `src/shared/lib/orderStage.ts:14-20` |
| 12 | `AGE_BUCKET_LABEL` | `src/modules/sections/sectionsView.ts:26-32` |
| 13 | `TAB_LABEL` (Finance) | `src/modules/finance/pages/FinanceV2Page.tsx:18` |
| 14 | `SRC_LABEL` (Finance) | `src/modules/finance/pages/FinanceV2Page.tsx:19` |
| 15 | `STAGE_LABEL` (InquiryDetailHeader) | `src/modules/inquiries/components/InquiryDetailHeader.tsx:6-10` |
| 16 | `STAGE_LABEL` (InquiriesBoard, duplicate of #15) | `src/modules/inquiries/components/InquiriesBoard.tsx:7-11` |
| 17 | `ORDER_KPI_LABEL` | `src/modules/orders/utils/orderKpis.ts:10-16` |
| 18 | `ORDER_KPI_HINT` | `src/modules/orders/utils/orderKpis.ts:18-24` |
| 19 | `BUCKET_LABEL` | `src/modules/inbox/utils/inboxBuckets.ts:14-18` |
| 20 | `GROUP_LABEL` | `src/modules/jobsPipeline/components/UpNextList.tsx:16` |
| 21 | `BAND_LABEL` | `src/modules/inbox/components/NeedsAttentionPanel.tsx:47` |
| 22 | `CATEGORY_LABEL` | `src/modules/inbox/components/NeedsAttentionPanel.tsx:70-74` |
| 23 | `CHANNEL_LABEL` | `src/modules/inbox/components/CustomerConversationView.tsx:31-36` |
| 24 | `CHANNEL` (local to TodayPage) | `src/modules/today/TodayPage.tsx:23` |

(Items 15/16 are byte-identical duplicates — `new/quoted/order_created` — but note both belong to the **unrouted** `inquiries` module (§2), so neither feeds a live screen.)

### Branch-based verb/label originators (6)

1. `nextActionForOrder` / `nextActionForEnquiry` — `src/shared/lib/nextAction.ts:87-143`. Header comment (`:1-12`) notes: **"Permit and proof steps were removed (Arin, Oct 2026): next-step generation no longer suggests permit or proof work."** `permitStatus`/`proofStatus` remain on the input type only so callers still compile.
2. `todayRules.ts` lane builders (`salesItems`, `csItems`, `permitItems`, `financeItems`) — `src/modules/today/todayRules.ts:22-166`.
3. `jobNextStep` — `src/modules/jobsPipeline/utils/pipelineView.ts:54-69`.
4. `buildOpportunity`'s `action` assignment — `src/modules/jobsPipeline/utils/opportunities.ts:131-148`.
5. `customerPriorityItem`'s `mk()` calls — `src/shared/priority/customerPriority.ts:87-104`.
6. `inboxRowAction.ts`'s `conversationPrimary`/`rowExplanation` — `src/modules/inbox/utils/inboxRowAction.ts:149-253`.

### Pill/box rendering components (not label sources, but the contract the spec's `WorkRow`/`ActionPill` must preserve)

- `src/shared/components/mason/ActionPill.tsx` — `ActionPill`, `WaitingChip`, `NextActionPill`, `ActionChip`, all delegating to `nextActionStyle()` (`src/shared/nextAction.ts:67-73`).
- `src/shared/components/mason/NextStepBox.tsx` — note the file's own comment: **"HELD pending the next mockups"** — not currently wired into a live screen.
- `src/modules/inbox/components/ConversationNextStepBar.tsx` — live, used in the Inbox conversation view.
- `src/modules/orders/components/OrderContextPanel.tsx:102-111` — its own local `primary` button-label table (`deposit`→"Request deposit", `balance`→"Request balance", `order`→"Create invoice", `follow`→"Reply"), separate from all 24 tables above.

**Direct conflict with Phase A/A.4 for Giorgi to weigh:** the spec's A.4 decision table requires adapters that generate `send_permit`/`chase_council`/`fix_permit`/`send_proof`/`chase_proof`/`revise_proof` verbs — but the current canonical next-action engine (`nextAction.ts`) had permit/proof verb generation **deliberately removed** per a prior Arin decision (Oct 2026, same month). Phase A reintroduces exactly what was just removed; flag this to confirm it's an intentional reversal before building `fromOrderPermit()`/`fromOrderProof()`.

---

## 5. Gaps

Fields/state that would need schema (or at least a tracked migration) for permits, proofs, and payments to become first-class WorkItems, plus other things the spec assumes that don't exist yet:

- **Permit `rejected` stage has no backing value.** Neither `orders.permit_status` (5 live values) nor `order_permits.permit_phase` (5 values, different wording) has a rejected/returned state. `supabase/migrations/20261014120000_permit_pack_fields.sql` would add `'returned_incomplete'` plus `permit_fee_paid_to_cemetery_at`/`permit_submitted_at`/`permit_approved_at`/`permit_missing_fields` — **file explicitly marked "WRITTEN ONLY — NOT APPLIED. Review with Giorgi before applying to prod"** (line 2).
- **`jobs.exit_reason = 'abandoned'` is not a legal value yet.** `supabase/migrations/20261014203000_jobs_exit_reason_abandoned.sql` would widen the CHECK constraint — **marked "NOT APPLIED. Needs Arin's approval"** (line 1). Decision 2 (sales terminal = won + abandoned) cannot be written to the DB until this lands; client-side derivation (treating any of the 5 existing exit reasons as "abandoned" for display) can proceed in the meantime, as the spec's rule 3 allows ("derive it client-side and note it in the PR description under 'Needs schema'").
- **Permit stage-started timestamps used by the live Today lane may not exist.** `todayRules.ts:121,124,128-132` reads `order_permits.next_action`, `.waiting_on`, `.stage_entered_at` — none of these three columns appear in the generated `database.types.ts` Row for `order_permits` (`database.types.ts:2378-2437` lists only `sent_at/submitted_at/approved_at/returned_at/specs_completed_at/created_at/updated_at`), and no migration in `supabase/migrations/` adds them. Either they were added by hand via the Dashboard (permitted per `supabase/CLAUDE.md`) and the generated types are stale, or this is a live bug reading non-existent columns. **Needs a live-DB check (Supabase MCP) before Phase A trusts this field set** — per CLAUDE.md, "a code path existing is not evidence any row exercises it."
- **No owner/assignee field for permits, proofs (on the `orders.proof_status` path), or payments.** `order_permits` has no owner column; `orders.assigned_to` exists but is never read alongside permit/proof/payment logic. The Proof-Agent system's `order_proofs.approved_by` is the only owner-shaped field found, and it only answers "who approved," not "who's responsible right now."
- **Payment canonical stages (`not_invoiced`/`deposit_due`/`deposit_paid`/`balance_due`/`paid`) have no backing column at all.** They're derived from a combination of `orders.deposit_date`, `stone_status`, `installation_date`, and invoice/payment amounts — and derived **two different, non-reconciled ways** (`receivables.ts`'s colour-bucket branch chain vs. `invoiceRemaining.ts`/`finance.api.ts`'s due-date/status bucketing). A `useWorkItems`/`fromReceivable()` adapter needs to pick one derivation as canonical or risk the Hub, Finance, and Orders showing different payment stages for the same order.
- **No "last reminder/chase sent" timestamp exists anywhere** (`reminder_sent`, `last_reminder`, `chased_at` — zero matches repo-wide). The `'Chase'` action label is computed purely from age, with no record of whether a chase was actually sent. This matters for the spec's `chase` verbs across sales/permit/proof/payment — none can currently tell "we chased 2 days ago" from "we've said nothing in 30 days."
- **A `workflow_slas` table already exists in the schema** (`organization_id, workflow, stage, target_days, warn_days, max_days` — `database.types.ts:4502-4538`, migration `20260419120200_workflow_slas.sql`) but is **read/written by zero application code.** This is a provisioned-but-unused generic SLA config table — a plausible home for the permit/proof stage-SLA data the spec's B.1 `SLA` table hardcodes, worth flagging to Giorgi as an alternative to another hardcoded constant.
- **`cemeteries.avg_approval_days` is captured but never consumed** by any permit SLA/ranking logic (`todayRules.ts`, `permitPins.ts`, `inboxBuckets.ts`, `customerPriority.ts` all ignore it) — another unused signal that could feed permit SLA computation later.
- **Two independent, inconsistent permit-chase thresholds already exist in production**: Today's permit lane chases after 7d (customer) / 14d (cemetery) (`todayRules.ts:129-132`), while the Inbox "cemetery" bucket uses 15d amber / 29d red (`inboxBuckets.ts:36,47-51`, inherited from the removed `permitTracker` module). Phase B's single `SLA` table needs to reconcile these, not add a third number.
- **Two parallel proof systems never reconcile** (`orders.proof_status` vs `order_proofs.state`) and two parallel permit systems never reconcile (`orders.permit_status` vs `order_permits.permit_phase`) — confirmed via grep, no cross-references between either pair. Any proof/permit adapter has to pick one source per lane; mixing both risks contradictory stage reads for the same order.
- **Finance file/export naming is confusing and worth noting for anyone touching Phase F**: the router-facing `FinancePage` component is defined inside `FinanceV2Page.tsx` (`src/modules/finance/index.ts:1`, `FinanceV2Page.tsx:37`), while the file literally named `FinancePage.tsx` on disk exports a component called `FinanceInvoicesTab`. Not a gap to fix in Phase 0, but a landmine for Phase F file edits.
- **`src/shared/components/mason/NextStepBox.tsx` is unwired** ("HELD pending the next mockups") — the spec's Phase G explicitly says to reuse it; confirm it still matches current visual-pass styling before wiring it in, since it predates PR #51/#52.

---

## Role checks

- **`canViewFinancials(role)`** — `src/shared/lib/canViewFinancials.ts:9-11`: `role === 'admin' || role === 'member'`; fails closed for `'staff'`/null/unknown. `OrganizationRole = 'admin' | 'member' | 'staff'` (`src/modules/organizations/types/organization.types.ts:6`). Wired into context as `OrganizationContextValue.canViewFinancials` (`src/shared/context/OrganizationContext.tsx:232`).
- **`RequireFinancials`** — `src/app/components/RequireFinancials.tsx:15-22`, a route guard. Gates `/dashboard/payments` and `/dashboard/reporting` (`src/app/router.tsx:92,94`) — redirects to `/dashboard` if not permitted. **`/dashboard/finance` itself is not route-guarded** (`router.tsx:76`); Finance instead self-restricts its own tabs/figures at render time (below).
- **`useCanSeeMoney()`** — `src/app/components/useCanSeeMoney.ts:4-7`, same underlying rule, `!isLoading && role !== null && !!canViewFinancials`. Gates: Finance tab visibility + KPI strip + `FinanceFlow` widget (`FinanceV2Page.tsx:41,45,76-79,95,98`), and money display on the Today/Hub page (`TodayPage.tsx:105`).
- **Reconcile tab specifically**: no separate/stricter gate — it uses the exact same `canViewFinancials`/`canSeeMoney` boolean as every other Finance tab (`FinanceV2Page.tsx:45,98`), forced back to `'invoices'` for disallowed roles. This is **UI-level only, not a data-access boundary** — the `invoices` table's RLS migration has no role-based policy clause, only org scoping (confirmed by reading `supabase/migrations/20250608000002_create_invoices_table.sql`). A `staff`-role user's Supabase client could still fetch the underlying rows directly; only the render path hides them.
- **Fetch-level (not just render-level) gating**: `useFinanceTotals`/`useConfirmedOrdersStat` disable their React-Query fetch entirely when `!canViewFinancials` (`src/modules/finance/hooks/useFinance.ts:16,31`) — a real exception to the "UI-only" pattern above, for those two specific queries only.
- **`AdminContext`/`useAdmin()`** — `src/app/layout/AdminContext.tsx:12-16`, an email-allowlist check against `VITE_ADMIN_EMAIL`, unrelated to org roles. **Zero consumers found anywhere in the codebase** — dead scaffolding, gates nothing today.
- **`isOrgAdmin`** — `OrganizationContext.tsx:231` (`role === 'admin'`, stricter than `canViewFinancials`). Only consumed in Settings (Gmail/WhatsApp connection controls, `SettingsPage.tsx:221,230`) — not a Finance gate.
- **For Phase F's "move Reconcile into an admin-only tab, gated by the existing role check"**: the existing check is `canViewFinancials` (admin **or** member), not `isOrgAdmin` (admin only). If Phase F genuinely wants admin-only, that's a stricter gate than anything currently applied to Reconcile — confirm with Giorgi which is intended before implementing, since the spec's own wording ("admin-only tab... find it in Phase 0") doesn't distinguish the two.

---

## Notes for Phase A

- **`Lane` type needs a 5th member.** Decision 5 locks in `'cs'` as its own lane, but A.1's `Lane = 'sales' | 'permit' | 'proof' | 'payment'` and A.2's `STAGES`/`TERMINAL` records as literally written in the spec don't include it. Phase A must add `'cs'` to `Lane`, define its `Stage` set (there is no stored stage column to copy from — derive from `todayRules.ts:csItems()`'s own branching: family-waiting / fixing-soon / proof-received / nothing-due), and give it a `Verb` (`reply`, per Decision 5) and an SLA entry (24h, already in `replySla.ts`).
- **A.4's permit/proof verbs reverse a very recent decision.** `nextAction.ts`'s header comment says permit/proof next-step generation was deliberately removed in Oct 2026 "(Arin, Oct 2026)" — the same month as this spec. Confirm with Giorgi this is an intentional reversal, not a stale comment, before building `fromOrderPermit()`/`fromOrderProof()`.
- **Permit/proof adapters must each pick one source table.** `orders.permit_status` vs `order_permits.permit_phase`; `orders.proof_status` vs `order_proofs.state`. They're not kept in sync. Recommend the richer, timestamp-bearing tables (`order_permits`, `order_proofs`) since A.1's `WorkItem.since`/`dueAt` need real stage-entry timestamps, which only those two tables carry — but verify `order_permits.next_action`/`waiting_on`/`stage_entered_at` actually exist live first (see Gaps).
- **`fromReceivable()` must pick one "owed" computation.** `receivables.ts` and `invoiceRemaining.ts`/`finance.api.ts` disagree on inputs and can produce different totals for the same order. Recommend `invoiceRemaining.ts` as canonical per existing CLAUDE.md guidance ("Canonical helpers... use them; do not re-derive"), and treat `receivables.ts`'s colour-bucket logic as the thing being replaced by `rank()`/`computeUrgency()`, not reused.
- **`rank()` replaces 19 functions, not a handful.** Budget Phase B for auditing all 19 call sites listed in §3, not just the ones named in the spec text (Hub/Inbox/Pipeline/Finance/Orders) — Logistics' `autoSchedule` and the unwired `topTodos` also showed up and need an explicit in/out-of-scope call.
- **`abandoned` as a stored value is blocked on an unapplied migration.** Phase A/B can derive "abandoned" client-side from the existing 5 exit reasons (per spec rule 3), but the PR description should say "Needs schema: `20261014203000_jobs_exit_reason_abandoned.sql`, awaiting Arin's approval" rather than silently working around it forever.
- **Two near-identical `nextAction` files already exist** (`src/shared/lib/nextAction.ts` — order/enquiry rule engine; `src/shared/nextAction.ts` — universal rendering/colour layer) with similarly-named but different-shaped tables (`NEXT_ACTION_LABEL` vs `ACTION_VERB`/`VERB_LABEL`). A.3's "one label table, used by every screen" needs to consolidate both, not just the ones named in the spec (`TodayPage`'s `VERB_LABEL`/`PREPARED`).
