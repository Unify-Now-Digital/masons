# Inbox UI Refinement — Layout and Scrolling Research

## Parent layout that must be height-bound

**File:** `src/app/layout/DashboardLayout.tsx`

- Layout root: `<div className="min-h-screen flex flex-col w-full">`.
- Header: `<header className="h-14 border-b ...">` (fixed height).
- Main: `<main className="flex-1 min-w-0 p-3 sm:p-6 bg-slate-50 overflow-x-hidden">` then `<Outlet />`.

**Finding:** `<main>` has `flex-1` but does **not** have `min-h-0` or `overflow-hidden`. In a flex column, a child with `flex-1` can still grow with content unless it has `min-h: 0`, which allows it to shrink and pass a bounded height to its children. Without `min-h-0`, the main element expands with the Outlet content (UnifiedInboxPage), so the whole page scrolls.

**Required change:** Add `min-h-0 overflow-hidden flex flex-col` to `<main>` so it (1) can shrink below content size and (2) establishes a flex container for the Outlet. The Outlet renders UnifiedInboxPage; UnifiedInboxPage root must then be `flex-1 min-h-0 flex flex-col overflow-hidden` so it fills main and establishes the height bound for the three-column grid.

## Current UnifiedInboxPage structure

- Root: `<div className="space-y-4">` — no flex, no height constraint; adds vertical gap.
- Header block: title + Archive / Mark read-unread (variable height).
- Grid wrapper: `<div className="grid gap-4 min-h-[480px] min-h-0 ...">` — grid has `min-h-[480px]` but no `flex-1` or `h-full`, so it does not take "remaining viewport height"; it grows with content.

## Scroll regions today

- **InboxConversationList:** Outer `h-full min-h-0 flex flex-col overflow-hidden`. Toolbar and search are `shrink-0`. List container has `flex-1 min-h-0 overflow-auto` — correct pattern, but the **parent** (UnifiedInboxPage left column) and the **page** do not supply a bounded height, so `h-full` and `flex-1` have no limit and the list grows the page.
- **ConversationView:** Root `h-full flex flex-col min-h-0 overflow-hidden`. ConversationHeader has no explicit shrink-0 (relies on default). ConversationThread has message area `flex-1 min-w-0 space-y-4 overflow-y-auto` — missing `min-h-0` on the scroll container; composer is `shrink-0`. Again, the chain from the page is unconstrained so the center column grows.
- **PersonOrdersPanel:** Wrapped in Card; order list has `max-h-48 overflow-y-auto` (fixed max height). Summary + list are not in a single `flex-1 min-h-0 overflow-auto` column structure; the panel does not fill or scroll within a bounded right column.

## Flex/grid min-h-0 and overflow rules

- In a flex column, a child with `flex: 1` gets remaining space but has a default `min-height: auto`, so it cannot shrink below its content unless we set `min-h-0`.
- Once a container has a bounded height and `overflow: hidden`, inner flex children with `flex-1 min-h-0 overflow-auto` become the scroll containers.
- Grid items participate in the grid; for a grid cell to contain a scrollable area, the cell (or its wrapper) needs `min-height: 0` and `overflow: hidden`, and the scrollable content inside needs `flex-1 min-h-0 overflow-auto` if the cell is a flex column.

## Center column: what scrolls vs what stays fixed

- **Fixed (shrink-0):** ConversationHeader (person name, order badge, link controls).
- **Scroll:** Message thread only — the div that wraps the list of message bubbles must be `flex-1 min-h-0 overflow-auto`.
- **Fixed (shrink-0):** Reply composer block (Reply via, AI suggestion chip, textarea, Send). So the center column flex chain is: Header (shrink-0) → Thread scroll (flex-1 min-h-0 overflow-auto) → Composer (shrink-0). The composer stays pinned at the bottom because the center column has a fixed height (from the viewport-bound chain) and only the thread scrolls.

## Risks to existing behavior

- **Changing only layout/CSS:** No changes to state, event handlers, or data fetching. Risk of breakage is limited to (1) a flex/overflow change accidentally hiding content or breaking scroll, or (2) a class change that affects click targets (e.g. removing a wrapper that had an onClick). Mitigation: keep all interactive elements and their handlers unchanged; only adjust container divs and classNames.
- **DashboardLayout shared by all dashboard routes:** Adding `min-h-0 overflow-hidden flex flex-col` to main could affect other pages that rely on main growing with content. Other pages (e.g. Orders, Customers) typically scroll the whole page; giving main `min-h-0` and `overflow-hidden` means the **page content** (Outlet) must fill main and handle its own scroll. So UnifiedInboxPage will fill and scroll internally; other routes might need their root to be `min-h-full` or `overflow-auto` so they still get document-style scroll. Recommendation: add `min-h-0 overflow-hidden flex flex-col` to main, and ensure UnifiedInboxPage root is `flex-1 min-h-0 flex flex-col overflow-hidden`. For other pages, if they use a simple scrollable document, their root can be `flex-1 min-h-0 overflow-auto` so they fill main and scroll within it. That preserves "one scroll region" behavior for those pages.
