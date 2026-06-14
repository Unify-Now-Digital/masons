# Tasks: Finance Hub — Outstanding Invoice Triage

**Input**: Design documents from `specs/014-finance-hub-triage/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/finance-hub-triage.md, quickstart.md

**Tests**: Not requested — manual verification per [quickstart.md](./quickstart.md) plus explicit regression checks below.

**Locked decisions** (do not substitute alternatives):
- Test/seed exclusion = **`amount >= 5` GBP floor** only — **never** filter on `is_test`
- Org scope = **`useOrganization()` / `OrganizationContext` only** — no hardcoded `organization_id`
- Remaining balance = **`invoiceRemaining.ts` helpers at all three call sites** (hub, table ~572, drawer ~695) in one pass
- Website-origin = **include** finalized `pending` with real balance; **exclude** unfinalized `draft` only
- Units = pounds/pence conversion **only inside** shared helper
- Unreliable date = `due_date >= '2100-01-01'` **OR null** → no-date bucket only

**Organization**: Tasks grouped by user story. **MVP** = Phase 1 + Phase 2 + Phase 3 (US1 headline hub).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline and read design artifacts before code changes

- [X] T001 Confirm feature branch `014-finance-hub-triage` is checked out; run `npm run lint` for clean baseline
- [X] T002 [P] Read [contracts/finance-hub-triage.md](./contracts/finance-hub-triage.md) and [quickstart.md](./quickstart.md); skim existing remaining-balance ternaries in `src/modules/finance/pages/FinancePage.tsx` (~572 table cell, ~695 drawer row)
- [X] T003 [P] Read `src/modules/finance/api/finance.invoices.api.ts` (`computePercentPaid`, `fetchFinanceInvoices`) and `src/shared/context/OrganizationContext.tsx` (org id source)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared helpers, eligibility rules, hub data layer, and **single-pass remaining refactor at all three call sites** — **MUST complete before user story UI work**

**⚠️ CRITICAL**: No Hub tab UI tasks until T004–T015 complete.

- [X] T004 Create `src/modules/finance/utils/invoiceRemaining.ts` with constants `UNRELIABLE_DUE_DATE_FLOOR = '2100-01-01'` and `MIN_HUB_INVOICE_AMOUNT_GBP = 5`; export `InvoiceRemainingInput` type
- [X] T005 Implement `invoiceRemainingPence(row)` in `src/modules/finance/utils/invoiceRemaining.ts`: `amount` pounds → pence via `Math.round(amount * 100)`; `amount_paid` / `amount_remaining` as pence; prefer `amount_remaining` when non-null; else derive from amount minus paid; return `max(0, …)`
- [X] T006 Implement `isInvoiceOwed(row)` and `formatInvoiceRemaining(row)` in `src/modules/finance/utils/invoiceRemaining.ts`: owed when `invoiceRemainingPence > 0`; display via `formatGbpPence` from `@/shared/lib/formatters` (no pounds/pence conversion outside this file)
- [X] T007 Implement date/horizon helpers
- [X] T008 Define finalized-pending-with-balance detection in `src/modules/finance/utils/invoiceRemaining.ts` as `isFinalizedPendingWithBalance(row)`: `status === 'pending'` AND `isInvoiceOwed(row)` — document in file comment that this **includes** website-origin invoices (e.g. `INV-WEB-*`) once finalized to `pending` with a real balance; unfinalized/abandoned website drafts remain excluded because `status === 'draft'` is not fetched
- [X] T009 Define hub eligibility in `src/modules/finance/utils/invoiceRemaining.ts` as `isHubEligibleInvoice(row)`: `isFinalizedPendingWithBalance(row)` AND `Number(row.amount) >= MIN_HUB_INVOICE_AMOUNT_GBP` (test/seed floor — **do not** reference `is_test`)
- [X] T010 Create `src/modules/finance/api/finance.hub.api.ts`: `fetchFinanceHubInvoices(organizationId)` querying `invoices_with_breakdown` with `.eq('organization_id', organizationId)` (parameter only — **never** hardcode org id), `.is('deleted_at', null)`, `.eq('status', 'pending')`, `.gte('amount', MIN_HUB_INVOICE_AMOUNT_GBP)`; **no** `is_test` filter; client filter with `isHubEligibleInvoice` then `isInvoiceOwed`
- [X] T011 Implement `buildFinanceHubSummary(rows)` in `src/modules/finance/api/finance.hub.api.ts`: compute `totalOutstandingGbp`, `unpaidCount`, `totalOverdueGbp`, horizon counts/balances, sorted `attentionList` using helpers from `invoiceRemaining.ts`
- [X] T012 Create `src/modules/finance/hooks/useFinanceHub.ts`: read `organizationId` from `useOrganization()` only; `queryKey: ['finance', 'hub', organizationId]`; `enabled: !!organizationId`; call `fetchFinanceHubInvoices` + `buildFinanceHubSummary`
- [X] T013 Refactor `computePercentPaid` in `src/modules/finance/api/finance.invoices.api.ts` to derive totals from `invoiceRemainingPence` + paid pence via shared helper (import from `invoiceRemaining.ts`)
- [X] T014 **Verify** after T013: open Finance → Invoices tab on a workshop with partial-paid rows; confirm progress bar **percent paid** values match pre-refactor behaviour (no rounding drift) — record pass/fail in PR notes
- [X] T015 Replace Invoices **table remaining cell** (~line 572) in `src/modules/finance/pages/FinancePage.tsx`: remove inline `amount_remaining != null ? formatGbpPence : formatGbpDecimal` ternary; use `formatInvoiceRemaining(row)` from `invoiceRemaining.ts`
- [X] T016 Replace **InvoiceDrawer remaining row** (~line 695) in `src/modules/finance/pages/FinancePage.tsx`: same — use `formatInvoiceRemaining(invoice)` only; no duplicate remaining math
- [X] T017 Wire hub attention-list remaining display in `src/modules/finance/pages/FinancePage.tsx` (or stub in `HubTab` placeholder): use `formatInvoiceRemaining(row)` — third call site; **no other remaining-balance formatting in finance module**

**Checkpoint**: All three remaining call sites use shared helper; hub fetch + summary pure functions ready; org id flows from context only

---

## Phase 3: User Story 1 — See what is owed at a glance (Priority: P1) 🎯 MVP

**Goal**: Hub landing tab with headline figures (total outstanding, unpaid count, total overdue) scoped to active org

**Independent Test**: Open Finance → lands on Hub; three headline tiles match sum of `formatInvoiceRemaining` / drawer values for each eligible pending invoice; switching org updates figures.

### Implementation

- [X] T018 [US1] Extend `Tab` union and default state in `src/modules/finance/pages/FinancePage.tsx`: add `'hub'`; `useState<Tab>('hub')`; add first `TabButton` label **Hub**
- [X] T019 [US1] Implement `HubTab` headline section in `src/modules/finance/pages/FinancePage.tsx`: three `TotalTile` (or equivalent) bound to `useFinanceHub()` — outstanding GBP, unpaid count, overdue GBP; reuse existing top-ribbon currency formatting pattern
- [X] T020 [US1] Add loading, error (+ retry via `refetch`), and all-zero empty states for headline section in `HubTab` within `src/modules/finance/pages/FinancePage.tsx`
- [X] T021 [US1] Wire `useFinanceHub()` at page level in `src/modules/finance/pages/FinancePage.tsx`; render `HubTab` when `tab === 'hub'`; leave Balance-chase / AI changes / Recent payments / Invoices tab bodies unchanged

### Verification

- [X] T022 [US1] Manual verify headline totals: sum drawer “Remaining” for each hub-eligible invoice equals headline outstanding (SC-002); confirm invoices with `amount < 5` absent; confirm no hardcoded org id in `src/modules/finance/api/finance.hub.api.ts` or `useFinanceHub.ts`

**Checkpoint**: MVP — Hub tab default with trustworthy headline figures

---

## Phase 4: User Story 2 — Prioritise partial and overdue invoices (Priority: P1)

**Goal**: Attention list with PARTIAL / OVERDUE flags, priority sort (partial+overdue first)

**Independent Test**: Workshop with partial-only, overdue-only, partial+overdue, and fully paid pending rows — only owed ≥£5 appear; flags and sort order correct; row opens drawer with matching remaining.

### Implementation

- [X] T023 [US2] Implement attention list UI in `HubTab` within `src/modules/finance/pages/FinancePage.tsx`: map `summary.attentionList`; show invoice number, customer, `formatInvoiceRemaining`, due date when `isReliableDueDate` else “No date”
- [X] T024 [US2] Add PARTIAL and OVERDUE `Pill`s per row using `getAttentionFlags` from `invoiceRemaining.ts` in `src/modules/finance/pages/FinancePage.tsx`
- [X] T025 [US2] Apply `attentionListSortKey` ordering from summary builder (partial+overdue → overdue → partial → other) in `src/modules/finance/api/finance.hub.api.ts` / displayed list
- [X] T026 [US2] Attention list row click sets `selectedInvoice` and opens existing `InvoiceDrawer` in `src/modules/finance/pages/FinancePage.tsx`
- [X] T027 [US2] Attention list empty state copy when no owed eligible invoices in `src/modules/finance/pages/FinancePage.tsx`

### Verification

- [X] T028 [US2] Manual verify: partial+overdue row ranks first; fully paid (`isInvoiceOwed` false) absent; INV-WEB / website pending with balance included when `status='pending'` and amount ≥ 5

**Checkpoint**: US1 + US2 — triage list addresses second-payment fear

---

## Phase 5: User Story 3 — Triage by due-date horizon (Priority: P2)

**Goal**: Four-segment horizon strip routing to Invoices tab with pre-applied filters

**Independent Test**: Click each horizon segment → Invoices tab opens on Unpaid with matching subset; invoice with `due_date >= 2100-01-01` or null appears only under No reliable date.

### Implementation

- [X] T029 [US3] Add `FinanceInvoiceHorizonFilter` type (`'overdue' | 'due-30' | 'due-later' | 'no-date' | null`) and `horizonFilter` state in `src/modules/finance/pages/FinancePage.tsx`
- [X] T030 [US3] Implement horizon strip UI in `HubTab` in `src/modules/finance/pages/FinancePage.tsx`: four clickable segments showing count (+ optional balance from summary); segments for Overdue, Due within 30 days, Due later, No reliable date; **empty state** when all horizon counts are zero; **shared error state** (message + retry via `useFinanceHub().refetch`) when hub fetch fails — same pattern as headline section (FR-018)
- [X] T031 [US3] Horizon segment click handler in `src/modules/finance/pages/FinancePage.tsx`: `setTab('invoices')`, `setStatusFilter('unpaid')`, `setHorizonFilter(segment)`
- [X] T032 [US3] Pass `horizonFilter` into `InvoicesTab` in `src/modules/finance/pages/FinancePage.tsx`; when non-null, filter displayed rows with `isHubEligibleInvoice(row) && getInvoiceHorizonBucket(row) === horizonFilter`
- [X] T033 [US3] Clear or preserve `horizonFilter` when user changes status pills manually in `src/modules/finance/pages/FinancePage.tsx` (document chosen UX in code comment; default: clear horizon when pill changes away from Unpaid)

### Verification

- [X] T034 [US3] Manual verify horizon buckets per [quickstart.md](./quickstart.md): `due_date = 2099-12-31` buckets normally; `due_date = 2100-01-01` only in No reliable date; null due only in No reliable date; segment counts match filtered Invoices tab rows

**Checkpoint**: Full hub triage + drill-down routing complete

---

## Phase 6: User Story 4 — Drill into detail without number drift (Priority: P2)

**Goal**: Hub, table, and drawer show identical remaining figures (SC-001 / SC-002)

**Independent Test**: Sample ≥5 invoices — hub list, table column, and drawer remaining all match `invoiceRemainingPence` for same id.

### Verification

- [X] T035 [US4] Manual cross-surface audit in `src/modules/finance/pages/FinancePage.tsx`: for 5+ hub-listed invoices, compare hub attention remaining, Invoices table remaining column, and drawer remaining — zero mismatches
- [X] T036 [US4] Grep guard: `rg "amount_remaining != null" src/modules/finance/` returns no remaining-display ternaries outside `invoiceRemaining.ts` (paid column excepted)

**Checkpoint**: SC-001 / SC-002 satisfied

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Lint, docs touch-up, final smoke

- [X] T037 [P] Run `npm run lint` on `src/modules/finance/`; fix any issues introduced
- [X] T038 Confirm [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/finance-hub-triage.md](./contracts/finance-hub-triage.md), and [quickstart.md](./quickstart.md) stay aligned with locked rules (`amount >= 5` test floor, no `is_test`, `2100-01-01` unreliable date, finalized-pending website rule); update verification table in quickstart if implementation deviates
- [X] T039 [P] Full Finance page smoke per quickstart: default Hub tab, all four horizon routes, existing Balance-chase / AI / Payments tabs still load
- [X] T040 Confirm top order-based ribbon (`useFinanceTotals`) unchanged in `src/modules/finance/pages/FinancePage.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) — BLOCKS all user stories
    ↓
Phase 3 (US1) ── MVP checkpoint
    ↓
Phase 4 (US2) — depends on US1 HubTab shell + summary
    ↓
Phase 5 (US3) — depends on US1 summary.horizon + InvoicesTab
    ↓
Phase 6 (US4) — verification after T015–T017 + US2/US3
    ↓
Phase 7 (Polish)
```

### User Story Dependencies

| Story | Depends on | Can start after |
|-------|------------|-----------------|
| US1 (P1) | Phase 2 complete | T017 |
| US2 (P1) | US1 HubTab shell | T021 |
| US3 (P2) | US1 summary horizons | T021 |
| US4 (P2) | T015–T017 + hub list | T026 |

### Within Phase 2 (strict order)

```text
T004–T009 (invoiceRemaining.ts) → T010–T011 (hub API) → T012 (hook)
T004–T006 → T013 → T014 (computePercentPaid + verify)
T004–T006 → T015, T016, T017 (three call sites — parallel after T006)
```

---

## Parallel Execution Examples

### Phase 2 — after T006 completes

```bash
# Three call-site refactors in parallel (different line regions, same file — coordinate merge):
T015: Table remaining cell ~572 in FinancePage.tsx
T016: Drawer remaining row ~695 in FinancePage.tsx
T017: Hub attention remaining in FinancePage.tsx

# Independent file:
T013: computePercentPaid in finance.invoices.api.ts  → then T014 verify
```

### Phase 1 — all parallel

```bash
T002: Read contracts/quickstart
T003: Read existing finance API + OrganizationContext
```

### Phase 7

```bash
T037: lint
T039: smoke test
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 + Phase 2 (including **T015–T017** three-call-site pass and **T014** percent-paid verify)
2. Complete Phase 3 (US1 headline Hub tab)
3. **STOP and VALIDATE** T022 — headline totals vs drawer
4. Demo if ready

### Incremental Delivery

1. Foundation + three-call-site refactor → no remaining drift on existing Invoices tab
2. + US1 → headline hub (MVP)
3. + US2 → attention list (primary client fear)
4. + US3 → horizon routing
5. + US4 verification + Polish

---

## Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Setup | T001–T003 | — |
| Foundational | T004–T017 | — |
| US1 Headline hub | T018–T022 | US1 |
| US2 Attention list | T023–T028 | US2 |
| US3 Horizon routing | T029–T034 | US3 |
| US4 No drift verify | T035–T036 | US4 |
| Polish | T037–T040 | — |
| **Total** | **40 tasks** | |

### Parallel opportunities

- **Phase 1**: T002, T003 parallel
- **Phase 2**: T015, T016, T017 parallel after T006 (same-file merge caution)
- **Phase 7**: T037, T039 parallel

### Independent test criteria

| Story | Test |
|-------|------|
| US1 | Headline figures = sum of drawer remaining; org switch updates; amount < £5 excluded |
| US2 | Flags + sort; partial+overdue first; website pending w/ balance included |
| US3 | Horizon click → filtered Invoices tab; 2100+ / null → no-date only |
| US4 | Zero mismatch across hub / table / drawer for sample set |

---

## Notes

- **Do not** add `is_test` to hub or finance invoice queries — use `amount >= 5` only (T009–T010)
- **Do not** hardcode Sears Melvin or any org UUID — `useOrganization()` only (T010, T012)
- `invoiceRemaining.ts` is the **only** place for pounds↔pence remaining math (T005–T006)
- Draft-status invoices excluded by `status = 'pending'` fetch gate; website finalized invoices included via `isFinalizedPendingWithBalance` (T008)
