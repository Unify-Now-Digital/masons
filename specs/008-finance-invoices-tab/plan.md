# Implementation Plan: Finance Invoices Tab

**Branch**: `008-finance-invoices-tab` | **Date**: 2026-05-19 | **Spec**: `specs/008-finance-invoices-tab/spec.md`  
**Input**: Feature specification from `specs/008-finance-invoices-tab/spec.md`

## Summary

Add a fourth **Invoices** tab to the existing Finance page that lists organization-scoped invoices from the `invoices_with_breakdown` database view, supports status filter pills (All / Unpaid / Overdue / Paid), sorts by `due_date` ascending, and opens a right-side detail drawer on row click. Implementation is frontend-only: new finance API + React Query hook, tab/table/drawer components colocated in `FinancePage.tsx`, gardens design system styling, and reuse of shared GBP formatters. No schema migration required—the view already exists.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React app)  
**Primary Dependencies**: React 18, React Router v6, TanStack React Query, Supabase JS client, gardens UI (`Card`, `Pill`, `Btn`, `Icon`)  
**Storage**: PostgreSQL via Supabase view `public.invoices_with_breakdown` (RLS on underlying `invoices`)  
**Testing**: `npm run lint`; manual Finance page smoke test per `quickstart.md`  
**Target Platform**: Web (desktop-first Finance dashboard)  
**Project Type**: Single frontend module extension + existing Supabase view  
**Performance Goals**: Single query per status-filter change; list usable within ~2s for typical org invoice volumes (<500 rows)  
**Constraints**: Read-only v1; do not modify existing Finance tabs; org isolation via `useOrganization()`; pence vs pounds display rules; additive-only  
**Scale/Scope**: ~4 new source files / sections, one page extension, zero migrations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Dual router constraint**: PASS. Route already registered at `/dashboard/finance` via `src/app/router.tsx`; no routing changes required.
- **Module boundaries**: PASS. All new code under `src/modules/finance/`; shared formatters from `@/shared/lib/formatters`; no imports from `src/modules/invoicing/*` internals.
- **Supabase + RLS**: PASS. Queries use anon client against `invoices_with_breakdown` with `.eq('organization_id', …)` and `.is('deleted_at', null)`; RLS on `invoices` remains the security boundary.
- **Secrets**: PASS. No edge functions or provider keys; read-only SELECT.
- **Additive-first**: PASS. No destructive schema/UI changes; fourth tab appended to existing tab bar.

## Phase 0: Research Plan

1. Confirm `invoices_with_breakdown` column set and join semantics (order breakdown via `orders.invoice_id`).
2. Align status filter semantics with existing invoicing display rules (`pending` + past due → overdue display).
3. Confirm monetary field units (`amount` pounds; `amount_paid` / `amount_remaining` pence).
4. Choose drawer UX pattern consistent with Finance gardens styling (fixed right panel + backdrop, not center modal).

Research output: `specs/008-finance-invoices-tab/research.md`.

## Phase 1: Design Plan

1. Produce `data-model.md` with list row shape, filter enum, and drawer sections.
2. Define Supabase list-query contract in `contracts/finance-invoices-list.md`.
3. Produce `quickstart.md` with implementation order and verification steps.
4. Agent context update script attempted (may require `pwsh` on host).

## Post-Design Constitution Check

- **Dual router constraint**: PASS (no router edits).
- **Module boundaries**: PASS (finance-local API/hook/UI; shared formatters only).
- **Supabase + RLS**: PASS (org + soft-delete filters on every query).
- **Secrets**: PASS.
- **Additive-first**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/008-finance-invoices-tab/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── finance-invoices-list.md
└── tasks.md                    # Created by /speckit.tasks (not this command)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── router.tsx              # Existing finance route (unchanged)
├── modules/
│   └── finance/
│       ├── api/
│       │   ├── finance.api.ts           # Existing (unchanged)
│       │   └── finance.invoices.api.ts  # NEW: fetch + types + status filter
│       ├── hooks/
│       │   ├── useFinance.ts            # Existing (unchanged)
│       │   └── useFinanceInvoices.ts    # NEW: React Query wrapper
│       ├── pages/
│       │   └── FinancePage.tsx          # ADD: tab, InvoicesTab, InvoiceDrawer
│       └── index.ts                     # Unchanged export
└── shared/
    └── lib/
        └── formatters.ts                # formatGbpDecimal, formatGbpPence

supabase/
└── migrations/
    └── (existing) invoices_with_breakdown view — no new migration
```

**Structure Decision**: Extend the existing finance feature module using the same `api/` + `hooks/` + `pages/` layering as `useFinanceTotals` / `fetchFinanceAtRisk`. UI subcomponents (`InvoicesTab`, `InvoiceDrawer`) live in `FinancePage.tsx` alongside existing tab components to match current file organization.

## Implementation Notes

### Tab integration

- Extend `Tab` union: `'balance-chase' | 'extras' | 'payments' | 'invoices'`.
- Add `TabButton` label: `Invoices (${count})` where count comes from `useFinanceInvoices` data length for active filter.
- Wire `useFinanceInvoices(statusFilter)` only when invoices tab is active (optional `enabled` optimization) or always—prefer `enabled: tab === 'invoices'` to avoid extra fetch on other tabs.

### Query

- Source: `invoices_with_breakdown`
- Filters: `organization_id`, `deleted_at IS NULL`, optional status filter
- Sort: `.order('due_date', { ascending: true })`
- Select: id, invoice_number, customer_name, issue_date, due_date, amount, amount_paid, amount_remaining, status, hosted_invoice_url, stripe_invoice_status, locked_at, main_product_total, additional_options_total, permit_total_cost, organization_id

### Display helpers (finance-local)

- `compactDate(iso)` → `"12 May"` (reuse pattern from `FinancePage.tsx`)
- `formatGbpDecimal` / `formatGbpPence` from `@/shared/lib/formatters`
- `displayStatus(invoice)`: if `status === 'pending'` and `due_date < today` → treat as `overdue` for badge/color (mirror `invoiceTransform.ts` logic without importing invoicing module)
- Pill tones: paid=green, pending=amber, overdue=red, draft/cancelled=neutral
- Paid column: `—` when `amount_paid` is 0 or null
- Sent indicator: green dot when `hosted_invoice_url` is non-null/non-empty

### Drawer

- Fixed `right-0` panel (~420px), `z-50`, backdrop `fixed inset-0 bg-black/40 z-40`
- Close on backdrop click and explicit close button
- Progress bar: `percentPaid = amount_paid / (amount_paid + amount_remaining)` when both known; else `amount_paid / (amount * 100)`
- Breakdown lines: memorial / additional / permit — render only if value > 0
- Stripe section: render only if any of `stripe_invoice_status`, `hosted_invoice_url`, `locked_at` present

### Non-goals (v1)

- Invoice create/edit/send from Finance tab
- Pagination / virtual scroll (defer unless list >500 becomes common)
- Cross-link navigation to Invoicing module (optional future enhancement)

## Complexity Tracking

No constitution violations identified; complexity exception log not required.
