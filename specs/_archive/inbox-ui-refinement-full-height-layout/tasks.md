# Inbox UI Refinement — Tasks

## Phase 1: Full-height layout and independent scrolling

- [X] **1.1** DashboardLayout: In `src/app/layout/DashboardLayout.tsx`, change `<main>` to `className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden p-3 sm:p-6 bg-slate-50"` so the Outlet receives a bounded height.
- [X] **1.2** UnifiedInboxPage: Change root wrapper from `space-y-4` to `flex flex-col flex-1 min-h-0 overflow-hidden`. Add `shrink-0` to the header block (title + actions). Wrap the three-column grid in a div with `flex-1 min-h-0 min-w-0 overflow-hidden`; set the grid to `h-full min-h-0 grid gap-4 ...` (keep existing grid-cols).
- [X] **1.3** UnifiedInboxPage left column: Ensure the column wrapper has `flex flex-col min-h-0 overflow-hidden` (and keep or add `h-full` as needed). Remove or reduce `rounded-lg`; add sidebar-style `border-r bg-muted/30` (or similar).
- [X] **1.4** UnifiedInboxPage center column: Ensure the column wrapper has `flex flex-col min-h-0 overflow-hidden`. Remove the inner `min-h-[200px]` wrapper; let ConversationView fill the column directly with `flex-1 min-h-0 flex flex-col overflow-hidden` on the column’s child.
- [X] **1.5** UnifiedInboxPage right column: Keep `flex flex-col min-h-0 overflow-hidden`; ensure PersonOrdersPanel can fill height (next phase).
- [X] **1.6** ConversationView: Ensure root is `h-full flex flex-col min-h-0 overflow-hidden`. Add `shrink-0` to ConversationHeader wrapper if needed. Ensure the ConversationThread container can grow (flex-1 min-h-0 overflow-hidden). Empty state (no conversation): use a wrapper that preserves flex chain (e.g. flex-1 min-h-0 flex items-center justify-center).
- [X] **1.7** ConversationThread: Set the message list scroll container to `flex-1 min-h-0 overflow-auto` (add `min-h-0` if missing). Ensure composer wrapper has `shrink-0`.
- [X] **1.8** PersonOrdersPanel: Replace outer Card with a div that has `h-full flex flex-col min-h-0 overflow-hidden`. Title block `shrink-0`. Wrap summary + order list in one div with `flex-1 min-h-0 overflow-auto` so the right column has a single scroll region.
- [X] **1.9** Verify: Long conversation list scrolls only in left column; long thread scrolls only in center; composer stays visible at bottom of center; right panel scrolls; no full-page scroll.

## Phase 2: Left sidebar visual refinement

- [X] **2.1** InboxConversationList: Replace each conversation row’s Card/CardHeader with a single list row (e.g. `<button>` or clickable `<div>`) with `border-b`, `py-2 px-3`, minimal or no rounded corners, and hover/selected styles. Keep checkbox, channel icon, person name, preview, timestamp, and all badges; move same content into the new row structure.
- [X] **2.2** InboxConversationList: Ensure toolbar (filters + channel + search) has `shrink-0` and compact layout. Optionally reduce row gap (e.g. `space-y-0`) for a tighter list.
- [X] **2.3** InboxConversationList: Strengthen selected row state (e.g. background + left border or ring) so the active conversation is clearly indicated.

## Phase 3: Center and right panel styling

- [X] **3.1** ConversationHeader: Adjust padding and typography (e.g. `px-3 py-2`, text sizes) to align with target mockup; keep order badge and link controls.
- [X] **3.2** ConversationThread: Add padding to the message scroll area (e.g. `px-3 py-2`); optionally adjust message spacing (`space-y-3`). Refine composer block: “Reply via” label and Select styling; AI suggestion chip; textarea and Send button spacing.
- [X] **3.3** PersonOrdersPanel: Use a simple panel container (no heavy Card); title as a plain heading. Ensure summary + list scroll region has consistent padding.
- [X] **3.4** OrderContextSummary: Use lighter container (e.g. `rounded-md border bg-muted/20 p-3`); adjust spacing and typography for side-panel look.

## Verification (no new tasks)

- [ ] Conversation selection, message load, send reply, AI suggestion, person link/change link, archive, mark unread, order context load, order row click → OrderDetailsSidebar all still work.
- [ ] Other dashboard routes (e.g. Orders, Customers) still scroll correctly when main has `min-h-0 overflow-hidden` (their roots should fill and scroll inside main if needed).
