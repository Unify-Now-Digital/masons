# Refine Unified Inbox UI: Full-Height Layout and Mockup-Aligned Styling

## Overview

Focused visual and layout refinement of the Unified Inbox so it matches the target Claude mockup more closely while keeping the existing 3-column architecture and all working functionality. The first redesign pass removed the People column, added the three-column layout, filters, and order context panel; this phase fixes full-height layout and scrolling, and refines panel styling to feel like an app workspace rather than a long document.

**Context:**
- First redesign is done: 3 columns (conversation list | conversation area | order context), filters, channel dropdown, person-derived order context.
- Current issues: page grows vertically and pushes the composer out of view; columns do not have independent scrolling; left list and right panel feel card-heavy; center composer is not anchored at bottom of viewport.
- Scope: layout/CSS and component structure only. No backend, schema, or new business logic.

**Goal:**
- **Primary:** Full-height desktop layout with independent scrolling in each column so the reply composer stays visible and the page feels like an app workspace.
- **Secondary:** Refine left sidebar, center area, and right order panel styling to match the target mockup (tighter rows, less card-like, better spacing, anchored composer, clearer hierarchy).

---

## Current State Analysis

### Page Shell and Layout Chain

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Current structure:**
- Root wrapper: `<div className="space-y-4">` — adds vertical gap between header block and grid; no height constraint.
- Header block: title "Unified Inbox", subtitle, Archive + Mark read/unread buttons.
- Three-column grid: `grid gap-4 min-h-[480px] min-h-0 min-w-0 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px]`.
- Grid has `min-h-[480px]` but no maximum height or `flex-1` to fill viewport. Parent (Dashboard shell) likely does not constrain the Inbox content to viewport height, so the grid grows with content and the whole page scrolls.

**Observations:**
- The grid and its columns use `min-h-0` and `overflow-hidden` in places, but the **page-level wrapper** does not fill the viewport or establish a bounded height. So the content area expands with conversation list + thread length, pushing the composer down.
- Fix requires: (1) Inbox content area (header + grid) to fill available viewport height (e.g. `flex-1 min-h-0` in the Dashboard layout for the Inbox route, or a fixed height like `calc(100vh - <header height>)` on the grid container); (2) Grid to take remaining height (`flex-1 min-h-0` or equivalent); (3) Each column to be `flex flex-col min-h-0 overflow-hidden` with scrollable regions using `flex-1 min-h-0 overflow-auto`.

### Left Column (Conversation List)

**File:** `src/modules/inbox/components/InboxConversationList.tsx`

**Current structure:**
- Outer div: `h-full min-h-0 flex flex-col overflow-hidden`.
- Toolbar: filter buttons (All/Unread/Urgent/Unlinked), channel Select, search Input.
- List container: `flex-1 min-h-0 overflow-auto space-y-1` with conversation rows as `Card` components (rounded, border, padding).

**Observations:**
- Each row is a full `Card` with `CardHeader`, giving a heavy, card-like look. Target mockup uses a tighter list/sidebar style with lighter borders and less rounding.
- Parent in UnifiedInboxPage wraps the list in `border rounded-lg bg-card p-2` — contributes to “box” feel. Sidebar should feel like a dedicated panel with compact rows and clearer active state.

### Center Column (Conversation Area)

**Files:** `ConversationView.tsx`, `ConversationHeader.tsx`, `ConversationThread.tsx`

**Current structure:**
- **ConversationView:** `h-full flex flex-col min-h-0 overflow-hidden`; composes ConversationHeader (sticky) + ConversationThread.
- **ConversationThread:** Outer div `flex-1 flex flex-col min-h-0 overflow-hidden`; message area `flex-1 min-w-0 space-y-4 overflow-y-auto`; composer section `border-t pt-4 pb-2 ... shrink-0`.
- Thread message area has `flex-1` and `overflow-y-auto` but no explicit `min-h-0` on the scroll container in some paths; composer is `shrink-0` which is correct. The main issue is the **parent chain**: if the center column or the page doesn’t have a bounded height, the whole column grows and the composer moves down with page scroll.

**Observations:**
- Center column in UnifiedInboxPage: `min-h-0 min-w-0 flex flex-col overflow-hidden` with inner `flex-1 min-h-[200px]`. The `min-h-[200px]` allows the center to shrink but doesn’t force it to fill remaining space; combined with no viewport-bound on the grid, the center can grow and push composer down.
- Header spacing and thread spacing can be tightened; composer should sit at the bottom of the **visible** center column (viewport-bound), not at the bottom of content.

### Right Column (Order Context Panel)

**Files:** `PersonOrdersPanel.tsx`, `OrderContextSummary.tsx`

**Current structure:**
- PersonOrdersPanel: Card with CardHeader “Order context”, OrderContextSummary block, then scrollable order list.
- Wrapper in UnifiedInboxPage: `hidden lg:flex lg:flex-col min-h-0 min-w-0 overflow-hidden`.

**Observations:**
- Panel uses Card styling; target mockup has a cleaner side-panel look with better spacing and typography. Summary block and list can be refined for hierarchy and density without changing data.

### Layout / Scrolling Root Cause Summary

1. **No viewport-bound height:** The Inbox page content (header + grid) is not constrained to the viewport. The Dashboard (or App) layout likely gives the main content area `flex-1` or similar but the Inbox inner `space-y-4` div doesn’t participate in a flex chain that limits height, so the grid grows with content.
2. **Grid not filling remaining height:** The grid has `min-h-[480px]` but no `flex-1` or `height: 100%` so it doesn’t take “all remaining space” in a flex parent. So even if the parent were constrained, the grid would need to be the flex child that grows.
3. **Column scroll containment:** Left and right columns have scrollable regions; center has a scrollable thread and a fixed composer. For independent scrolling to work, the **page** must have a fixed height (or flex-bounded height), then the **grid** must fill that, then each **column** must be flex with `min-h-0` and inner scroll areas with `flex-1 min-h-0 overflow-auto`. The composer stays at the bottom of the center column because the center column has a fixed height (viewport-derived) and the thread scrolls inside it.

---

## Recommended Layout and Styling Adjustments

### Page Shell and Full-Height Layout

**Requirements:**
- Inbox content area (title + actions + three-column grid) must occupy the remaining viewport height below the app/Dashboard header without causing the whole page to scroll.
- The three-column grid must fill that remaining height and use `min-h-0` so flex/grid children can shrink and scroll.
- Left column: fixed-height toolbar (filters, channel, search) + scrollable list (`flex-1 min-h-0 overflow-auto`).
- Center column: fixed-height header + scrollable thread + pinned composer at bottom (header and composer `shrink-0`, thread `flex-1 min-h-0 overflow-auto`).
- Right column: fixed-height title + scrollable summary + list, or single scroll region containing both (summary + list) with `flex-1 min-h-0 overflow-auto`.

**Implementation approach:**
- Ensure the route/layout that wraps UnifiedInboxPage gives the main content a flex container with `flex-1 min-h-0` (e.g. Dashboard content area). Then in UnifiedInboxPage, make the root wrapper a flex column with `flex-1 min-h-0 overflow-hidden` (or `h-full` if the parent supplies a defined height). The header block stays `shrink-0`; the grid gets `flex-1 min-h-0 min-w-0 overflow-hidden`. Each column is `flex flex-col min-h-0 overflow-hidden`; scrollable regions get `flex-1 min-h-0 overflow-auto`. No schema or API changes.

### Left Column Styling

- Replace heavy Card-based conversation rows with a lighter list style: reduce border/radius, use a simple border-b or subtle background for separation, tighter padding (e.g. py-2 px-3), smaller typography where appropriate.
- Keep filters and channel dropdown in a compact toolbar at the top; ensure it doesn’t grow (shrink-0).
- Strengthen active row state (e.g. background + left border or accent) so the selected conversation is clearly indicated.
- Optionally reduce gap between rows (`space-y-0.5` or similar) for a denser sidebar feel.

### Center Column Styling

- ConversationHeader: adjust padding and spacing to match mockup; keep order badge and link controls.
- Thread: ensure the scroll container has `flex-1 min-h-0 overflow-auto` and message area fills available height; adjust message bubble spacing (space-y-3 or similar) for clarity.
- Composer: keep as `shrink-0` at the bottom of the center column; refine padding and “Reply via”/channel switcher to be lighter and more integrated; AI suggestion chip above the textarea in a cleaner style (no yellow banner).
- Ensure the center column’s flex chain is: header (shrink-0) → thread (flex-1 min-h-0 overflow-auto) → composer (shrink-0).

### Right Column Styling

- Make the order context panel read as a side panel: consistent padding, clear typography hierarchy (title, summary block, list). Reduce card heaviness (e.g. summary block with subtle border/background instead of heavy card).
- Keep summary + order list; ensure the list (or summary + list container) scrolls independently with `flex-1 min-h-0 overflow-auto` inside the column.
- Preserve click-to-open OrderDetailsSidebar; no new Actions section.

---

## Implementation Approach

### Phase 1: Full-Height Layout and Scrolling

1. **Dashboard/route layout:** Identify the parent of UnifiedInboxPage (e.g. Dashboard content wrapper). Ensure it is a flex container with `flex-1 min-h-0 overflow-hidden` so the Inbox can fill remaining height. If the layout already uses something like `flex-1`, ensure the Inbox root does not break the chain (e.g. use `flex-1 min-h-0 flex flex-col overflow-hidden` on the Inbox root).
2. **UnifiedInboxPage root:** Change root wrapper to a flex column that fills height: e.g. `flex flex-col flex-1 min-h-0 overflow-hidden` (or `h-full` if parent gives explicit height). Header block (title + actions) `shrink-0`. Grid wrapper `flex-1 min-h-0 min-w-0 overflow-hidden`.
3. **Grid:** Keep three-column grid; ensure it has `flex-1 min-h-0` (or equivalent) and `overflow-hidden` so it doesn’t grow past the viewport.
4. **Left column:** Column div `flex flex-col min-h-0 overflow-hidden`. Toolbar (filters, channel, search) `shrink-0`. List container `flex-1 min-h-0 overflow-auto`.
5. **Center column:** Column div `flex flex-col min-h-0 overflow-hidden`. ConversationView fills the column; inside it, header shrink-0, thread scroll region `flex-1 min-h-0 overflow-auto`, composer `shrink-0`.
6. **Right column:** Column div `flex flex-col min-h-0 overflow-hidden`. Title/header shrink-0; content (summary + list) in a single scroll container `flex-1 min-h-0 overflow-auto` or summary shrink-0 and list `flex-1 min-h-0 overflow-auto`.
7. Verify: Long conversation list scrolls only in left column; long thread scrolls only in center; composer stays visible at bottom of center; right panel scrolls independently. No full-page scroll for normal use.

### Phase 2: Left Sidebar Visual Refinement

- In InboxConversationList, replace Card-based rows with a simpler row component: minimal border (e.g. border-b), reduced padding, smaller text where appropriate, clear selected state.
- Adjust the wrapper in UnifiedInboxPage (left column) to a sidebar-style background/border (e.g. border-r, bg-muted/30) and remove or reduce rounded-lg if it feels too boxy.
- Keep filters and channel dropdown compact; ensure they don’t wrap in a way that breaks layout.

### Phase 3: Center and Right Panel Styling

- ConversationHeader: spacing and typography tweaks to match mockup.
- ConversationThread: thread scroll container `flex-1 min-h-0 overflow-auto`; composer section padding and “Reply via” styling; AI chip styling.
- PersonOrdersPanel and OrderContextSummary: spacing, typography, and light borders/backgrounds so the right column reads as a side panel without heavy cards.

### Safety Considerations

- No changes to data fetching, hooks, or state logic. Only layout (flex/grid, overflow, height) and CSS/styling.
- Test: conversation selection, message load, send reply, AI suggestion, person link, archive, mark unread, order list, order detail popout all still work after layout changes.
- If the Dashboard layout is shared with other routes, ensure only the Inbox content area gets the flex-1 min-h-0 treatment where appropriate so other pages are unaffected.

---

## What NOT to Do

- Do not add backend fields, new APIs, or new business logic.
- Do not remove or rewire conversation selection, message loading, send reply, AI suggestion, person linking, archive, mark unread, order context, or order sidebar popout.
- Do not introduce the yellow AI suggestion banner from the mockup.
- Do not add an Actions section to the order context panel.
- Do not change filter/channel/search behavior or data flow.

---

## Open Questions / Considerations

- **Dashboard layout:** The exact parent of UnifiedInboxPage (e.g. `src/pages/Dashboard.tsx` or route layout) must be inspected to ensure it provides a flex container with remaining height. If the app uses a fixed header and a main content area, that content area should be `flex-1 min-h-0` so the Inbox can consume it.
- **Mobile/responsive:** Full-height layout is desktop-first. On small screens the columns stack; ensure stacking still allows scrolling in each section or document-style scroll is acceptable there.
- **Cemetery tab:** If the current UI still shows a “Cemetery” filter tab from an older mockup, remove it in this refinement pass so the filter bar matches the agreed All/Unread/Urgent/Unlinked set.

---

## Deliverables for Next Phase

### Layout/Scrolling Fixes (exact issues and fixes)

1. **Root cause:** Page content is not constrained to viewport height; grid grows with content and full page scrolls, pushing composer down.
2. **Fix:** (a) Ensure parent layout gives Inbox a bounded height (flex-1 min-h-0). (b) Inbox root: flex column, flex-1 min-h-0 overflow-hidden; header shrink-0; grid flex-1 min-h-0 overflow-hidden. (c) Each column: flex flex-col min-h-0 overflow-hidden. (d) Scrollable regions: flex-1 min-h-0 overflow-auto. (e) Center: thread scroll + composer shrink-0 so composer stays at bottom of column.

### Files to Update

| File | Changes |
|------|--------|
| **Layout that wraps Inbox** (e.g. `src/pages/Dashboard.tsx` or route layout) | Ensure main content area is flex with `flex-1 min-h-0 overflow-hidden` so the Inbox page can fill height. |
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Root wrapper: `flex flex-col flex-1 min-h-0 overflow-hidden`. Header block: `shrink-0`. Grid container: `flex-1 min-h-0 overflow-hidden`. Left column wrapper: `flex flex-col min-h-0 overflow-hidden`; ensure list column has correct scroll. Center column: same; ensure ConversationView fills and scrolls. Right column: same. |
| `src/modules/inbox/components/InboxConversationList.tsx` | Toolbar shrink-0; list container `flex-1 min-h-0 overflow-auto`. Replace Card-based rows with lighter list rows (tighter padding, lighter border, clearer active state). |
| `src/modules/inbox/components/ConversationView.tsx` | Ensure root is `h-full flex flex-col min-h-0 overflow-hidden`; header shrink-0; thread wrapper flex-1 min-h-0 overflow-hidden so ConversationThread can fill and scroll. |
| `src/modules/inbox/components/ConversationThread.tsx` | Scrollable message area: `flex-1 min-h-0 overflow-auto` (ensure min-h-0 is set). Composer wrapper: shrink-0. Refine composer and “Reply via” styling. |
| `src/modules/inbox/components/ConversationHeader.tsx` | Spacing/typography to match mockup. |
| `src/modules/inbox/components/PersonOrdersPanel.tsx` | Column structure: title shrink-0; content (summary + list) in scrollable region `flex-1 min-h-0 overflow-auto`. Refine summary and list styling for side-panel look. |
| `src/modules/inbox/components/OrderContextSummary.tsx` | Spacing and typography; lighter card/border so it fits the panel. |

### Verification Checklist

- [ ] Inbox content area fills viewport below app header; no full-page scroll when list/thread are long.
- [ ] Left column: only the conversation list scrolls; filters/search stay at top.
- [ ] Center column: only the message thread scrolls; header and composer stay visible; composer at bottom of center column.
- [ ] Right column: order list (and summary if in same scroll) scrolls independently.
- [ ] Conversation selection, message load, send reply, AI suggestion, link/change link, archive, mark unread, order context, order popout all still work.
- [ ] Left sidebar looks tighter and less card-like; center and right panels have clearer hierarchy and spacing.
