# Unified Inbox — Compact Layout & Sidebar Collapse UX

## Overview

Make the Unified Inbox **more condensed and compact** on desktop — reducing dead space and improving information density — while **preserving all existing behavior** (reply, read/unread, scroll, selection, linking, unified All tab behavior).

**Context:**
- Unified Inbox currently has:
  - A full-width `PeopleSidebar` on the left.
  - Conversation list + `ConversationView` or `AllMessagesTimeline` in the center.
  - `PersonOrdersPanel` on the right (3-column layout on `lg+`).
- New features (reply-to chip, channel borders, source metadata, unified All tab) must remain functionally unchanged.

**Goal:**
- Tighten spacing in the Unified Inbox while:
  - Adding a **collapsible People sidebar** on desktop.
  - Reducing vertical padding and card spacing in conversation list and panels.
  - Slightly densifying the right Orders panel.
  - Optionally providing a “compact mode” toggle if trivial.

---

## Current State Analysis

### UnifiedInboxPage layout

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Key responsibilities:**
- Manages:
  - `activeTab` (All, Email, SMS, WhatsApp).
  - `selectedPersonId`, `selectedConversationId`, `selectedOrderId`.
  - Derived `activePersonId`.
- Renders:
  - **Header**: title, description, actions (Sync, Archive, Mark Read/Unread).
  - **Search bar**.
  - **Tabs** for channel selection.
  - Main **3-column grid** on `lg+`:
    - Col 1: `PeopleSidebar`.
    - Col 2: All tab unified timeline (`AllMessagesTimeline`) or channel-specific conversations (`ConversationView` + list).
    - Col 3: `PersonOrdersPanel`.

**Spacing characteristics:**
- Generous vertical spacing in:
  - Page header and description.
  - Tabs area.
  - Conversation cards (padding + gaps).
  - ConversationView / AllMessagesTimeline wrappers.
- `PeopleSidebar` is fixed width and non-collapsible.

### PeopleSidebar

**File:** `src/modules/inbox/components/PeopleSidebar.tsx`

**Behavior:**
- Shows a list of people / link candidates.
- Drives `selectedPersonId` and All tab unified timeline.

**Observations:**
- On desktop, the sidebar width is static.
- No built-in collapse/rail behavior.

### ConversationView / ConversationHeader / AllMessagesTimeline

**Files:**
- `src/modules/inbox/components/ConversationView.tsx`
- `src/modules/inbox/components/ConversationHeader.tsx`
- `src/modules/inbox/components/AllMessagesTimeline.tsx`

**Behavior:**
- Use `ConversationThread` to render messages with:
  - Reply-to chip & reply button.
  - Channel border colors.
  - Source metadata (subject/from/to).
- Layout uses Card-like wrappers with:
  - Header (title, secondary line, link controls).
  - Content area with scrolling thread.

**Spacing:**
- Comfortable padding in headers and content (safe but slightly tall for dense inbox use).

### PersonOrdersPanel

**File:** `src/modules/inbox/components/PersonOrdersPanel.tsx`

**Behavior:**
- Lists orders related to the active person.
- Supports selection of an order and showing details/sidebars.

**Spacing:**
- Uses standard card/list padding; can be slightly tightened without harming readability.

---

## Recommended Schema Adjustments

### Database / API

- **None.** This work is **purely presentational**:
  - No schema, Supabase functions, hooks, or API changes.
  - No modifications to `ConversationThread` message logic, reply, or read/unread.

### State & Hooks

- The only new state is a **local UI state** in `UnifiedInboxPage` for sidebar collapse (and optionally compact mode):
  - e.g. `const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);`
  - Optionally persisted per-session via `localStorage` or similar (not required).

---

## Implementation Approach

### Phase 1: Collapsible People sidebar (desktop-first)

**File:** `UnifiedInboxPage.tsx` (plus small additions in `PeopleSidebar.tsx` if needed)

- Add local state in `UnifiedInboxPage`:

```ts
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
```

- In the main grid:
  - For `lg+`, adjust the first column width dynamically based on `isSidebarCollapsed`:
    - Expanded: `~180px` (current behavior).
    - Collapsed: narrow rail `~56–64px`.
  - Use Tailwind to implement two width presets, e.g.:
    - `lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)_360px]` with a CSS variable on the wrapper, **or**
    - Two Tailwind classes toggled via `className` when collapsed vs expanded.

- Add a **collapse toggle button**:
  - Placed near the top of the sidebar area (within the first column wrapper).
  - E.g. small icon button (chevron) that:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
  aria-label={isSidebarCollapsed ? 'Expand people sidebar' : 'Collapse people sidebar'}
>
  {/* icon rotates based on collapsed state */}
</Button>
```

- Collapsed rail behavior:
  - PeopleSidebar can:
    - Render avatars/initials-only or a minimal indicator list when `collapsed` (prop).
    - Still allow clicking to select a person.
  - Full labels and details appear only when expanded.

> If necessary, pass `collapsed={isSidebarCollapsed}` from `UnifiedInboxPage` into `PeopleSidebar` and adjust its internals to show a compact view when collapsed (no behavioral changes, only styling/visibility).

### Phase 2: Tighten vertical padding and card density

**Files:**
- `UnifiedInboxPage.tsx` (header + search + tabs)
- `ConversationView.tsx` / `ConversationHeader.tsx`
- `AllMessagesTimeline.tsx`

Adjustments:
- Page header:
  - Reduce top/bottom margin slightly (e.g. remove extra `mt-1`, reduce `space-y-6` to `space-y-4`).
- Search/tabs:
  - Slightly smaller gaps (`gap-4` → `gap-3` where appropriate).
  - Tighten padding on `TabsList` and triggers (maintain touch targets, but avoid extra vertical whitespace).
- Conversation cards (list items):
  - Reduce `p-2` to something like `px-2 py-1.5` where safe.
  - Keep checkboxes, icons, and text alignment intact.
- ConversationHeader / AllMessagesTimeline:
  - Decrease header paddings (e.g. `py-3 px-4` → `py-2.5 px-3.5`) without changing typography.

All of the above should be one-line class changes; no logic changes.

### Phase 3: Right Orders panel density

**File:** `PersonOrdersPanel.tsx`

- Reduce vertical padding on list items and section headers:
  - E.g. shrink `py-3` → `py-2`, reduce gaps between items.
- Ensure:
  - Order title and key metadata remain readable.
  - Scroll area remains the same.

No structural changes; pure padding/gaps/`text-sm` vs `text-xs` decisions.

### Phase 4: Optional “compact mode” toggle (if trivial)

**File:** `UnifiedInboxPage.tsx`

- Add a UI toggle (e.g. a small toggle button or checkbox in the header) that flips `isCompact`:

```ts
const [isCompact, setIsCompact] = useState(true);
```

- When `isCompact` is true, use tighter paddings/gaps as per Phases 2–3; when false, fall back to previous, more spacious classes.
- If this introduces too much branching or CSS complexity, **skip** and keep compact as the default.

### Safety Considerations

- Must **not** change:
  - Reply-to-message UX or channel selection in `ConversationThread`.
  - Channel border color coding.
  - Source details metadata rows.
  - All-tab unified timeline data flow and scroll behavior (no extra nested scroll containers).
  - Read/unread, archive, or sync logic.
- All changes should be limited to **className tweaks** and a small amount of local UI state for collapse/compact.

---

## What NOT to Do

- Do **not**:
  - Touch backend schemas, migrations, or RLS.
  - Change hooks or query logic (`useInboxConversations`, `useInboxMessages`, etc.).
  - Modify `ConversationThread` internal logic (reply, read/unread, auto-scroll).
  - Introduce new layout systems (stick with Tailwind grid/flex as currently used).

---

## Open Questions / Considerations

- Exact widths for collapsed sidebar:
  - 56px vs 64px; should it show only avatars or also a one-letter initial?
- Whether compact mode should be:
  - Always on (global default), or
  - User-toggleable (with minor state persistence).
- Future enhancements:
  - Remember sidebar collapse and compact mode per user.
  - Expose a “comfortable vs compact” density preference in settings.

