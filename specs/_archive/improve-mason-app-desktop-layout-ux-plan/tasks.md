# Implementation Tasks: Desktop Layout and UI/UX

**Feature spec:** [improve-mason-app-desktop-layout-ux.md](../improve-mason-app-desktop-layout-ux.md)  
**Branch:** `feature/improve-mason-app-desktop-layout-ux`

---

## Phase 1 — Global dashboard shell

- [X] **1.1** Introduce a single source of truth for sidebar widths: expanded = 140px, collapsed = 40px (e.g. React context, CSS variables in a layout provider, or constants used by both sidebar and content wrapper).
- [X] **1.2** In `App.tsx`, make the content wrapper’s left padding (or margin) depend on sidebar state: when collapsed use 40px, when expanded use 140px. Ensure the sidebar (ReviewNavToolbar) state is available to the wrapper (e.g. lift state to a provider that wraps both, or use SidebarProvider + SidebarInset).
- [X] **1.3** Ensure the main content container (dashboard main or the div wrapping AppRouter) uses `flex-1` and `min-w-0` so the content area can grow when the sidebar collapses and overflow is handled correctly.
- [X] **1.4** Remove any unnecessary max-width or fixed width on the main content wrapper that would prevent expansion.
- [X] **1.5** Test: With sidebar expanded, content starts at 140px; with sidebar collapsed, content starts at 40px and table/content visibly gains space. No layout jump or overflow hidden on major dashboard pages.

---

## Phase 2 — Shared page structure

- [X] **2.1** Audit Orders, Invoicing, People (Customers), and Workers pages for current structure (header, toolbar, content, sidebar). Document any shared vs. ad-hoc patterns.
- [X] **2.2** Standardize page-level layout: page header row → actions/search/filter/columns row → content section → optional right detail sidebar. Apply consistent padding and gap (e.g. align with DashboardLayout main padding `p-3 sm:p-6` or a shared token).
- [X] **2.3** Optionally introduce shared wrappers (e.g. PageHeader, PageToolbar, PageContent) in `src/shared/` or `src/app/layout/` and use them in at least Orders and Invoicing; align People and Workers to the same structure.
- [X] **2.4** Normalize alignment: toolbar and header use the same horizontal padding and alignment across the four table pages.

---

## Phase 3 — Table responsiveness

- [X] **3.1** For Orders page: wrap the table in a container with `overflow-x-auto` and ensure the flex chain from dashboard main to table wrapper includes `min-w-0` where needed so horizontal scroll appears instead of crushing columns.
- [X] **3.2** For Invoicing page: same as 3.1 — table in `overflow-x-auto` wrapper; `min-w-0` along the flex chain.
- [X] **3.3** For People (Customers) and Workers pages: same table container and flex rules.
- [X] **3.4** Preserve or set readable minimum widths for table columns (via existing column state or min-width on columns); keep column toggle (Columns button) behavior unchanged.
- [X] **3.5** Verify at narrow desktop width (e.g. 1024px): tables show horizontal scroll when needed; no column crushing; action buttons remain usable.

---

## Phase 4 — Right detail sidebars

- [ ] **4.1** Standardize width: OrderDetailsSidebar and InvoiceDetailSidebar both use the same width (e.g. `w-96`). Document in contracts/detail-sidebar.md; apply to any other detail sidebars (People/Workers if present).
- [ ] **4.2** Ensure sticky header and close button: sidebar panel has a sticky top header with title and close (X); body area scrolls with `overflow-y-auto`.
- [ ] **4.3** Confirm backdrop and outside-click close: clicking backdrop closes sidebar; no body scroll lock when sidebar is open.
- [ ] **4.4** Apply consistent spacing and border/shadow to all detail sidebars so they look and behave the same.

---

## Phase 5 — UI/UX polish

- [X] **5.1** Typography: improve hierarchy for page titles and card titles (size/weight); ensure secondary text is clearly muted.
- [X] **5.2** Spacing: consistent spacing rhythm on cards, tables, and forms (padding/gap); align with design tokens or existing DashboardLayout spacing where possible.
- [X] **5.3** Buttons: standardize primary/secondary button styling on table pages; fix any label overflow or clipping (e.g. truncate or shorten labels).
- [X] **5.4** Cards and tables: consistent borders and backgrounds for table cards and sidebar panels.
- [X] **5.5** Empty and loading states: add or clean up empty-state and loading UI on Orders, Invoicing, People, Workers where missing or inconsistent.

---

## QA checklist

- [ ] **QA.1** Sidebar collapse: When the left sidebar is collapsed, the content area expands to the right (starts at ~40px). When expanded, content starts at ~140px. Verified on Orders and Invoicing at 1280px and 1024px viewport.
- [ ] **QA.2** Table readability: Orders and Invoicing tables remain readable; horizontal scroll appears when many columns are visible; no crushed columns. Column visibility/order controls still work.
- [ ] **QA.3** Right sidebars: Order and Invoice detail sidebars open on the right with same width; backdrop click and X close the sidebar; sidebar content scrolls internally; main page remains scrollable with sidebar open.
- [ ] **QA.4** No regressions: Create/edit order, create/edit invoice, open/close sidebars, navigate between dashboard pages — all work as before. No new console errors or layout jumps.

---

## Outputs

- Updated `App.tsx` and optionally `ReviewNavToolbar.tsx` (or new layout provider) for Phase 1.
- Consistent page structure and optional shared components for Phase 2.
- Table wrappers and flex/min-w-0 fixes in Orders, Invoicing, People, Workers for Phase 3.
- Standardized detail sidebar width and behavior for Phase 4.
- Typography, spacing, and empty/loading state improvements for Phase 5.
- QA sign-off using the checklist above.
