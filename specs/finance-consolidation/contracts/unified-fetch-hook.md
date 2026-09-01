# Contract: unified fetch hook (lands C1)

The single data source for tiles + table. Evolves the existing `useInvoices` (`src/modules/invoicing/hooks/useInvoices.ts:16-27` → `fetchInvoices`, `invoicing.api.ts:36-50`) rather than adding a parallel hook, **keeping its query-key family** so every existing mutation-invalidation site keeps working unchanged (R2; confirm sites via OQ5 grep before edit).

```ts
// consumer-facing shape (FinancePage + InvoiceWorkspace)
function useInvoices(): {
  invoices: FinanceInvoiceRow[]   // see data-model.md §1
  isLoading: boolean
  isError: boolean                // drives the rebuilt error state (flag 3)
}
```

**Server-side (in the fetch, unchanged semantics + one ordering change):**
- `.eq('organization_id', orgId)` — org guard at the query layer (CLAUDE.md)
- `.is('deleted_at', null)`
- `.eq('is_test', false)` when the test toggle is off (existing behaviour at `invoicing.api.ts:45`)
- `.order('due_date', { ascending: true })` — replaces `created_at desc` (`:46`) as the base order (client sort in C4 still owns final order; SQL order makes the pre-C4 interim sensible)

**Explicitly NOT server-side (client concerns):** void exclusion, enquiry-prefix hiding, aging buckets, hub-eligibility, search.

**Guarantees handed to later commits:**
1. Exactly one list request per page load (SC-001); tiles and table can never disagree on the row set.
2. Rows arrive with money units exactly as data-model.md §1 (pence strings NOT converted in the fetch layer — canonical helpers do all arithmetic).
3. `fetchFinanceHubInvoices` (`finance.hub.api.ts:82-95`) and `useFinanceInvoices` lose their last consumers by end of C2; files deleted in C5.
