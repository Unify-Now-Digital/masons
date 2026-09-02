# Contract: Days-overdue cell (new column, lands C3)

Column id `'daysOverdue'` in `invoiceColumnDefinitions.tsx` + `defaultColumns.ts` (invoices module). Hideable; **default visible** (maximal defaults, FR-007). Display-only — participates in no sort, no filter, no aggregate (spec A-3).

```ts
interface DaysOverdueCellInput {
  dueDate: string | null
  hasReliableDueDate: boolean   // same predicate the Hub row used (candidate: isReliableDueDate — OQ4, verify at C3)
  daysPastDue: number | null    // computed from dueDate vs today; null when unreliable
}

// Render — the Hub chase-signal text variants VERBATIM (FinancePage.tsx:534-545 semantics):
//   overdue          → "N days overdue · due DD Mon"
//   not yet due      → "due in n days"
//   unreliable/null  → "no reliable due date"
// RULED 2026-09-01: no PARTIAL marker here — the Status column's "Partially paid" covers it.
```

Derivation may read the row directly (cell renderers receive the row); the shape above is the semantic input, not necessarily a props interface. Reuse the same date arithmetic `getOverdueAgingBucket` uses so the cell text and the row's tile bucket can never disagree (e.g. a row under the 7–30d tile must never read "3 days overdue").
