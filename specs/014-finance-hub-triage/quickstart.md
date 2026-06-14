# Quickstart: Finance Hub — Outstanding Invoice Triage

## Prerequisites

- Dev server: `npm run dev`
- Signed-in user with org membership
- Sample invoices: mix of pending full/unpaid, partial (`amount_paid > 0`, `amount_remaining > 0`), paid, and at least one with `due_date >= 2100-01-01`
- View `invoices_with_breakdown` deployed (existing)

## 1) Shared remaining helper

**File**: `src/modules/finance/utils/invoiceRemaining.ts` (NEW)

1. Implement `invoiceRemainingPence`, `isInvoiceOwed`, `formatInvoiceRemaining`.
2. Implement `isReliableDueDate` — unreliable when missing OR `>= '2100-01-01'`.
3. Implement `getInvoiceHorizonBucket`, `getAttentionFlags`, `attentionListSortKey`.
4. Import formatters from `@/shared/lib/formatters` only.

## 2) Hub API + summary builder

**File**: `src/modules/finance/api/finance.hub.api.ts` (NEW)

1. `fetchFinanceHubInvoices(organizationId)` — pending + org + not deleted + `amount >= 5` GBP + owed SQL prefilter (`amount_remaining > 0` OR null); client `isHubEligibleInvoice`.
2. `buildFinanceHubSummary(rows)` — filter `isInvoiceOwed`, compute aggregates and sorted attention list.

**File**: `src/modules/finance/api/finance.invoices.api.ts` (UPDATE)

1. Refactor `computePercentPaid` to use `invoiceRemainingPence`.
2. Export `UNRELIABLE_DUE_DATE_FLOOR = '2100-01-01'` or re-export from utils.
3. Optionally extend `FinanceInvoiceStatusFilter` usage docs only (no breaking change).

## 3) React Query hook

**File**: `src/modules/finance/hooks/useFinanceHub.ts` (NEW)

```typescript
export function useFinanceHub(options?: { enabled?: boolean }) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: ['finance', 'hub', organizationId],
    queryFn: async () => {
      const rows = await fetchFinanceHubInvoices(organizationId!);
      return buildFinanceHubSummary(rows);
    },
    enabled: !!organizationId && (options?.enabled ?? true),
  });
}
```

## 4) Finance page — Hub tab + refactors

**File**: `src/modules/finance/pages/FinancePage.tsx` (UPDATE)

1. Extend `Tab`: `'hub' | 'balance-chase' | ...` — default `tab` to `'hub'`.
2. Add `horizonFilter` state (`FinanceInvoiceHorizonFilter | null`).
3. Implement **`HubTab`**:
   - Three headline tiles (outstanding / unpaid count / overdue total)
   - **Attention list** with PARTIAL / OVERDUE pills, sorted by priority
   - **Horizon strip** (4 segments, clickable)
   - Row click → open existing `InvoiceDrawer`
4. Horizon click → `setTab('invoices')`, `setStatusFilter('unpaid')`, `setHorizonFilter(segment)`.
5. **`InvoicesTab`**: when `horizonFilter` set, filter displayed rows with `getInvoiceHorizonBucket`.
6. Replace remaining display at table (~572) and drawer (~695) with `formatInvoiceRemaining(row, { zeroDisplay: 'gbp' })`; hub uses default em dash for zero.
7. Keep existing tabs and top order ribbon unchanged.

## 5) Manual verification

| # | Step | Expected |
|---|------|----------|
| 1 | Open `/dashboard/finance` | Lands on **Hub** tab |
| 2 | Compare headline outstanding | Equals sum of drawer “Remaining” for each attention-list invoice |
| 3 | Partial invoice | PARTIAL flag; remaining matches drawer |
| 4 | Partial + past due | Appears top of attention list; both flags |
| 5 | Fully paid pending w/ zero remaining | Absent from hub |
| 6 | Invoice due 2099-12-31 | In horizon bucket normally |
| 7 | Invoice due 2100-01-01+ | Only in **No reliable date**; not overdue |
| 8 | Click horizon **Overdue** | Invoices tab, unpaid filter, only overdue owed rows |
| 9 | Invoices table remaining col | Matches drawer for same row |
| 10 | Switch org | Hub figures change; no cross-org leakage |

## 6) Lint

```bash
npm run lint
```

## File checklist

| File | Action |
|------|--------|
| `src/modules/finance/utils/invoiceRemaining.ts` | Create |
| `src/modules/finance/api/finance.hub.api.ts` | Create |
| `src/modules/finance/api/finance.invoices.api.ts` | Update helpers |
| `src/modules/finance/hooks/useFinanceHub.ts` | Create |
| `src/modules/finance/pages/FinancePage.tsx` | Hub tab + refactors |

## Out of scope guardrails

- No migrations
- No invoicing module imports
- No changes to order-based `fetchFinanceTotals` ribbon
- No revenue charts or reconciliation views
