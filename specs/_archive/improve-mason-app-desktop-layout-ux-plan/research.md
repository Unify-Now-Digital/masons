# Phase 0: Research / Audit — Desktop Layout and UI/UX

## 1. Main Dashboard Shell Files

| Role | File | Notes |
|------|------|--------|
| App shell (sidebar + content wrapper) | `src/app/App.tsx` | Renders `ReviewNavToolbar` + `<div className="md:pl-[140px]">` wrapping `AppRouter`. Content padding is **fixed** at 140px on desktop. |
| Left sidebar (desktop) | `src/app/layout/ReviewNavToolbar.tsx` | Fixed left sidebar; `collapsed ? 'w-10' : 'w-[140px]'`. Collapse state is **local** to this component. |
| Dashboard layout (header + main) | `src/app/layout/DashboardLayout.tsx` | Rendered inside the padded div for `/dashboard/*`. Contains top header + `<main className="flex-1 p-3 sm:p-6 bg-slate-50 overflow-x-hidden">` and `<Outlet />`. |
| Router | `src/app/router.tsx` | Dashboard route uses `DashboardLayout`; nested routes render Orders, Invoicing, People, Workers, etc. |

**Finding:** The content area uses a **fixed** `md:pl-[140px]`. When the sidebar is collapsed (40px wide), the padding does not change, so the main content does not expand. Sidebar collapse state lives only in `ReviewNavToolbar` and is not shared with the wrapper in `App.tsx`.

## 2. Shared Layout Primitives

| Primitive | Location | Usage |
|-----------|----------|--------|
| Sidebar (shadcn) | `src/shared/components/ui/sidebar.tsx` | Exports `SidebarProvider`, `Sidebar`, `SidebarInset`, etc. **Not currently used** in the app shell; `App.tsx` uses custom `ReviewNavToolbar` + fixed padding. |
| AppSidebar | `src/app/layout/AppSidebar.tsx` | Uses shadcn Sidebar; **not rendered** anywhere in current App/router. |
| DashboardLayout | `src/app/layout/DashboardLayout.tsx` | Header + main with `flex-1`, `overflow-x-hidden`. No sidebar; only wraps nested route content. |
| Card | `src/shared/components/ui/card.tsx` | Used on Orders, Invoicing, etc. for page container. |
| Table | `src/shared/components/ui/table.tsx` | Used in table pages. No shared “page layout” or “table page” wrapper. |

**Finding:** There is no shared “PageLayout” or “TablePageLayout” component. Each module (Orders, Invoicing, People, Workers) builds its own page structure (Card, tabs, toolbar, table, detail sidebar). The shadcn sidebar system (SidebarProvider + SidebarInset) exists but is not wired into the app shell.

## 3. Breakpoints, Widths, and Overflow

### 3.1 Content not expanding on sidebar collapse

- **Cause:** In `App.tsx`, the content wrapper has `className="md:pl-[140px]"`. This is a fixed value and does not depend on sidebar state.
- **Sidebar widths:** `ReviewNavToolbar` uses `w-[140px]` when expanded and `w-10` (40px) when collapsed. There is no shared constant or CSS variable; values are duplicated.
- **Fix direction:** Make content left offset depend on sidebar state (e.g. lift state to a provider or use a layout that uses the same widths), or adopt SidebarProvider + SidebarInset so the content area is the “inset” and gets correct spacing via the sidebar component.

### 3.2 Tables compressing

- **Orders:** `SortableOrdersTable` inside a Card; table is in a scrollable container. Column widths come from `columnState` (tableViewPresets). No explicit `min-w-0` on the content chain; overflow behavior may depend on parent flex.
- **Invoicing:** Similar: table inside Card with column state. Both pages use a single Card wrapping the table.
- **Risk:** If the main content area or Card does not have `min-w-0`, flex children can overflow and cause layout issues. Tables may be forced to shrink if the container has a fixed or max width without horizontal scroll.

### 3.3 Right detail sidebars

- **Orders:** `OrderDetailsSidebar` + backdrop (`fixed inset-0 z-40 bg-black/10`). Sidebar is fixed/absolute; closing via backdrop click or X.
- **Invoicing:** `InvoiceDetailSidebar` + same backdrop pattern.
- **People/Workers:** To be confirmed; if they have detail panels, they should follow the same pattern for consistency.
- **Observation:** Backdrop and z-index are consistent; width and internal structure (sticky header, scroll) may differ and should be standardized.

## 4. Identified Files for Each Phase

### Phase 1 — Global dashboard shell
- `src/app/App.tsx` — content wrapper padding must respond to sidebar state.
- `src/app/layout/ReviewNavToolbar.tsx` — sidebar widths (140px / 40px); consider exposing state or using a shared layout.
- Optionally: introduce a small layout context or use shadcn `SidebarProvider` + `SidebarInset` and migrate sidebar into it.

### Phase 2 — Shared page structure
- `src/modules/orders/pages/OrdersPage.tsx`
- `src/modules/invoicing/pages/InvoicingPage.tsx`
- `src/modules/customers/pages/CustomersPage.tsx` (People)
- `src/modules/workers/pages/WorkersPage.tsx`
- Optional: new shared components (e.g. `PageHeader`, `PageToolbar`, `PageContent`) in `src/shared/` or `src/app/layout/`.

### Phase 3 — Table responsiveness
- Orders: `SortableOrdersTable` + OrdersPage table container.
- Invoicing: InvoicingPage table + column definitions.
- People (Customers): CustomersPage table.
- Workers: WorkersPage table.
- Shared: `src/shared/tableViewPresets/` (column definitions, state); ensure table wrapper has `overflow-x-auto` and `min-w-0` where needed.

### Phase 4 — Right detail sidebars
- `src/modules/orders/components/OrderDetailsSidebar.tsx`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`
- Any detail panel in People/Workers; ensure same width, sticky header, internal scroll, and outside-click close.

### Phase 5 — UI/UX polish
- Same pages as Phase 2; typography (titles, labels), spacing (cards, tables, forms), button styling, empty/loading states.

## 5. Summary

- **Root cause of content not expanding:** Fixed `md:pl-[140px]` in `App.tsx` that does not change when `ReviewNavToolbar` collapses. Sidebar state is local to the toolbar.
- **Layout primitives:** Shadcn sidebar exists but is unused in the shell; no shared page layout component.
- **Tables:** Need `min-w-0` along the flex chain and explicit horizontal scroll on table containers; column min-widths and existing column controls should be preserved.
- **Right sidebars:** Pattern is consistent (backdrop + fixed panel); standardize width, header, and scroll behavior.
