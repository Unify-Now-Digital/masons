# Research: Finance Invoices Tab

## Decision 1: Use existing `invoices_with_breakdown` view (no migration)

- **Decision**: Query `public.invoices_with_breakdown` from the finance module with the same org + soft-delete filters used in invoicing list fetch.
- **Rationale**: View already joins invoice rows to order breakdown totals (`main_product_total`, `additional_options_total`, `permit_total_cost`) via `orders.invoice_id`. Avoids duplicate SQL and satisfies spec breakdown requirements.
- **Alternatives considered**:
  - New RPC aggregating invoices: rejected—unnecessary for read-only flat list; adds migration overhead.
  - Query `invoices` + per-row order joins: rejected—N+1 or heavy client joins.

## Decision 2: Status filter semantics aligned with invoicing display rules

- **Decision**:
  - **All**: no status filter (still scoped by org + `deleted_at IS NULL`).
  - **Unpaid**: `status = 'pending'` only (excludes DB `overdue` rows from this pill).
  - **Overdue**: `status = 'overdue'` OR (`status = 'pending'` AND `due_date < today` in org-local date).
  - **Paid**: `status = 'paid'`.
  - **Display status** in table/drawer: if `pending` and past due, show as **overdue** (badge/color) even when Unpaid filter is not active.
- **Rationale**: Matches `transformInvoiceForUI` / Finance totals logic already used elsewhere; users expect overdue emphasis when due date passed.
- **Alternatives considered**:
  - Overdue filter = `status.eq.overdue` only: rejected—misses pending rows past due date still stored as `pending`.

## Decision 3: Monetary unit handling

- **Decision**:
  - `amount` (invoice total): stored as **decimal pounds** → `formatGbpDecimal`.
  - `amount_paid`, `amount_remaining`: stored as **bigint pence** → divide by 100 / `formatGbpPence`.
  - Progress bar denominator: prefer `amount_paid + amount_remaining` when both present; else `amount * 100` pence.
- **Rationale**: Documented in user requirements and confirmed in `finance.api.ts` comments and `invoiceAmounts.ts`.
- **Alternatives considered**:
  - Treat all fields as pounds: rejected—would mis-display partial payment data.

## Decision 4: Finance-local API module (no cross-feature imports)

- **Decision**: Add `finance.invoices.api.ts` + `useFinanceInvoices.ts`; do **not** import `src/modules/invoicing/utils/*` (not exported from invoicing public surface).
- **Rationale**: Constitution module boundary; invoicing `index.ts` only exports `InvoicingPage`.
- **Alternatives considered**:
  - Promote `transformInvoiceForUI` to `src/shared/`: valid long-term but out of scope; duplicate minimal display helpers in finance.

## Decision 5: Drawer UX — gardens-styled fixed right panel

- **Decision**: Implement custom slide-in panel in `FinancePage.tsx` (fixed right, backdrop overlay) using gardens CSS variables and components—not the centered shadcn `Drawer` or narrow `Sheet`.
- **Rationale**: Finance page is entirely gardens-styled; `OrderDetailsSidePanel` / inbox peek patterns use fixed right panels; spec requests slide-in from right with overlay.
- **Alternatives considered**:
  - shadcn `Sheet` side="right": acceptable technically but visual mismatch with Finance tabs.
  - Navigate to Invoicing detail: rejected—spec requires in-place drawer on Finance.

## Decision 6: Sort and count behavior

- **Decision**: Server-side `.order('due_date', { ascending: true })`; tab count `Invoices (N)` = length of returned array for **active filter** (not global total unless filter is All).
- **Rationale**: Matches spec “Invoices (N)” tied to visible list; oldest debt first aids balance-chase workflow.
- **Alternatives considered**:
  - Separate count query: rejected for v1—extra round trip without clear need.

## Decision 7: React Query integration pattern

- **Decision**: Mirror `useFinance.ts` — `queryKey: ['finance', 'invoices', organizationId, statusFilter]`, `enabled: !!organizationId` (optionally `&& tab === 'invoices'`).
- **Rationale**: Consistent invalidation and org scoping with existing finance hooks.
- **Alternatives considered**:
  - Reuse `useInvoices` from invoicing: rejected—hook does not exist publicly and filter/sort differ.

## Pre-Implementation Verification (completed during planning)

| Check | Outcome |
|-------|---------|
| View definition includes breakdown columns | Yes — `20260426090000_add_is_test_columns.sql` |
| Invoice status enum | `draft \| pending \| paid \| overdue \| cancelled` |
| Finance page tab pattern | Three tabs + subcomponents in `FinancePage.tsx` |
| Org filter column on invoices | `organization_id` on `invoices` (selected via view `i.*`) |
