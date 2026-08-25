# Quickstart — Verifying Inbox Sidebar Multi-Tabs

## Setup
```bash
npm run dev          # then open the inbox (desktop width ≥ lg — panel is hidden below lg)
```
Open React Query devtools and the browser network tab before testing.

## Gate commands (run per commit, not just at the end)
```bash
npx tsc -p tsconfig.app.json --noEmit   # PASS = exactly 54 pre-existing errors, 0 new
npm run lint                             # PASS = exactly 10 errors / 19 warnings
```
(Bare `npx tsc --noEmit` checks nothing in this repo — solution tsconfig.)

## SC-001 / SC-002 — shell + Orders tab (P1)
1. Select a linked customer with orders. Orders tab active by default; the tab strip is the
   panel's top row (active tab shows icon + label, inactive tabs icon-only with hover
   tooltips; the Orders trigger shows the order count when > 0). The Orders *body* matches
   `staging` — summary card, action buttons, orders list, Unassigned. The old
   "Order context (N)" header row is gone by design (c99fc76).
2. Switch Orders → Contact → Finances → History → Orders. Verify: **zero** new/refetched
   queries in devtools, zero network requests, no order deselection, no flash of the summary
   card auto-select.
3. Open CreateOrderDrawer ("New order"), switch tabs, return — drawer still open with typed
   state intact. Repeat for CreateInvoiceDrawer.
4. Select an unlinked thread that has no job: the old "Order context is available…" empty
   state renders with **no tab strip**.
5. The strip's right-edge PanelRightClose button is the ONLY collapse control (the page-level
   floating button no longer exists). Collapse with it — this also clears the order
   selection (accepted behavior, c99fc76) — then re-expand via the collapsed rail's Package
   button: active tab unchanged.
6. Keyboard: focus a tab trigger, arrow left/right cycles tabs.

## SC-003 — Contact (P2)
1. Linked person: every row matches the customer record (name, mailto email, tel phone,
   address, city, country, status, "customer since"). Missing fields show em dashes.
2. Unlinked selection: "no linked contact" empty state; devtools shows NO customers query
   fired for it.
3. S5 path: unlinked-but-job-linked conversation → "New order" (resolves person) → Contact now
   shows the resolved person without any new query key appearing.
4. Edit contact: with a loaded person, an "Edit contact" button appears under the rows
   (absent for unlinked/loading states). It opens the People-page EditCustomerDrawer
   prefilled (incl. the Linked Contacts section); save → "Person updated" toast, drawer
   closes, and the Contact rows refresh instantly with no refetch spinner. An open edit
   drawer survives tab switches.

## SC-004 — Finances (P3)
1. Person with a multi-order job + an unassigned order: every order's Total equals the Orders
   tab summary card's total for that order (click each order row to compare).
2. Grand total = sum of the listed order totals.
3. No invoice-related request appears; no paid/remaining/deposit wording anywhere.

## SC-005 — History (P4)
1. Repeat customer with ≥2 jobs incl. one exited: rows newest-first; stage labels match the
   pipeline board (`formatStageLabel`); paid job shows Paid date; exited job shows its
   exit_reason.
2. Copy check: no "timeline"/"activity"/event-log phrasing in the tab body.
3. Unlinked selection, probe returns no jobs → Clock-icon empty state.

## Regression spot-checks
- Auto-collapse: select a person with zero orders and no job → column auto-collapses exactly
  as on `staging`, regardless of which tab was last active.
- Order-row click flash: with multiple orders, click the selected row again → summary card
  scrolls into view and flashes (Orders tab).
- Search-filter the customers list until the selected row disappears → panel behaves as on
  `staging` (probe disables, count 0, collapse).
