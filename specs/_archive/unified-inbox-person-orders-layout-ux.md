# Unified Inbox — Person Orders Panel Right-Column Layout

## Overview

Move the **Related Orders** panel (`PersonOrdersPanel`) to the **right** of the conversation window in Unified Inbox to create a consistent 3‑column desktop layout and reduce vertical stacking.

**Context:**
- Current Unified Inbox layout mixes:
  - People sidebar (left)
  - Conversation list + Conversation view (center)
  - `PersonOrdersPanel` often stacked **below** the conversation on desktop.
- Users need a stable, glanceable view of:
  - Who they are talking to (People)
  - The conversation itself (center)
  - The person’s active orders (right)
  without scrolling up/down to see orders.

**Goal:**
- On large screens, standardize on:
  - **Left:** `PeopleSidebar`
  - **Center:** Conversation area (All tab unified timeline or Email/SMS/WhatsApp conversations)
  - **Right:** `PersonOrdersPanel` (“Related Orders”) as a dedicated column.
- Preserve existing behavior for selection, linking, reply, read/unread, and scroll.

---

## Current State Analysis

### UnifiedInboxPage layout

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Current behaviors (high level):**
- Manages:
  - Tabs: All | Email | SMS | WhatsApp
  - `selectedPersonId`, `selectedConversationId`
  - Layout wiring between:
    - `PeopleSidebar`
    - Conversation list + `ConversationView`
    - All-tab unified `AllMessagesTimeline`
    - `PersonOrdersPanel` (Related Orders)
- On All tab with a linked person:
  - Shows person unified timeline via `AllMessagesTimeline`.
  - `PersonOrdersPanel` may render **below** the conversation in some breakpoints.
- On Email/SMS/WhatsApp tabs:
  - Classic 3‑column view (People | Conversations list | Conversation view).
  - Orders panel sometimes stacked under the conversation, not as a right column.

**Issues:**
- Desktop users must scroll to see Related Orders.
- Layout is inconsistent across tabs and link states.

### PersonOrdersPanel

**File:** `src/modules/inbox/components/PersonOrdersPanel.tsx`

**Current behavior (in scope):**
- Shows orders related to the currently active person.
- May have existing collapse behavior or internal scrolling.

**Constraints:**
- Must remain functionally unchanged:
  - Clicking orders opens existing inline sidebar/details.
  - Linking logic and data loading unaffected.

---

## Recommended Schema Adjustments

### Database Changes

- **None.** This is purely a layout/composition change in the frontend.

### Query/Data-Access Alignment

- All existing hooks and queries for people, conversations, and orders remain as-is.
- Only **where** `PersonOrdersPanel` is placed in the JSX changes, not **how** it is populated.

---

## Implementation Approach

### Phase 1: Standardize the desktop 3‑column grid

**File:** `UnifiedInboxPage.tsx`

- Audit the main grid container for Unified Inbox (likely a `div` or `main` with Tailwind grid classes).
- Target a **desktop layout** along the lines of:
  - `lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(320px,420px)]`
  - Or an equivalent `lg:grid-cols-3` + per-column width utilities.
- Ensure:
  - Column 1: `PeopleSidebar`
  - Column 2: Conversation area (All tab unified timeline or channel tabs).
  - Column 3: `PersonOrdersPanel`.

### Phase 2: Move PersonOrdersPanel to the right column

**File:** `UnifiedInboxPage.tsx`

- Extract or refactor the JSX so that `PersonOrdersPanel`:
  - Lives in the **third grid column** on lg+ screens, not nested under the conversation.
  - Remains rendered for:
    - All tab + linked person (unified timeline).
    - Email/SMS/WhatsApp tabs when a person is resolved.
    - Unlinked mode: either hidden or shows the existing “no person selected”/empty state (unchanged).
- If `PersonOrdersPanel` currently appears inside the center column wrapper:
  - Lift it out and render it as a sibling column, sharing the same selected person state.

### Phase 3: Preserve and (if needed) restore collapse behavior

**File(s):** `PersonOrdersPanel.tsx` (and/or its parent wiring in `UnifiedInboxPage.tsx`)

- If a collapse control already exists:
  - Keep the same control and simply render the panel in the right column.
- If collapse behavior is missing or minimal:
  - Optionally add a small header toggle (e.g. “Related orders ▾”) inside `PersonOrdersPanel`.
  - Collapse should:
    - Hide the internal content but keep the column structure intact.
    - Not affect other state (selected order, etc.).

### Phase 4: Responsive behavior

- On small screens (`< lg`):
  - Acceptable behaviors:
    - Orders panel stacks **below** the conversation.
    - Or is hidden behind its collapse toggle to avoid crowding.
  - Use Tailwind responsive utilities:
    - E.g. `hidden lg:block` on the right column wrapper, plus an optional stacked variant for mobile if desired.
- On lg+:
  - Ensure `PersonOrdersPanel` is **always** in the right column, not stacked.

### Safety Considerations

- Ensure the following behaviors remain unchanged:
  - Selecting a person:
    - Still filters conversations.
    - Still drives All tab unified timeline as before.
  - Selecting an order:
    - Still opens inline order details/sidebar as currently implemented.
  - All tab:
    - Unified timeline scroll behavior remains intact (no extra scroll containers or overflow changes).
  - Reply/read/unread logic:
    - No changes to `ConversationThread`, `ConversationView`, or inbox hooks.

---

## What NOT to Do

- Do **not**:
  - Modify database schema, Supabase functions, or inbox hooks.
  - Refactor `ConversationThread` reply logic or read/unread behavior.
  - Introduce new dependencies or layout systems (stick to existing Tailwind grid/flex approach).
  - Change the semantics of selection, linking, or order details.

---

## Open Questions / Considerations

- Exact desktop widths for the right column:
  - E.g. lock near `360–400px` vs more flexible `minmax(320px, 420px)`.
- How aggressively to show/hide the orders panel on small screens:
  - Always stacked vs only under a collapse header.
- Whether future iterations should:
  - Allow users to resize the orders panel.
  - Add per-tab visibility prefs (out of scope for this spec).

