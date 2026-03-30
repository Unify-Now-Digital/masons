# Layout Structure Model (Phase 1)

This document describes the target layout structure for the Mason App desktop shell and page-level layout. No database schema changes are involved.

## 1. Global Shell Structure

### Current (problematic)
```
App
├── ReviewNavToolbar (fixed left; collapsed=40px, expanded=140px)
└── div.md:pl-[140px]   ← fixed; does not respond to collapse
    └── AppRouter
        └── DashboardLayout (for /dashboard/*)
            ├── header
            └── main.flex-1.p-3.sm:p-6.overflow-x-hidden
                └── Outlet (Orders, Invoicing, etc.)
```

### Target
- **Content left offset** must be dynamic: when sidebar is collapsed use ~40px (or 2.5rem); when expanded use ~140px (or 14rem). Single source of truth for these widths (e.g. CSS variables or shared constants).
- **Main content area** must use flexible layout: `flex-1`, `min-w-0` so it can grow/shrink and not block expansion when sidebar collapses.
- **No unnecessary max-width** on the main content wrapper that would prevent using full remaining width.

### Recommended implementation options
- **Option A:** Lift sidebar collapsed state to React context (e.g. `SidebarLayoutProvider`) in `App.tsx`; content wrapper uses `pl-10` when collapsed, `pl-[140px]` when expanded.
- **Option B:** Use shadcn `SidebarProvider` + `Sidebar` + `SidebarInset` in `App.tsx`, and migrate `ReviewNavToolbar` into the Sidebar component so the inset automatically gets correct margin. Sidebar width is then driven by the sidebar primitive (CSS variables `--sidebar-width`, `--sidebar-width-icon`).

## 2. Page-Level Structure (Table Pages)

Target pattern for Orders, Invoicing, People, Workers:

| Zone | Purpose | Notes |
|------|---------|--------|
| Page header | Title and optional breadcrumb | Consistent padding and typography |
| Toolbar row | Search, filters, column picker, primary actions | Single row; consistent gap and alignment |
| Content area | Table (or other main content) | Scrollable; `min-w-0` so flex can shrink; table in `overflow-x-auto` wrapper |
| Right detail sidebar | Optional; opens when row/item selected | Fixed position; consistent width; backdrop for outside click |

### Shared conventions
- **Padding:** Use consistent horizontal/vertical padding (e.g. same as DashboardLayout main: `p-3 sm:p-6` or a shared token).
- **Gap:** Consistent gap between toolbar items and between sections.
- **Alignment:** Toolbar and header align to the same horizontal edges.

## 3. Table Container Rules

- **Wrapper:** Table must live in a container with `overflow-x-auto` (or `overflow-x: auto`) so horizontal scroll appears when the table is wider than the viewport.
- **Column widths:** Preserve readable minimum widths; avoid compressing columns below a sensible minimum. Use existing column state (visibility, order, width) from tableViewPresets where applicable.
- **Flex chain:** From dashboard main → page container → table wrapper: each level that participates in flex should have `min-w-0` where appropriate so overflow is not hidden incorrectly.

## 4. Right Detail Sidebar Conventions

| Aspect | Convention |
|--------|-------------|
| Width | Single standard (e.g. 400px or max-w-md) |
| Position | Fixed right; z-index above content; below any global modals |
| Header | Sticky; close button and title |
| Body | Scrollable (overflow-y-auto) |
| Backdrop | Semi-transparent overlay; click closes sidebar |
| No scroll lock | Opening sidebar must not lock body scroll (avoid modal behavior that sets overflow: hidden on body) |

## 5. Entities (Layout Only)

No database entities. “Entities” here are layout segments:

- **Shell:** App → Sidebar (or Nav) + Content wrapper
- **Dashboard layout:** Header + Main (Outlet)
- **Table page:** Header row, Toolbar row, Content (table wrapper + table), Detail sidebar (optional)
- **Detail sidebar:** Backdrop + Panel (header + body)

These are implemented as React components and CSS; no new tables or API contracts.
