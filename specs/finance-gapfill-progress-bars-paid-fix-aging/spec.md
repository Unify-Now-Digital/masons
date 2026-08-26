# Feature Specification: Finance Gap-Fill — Progress Bars, Paid Fix, Overdue Aging

**Feature Branch**: `feature/finance-gapfill-progress-bars-paid-fix-aging`
**Created**: 2026-08-26
**Status**: Draft — awaiting Giorgi review before `/speckit.plan`
**Input**: User description: "Finance cycle: gap-fill on the existing /dashboard/finance page
(Hub tab + Invoices tab), NOT a new surface. Progress bars in invoice table rows, Paid column
data fix, overdue aging sub-buckets, recent-first default, Stripe line-item label audit."
Amendments A1–A5 applied per Giorgi approval 2026-08-26; aging shape decided (Hub
sub-buckets) per Giorgi amendment 2026-08-26.

> **Surface note (from Step 0 audit)**: the Finance page has two invoice tables. The slim
> `InvoicesTab` inside `src/modules/finance/pages/FinancePage.tsx:759` is dormant
> (`SHOW_SECONDARY_FINANCE_TABS = false`, superseded 2026-07-19). The **live** Invoices tab is
> `InvoiceWorkspace` (`src/modules/invoicing/components/InvoiceWorkspace.tsx`), mounted at
> `FinancePage.tsx:256`. All work in this spec targets the live surface.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paid column shows true paid amounts (Priority: P1)

A mason opens the Invoices tab and looks at a paid invoice. Today, invoices with
`status = 'paid'` whose payment never went through the Stripe webhook path (offline-paid rows
flipped via Dashboard SQL, legacy/pre-Stripe rows, paid-then-voided Stripe invoices) render
**"£0.00 (0%)"** in the Paid column and the full amount in the Remaining column — contradicting
the Paid status badge on the same row. After this fix, a paid invoice reads paid = total,
remaining = £0.00, 100%.

**Why this priority**: It is wrong money data on a live surface, and every other item in this
cycle (progress bars especially) inherits the same numbers. Blocked-by root of the cycle.

**Independent Test**: With a `status='paid'` invoice whose `amount_paid` is NULL, the Paid
column shows the full total with (100%) and Remaining shows £0.00 (0%). Stripe-paid invoices
(with real `amount_paid`/`amount_remaining`) are unchanged.

**Audit findings (Step 0, 2026-08-26) — root cause evidence**:

- Paid column reads `invoice.amountPaidPence` / `totalPence`
  (`src/modules/invoicing/components/invoiceColumnDefinitions.tsx:313`); percent computed at
  `:318–319` as `paid / totalPence * 100`. Remaining column mirror logic at `:334–344`.
- Both fields come from `computeTotals`
  (`src/modules/invoicing/utils/invoiceAmounts.ts:21–37`):
  `paidPence = parsePence(invoice.amount_paid) ?? 0`; when `amount_remaining` is null,
  `totalPence` falls back to `Math.round(amount * 100)`.
- Pence-string coercion is **correctly handled** (`parsePence` at `invoiceAmounts.ts:6–10`
  does `Number()`, no double-×100). Coercion is *not* the culprit.
- **Root cause**: `computeTotals` trusts `amount_paid` alone, with no fallback for
  `status = 'paid'` rows where `amount_paid` is NULL (or 0). For those rows
  `paidPence = 0`, `totalPence = amount × 100` → "£0.00 (0%)", while the Status column
  independently reads `derivedStatus`/`status` and shows Paid.
- **Fix seam (decided)**: the rule lives in `computeTotals` (invoicing module), NOT the
  finance helpers — one decision point that Paid, Remaining, `computeDerivedStatus`, and the
  new bars all inherit.

**Fallback rule (A2)**: when `status = 'paid'` → `paidPence = totalPence`,
`remainingPence = 0`, applied inside `computeTotals`, covering the Paid column, the Remaining
column, and every percent derived from them.

**Precondition (A2) — SELECT-first verification, both orgs, ships only on zero rows**:
run read-only in the Supabase Dashboard SQL editor *before* implementing the rule. Any
returned row means a genuinely-partial invoice is marked `paid` and the blanket rule would
mask real money — in that case STOP and report to Giorgi; do not ship the rule.

Placeholders — substitute the real org UUIDs from CLAUDE.local.md when pasting into the
Dashboard; never commit real UUIDs to this file.

```sql
-- Read-only precondition for the status='paid' fallback rule (FR-001).
-- Org-guarded: the two live orgs only; any other org (incl. the mystery org) excluded.
SELECT id, organization_id, invoice_number, status, amount,
       amount_paid, amount_remaining,
       ROUND(amount * 100)::bigint AS total_pence
FROM invoices
WHERE organization_id IN (
        '<CHURCHILL_ORG_ID>',    -- substitute from CLAUDE.local.md at paste time
        '<SEARS_MELVIN_ORG_ID>'  -- substitute from CLAUDE.local.md at paste time
      )
  AND deleted_at IS NULL
  AND status = 'paid'
  AND (
        (amount_paid IS NOT NULL AND amount_paid > 0
          AND amount_paid < ROUND(amount * 100)::bigint)
     OR (amount_remaining IS NOT NULL AND amount_remaining > 0)
      );
-- Expected: 0 rows. Paste the actual output into the implementation record when run.
```

> **Implementation record — precondition RUN 2026-08-26** (Giorgi, Supabase Dashboard,
> read-only; UUIDs substituted from CLAUDE.local.md per plan A0):
> Output: `Success. No rows returned` (zero rows).
> **Verdict: PASS — FR-001 fallback rule cleared to ship.**

**Acceptance Scenarios**:

1. **Given** an invoice with `status='paid'`, `amount_paid` NULL, `amount_remaining` NULL,
   **When** the Invoices table renders, **Then** Paid shows the full total "(100%)" and
   Remaining shows "£0.00 (0%)".
2. **Given** an invoice with `status='paid'` and Stripe-written `amount_paid = total`,
   `amount_remaining = 0`, **When** the table renders, **Then** output is identical to today
   (rule is a fallback, not an override of consistent data — though with the zero-row
   precondition the forced and stored values coincide).
3. **Given** a `pending` invoice with a partial `amount_paid`, **When** the table renders,
   **Then** Paid/Remaining are unchanged from today (rule keys on `status='paid'` only).
4. **Given** the precondition query returns ≥1 row, **Then** the rule does NOT ship and the
   rows are reported to Giorgi.

---

### User Story 2 - Payment progress bars in invoice table rows (Priority: P2 — centerpiece, blocked by US1)

A mason scans the Invoices table and sees, per row, a small progress bar showing how much of
the invoice is paid — the same visual language as the Hub "Needs attention" list — without
opening the detail sidebar.

**Why this priority**: The centerpiece of the cycle, but **blocked by US1**: bar percent is
derived from `computeTotals` output, so shipping bars first would render 0% bars on paid
invoices and bake the bug into a more prominent visual.

**Independent Test**: After US1 lands, every row in the Invoices table shows a bar whose fill
percent equals the Paid column's percent for that row, across all five status tabs.

**Component extraction (A4)**: the existing bar is not a component — inline divs at
`FinancePage.tsx:458–469` (Needs-attention rows: h-1.5, red `--g-red-dk` track, green
`--g-grn-dk` fill) and a second variant in the dormant `InvoiceDrawer`
(`FinancePage.tsx:998–1006`). Extract a shared `PaymentProgressBar` (props: percent, optional
tone) and adopt it in:

- **In scope**: Hub Needs-attention rows (`FinancePage.tsx:456–470`) + the new Invoices table
  cell (new column in `invoiceColumnDefinitions.tsx`).
- **Explicitly OPTIONAL / deferred**: the dormant `InvoiceDrawer` swap — flag-hidden code,
  not worth the regression surface this cycle.

**Placement constraint**: finance already imports from invoicing (`FinancePage.tsx:13`), and
invoicing must not import finance (cycle risk documented in
`src/modules/invoicing/utils/invoiceTransform.ts:34–36`). Since both modules consume the bar,
it MUST live under `src/shared/` (AC-002).

**Percent-source rule (A1)**: the table bar computes percent from the **fixed `computeTotals`
output** (`amountPaidPence` / `totalPence` already on `UIInvoice`), **NOT** from
`computePercentPaid` (`src/modules/finance/api/finance.invoices.api.ts:64–71`).
`computePercentPaid` depends on `invoiceRemainingPence`, which carries the same
paid-status blind spot — see the known-unfixed footnote under Requirements. The Hub
attention rows keep their existing `computePercentPaid` call (Hub never renders Paid rows,
so it is safe there); only the visual is swapped onto the shared component.

**Acceptance Scenarios**:

1. **Given** a pending invoice 40% paid, **When** the table renders, **Then** its row bar
   fills to the same rounded percent shown in the Paid column.
2. **Given** a paid invoice (post-US1), **When** the table renders, **Then** the bar shows
   100%.
3. **Given** the Hub Needs-attention list, **When** it renders after the swap, **Then** bars
   are visually unchanged (same geometry/colors) and percentages identical to before.
4. **Given** an invoice with `totalPence == null` (unusable amounts), **Then** the bar cell
   renders the same "—" the Paid column shows, never a 0% bar.
5. **Given** mobile viewport (<md), **Then** the bar column follows the existing
   `mobilePriority` column rules (hidden unless marked primary — default: hidden).

---

### User Story 3 - Overdue aging sub-buckets ≤7d / 7–30d / 30+d (Priority: P3)

A mason wants to see *how* overdue the overdue money is, split into ≤7 days, 7–30 days, and
30+ days past due, to prioritise chasing.

**Why this priority**: Valuable, shape decided (Giorgi, 2026-08-26), but sits behind the
money-correctness work (US1) and the centerpiece (US2) in this cycle.

**Independent Test**: With overdue invoices seeded at 3, 15, and 45 days past due, the Hub
Due-horizon Overdue segment shows three sub-buckets counting 1/1/1, and clicking a
sub-bucket opens the matching invoice list.

**Decided shape**: sub-bucket the Due horizon "Overdue" segment on the Hub
(`FinancePage.tsx:496–537`, segment config `:355–364`, bucketing
`src/modules/finance/utils/invoiceRemaining.ts:108` `getInvoiceHorizonBucket`) into
≤7d / 7–30d / 30+d, **extending the existing segment row pattern** — same tile/segment
construction, counts, and balance display as the current four segments. Clicking a
sub-bucket opens the matching invoice list exactly like existing segments do today
(`handleHorizonNavigate`, `FinancePage.tsx:96–101`) — no new behavior class.

**Deferred alternative (not rejected)**: aging tabs/filters on the Invoices status tab
strip (`InvoiceWorkspace.tsx:554–561`). Revisit only if Arin asks after seeing the Hub
version.

Bucket definitions: days past due `d` with `d ≤ 7`, `7 < d ≤ 30`, `d > 30`,
computed from `due_date` vs today (existing `daysOverdue` at
`src/modules/invoicing/utils/invoiceTransform.ts:50–52` or `getInvoiceHorizonBucket`-style
date math; unreliable due dates — `isReliableDueDate`,
`invoiceRemaining.ts:100` — never enter an aging bucket).

**Acceptance Scenarios**:

1. **Given** an overdue invoice 3 days past due, **Then** it counts in ≤7d and no other
   bucket (buckets are disjoint, boundary days belong to the earlier bucket).
2. **Given** an invoice with a placeholder due date (≥ `UNRELIABLE_DUE_DATE_FLOOR`),
   **Then** it appears in no aging bucket.
3. **Given** the three sub-buckets, **Then** their counts and balances sum to the current
   Overdue segment's count and balance (partition, nothing dropped or double-counted).
4. **Given** a click on any aging sub-bucket, **When** it has count > 0, **Then** the
   Invoices tab opens filtered the same way the existing Overdue segment click filters
   today; a zero-count sub-bucket is disabled like existing zero-count segments.

---

### User Story 4 - Recent-first default sort (Priority: — already satisfied, no work)

**Audit verdict**: the live Invoices table already renders recent-first. `fetchInvoices`
orders `created_at` descending (`src/modules/invoicing/api/invoicing.api.ts:46`); neither
`useInvoicesList` nor `InvoiceWorkspace.filteredInvoices` (`InvoiceWorkspace.tsx:444–457`,
filter only) re-sorts. Recorded as **already-satisfied**; no requirement, no task. (The
dormant slim tab sorts `due_date` ascending — `finance.invoices.api.ts:108` — irrelevant
while flag-hidden.)

---

### Edge Cases

- `status='paid'` with `amount_paid` present but `< total`: excluded by the FR-002
  precondition — the rule does not ship if such rows exist.
- `status='paid'` with `amount_remaining > 0` present: same precondition gate.
- Voided/uncollectible Stripe invoice that is also `status='paid'` (offline-paid then voided
  to prevent double payment — see `invoiceTransform.ts:54–64`): fallback rule applies (keys
  on `status`), showing 100% paid — correct, the money was collected offline.
- `amount` NULL/non-finite → `totalPence == null` → Paid, Remaining, and bar all render "—".
- Zero-amount invoices (`totalPence === 0`): percent guard already returns 0; bar renders
  empty, not NaN.
- Pence fields arriving as JS strings from Supabase: already coerced via `Number()` in
  `parsePence`; the bar MUST consume the parsed pence numbers, never raw row fields.
- Aging boundary: an invoice exactly 7 days past due sits in ≤7d; exactly 30 days in 7–30d.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `computeTotals` (`src/modules/invoicing/utils/invoiceAmounts.ts`) MUST apply
  the fallback rule: `status='paid'` ⇒ `paidPence = totalPence`, `remainingPence = 0` —
  a single decision point inherited by the Paid column, the Remaining column,
  `computeDerivedStatus`, and all derived percents.
- **FR-002**: FR-001 MUST NOT ship until the precondition SQL in User Story 1 has been run
  read-only against production (both live orgs, mystery org excluded) and returned **zero
  rows**, with the actual output pasted into the implementation record. Non-zero → stop,
  report to Giorgi.
- **FR-003**: The Invoices table MUST gain a per-row payment progress bar whose percent is
  computed from the fixed `computeTotals` output (`amountPaidPence`/`totalPence` on
  `UIInvoice`) — NOT from `computePercentPaid` (A1).
- **FR-004**: The bar MUST be an extracted shared `PaymentProgressBar` component under
  `src/shared/`, adopted by the Hub Needs-attention rows and the new table cell. The dormant
  `InvoiceDrawer` swap is OPTIONAL/deferred (A4).
- **FR-005**: The bar column MUST integrate with the existing column system
  (`invoiceColumnDefinitions.tsx`): visibility toggle, drag order, resize, mobile rules —
  following the Orders-header event discipline (stopPropagation on new header controls if
  any are added).
- **FR-006**: The Hub Due-horizon "Overdue" segment MUST be sub-bucketed into
  ≤7d / 7–30d / 30+d by extending the existing segment row pattern
  (`FinancePage.tsx:355–364` config + `getInvoiceHorizonBucket`-style date math), with
  sub-bucket clicks opening the matching invoice list exactly as existing segment clicks do
  (`handleHorizonNavigate`) — no new behavior class, display/filter only per AC-004. The
  Invoices tab-strip aging filter is a DEFERRED ALTERNATIVE (not rejected): revisit only if
  Arin asks after seeing the Hub version.
- **FR-007** (documentation task, not implementation): Stripe line-item label audit — record
  and verify the four sync-by-comment implementations of the order line label rule:
  `src/modules/orders/utils/orderLineLabel.ts:10` (client canon; its header names the server
  copies) and the three edge functions `supabase/functions/stripe-create-invoice/index.ts`,
  `supabase/functions/stripe-create-invoice-payment-link/index.ts`,
  `supabase/functions/stripe-create-checkout-session/index.ts`. Deliverable: a
  divergence-check note (do the four produce identical labels for the same order today?),
  filed as an audit finding — NO code changes to any of the four in this cycle.

### Architectural Constraints *(mandatory when relevant)*

- **AC-002 (Module boundaries)**: `PaymentProgressBar` lives in `src/shared/` because both
  finance and invoicing consume it and invoicing must not import finance (cycle risk
  documented at `invoiceTransform.ts:34–36`).
- **AC-003 (RLS as boundary)**: no new queries; all reads go through existing org-scoped
  fetches (`invoices_with_breakdown` with `organization_id` filter).
- **AC-004 (Read-only over money data)**: invoice age is display/filter only — it MUST never
  drive routing and never trigger a write. The entire feature is read-only over existing
  money data: no INSERT/UPDATE/DELETE, no migration, no schema change. The only production
  DB interaction this cycle is the read-only precondition SELECT in FR-002.
- **AC-005 (Units trap)**: `amount` is decimal GBP pounds; `amount_paid`,
  `amount_remaining`, `intended_deposit_pence` are bigint pence returned as JS strings —
  always `Number()` before math, never multiply by 100 again, and NEVER mix pounds and pence
  in one expression. All bar math is single-unit (pence) end to end: percent =
  `paidPence / totalPence`, both from `computeTotals`.
- **AC-006 (Formatter reuse)**: reuse `formatGbpDecimal` / `formatGbpPence`
  (`src/shared/lib/formatters.ts`, commit 12d81fe) — no new formatters without a
  demonstrated gap. The bar itself renders no currency text; adjacent text reuses the
  existing column formatting.

**Known-unfixed footnote (A1)**: `invoiceRemainingPence`
(`src/modules/finance/utils/invoiceRemaining.ts:65–80`) and its dependent
`computePercentPaid` (`finance.invoices.api.ts:64–71`) carry the same `status='paid'` blind
spot as pre-fix `computeTotals` (a paid row with NULL `amount_paid`/`amount_remaining`
yields remaining = full total). It is **latent** today: the Hub population is
pending-status-only (`isFinalizedPendingWithBalance`, `invoiceRemaining.ts:154`), so Paid
rows never render there. Deliberately NOT fixed this cycle. **Follow-up note**: if any
future surface feeds Paid rows into these helpers, port the FR-001 rule (or better, have
them delegate to `computeTotals`) first.

**Considered and rejected (A3) — DB backfill of `amount_paid`/`amount_remaining` on paid
rows**: rejected because it is a live-money write to both production orgs (out of scope per
AC-004 and the multi-tenancy guardrails), and it would not prevent recurrence — future
Dashboard-flipped offline-paid rows would reintroduce NULL `amount_paid` immediately. The
display-layer fallback in `computeTotals` handles past and future rows alike with zero
writes.

### Key Entities

- **Invoice** (`invoices` / view `invoices_with_breakdown`): `amount` (decimal pounds),
  `amount_paid` / `amount_remaining` (bigint pence as JS strings), `status`
  (`draft|pending|paid|overdue|cancelled`), `due_date`, `stripe_invoice_status`,
  `deleted_at`, org-scoped by `organization_id`. Read-only this cycle.
- **UIInvoice** (`invoiceTransform.ts:5`): derived display shape carrying
  `amountPaidPence` / `amountRemainingPence` / `totalPence` / `derivedStatus` — the bar's
  sole data source.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `status='paid'` invoices in the live table show Paid = total (100%)
  and Remaining = £0.00 (0%); zero rows show the "Paid badge + £0.00 (0%)" contradiction.
- **SC-002**: Every invoice row with usable amounts shows a progress bar whose fill matches
  the Paid column percent exactly (same source values); rows with `totalPence == null` show
  "—", never a misleading empty bar.
- **SC-003**: Hub Needs-attention bars are pixel-equivalent before/after the shared-component
  swap (no visual regression), verified by side-by-side comparison.
- **SC-004**: Zero database writes from this feature (precondition SELECT is the only
  production DB interaction, and it is read-only).
- **SC-005**: `npx tsc --noEmit -p tsconfig.app.json` output diffs clean against
  `specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt` (use `--strip-trailing-cr` on
  Windows) — zero new items; lint no new errors vs 10/19 baseline.
- **SC-006**: FR-007 audit note filed answering the four-implementation divergence question
  with file:line evidence.

## Assumptions

- The two live orgs (Churchill, Sears Melvin) are the only rows in scope for the
  precondition; any other `organization_id` (including the mystery org) is excluded by the
  IN-list and out of scope.
- `status='paid'` is trustworthy as ground truth for "money fully collected" — the FR-002
  zero-row precondition is what validates this assumption against real data before the rule
  ships.
- The dormant slim `InvoicesTab` and `InvoiceDrawer` stay flag-hidden this cycle; no work
  targets them beyond the optional deferred drawer swap noted in FR-004.
- Overdue aging (US3) ships this cycle in the decided Hub sub-bucket shape; the
  Invoices-strip variant stays a deferred alternative pending Arin's reaction to the Hub
  version. Nothing in US1/US2 depends on US3.
- Out of scope entirely: offline-payment recording, mark-as-customer, Stripe write-path
  changes, schema changes.
