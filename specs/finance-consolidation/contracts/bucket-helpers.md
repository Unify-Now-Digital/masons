# Contract: bucket / aggregate helper signatures (canonical home: `src/modules/finance/utils/invoiceRemaining.ts`)

C1 establishes these; C2–C4 consume them and add none elsewhere. No re-derivation anywhere else survives C1 (FR-017).

```ts
// ——— existing, semantics amended in C1 ———
invoiceRemainingPence(inv: FinanceInvoiceRow): number
// pence. NEW folded rule: status === 'paid' ⇒ 0 (absorbs computeTotals' override; resolves the
// paid-with-null-Stripe divergence, F2 §1). All other behaviour unchanged.

formatInvoiceRemaining(inv: FinanceInvoiceRow): string   // unchanged; the table's Remaining column uses THIS

isVoidedStripeInvoice(inv: Pick<FinanceInvoiceRow, 'stripe_invoice_status'>): boolean
// After C1 this is the ONLY definition; the duplicate at invoiceTransform.ts:37-42 becomes an
// import of this one ("keep in sync" comment deleted).

isHubEligibleInvoice(inv: FinanceInvoiceRow): boolean    // unchanged: pending, !void, amount>=5, owed
getOverdueAgingBucket(inv: FinanceInvoiceRow, today: Date): 'd7' | 'd7to30' | 'd30plus' | null  // unchanged
getInvoiceHorizonBucket(inv: FinanceInvoiceRow, today: Date)  // KEPT (feeds notYetDue + allZero) though its UI dies

// ——— new in C2 ———
buildFinanceSummary(rows: FinanceInvoiceRow[], today: Date): FinanceSummary   // data-model.md §4
// Composition rule: rows = the working set AFTER enquiry-hiding (spec A-1), BEFORE tile filtering.
// Internally: hub-eligibility → bucket partition (incl. notYetDue synthesis from horizon buckets),
// invoicedUnpaidGbp / overdueGbp / overdueCount / allZero with semantics IDENTICAL to today's
// buildFinanceHubSummary outputs (verification: quickstart step 0 ribbon baseline).

classifyRowForFilter(inv: FinanceInvoiceRow, today: Date): AgingBucket
// Single classification used by BOTH tile aggregates and table filtering — one function so a row
// can never be counted in a tile it doesn't appear under (SC-001 no-disagreement guarantee).
```

**Retired by C1:** `invoiceAmounts.computeTotals` (`invoiceAmounts.ts:21-45`) and the inline re-derivation at `invoiceColumnDefinitions.tsx:364-367`. Consumers in the three drawer files rewire to `invoiceRemainingPence`/`formatInvoiceRemaining` (call sites = OQ1 grep, counts stated before edit).
