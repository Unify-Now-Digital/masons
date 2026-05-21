# Quickstart: Finance Invoices Tab

## Prerequisites

- Dev server: `npm run dev`
- Signed-in user with organization membership and sample invoices
- Supabase view `invoices_with_breakdown` deployed (existing migration)

## 1) Add API layer

**File**: `src/modules/finance/api/finance.invoices.api.ts`

1. Export `FinanceInvoiceStatusFilter`, `FinanceInvoiceRow`, and helpers:
   - `getDisplayStatus(row)` — pending + past due → `overdue`
   - `isInvoiceOverdue(row)`
   - `computePercentPaid(row)`
2. Implement `fetchFinanceInvoices(organizationId, filter)`:
   - `.from('invoices_with_breakdown')`
   - `.select(<columns>)`
   - `.eq('organization_id', organizationId)`
   - `.is('deleted_at', null)`
   - Apply status filter per `contracts/finance-invoices-list.md`
   - `.order('due_date', { ascending: true })`

## 2) Add React Query hook

**File**: `src/modules/finance/hooks/useFinanceInvoices.ts`

```typescript
export function useFinanceInvoices(
  filter: FinanceInvoiceStatusFilter,
  options?: { enabled?: boolean },
) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: ['finance', 'invoices', organizationId, filter],
    queryFn: () => fetchFinanceInvoices(organizationId!, filter),
    enabled: !!organizationId && (options?.enabled ?? true),
  });
}
```

## 3) Extend Finance page (additive only)

**File**: `src/modules/finance/pages/FinancePage.tsx`

1. Add `'invoices'` to `Tab` union.
2. Add state: `statusFilter`, `selectedInvoice` (or id).
3. Add fourth `TabButton`: `Invoices (${count})` using hook data length.
4. Implement **status filter pills** (All / Unpaid / Overdue / Paid) above table.
5. Implement **`InvoicesTab`**:
   - Loading / empty / error states (match Balance-chase tab tone)
   - Responsive table with 9 columns per spec
   - Row `onClick` → set selected invoice
   - Row hover styles (`cursor-pointer`, background on hover)
6. Implement **`InvoiceDrawer`**:
   - Backdrop + fixed right panel
   - Header, progress bar, totals, breakdown, dates, conditional Stripe block
   - Close on backdrop + button
7. Render tab content when `tab === 'invoices'`.
8. **Do not modify** existing `BalanceChaseTab`, `ExtrasTab`, `PaymentsTab` bodies.

### Styling checklist

- Use `Card`, `Pill`, `Btn`, `Icon` from `@/shared/components/gardens`
- CSS variables: `--g-tx`, `--g-txs`, `--g-acc`, `--g-bdr`, `--g-surf2`, `--g-grn`, `--g-amb`, etc.
- Monospace invoice numbers: `fontFamily: 'ui-monospace, monospace'`
- Right-align currency columns

## 4) Verify manually

| # | Step | Expected |
|---|------|----------|
| 1 | Open `/dashboard/finance` | Page loads; existing tabs unchanged |
| 2 | Click **Invoices** tab | Table loads; label shows count |
| 3 | Confirm sort | Earliest `due_date` first |
| 4 | Filter **Unpaid** | Only `pending` rows |
| 5 | Filter **Overdue** | `overdue` + pending past due |
| 6 | Filter **Paid** | Only `paid` rows |
| 7 | Click a row | Drawer opens from right |
| 8 | Check paid column | `—` when nothing paid |
| 9 | Check sent dot | Green dot when payment link exists |
| 10 | Close drawer | Backdrop click and X both close |

## 5) Lint

```bash
npm run lint
```

## 6) Out of scope guardrails

- No edits to invoicing module for this feature
- No new Supabase migrations unless RLS gap discovered
- No invoice mutations from Finance tab

## File checklist

| File | Action |
|------|--------|
| `src/modules/finance/api/finance.invoices.api.ts` | Create |
| `src/modules/finance/hooks/useFinanceInvoices.ts` | Create |
| `src/modules/finance/pages/FinancePage.tsx` | Extend (tab + new components only) |

---

## Implementation verification (2026-05-19)

Implemented in-repo:

- `src/modules/finance/api/finance.invoices.api.ts` — fetch, filters, display helpers
- `src/modules/finance/hooks/useFinanceInvoices.ts` — React Query hook
- `src/modules/finance/pages/FinancePage.tsx` — Invoices tab, filter pills, table, `InvoiceDrawer`
- `npx eslint src/modules/finance/` — pass (exit 0)

Manual UI verification: run dev server and complete section 4 checklist in browser.
