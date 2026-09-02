# Contract: table filter props (FinancePage → InvoiceWorkspace, lands C2; C4 widens)

```ts
interface InvoiceWorkspaceProps {
  invoices: FinanceInvoiceRow[]   // the unified working set (post enquiry-hiding), due-date-asc
  activeTile: TileFilter          // 'all' default — the ONLY list filter (FR-002)
  // C4 additions:
  //   (search stays INTERNAL to the workspace — not lifted)
}

// FinancePage owns: activeTile, showEnquiry (and applies enquiry-hiding BEFORE passing rows,
// so tiles and table filter one identical set — spec A-1).
// InvoiceWorkspace owns: search text, expandedInvoices, column state (localStorage), resize,
// drawers, ?invoice= sidebar sync, ?focus/?stripe/?pay param effects.
```

**Hard guarantees (FR-014 / SC-002):**
1. `InvoiceWorkspace` is mounted exactly once by `FinancePage` and is **never given a `key`** derived from filter state. Filter changes arrive as prop changes; row visibility is a memoized internal computation.
2. A change to `activeTile`, search, or `showEnquiry` triggers **zero refetches** and **zero unmounts**; `expandedInvoices`, search text, column state, sidebar, and scroll survive.
3. Tile-filter semantics inside the workspace use `classifyRowForFilter` (see bucket-helpers) — never a local re-derivation:
   - `activeTile === 'all'` → every row; void rows rendered with the dim treatment; `null`-bucket rows visible.
   - otherwise → rows whose classification equals `activeTile` (hub-eligible by construction; void/paid excluded).
4. Status tabs (`InvoiceWorkspace.tsx:535-542`) and the `activeTab` predicate (`:428-432`) are deleted in C2 — `TileFilter` is their only successor. The removed `workspaceStatusFilter` leg of `handleHorizonNavigate` maps to `onTileChange` (due-horizon dependent 5).
5. Row expansion and sidebar behaviour (`?invoice=` driven) are byte-for-byte today's (FR-005); this contract adds no props for them.
```
