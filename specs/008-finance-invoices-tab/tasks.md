# Tasks: Finance Invoices Tab

**Input**: Design documents from `/specs/008-finance-invoices-tab/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/finance-invoices-list.md`, `quickstart.md`

**Tests**: No automated test tasks (not requested in spec). Verification via `npm run lint` and manual quickstart checklist.

**Organization**: Tasks grouped by user story for independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`) for story-phase tasks only
- Every task includes an explicit file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm prerequisites and align with existing Finance module patterns before coding.

- [x] T001 Review design artifacts (`spec.md`, `plan.md`, `contracts/finance-invoices-list.md`) in `specs/008-finance-invoices-tab/`
- [x] T002 [P] Review existing Finance tab patterns (tab bar, `Card`, `Pill`, `currency`, `compactDate`) in `src/modules/finance/pages/FinancePage.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data-access layer and React Query hook required by all user stories.

**⚠️ CRITICAL**: No user story UI work should begin until this phase is complete.

- [x] T003 Define `FinanceInvoiceStatusFilter`, `FinanceInvoiceRow`, and display helpers (`getDisplayStatus`, `isInvoiceOverdue`, `computePercentPaid`) in `src/modules/finance/api/finance.invoices.api.ts`
- [x] T004 Implement `fetchFinanceInvoices(organizationId, filter)` querying `invoices_with_breakdown` with org scope, `deleted_at IS NULL`, status filters, and `due_date` ascending sort per `specs/008-finance-invoices-tab/contracts/finance-invoices-list.md` in `src/modules/finance/api/finance.invoices.api.ts`
- [x] T005 Implement `useFinanceInvoices(filter, options?)` with `useOrganization()` and query key `['finance', 'invoices', organizationId, filter]` in `src/modules/finance/hooks/useFinanceInvoices.ts`

**Checkpoint**: API and hook ready; UI stories can proceed.

---

## Phase 3: User Story 1 - Review invoice debt at a glance (Priority: P1) 🎯 MVP

**Goal**: Fourth Finance tab lists org invoices in a sortable table with financial columns, count in tab label, and overdue emphasis.

**Independent Test**: Open Finance → Invoices tab; confirm `Invoices (N)` label, table shows only current-org non-deleted rows sorted by `due_date` ascending, overdue due/remaining styled in red.

### Implementation for User Story 1

- [x] T006 [US1] Extend `Tab` union with `'invoices'` and add `TabButton` labelled `Invoices (N)` using hook result length in `src/modules/finance/pages/FinancePage.tsx`
- [x] T007 [US1] Add `InvoicesTab` shell with loading, empty, and retryable error states matching existing Finance tabs in `src/modules/finance/pages/FinancePage.tsx`
- [x] T008 [US1] Implement invoice table with columns: Invoice #, Customer, Issued, Due, Total, Paid, Remaining, Status, Sent indicator in `src/modules/finance/pages/FinancePage.tsx`
- [x] T009 [US1] Wire `useFinanceInvoices('all', { enabled: tab === 'invoices' })` and render tab panel when `tab === 'invoices'` in `src/modules/finance/pages/FinancePage.tsx`
- [x] T010 [US1] Apply GBP formatting (`formatGbpDecimal` for total, `formatGbpPence` for paid/remaining), paid column `—` when zero, monospace invoice #, right-aligned currency in `src/modules/finance/pages/FinancePage.tsx`
- [x] T011 [US1] Apply status `Pill` tones (paid=green, pending=amber, overdue=red, draft/cancelled=neutral), overdue row styling on due date and remaining, green sent dot when `hosted_invoice_url` present in `src/modules/finance/pages/FinancePage.tsx`

**Checkpoint**: User Story 1 delivers MVP list view without filters or drawer.

---

## Phase 4: User Story 2 - Filter invoices by payment state (Priority: P2)

**Goal**: Status pills (All / Unpaid / Overdue / Paid) refetch and narrow the table; filter-specific empty states.

**Independent Test**: Switch each pill and verify list refreshes with correct rows; empty filter shows explicit message; All restores full list.

### Implementation for User Story 2

- [x] T012 [US2] Add status filter pill bar (All, Unpaid, Overdue, Paid) with gardens styling above the table in `src/modules/finance/pages/FinancePage.tsx`
- [x] T013 [US2] Connect `statusFilter` state to `useFinanceInvoices(statusFilter)` so tab count and rows reflect active filter in `src/modules/finance/pages/FinancePage.tsx`
- [x] T014 [US2] Add filter-specific empty-state copy (e.g. no unpaid / no overdue / no paid) in `src/modules/finance/pages/FinancePage.tsx`

**Checkpoint**: User Story 2 independently testable on top of US1 table.

---

## Phase 5: User Story 3 - Inspect one invoice in detail (Priority: P3)

**Goal**: Row click opens right slide-in drawer with payment progress, totals, breakdown, dates, and conditional Stripe section.

**Independent Test**: Click any row; drawer shows header, progress bar, sections; Stripe block omitted when no Stripe fields; backdrop and close dismiss drawer.

### Implementation for User Story 3

- [x] T015 [US3] Implement `InvoiceDrawer` shell (fixed right panel, backdrop overlay, close button, ESC/backdrop dismiss) using gardens CSS variables in `src/modules/finance/pages/FinancePage.tsx`
- [x] T016 [US3] Add drawer header (invoice number, customer, status pill) and payment progress bar (green when paid, red when overdue) in `src/modules/finance/pages/FinancePage.tsx`
- [x] T017 [US3] Add drawer sections: invoice totals, breakdown lines (memorial/additional/permit only if > 0), dates (due red if overdue) in `src/modules/finance/pages/FinancePage.tsx`
- [x] T018 [US3] Add conditional Stripe section (`stripe_invoice_status`, payment link opens new tab, `locked_at`) and wire table row `onClick` + hover cursor in `src/modules/finance/pages/FinancePage.tsx`

**Checkpoint**: All three user stories complete end-to-end on Finance page.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Lint, regression guard for existing tabs, documentation sign-off.

- [x] T019 Run `npm run lint` and fix any issues under `src/modules/finance/`
- [x] T020 Execute manual verification checklist in `specs/008-finance-invoices-tab/quickstart.md` and note results in that file
- [x] T021 Confirm Balance-chase, AI changes, and Recent payments tab bodies were not modified in `src/modules/finance/pages/FinancePage.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user stories**.
- **Phases 3–5 (User Stories)**: Depend on Phase 2; implement in priority order (P1 → P2 → P3) for incremental delivery.
- **Phase 6 (Polish)**: Depends on completion of Phases 3–5 (or MVP scope through Phase 3).

### User Story Dependencies

| Story | Depends on | Can start after |
|-------|------------|-----------------|
| US1 (P1) | Foundational (T003–T005) | Phase 2 complete |
| US2 (P2) | US1 table + tab wiring | T009 complete |
| US3 (P3) | US1 row data in table | T008 complete (drawer can parallelize late US2 if needed) |

US2 and US3 do not require each other; US2 only needs the table from US1; US3 only needs row click target from US1.

### Within Each User Story

- API/hook (Phase 2) before any UI.
- Tab shell before table columns before styling polish.
- Filter pills after base table fetch works.
- Drawer after rows are clickable.

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel.
- **After Phase 2**: US2 (filters) and US3 (drawer) could be split across developers once US1 table exists (T008+); US3 drawer components (T015–T017) are same-file sequential.
- **Phase 6**: T019 and T021 can run in parallel after implementation.

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, sequential in FinancePage.tsx:
# T006 → T007 → T008 → T009 → T010 → T011
```

## Parallel Example: After US1 MVP

```bash
# Developer A — filters:
# T012 → T013 → T014

# Developer B — drawer (after T008):
# T015 → T016 → T017 → T018
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2.
2. Complete Phase 3 (US1).
3. **STOP and VALIDATE**: Invoices tab lists correct data with count and overdue styling.
4. Demo/deploy if ready.

### Incremental Delivery

1. Phase 2 → data layer ready.
2. Phase 3 (US1) → debt list MVP.
3. Phase 4 (US2) → operational filters.
4. Phase 5 (US3) → detail drawer.
5. Phase 6 → lint + quickstart sign-off.

### Suggested MVP Scope

**User Story 1 only** (T001–T011 + T019): delivers core Finance invoices list without filters or drawer — sufficient for early feedback but below full spec.

**Full spec** requires through **T018** (all three user stories).

---

## Task Summary

| Phase | Task IDs | Count |
|-------|----------|-------|
| Setup | T001–T002 | 2 |
| Foundational | T003–T005 | 3 |
| US1 (P1) | T006–T011 | 6 |
| US2 (P2) | T012–T014 | 3 |
| US3 (P3) | T015–T018 | 4 |
| Polish | T019–T021 | 3 |
| **Total** | **T001–T021** | **21** |

### Independent Test Criteria

| Story | How to verify alone |
|-------|---------------------|
| US1 | Invoices tab + table + sort + overdue styling + count label |
| US2 | Each status pill narrows list; empty states per filter |
| US3 | Row opens drawer with all sections; Stripe omitted when absent |

### Format Validation

- All 21 tasks use `- [x]` checkbox prefix
- All tasks include task ID `T###`
- Story-phase tasks include `[US1]`, `[US2]`, or `[US3]`
- All tasks include explicit file paths
- `[P]` markers only on T002 (parallel setup reads)

---

## Notes

- Do **not** import from `src/modules/invoicing/*`; use `@/shared/lib/formatters` for currency.
- Do **not** add Supabase migrations unless RLS gap is discovered during implementation.
- Keep changes additive: existing Finance tabs must remain behavior-identical (AC-004).
