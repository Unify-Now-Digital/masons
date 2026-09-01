# Feature Specification: Finance Consolidation

**Feature Branch**: `feature/finance-consolidation` *(to be created by Giorgi from `staging`; CC does not run git)*
**Created**: 2026-09-01
**Status**: Draft
**Input**: User description: "finance-consolidation — consolidate the Finance page into a single view: summary ribbon, aging tiles as the filter, one full-column invoice table." Written against the F2 investigation report (`~/.claude/plans/task-f2-finance-snazzy-squid.md`); every file:line claim below traces to it. Do not re-investigate; re-verify only on line shift.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single-page finance triage (Priority: P1)

A masonry business owner opens `/dashboard/finance` and sees, in one scroll, the summary ribbon, the unpaid-balances aging tiles, and the full invoice table. Clicking an aging tile filters the table to that bucket; clicking **All** shows everything. There are no tabs; there is no second page to visit.

**Why this priority**: This is the consolidation itself — the Hub/Invoices tab split is the thing being removed. Everything else layers on the merged page.

**Independent Test**: Load `/dashboard/finance` as an SM user; confirm ribbon + tiles + table render in one flow with no tab strip; click each tile and confirm the table filters without remounting.

**Acceptance Scenarios**:

1. **Given** the SM org with its live invoices, **When** the Finance page loads, **Then** the page shows (top to bottom) the 5-tile summary ribbon, the 5 aging tiles (≤7d / 7–30d / 30+d / Not yet due / All), and the invoice table — no Hub/Invoices tab strip, no status tabs, no Due-horizon section.
2. **Given** a named SM overdue invoice, **When** its aging tile is clicked, **Then** the table shows only invoices in that bucket (hub-eligibility semantics: `status='pending'`, not void, `amount ≥ £5`, owed) and the named invoice appears in exactly one bucket.
3. **Given** an active aging tile, **When** the **All** tile is clicked, **Then** the table shows the full row set — paid invoices included, void rows dimmed — with no filter applied.
4. **Given** a row expanded and a search term entered, **When** the active tile changes, **Then** the expanded row, search text, column state, and open detail sidebar all survive (the table is never unmounted/remounted by filtering).

---

### User Story 2 - Full-detail invoice table (Priority: P2)

The owner sees every money fact per invoice in one table: existing columns plus Main product total, Additional options total, Permit total cost, Remaining, a payment progress bar in the Paid column, the Stripe payment-link actions, and a new hideable **Days overdue** column carrying the Hub row's chase signal. The shared column picker controls visibility and persists per browser.

**Why this priority**: "Hub format wins" plus maximal columns is the product ask; without it the merge loses the Hub's chase information.

**Independent Test**: Open the column picker, confirm the full column set (no phantom `actions`), toggle Days overdue off/on, reload the browser, confirm the choice persisted.

**Acceptance Scenarios**:

1. **Given** the default column state (fresh browser), **When** the table renders, **Then** all columns are visible by default (maximal), including the three order-derived money columns, Remaining, and Days overdue.
2. **Given** a partially paid invoice, **When** its row renders, **Then** the Paid column shows the `PaymentProgressBar` (ported from the Hub row) alongside the paid amount/%.
3. **Given** an overdue hub-eligible invoice, **When** its row renders, **Then** the Days overdue column shows the Hub chase signal ("N days overdue · due DD Mon" / "due in n days" / "no reliable due date" per `FinancePage.tsx:534-545` semantics).
4. **Given** a column hidden via the picker, **When** the page is reloaded, **Then** the choice is restored from localStorage key `'invoices_column_state'`.

---

### User Story 3 - Find and order invoices (Priority: P3)

The owner searches by invoice number, customer name, or amount, and the table is sorted by due date ascending by default.

**Why this priority**: Usability layer over the merged table; independent of the merge and the columns.

**Independent Test**: Type an amount that matches exactly one invoice; confirm one row remains. Clear search; confirm rows are ordered by due date ascending.

**Acceptance Scenarios**:

1. **Given** the unfiltered table, **When** no search is active, **Then** rows are sorted by due date ascending (new sort machinery — none exists today; fetch order is `created_at desc`, `invoicing.api.ts:46`).
2. **Given** a search term, **When** it matches an invoice number, customer, or amount (amount matching is new — today only customer + number, `InvoiceWorkspace.tsx:433-435`), **Then** only matching rows show; the client filter never triggers a refetch.

---

### User Story 4 - Voided invoice visibility (Priority: P4) *(rewritten 2026-09-02, C4b ruling)*

Void invoices (display status 'void': `isVoidedStripeInvoice` and not `status='paid'`) are hidden by default and revealed by a "Show voided" toggle. When shown they appear only under **All**, dimmed, and never count toward the four aging tiles or the two hub-derived ribbon tiles. (Enquiry `INV-WEB-` predicate retired — see the note under FR-011.)

**Why this priority**: Correctness polish; dead Stripe paper must not read as chaseable balance.

**Independent Test**: With toggle off, confirm 0 void rows anywhere; toggle on + All tile → all void rows appear, dimmed, "Void" badges (SM 8 incl. the 4 INV-WEB- rows; Churchill 1, as of 2026-09-01). No data is modified.

**Acceptance Scenarios**:

1. **Given** the toggle off (default), **When** any tile is active, **Then** no void row is visible and none contributes to tile aggregates.
2. **Given** the toggle on and the **All** tile active, **Then** void rows render dimmed; under the four aging tiles they still do not appear (void-excluded by the classifier).
3. **Given** a void invoice shown via the toggle, **When** its status badge renders, **Then** it shows "Void", not "Pending" (bug fix: badge must respect display status, `invoiceColumnDefinitions.tsx:386-399` vs `invoiceTransform.ts:76-82`).

---

### Edge Cases

- **No reliable due date**: rows whose bucket is `null` (unreliable due date) match none of the four aging tiles; they are visible under **All** only, with the Days overdue column showing "no reliable due date".
- **Churchill renders near-empty**: 1 non-deleted invoice, and it is void — expect a table empty under every aging tile and, with the void toggle off (default), empty under All too; toggle on → one dimmed row under All. This is correct, not a bug.
- **`status='paid'` with null Stripe amounts**: canonical rule is `status='paid'` ⇒ remaining 0 (fold `computeTotals`' override into the canonical helper; resolves the documented divergence with `invoiceRemainingPence`, F2 §1).
- **`order_id IS NULL`**: the three order-derived columns (Main product / Additional options / Permit) render 0 — view-join behaviour, unchanged.
- **Money units**: `amount` is decimal £; `amount_paid` / `amount_remaining` are bigint pence returned as JS strings — `Number()` before arithmetic, never ×100 again.
- **Test-data toggle**: `is_test` filtering applies to the single unified fetch, so tiles and table always agree (today the Hub fetch never filters `is_test`; the table does — F2 §1).
- **Empty/error states**: the unified fetch needs its own loading, error, and empty states (the Hub's, `FinancePage.tsx:418-445,501-503,584`, die with HubTab); the `allHorizonZero`-style "nothing owed" empty state is kept/re-derived.

## Requirements *(mandatory)*

### Functional Requirements

**Layout (givens — decided, do not re-open)**

- **FR-001**: `/dashboard/finance` MUST render, top to bottom: summary ribbon (unchanged five tiles: Total order balance, Invoiced & unpaid, Collected this month, Expected this month, Overdue), the "Unpaid balances" aging tiles, and the invoice table. No tab shell.
- **FR-002**: The aging tiles MUST be ≤7d / 7–30d / 30+d / Not yet due plus a new **All** tile, and MUST be the only list filter. The Invoices status tabs (All/Unpaid/Pending/Overdue/Paid — five today, `InvoiceWorkspace.tsx:535-542`) are removed.
- **FR-003**: The four aging tiles MUST keep hub-eligibility semantics (`isHubEligibleInvoice`, `invoiceRemaining.ts:203-209`: pending, not void, amount ≥ £5, owed) and bucket via `getOverdueAgingBucket` (`invoiceRemaining.ts:157-166`). **All** = no filter: full table, paid included, void rows dimmed.
- **FR-004**: The Due horizon section (`FinancePage.tsx:576-617`) MUST be deleted, and its five dependents (F2 §2) kept or re-derived: (1) Not-yet-due tile (`horizon.due30 + dueLater`), (2) Overdue ribbon secondary count, (3) `overdueAging` partitions, (4) empty-state, (5) `handleHorizonNavigate` — only its live `workspaceStatusFilter` leg needs a successor (tile activation).
- **FR-005**: Row expansion (order sub-rows with Edit/Delete/Add Order, lock-gated per T5 `isInvoiceLocked`) and the detail sidebar via `?invoice=` MUST behave exactly as today.

**Table & columns**

- **FR-006**: The table MUST use the shared `tableViewPresets` column picker with module id `'invoices'` (already mounted, `InvoiceWorkspace.tsx:784-791`); no new module id.
- **FR-007**: Default columns MUST be maximal: every current column + Main product total + Additional options total + Permit total cost + Remaining + progress bar (port `PaymentProgressBar` into the Paid column) + Stripe payment-link column (Full/Partial/Link, already present `invoiceColumnDefinitions.tsx:18-152,413-427`) + a new hideable **Days overdue** column carrying the Hub row's chase signal (`FinancePage.tsx:534-545` text variants).
- **FR-008**: Picker state MUST persist in localStorage key `'invoices_column_state'` as today; per-browser is the accepted meaning of per-user. The dead DB `table_view_presets` layer stays dead (org-shared, would violate per-user; reviving drags in 3 baseline tsc items).
- **FR-009**: `defaultColumns.ts` MUST be synced to the real invoice column set: drop phantom `'actions'` (`defaultColumns.ts:45`), add the new columns.

**Behaviour**

- **FR-010** *(rewritten 2026-09-02, C4b)*: Void invoices (display status 'void': `isVoidedStripeInvoice` and not `status='paid'`) MUST be hidden by default; a "Show voided" toggle reveals them. Data is never modified.
- **FR-011** *(rewritten 2026-09-02, C4b)*: Void rows MUST be visible only with the toggle on, and then dimmed — under **All** only (void rows never bucket); excluded from the four aging tiles and from the two hub-derived ribbon tiles (Invoiced & unpaid, Overdue — already true today, preserved) regardless of toggle. The order-balance-derived ribbon tiles (Total order balance, Expected this month) are order-side and are **not** redefined — a void invoice's order still carries `balance_due`; this limit is accepted and stated, not fixed.
- **Note (2026-09-02, ruled)**: the enquiry-invoice predicate (`INV-WEB-%`) and its toggle are retired, superseded by the void toggle — the website enquiry flow now creates Pipeline jobs, not invoices; INV-WEB- is a closed set of 4 rows, all void. The shared-schema "real enquiry column" backlog item is no longer needed.
- **FR-012**: Default sort MUST be due date ascending — implement client sorting (none exists; `sortable` flags are decorative). Header-click sorting is out of scope (backlog).
- **FR-013**: Search MUST client-filter over invoice number, customer, and amount (amount matching is new work).
- **FR-014**: Filtering (tiles, search, toggle) MUST never unmount/remount the table. Must-survive state: `expandedInvoices`, detail sidebar (`?invoice=`, keep URL-driven) + `focusCollectPayment`, column state (localStorage), search text, active tile. No forceMount machinery needed — the tab split's unmount problem evaporates in a single view; just never key-remount the table on filter change.

**Data unification**

- **FR-015**: One fetch from `invoices_with_breakdown` (org-guarded, `deleted_at IS NULL`, `is_test` per the test toggle) MUST feed both the tiles and the table. Buckets/aggregates computed client-side with the canonical `invoiceRemaining.ts` helpers (`buildFinanceHubSummary` may stay as the tiles' engine, fed from the table's row set).
- **FR-016**: Retire: `useFinanceInvoices` (exists only for the tab-label count, `FinancePage.tsx:220`) and the Hub's separate fetch (`fetchFinanceHubInvoices`).
- **FR-017**: Remaining MUST unify on `invoiceRemainingPence`, folding in the rule `status='paid'` ⇒ remaining 0. Retire `invoiceAmounts.computeTotals` and the inline re-derivation at `invoiceColumnDefinitions.tsx:364-367`. Keep `isVoidedStripeInvoice` in exactly ONE place (currently duplicated: `invoiceRemaining.ts:28-34` + `invoiceTransform.ts:37-42`).

**Fixes in passing**

- **FR-018**: Void badge bug: status badge respects display status ("Void", not amber "Pending").
- **FR-019**: `fetchFinanceTotals` gains `deleted_at IS NULL` on its raw `invoices` query (`finance.api.ts:58-62` — 35 of 49 live-org rows are soft-deleted), and the two `no-constant-binary-expression` lint errors at `finance.api.ts:95-96` are removed.

**Deletions**

- **FR-020**: Delete: tab shell (`FinancePage.tsx:196-224`), `TabButton`, `HubTab` (`:363-620`), `InvoicesTab` (`:839-1003`), `InvoiceDrawer` (`:1005-1218` — note it holds the only per-order Permit/Options breakdown UI; loss accepted), dead state (`:70,76,85-89`), unused `isReliableDueDate` import (`:45`); `InvoicingPage.tsx` + its export (`invoicing/index.ts:1`); `useFinanceInvoices`; the flag-gated `BalanceChaseTab` / `ExtrasTab` / `PaymentsTab` / AI banner (off since 2026-07-19 — **delete**, git keeps them; add a backlog line).
- **FR-021**: The word "Hub" disappears as a Finance tab label (`FinancePage.tsx:198`). The sidebar `/dashboard/hub` page is a DIFFERENT module and is out of scope — do NOT touch `src/modules/hub/`, `Sidebar.tsx:43-44`, `router.tsx:69`, `PriorityPage`.
- **FR-022**: `PageShell.tsx:57` stale Finance subtitle rewritten — no balance-chase/AI mention.

### Architectural Constraints *(mandatory when relevant)*

- **AC-002 (Module boundaries)**: the merged page keeps finance code in `src/modules/finance/`, invoicing table code in `src/modules/invoicing/`; shared predicates stay in `src/modules/finance/utils/invoiceRemaining.ts` (already the canonical home per CLAUDE.md money rules).
- **AC-F1 (tsc baseline)**: baseline items in touched files (F2 §12): `finance.api.ts(174,15)`; `invoicing.api.ts(49,10)`; `CreateInvoiceDrawer.tsx(338,55),(425,55)`; `EditInvoiceDrawer.tsx(100,7),(115,9),(149,22)`; `InvoiceWorkspace.tsx(87,29),(621,31)`; `OrderFormInline.tsx(83,7)` — 10 certain; `tableViewPresets.api.ts(31,15),(41,37)` + `PresetsTab.tsx(65,7)` only if the preset layer is touched. Re-anchor on line shift **in the same commit**; never add items. Item-diff, never counts.
- **AC-F2 (lint)**: counts must not grow (baseline 10 err / 19 warn, count-only). Deleting `finance.api.ts:95,96` shrinks; refactors must not add.
- **AC-F3 (commit sequence)**: one concern per commit; suggested order: (1) data unification + remaining helper, (2) tile filter + All + Due-horizon deletion, (3) table columns + defaults + Days overdue + progress bar, (4) sort + search + enquiry toggle + void dim/badge, (5) deletions + subtitle, (6) docs.
- **AC-F4 (no schema change)**: none. A real enquiry-marker column is a shared-schema backlog item with the portal team, not this feature.
- **AC-F5 (tests)**: no new component tests are possible (no DOM test env). Verification = browser on staging against the named records below + gates. The two pure-util test files (`invoiceTransform.test.ts`, `ensureStripeInvoice.test.ts`) must stay green.

### Key Entities

- **Invoice row** (from view `invoices_with_breakdown`): `amount` (decimal £), `amount_paid`/`amount_remaining` (bigint pence-as-string), `main_product_total`/`additional_options_total`/`permit_total_cost` (decimal £, 0 when `order_id IS NULL`), `invoice_number` (carries the `INV-WEB-` enquiry prefix), `status`, `stripe_invoice_status`, `due_date`, `deleted_at`, `is_test`, `organization_id`.
- **Aging bucket**: client-side classification of a hub-eligible invoice into ≤7d / 7–30d / 30+d / Not yet due / null (unreliable due date), via `getOverdueAgingBucket` + horizon predicates.
- **Column state**: per-browser localStorage record (`'invoices_column_state'`) of visibility/order for module `'invoices'`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `/dashboard/finance` issues exactly one `invoices_with_breakdown` list request per load (plus the unchanged `fetchFinanceTotals` order-side queries); tile counts and table rows always derive from the same row set (no tile/table disagreement is reproducible via the test-data toggle).
- **SC-002**: Tile switches, search, and the enquiry toggle change visible rows with zero refetches and zero table remounts (expanded row + sidebar + search text survive every switch).
- **SC-003**: Gates: tsc item-diff = baseline (re-anchored, 0 new), lint ≤ 10/19 (the 2 errors at `finance.api.ts:95-96` gone), build green, the two util test files green.
- **SC-004**: All verification targets below pass on staging.

### Verification targets (named up front)

1. A named SM overdue invoice: appears in exactly one aging tile's filtered view; dim rules never apply to it.
2. Void rows behind the toggle (SM 8 as of 2026-09-01, incl. the 4 `INV-WEB-` rows; Churchill 1): expect them **only** under All with the toggle on, dimmed; never in aging tiles.
3. One expanded row surviving a tile switch (and the `?invoice=` sidebar surviving it too).
4. Column-picker persistence across a full browser reload.
5. Churchill renders near-empty: 1 non-deleted invoice, void — empty under all four tiles, one dimmed row under All.
6. External callers of the retired routes keep working (verification only — the `/dashboard/invoicing` → `/dashboard/finance` redirect with query preservation already exists, `router.tsx:33-38,94`; nothing to build): `inbox/components/OrderContextSummary.tsx:153` (`?invoice=`), `payments/components/OutstandingTab.tsx:42`, `hub/pages/HubPage.tsx:62`, `PriorityPage.tsx:15,19,207` / `priority.api.ts:118` (`route:'finance'`).
7. `?invoice=`, `?focus=`, `?stripe=success`, `?pay=success`, `?focus=collect` param handling all still function on the merged page (`FinancePage.tsx:66-68,110-119`; `InvoiceWorkspace.tsx:90-193,440-477`).
8. **Ribbon baseline (ruled 2026-09-01, per flagged tension 2)**: capture SM's rendered **Invoiced & unpaid** and **Overdue** ribbon values on staging **before commit 1**; after the re-derivation they must equal the captured values for the same data.

## Assumptions

*(Spec decisions made where the givens were silent; each is the working rule unless Giorgi overrides.)*

- **A-1 (void toggle scope, rewritten 2026-09-02)**: the toggle filters the working row set **before** bucketing. Zero tile/ribbon effect (void rows are hub-ineligible and never bucket), but the rule keeps tiles and table on one dataset.
- **A-2 (null-bucket rows)**: invoices with no reliable due date match none of the four tiles and are visible under **All** only (today they show whenever no tile is active; under the new model "no tile active" doesn't exist — All is the home for them).
- **A-3 (Days overdue content)**: the new column renders the Hub chase-signal text variants verbatim ("N days overdue · due DD Mon" / "due in n days" / "no reliable due date"); it is display-only, hideable, and participates in nothing else.
- **A-4 (branch name)**: `feature/finance-consolidation`, created by Giorgi from `staging`.
- **A-5 (Overdue ribbon secondary count)**: re-derived from the unified row set with unchanged semantics; displayed value must equal today's for the same data.

## Flagged tensions — F2 map vs the givens *(not silently resolved)*

1. **PARTIAL amber pill and priority ordering have no home.** The givens carry the Days-overdue chase signal into a column and replace Hub priority ordering (`attentionListSortKey`: partial+overdue first) with due-date-asc — but the PARTIAL pill (`FinancePage.tsx:528-532`, `getAttentionFlags`) is mentioned nowhere. **RULED 2026-09-01 (Giorgi): accept the loss.** The Status column's "Partially paid" covers it; no Partial marker in the Days overdue column.
2. **"Summary ribbon unchanged" requires re-derivation, not preservation.** Invoiced & unpaid and Overdue are computed by `buildFinanceHubSummary` over the Hub fetch being retired (FR-016). They must be re-fed from the unified row set with identical semantics. Rendered values must not change for the same data — this is a re-implementation dressed as "unchanged", and a named verification point (target 8: pre-commit-1 baseline capture). **RULED 2026-09-01: flags 2–4 accepted as specced.**
3. **Hub loading/error/empty states die with HubTab** (`FinancePage.tsx:418-445,501-503,584`). The givens keep only the horizon empty-state dependent. The unified fetch needs its own loading/error/empty treatment — small new UI the givens don't mention.
4. **The enquiry toggle's present-day payoff is near zero** (F2 §3: SM 5 rows, 4 non-deleted, all void; Churchill 0). Build it as specced, but expect verification target 2 to be its entire observable effect. Backlog items attached: real enquiry-marker column (shared-schema, portal team); Awaiting-Arin purge of old enquiry invoices interacts with this.

## Out of scope

- `/dashboard/invoicing` redirect — already shipped with query preservation; verification only.
- Header-click sorting (backlog).
- The sidebar `/dashboard/hub` module, `Sidebar.tsx:43-44`, `router.tsx:69`, `PriorityPage` — different Hub, untouched.
- Schema changes of any kind; enquiry-marker column is portal-team backlog.
- New tests beyond keeping the two existing util test files green.
- Reviving the DB `table_view_presets` layer.
