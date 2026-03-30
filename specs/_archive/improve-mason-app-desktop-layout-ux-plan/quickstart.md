# Quickstart: Desktop Layout and UI/UX Improvements

## Run the app locally

```bash
npm install
npm run dev
```

Open the app (e.g. http://localhost:5173), log in if required, and go to the dashboard (e.g. `/dashboard/orders`, `/dashboard/invoicing`).

## Verify Phase 1 (Shell)

1. **Sidebar collapse and content expansion**
   - Navigate to any dashboard page (e.g. Orders or Invoicing).
   - Note the left sidebar: it has a chevron to collapse/expand (desktop only).
   - **Expand sidebar:** content area should start after the wide sidebar (~140px).
   - **Collapse sidebar:** content area should expand left so it starts after the narrow rail (~40px). The main table/content should visibly gain horizontal space.
   - Toggle again: expansion/contraction should be consistent.

2. **No overflow issues**
   - With sidebar collapsed, resize the browser window to a narrow desktop width (e.g. 1024px). Content should not be cut off; table should show horizontal scroll if needed.
   - With sidebar expanded, same check.

## Verify Phase 2–3 (Pages and tables)

3. **Table pages**
   - Open Orders, Invoicing, People (Customers), Workers.
   - Each should have a clear page header, toolbar row (search/filters/actions), and table.
   - Spacing and alignment should feel consistent across these pages.

4. **Table horizontal scroll**
   - On Orders or Invoicing, ensure enough columns are visible so the table is wider than the viewport (or use a narrow window).
   - The table container should show a horizontal scrollbar; columns should not be crushed to unreadable widths.
   - Column toggle (Columns button) should still work; visible columns should keep readable minimum widths.

## Verify Phase 4 (Right sidebars)

5. **Detail sidebar**
   - On Orders: click a row to open the order detail sidebar. Check:
     - Sidebar opens on the right with consistent width.
     - Clicking the dark overlay (backdrop) closes the sidebar.
     - Close (X) button closes the sidebar.
     - Long content in the sidebar scrolls inside the panel; the main page does not lock scroll.
   - On Invoicing: click an invoice to open the invoice detail sidebar. Same checks.
   - Both sidebars should look and behave the same (width, header, scroll, close).

## Verify Phase 5 (Polish)

6. **Visual consistency**
   - Page titles and card titles should have clear hierarchy.
   - Buttons and actions should not be clipped or overflow.
   - Empty and loading states should be present and consistent where applicable.

## QA checklist (summary)

- [ ] Sidebar collapse expands content area; expand shrinks it again.
- [ ] Tables are readable; horizontal scroll appears when needed; no column crushing.
- [ ] Right detail sidebars: same width, backdrop close, internal scroll, no body scroll lock.
- [ ] No workflow regressions: creating/editing orders and invoices, opening/closing sidebars, and navigation still work as before.
