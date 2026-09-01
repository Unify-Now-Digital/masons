# Contract: stat filters + pager (Amendment 1 — C7 establishes the filter type; C9 adds the pager)

## Extended filter type (canonical home: `src/modules/finance/utils/invoiceRemaining.ts`)

```ts
type StatFilter = 'unpaid' | 'collected' | 'expected' | 'overdue'
type ActiveFilter = TileFilter | StatFilter   // TileFilter already includes 'all'

matchesStatFilter(
  row: FinanceInvoiceRow,   // + order?: { installation_date: string | null } | null (FR-029a embed)
  filter: StatFilter,
  today: Date,
): boolean
// 'unpaid'    → classifyRowForFilter(row, today) !== null            (union of the four buckets)
// 'overdue'   → classifyRowForFilter(row, today) ∈ {'d7','d7to30','d30plus'}
// 'collected' → row.paid_at != null AND falls in today's calendar month
// 'expected'  → row.order?.installation_date falls in today's calendar month
```

Bucket cases DELEGATE to `classifyRowForFilter` — never re-derive eligibility or buckets (FR-027).
The workspace's row-set memo becomes: `activeFilter === 'all'` → every row; a `TileFilter` value →
today's `classifyRowForFilter` equality path, unchanged; a `StatFilter` value → `matchesStatFilter`.
ONE classifier family; no second classifier in the workspace.

Known, stated divergences (spec tensions A1-3/A1-4 — behaviour is correct as specced):
- 'unpaid' can list fewer rows than the Invoiced-&-unpaid £ (eligible no-reliable-due-date rows are
  in the £ but bucket `null`).
- 'collected' misses partially-paid-this-month rows (`paid_at` unset) and can never show the
  order-level-payment component of the £ (caption states "incl. order-level payments").

## Filter state (FinancePage-owned; `activeFilter` replaces `activeTile`)

```ts
activeFilter: ActiveFilter            // default 'all'
```

- Chip click → the `TileFilter` value (existing click-again-→-'all' toggle preserved).
- Stat click (stats 2–5) → the `StatFilter` value; clicking the ACTIVE stat → `'all'`.
- Every set REPLACES: a stat click deselects any chip, a chip click deselects any stat, All clears
  everything. Two filters are never active together (FR-026).
- Stat 1 (Confirmed orders) is a navigate, not a filter — it never touches `activeFilter`.
- Workspace prop renamed `activeTile` → `activeFilter`. Chips render selected only when the value is
  a `TileFilter`; a stat renders selected only when it is that stat's `StatFilter`.

## Pager (C9 — internal to `InvoiceWorkspace`; NO new cross-boundary props)

```ts
type PageSize = 10 | 25 | 50          // default 25; persisted localStorage 'invoices_page_size'

interface InvoicePagerProps {
  page: number                        // 1-based
  pageSize: PageSize
  total: number                       // filteredInvoices.length
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
}
```

Renders below the table INSIDE the card: Prev/Next + "x–y of n" + size picker. Built from the
existing `ui/` Button + Select — no pagination primitive exists in the repo (verified 2026-09-02).

**Hard guarantees (extend `table-filter-props.md`'s — all of those still hold):**

1. Paging is a memoized slice of `filteredInvoices` (`InvoiceWorkspace.tsx:466`); the table and the
   workspace are NEVER remounted by a page change (FR-014 / FR-038).
2. `page` resets to 1 on: `activeFilter` change, search change, void-toggle change, `pageSize`
   change (FR-036).
3. `?invoice=` target off-page → compute its page from the current filtered + sorted set, jump,
   then open the sidebar (extends the `:171-190` effect, FR-037); target not in the filtered set →
   today's behaviour (sidebar opens, list unchanged).
4. `expandedInvoices` clears on page change (FR-038); column state, search text, sidebar, and
   scroll-within-page survive.
5. Card min-height fits `pageSize` rows; a short last page keeps that height; no padding rows
   (FR-035).
