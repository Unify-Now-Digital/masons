# Implementation Plan: Finance Hub — Outstanding Invoice Triage

**Branch**: `014-finance-hub-triage` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/014-finance-hub-triage/spec.md`  
**User planning notes**: Extract shared `invoiceRemaining()` helper; pounds vs pence units; population `status='pending'` + owed via helper; unreliable dates `due_date >= '2100-01-01'`.

## Summary

Add a **Hub** landing tab to the Finance module that aggregates outstanding invoice balances for the active workshop: headline figures, a priority attention list (PARTIAL / OVERDUE flags), and a four-segment due-date horizon strip that routes into the existing Invoices tab with filters pre-applied. Implementation is frontend-only — new shared `invoiceRemaining.ts` helpers (single source of truth for remaining balance), hub API + React Query hook, and `HubTab` UI in `FinancePage.tsx`. Refactor the Invoices table remaining cell (~572) and drawer remaining row (~694–698) to use the same helpers. No schema migration.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React 18)  
**Primary Dependencies**: TanStack React Query, Supabase JS client, gardens UI (`Card`, `Pill`, `Btn`, `Icon`), `@/shared/lib/formatters`  
**Storage**: PostgreSQL via existing view `public.invoices_with_breakdown` (RLS on `invoices`)  
**Testing**: `npm run lint`; manual verification per `quickstart.md`  
**Target Platform**: Web (Finance dashboard)  
**Project Type**: Single frontend module extension  
**Performance Goals**: One hub query on Finance load; client-side aggregate/bucket on typical org volumes (<500 pending rows)  
**Constraints**: Single remaining-balance source; pending + `isInvoiceOwed` population; `2100-01-01` unreliable-date floor; org-scoped; test/seed exclusion via **`amount >= 5` GBP floor** (never `is_test`); additive-only  
**Scale/Scope**: ~3 new files, 2 updated files, zero migrations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Dual router constraint | PASS | Route `/dashboard/finance` unchanged; tab state only |
| Module boundaries | PASS | All code under `src/modules/finance/`; formatters from `@/shared/`; no invoicing imports |
| Supabase + RLS | PASS | Read-only SELECT on existing view; org + soft-delete + status filters |
| Secrets | PASS | No edge functions |
| Additive-first | PASS | New hub tab + helpers; existing tabs preserved |

## Phase 0: Research

Completed — see [research.md](./research.md). All technical unknowns resolved:

- Shared `invoiceRemainingPence` / `formatInvoiceRemaining` / `isInvoiceOwed`
- Population: SQL `status=pending`, client `isInvoiceOwed`
- Unreliable date: `due_date >= '2100-01-01'` or missing → no-date bucket only
- Test/seed exclusion: SQL `amount >= 5` GBP + client `isHubEligibleInvoice`; draft status excluded by pending gate; **never** filter on `is_test`
- Horizon routing via `horizonFilter` client slice on Invoices tab

## Phase 1: Design

| Artifact | Path |
|----------|------|
| Data model | [data-model.md](./data-model.md) |
| Hub contract | [contracts/finance-hub-triage.md](./contracts/finance-hub-triage.md) |
| Quickstart | [quickstart.md](./quickstart.md) |

### Agent context update

Attempted `.specify/scripts/powershell/update-agent-context.ps1 -AgentType cursor-agent` — failed in current shell (`powershell.exe` exec format error on second invocation). Manual follow-up optional; no new stack technologies introduced.

## Post-Design Constitution Check

All gates PASS. No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/014-finance-hub-triage/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── finance-hub-triage.md
├── checklists/
│   └── requirements.md
└── tasks.md                    # Created by /speckit.tasks
```

### Source Code

```text
src/modules/finance/
├── utils/
│   └── invoiceRemaining.ts          # NEW: invoiceRemainingPence, formatInvoiceRemaining, horizon/flags
├── api/
│   ├── finance.invoices.api.ts      # UPDATE: computePercentPaid uses shared helper
│   └── finance.hub.api.ts           # NEW: fetchFinanceHubInvoices, buildFinanceHubSummary
├── hooks/
│   ├── useFinanceInvoices.ts        # unchanged (horizon filter applied in page)
│   └── useFinanceHub.ts             # NEW
└── pages/
    └── FinancePage.tsx                # UPDATE: HubTab, default tab, horizon routing, remaining refactor
```

**Structure Decision**: Follow 008 layering (`api/` + `hooks/` + `pages/`). Pure bucketing/remaining logic in `utils/invoiceRemaining.ts` so hub, table, and drawer share one implementation without bloating the API file.

## Implementation Notes

### 1. `invoiceRemaining.ts` (single source of truth)

```typescript
// Canonical remaining in pence
export function invoiceRemainingPence(row: InvoiceRemainingInput): number

// Owed gate for hub population
export function isInvoiceOwed(row: InvoiceRemainingInput): boolean

// Display — replaces inline ternary at FinancePage ~572 and ~694
export function formatInvoiceRemaining(row: InvoiceRemainingInput): string

// due_date missing OR >= '2100-01-01'
export function isReliableDueDate(dueDate: string | null | undefined): boolean
```

**Unit rules** (locked per user input):
- `amount` → pounds → multiply by 100 inside helper
- `amount_paid`, `amount_remaining` → already pence

When `amount_remaining` is non-null, use it directly. When null, derive from `amount` (pounds) minus `amount_paid` (pence) per research R1.

### 2. Hub fetch population

```typescript
// Server
.from('invoices_with_breakdown')
.eq('organization_id', orgId)
.is('deleted_at', null)
.eq('status', 'pending')
.gte('amount', MIN_HUB_INVOICE_AMOUNT_GBP) // 5 GBP floor — test/seed exclusion

// Client
const owed = rows.filter(isHubEligibleInvoice).filter(isInvoiceOwed)
```

Fully paid rows with `status='pending'` but `amount_remaining=0` drop out via `isInvoiceOwed`. Unpaid rows with null `amount_remaining` stay in via pounds→pence fallback (matches current drawer behaviour).

### 3. Headline aggregates (from owed set)

| Figure | Formula |
|--------|---------|
| Total outstanding | `sum(invoiceRemainingPence) / 100` |
| Unpaid count | `owed.length` |
| Total overdue | sum remaining pence where `getAttentionFlags().overdue` |

### 4. Attention list

- **PARTIAL**: `amount_paid > 0` && owed
- **OVERDUE**: owed && reliable date && past due (independent of DB `status` label)
- Sort: partial+overdue → overdue → partial → other; then due date asc

### 5. Horizon strip

| Segment | Bucket rule |
|---------|-------------|
| Overdue | owed + reliable + `due < today` |
| Due within 30 days | owed + reliable + `today <= due <= today+30` |
| Due later | owed + reliable + `due > today+30` |
| No reliable date | owed + unreliable date |

Click → `tab='invoices'`, `statusFilter='unpaid'`, `horizonFilter=<segment>`.

### 6. Invoices tab integration

- Add `horizonFilter` prop to `InvoicesTab`
- When set, filter rows: `isInvoiceOwed(row) && getInvoiceHorizonBucket(row) === horizonFilter`
- Remaining column: `formatInvoiceRemaining(row)` only

### 7. Non-regression

- Default tab becomes `'hub'` (was `'balance-chase'`)
- Top order-based ribbon (`useFinanceTotals`) unchanged
- Balance-chase / AI changes / Recent payments tab bodies unchanged
- Invoice drawer structure unchanged; remaining value source only

## Complexity Tracking

> No constitution violations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Next Step

Run **`/speckit.tasks`** to generate `tasks.md` from this plan.
