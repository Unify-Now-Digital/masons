# Tasks: Unified Inbox Layout & Tabs UX Update

**Branch:** feature/unified-inbox-layout-tabs-ux  
**Spec:** specs/unified-inbox-layout-tabs-ux.md

---

## Phase 0 — Guardrails
- [X] UI-only: tabs, layout, styling. No data fetching, unread_count logic, linking logic, or DB changes.
- [X] Preserve "no page scroll jump" (message container scroll only).
- [X] Do not remove unread badges or "Mark as Read"; only remove Unread tab and its filter branch.

---

## Phase 1 — Locate key components (done in research.md)
- [X] Unified Inbox page: `UnifiedInboxPage.tsx`
- [X] Tabs: same file (TabsList, TabsTrigger — All, Unread, Email, SMS, WhatsApp)
- [X] Conversation list items: same file (Card/CardHeader per conversation)
- [X] Message bubbles: `ConversationView.tsx` (inline divs, no separate MessageBubble component)
- [X] People column: `PeopleSidebar.tsx`

---

## Phase 2 — Remove Unread tab

### Task 2.1: Remove Unread tab from UI [X]
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- Remove `<TabsTrigger value="unread">Unread</TabsTrigger>`.
- Change `TabsList` from `grid-cols-5` to `grid-cols-4`.

### Task 2.2: Remove unread tab filter branch [X]
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- In the `filters` useMemo, remove the block:
  `if (activeTab === 'unread') { base.unread_only = true; }`
- Ensure All / Email / SMS / WhatsApp branches are unchanged.

### Check
- Unread badges on conversation cards still display.
- "Mark as Read" button still works (unchanged).

---

## Phase 3 — Fixed 3-column layout

### Task 3.1: Apply grid layout [X]
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- Replace the main content wrapper (current `flex gap-0` and inner `grid grid-cols-1 lg:grid-cols-2`) with a single grid:
  - `grid grid-cols-[180px_260px_1fr] gap-4 min-h-[480px]` (or equivalent with responsive if desired, e.g. `lg:grid-cols-[180px_260px_1fr]` and `grid-cols-1` on small screens).
- Column 1: People sidebar (180px).
- Column 2: Conversations list (260px).
- Column 3: Conversation panel + PersonOrdersPanel (1fr).

### Task 3.2: Column scroll containment [X]
- People column: ensure container has `h-full overflow-auto` (PeopleSidebar already has internal `overflow-y-auto`; parent column may need `min-h-0` / `overflow-hidden` so flex/grid children scroll correctly).
- Conversations column: `h-full overflow-auto` (and `min-h-0` if inside flex/grid).
- Conversation panel: message list scroll remains container-only (no change to ConversationView scroll behavior).

### Check
- No whole-page scroll jump when switching conversations.
- Only message list scrolls, not the entire page.

---

## Phase 4 — Conversation card density

### Task 4.1: Compact card styling [X]
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- Conversation Card: reduce padding to `p-2.5` or `p-3` (e.g. on Card or CardHeader).
- Inner gaps: `gap-2` (e.g. between icon, text, timestamp row; and for badges row).
- Preview line: ensure single line — use `line-clamp-1` or keep `truncate` with single-line layout (e.g. `truncate` on the preview div).
- Badges: smaller — e.g. `text-xs px-2 py-0.5` (unread badge and channel badge).
- Keep selected state: existing `ring-2 ring-blue-500` (or equivalent) when `selectedConversationId === conversation.id`.

### Check
- Cards are visibly shorter; more items per viewport.
- Preview text is exactly one line (no wrapping).

---

## Phase 5 — Message bubble width cap

### Task 5.1: Cap bubble width to 75% [X]
**File:** `src/modules/inbox/components/ConversationView.tsx`
- In the message bubble container (the inner div with `max-w-xs lg:max-w-md`), replace with `max-w-[75%]` for both inbound and outbound bubbles.
- Do not change message content, timestamps, order, or send behavior.

### Check
- Bubbles do not stretch across full panel width; layout clean on large screens.

---

## Phase 6 — QA / Acceptance

- [X] Unread tab removed.
- [X] All / Email / SMS / WhatsApp tabs work as before.
- [X] Column widths: People ~180px, Conversations ~260px, panel expands (1fr).
- [X] Conversation cards denser; preview 1-line.
- [X] Bubbles capped at ~75%.
- [X] No scroll regressions (no page jump; message container scroll only).
- [X] No TS errors; lint clean (or existing only).
- [X] Build passes: `npm run build`.

---

## Phase 7 — Commit plan

1. **Commit 1:** Remove Unread tab + filter logic (Phase 2).
2. **Commit 2:** Layout grid + column scroll containment (Phase 3).
3. **Commit 3:** Conversation card density (Phase 4).
4. **Commit 4:** Bubble width cap + final polish (Phase 5).

---

## Output for /implement
- Minimal diffs; only the specified UI changes.
- No behavior changes outside tabs, layout, and styling.
