# Unified Inbox — Layout & Tabs UX Update

## Overview

**Goal:** Update the Unified Inbox page UI to:
1. Remove the **Unread** tab (keep unread badges/counts + existing "Mark as Read" behavior).
2. Make the **conversation picker cards** smaller/denser and the conversation list column narrower.
3. Make the **conversation window wider** by reallocating horizontal space using a fixed-width 3-column layout.

**Scope:** Styling and layout only. No data model, queries, or backend changes.

---

## Context

### Current UI
- **Tabs:** All | Unread | Email | SMS | WhatsApp
- **Layout:** 3-column — People list (left), Conversations list (middle), Conversation panel (right)
- **Conversation list:** Cards with CardHeader, padding, preview text, badges
- **Conversation panel:** Message bubbles with `max-w-xs lg:max-w-md`; message list scrolls via container ref (no page scroll jump)

### Data Model (unchanged)
- `inbox_conversations` / `inbox_messages`; linking states; `unread_count`; filters (`status`, `channel`, `unread_only`, `person_id`, `unlinked_only`, `search`)
- API: `fetchConversations(filters)` — `unread_only: true` used only when Unread tab is selected

---

## Non-Goals / Must Not Break

- Do **NOT** change the locked architecture (Invoices → Orders → Jobs → Installations).
- Do **NOT** change data models or queries (inbox_conversations/messages, linking states, unread_count logic).
- Do **NOT** reintroduce page scroll jump; keep scrolling confined to the message container (existing fix must remain).
- Do **NOT** remove unread badges or unread_count usage; only remove the Unread **tab** and any filter logic exclusively for that tab.

---

## Functional Requirements

### A) Tabs
- **Remove** the Unread tab from the Unified Inbox tabs UI.
- **Remove** any `unread` tab filtering branch/case in code (e.g. `activeTab === 'unread'` → `base.unread_only = true`).
- **Ensure** All / Email / SMS / WhatsApp tabs behave exactly as before (All = no channel filter; Email/SMS/WhatsApp = single channel).

### B) Layout widths
- Convert (or adjust) the page layout to a stable 3-column structure using CSS grid:
  - `grid-cols-[180px_260px_1fr]`
- Each column should remain independently scrollable where applicable:
  - **People list:** `h-full overflow-auto` (or equivalent)
  - **Conversation list:** `h-full overflow-auto`
  - **Conversation panel:** message list scrollable; composer stays pinned at bottom; do **NOT** allow whole-page scrolling to jump when switching conversations.

### C) Conversation list card compact styling
Update the conversation list item/card component styles to be denser:
- Reduce padding to approx `p-2.5` or `p-3`
- Reduce gaps to `gap-2`
- **Preview line:** 1-line clamp/truncate (use `line-clamp-1` if available; otherwise `truncate` with single-line layout)
- **Badges:** use smaller text/padding (e.g. `text-xs px-2 py-0.5`)
- **Selected state:** remains clearly visible (keep existing selected styling; ring/border highlight acceptable)

### D) Conversation panel message bubble width
- In the conversation panel, cap message bubbles to **max-w-[75%]** (both inbound and outbound).
- Do **not** change message rendering logic, timestamps, ordering, or send behavior.

---

## Acceptance Criteria

- [ ] Unread tab is gone.
- [ ] All remaining tabs (All, Email, SMS, WhatsApp) work the same as before.
- [ ] Column widths match: People ~180px, Conversations ~260px, Conversation panel wider (1fr).
- [ ] Conversation cards are visibly smaller/denser; preview is 1-line.
- [ ] Conversation panel is wider; message bubbles do not stretch beyond ~75% width.
- [ ] No regressions to scroll behavior (no page jump; scrolling stays in message list).
- [ ] No backend/DB changes.
- [ ] Build passes; no TS errors.

---

## Implementation Notes

### Files to locate and likely touch
| Area | File (guidance) |
|------|------------------|
| Page + tabs + layout | `src/modules/inbox/pages/UnifiedInboxPage.tsx` |
| Tabs | Tabs/TabsList/TabsTrigger in same file (no separate InboxTabs) |
| Conversation list cards | Same file — Card/CardHeader for each conversation item |
| Conversation panel / messages | `src/modules/inbox/components/ConversationView.tsx` |
| Filters | `src/modules/inbox/pages/UnifiedInboxPage.tsx` (filters useMemo); optionally `src/modules/inbox/api/inboxConversations.api.ts` only if removing unread_only usage from callers |
| Types | `src/modules/inbox/types/inbox.types.ts` — ConversationFilters may still include `unread_only` for API; remove only the tab and the branch that sets it from activeTab |

### A) Tabs
- In `UnifiedInboxPage.tsx`: Remove `<TabsTrigger value="unread">Unread</TabsTrigger>`.
- Change `TabsList` from `grid-cols-5` to `grid-cols-4`.
- In the `filters` useMemo: remove the `if (activeTab === 'unread') { base.unread_only = true; }` branch (so no filter ever sets `unread_only` from tab choice).

### B) Layout
- Replace the main content layout (e.g. `flex gap-0` + `grid grid-cols-1 lg:grid-cols-2`) with a single grid: e.g. `grid grid-cols-[180px_260px_1fr]` (with responsive handling if needed, e.g. collapse to stacked on small screens).
- Apply `h-full overflow-auto` (or equivalent) to People column and Conversations column containers.
- Conversation panel: keep existing structure; ensure message list scroll is container-only (already fixed).

### C) Conversation cards
- Reduce Card/CardHeader padding (e.g. `p-2.5` or `p-3`), inner gaps to `gap-2`.
- Preview: ensure single line with `line-clamp-1` or `truncate`.
- Badges: `text-xs px-2 py-0.5` (or similar).

### D) Message bubbles
- In `ConversationView.tsx`, change bubble container from `max-w-xs lg:max-w-md` to `max-w-[75%]` for both inbound and outbound bubbles.

---

## Notes

- Prefer minimal changes: styling + layout only.
- Keep existing shadcn/ui patterns and Tailwind conventions used in the codebase.
