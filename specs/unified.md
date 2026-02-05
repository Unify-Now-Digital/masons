# Unified Inbox — All-tab Person Timeline Auto-Scroll to Bottom

## Overview

Ensure that when a person is selected in the Unified Inbox “All” tab and the unified chronological timeline view is shown, the message list automatically scrolls to the bottom so the latest message is visible by default.

**Context:**
- The Unified Inbox has an “All” tab that, when a person is selected, shows a unified chronological timeline of messages across channels (email/SMS/WhatsApp) for that person.
- Currently, when this timeline view opens, the scroll position starts at the **top**, showing the oldest messages first; users must manually scroll down to see the latest conversation activity.
- Messages for this timeline are loaded in one batch (no incremental pagination), so “scroll to bottom on open” is both intuitive and safe.

**Goal:**
- On first render of the All-tab unified person timeline, and whenever the selected person changes, automatically scroll the timeline container to the bottom, bringing the most recent message into view.
- Apply this behavior **only** to the All-tab + person-selected unified timeline mode, without altering the classic three-column unlinked mode or other inbox views.

---

## Current State Analysis

### Unified Inbox Timeline View

**Entity:** All-tab unified person timeline component (e.g. `AllMessagesTimeline` or equivalent).

**Current Structure (expected):**
- Renders a chronological list of messages (oldest at top, newest at bottom) for the currently selected person.
- Lives within the Unified Inbox page under the “All” tab when a `personId` is selected.
- Uses a scrollable container (could be:
  - a plain `div` with `overflow-y-auto`,
  - a `ScrollArea` wrapper,
  - or a virtualized list implementation).

**Observations:**
- When the timeline is shown or refreshed (e.g. when `personId` changes), the scroll container’s initial position is at the top.
- There is no existing “jump to bottom on mount” logic for this timeline mode.
- Because the messages are loaded all at once and represent historical conversation, the most relevant context for the user is typically at the bottom (latest messages).

### Unified Inbox Page / Selection Logic

**Entity:** Unified Inbox page (`UnifiedInboxPage`) and selection state.

**Current Structure (expected):**
- Manages:
  - Active tab (`all`, `email`, `sms`, `whatsapp`).
  - Selected person (which triggers showing the unified timeline in All tab).
  - Selected conversation for the classic three-column view in channel tabs.
- When a person is selected in the All tab:
  - The classic three-column “conversations + messages + sidebar” layout is replaced (or supplemented) by the unified person timeline.

**Observations:**
- The All-tab timeline view is only active when:
  - Tab is “All”.
  - A `personId` is selected.
- The classic 3-column unlinked mode should remain unchanged; it has its own scroll behavior that should not be auto-jumped.

### Relationship Analysis

**Current Relationship:**
- The All-tab unified timeline consumes:
  - The currently selected `personId`.
  - Message data pulled across conversations for that person.
- Scroll behavior is purely UI-layer; no database fields or pagination state are directly bound to scroll position.

**Gaps/Issues:**
- Lack of auto-scroll on initial show leads to:
  - Users seeing oldest messages first.
  - Extra manual scrolling for every selection.
  - Potential confusion about whether new messages have arrived.

### Data Access Patterns

**How the timeline is currently accessed:**
- Likely via a hook such as `useInboxMessages` or a specialized `useAllMessagesTimeline` which fetches all messages for a person.
- Data is rendered in-order, with no separate “load more” mechanism in this mode.

**How it is integrated into the page:**
- `UnifiedInboxPage` (or similar) decides when to render the unified timeline vs. the classic layout based on `activeTab` and selected person.
- The scrollable container is created on React render whenever the timeline view mounts or re-mounts.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- None. This is a purely frontend scroll-behavior change.

**Non-Destructive Constraints:**
- Do not add any new columns or tables related to scroll state.
- Do not persist scroll positions in the database.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Continue fetching all messages for the person/timeline as currently done.
- No changes required to ordering or filters; the auto-scroll behavior operates at the UI level on top of existing data.

**Recommended Display Patterns:**
- Introduce an auto-scroll-on-mount behavior for the All-tab unified timeline container:
  - After messages have been rendered for the first time (or when `personId` changes), programmatically:
    - Set `scrollTop = scrollHeight` on the scrollable element (or call `scrollTo({ top: scrollHeight })`).
  - Ensure this happens:
    - Only for the All-tab person-selected mode.
    - On initial mount and on person-change; not on every re-render caused by minor UI updates.

---

## Implementation Approach

### Phase 1: Identify and Hook into the Timeline Container
- Locate the timeline component (e.g. `AllMessagesTimeline`):
  - Identify the scrollable container element:
    - A `div` with `overflow-y-auto`, or
    - A `ScrollArea`/custom scroll wrapper, or
    - A virtualized list root.
- Add a `ref` (e.g. `containerRef`) to the top-level scrollable container inside this component.
- Add props to the component (if needed) to:
  - Accept `personId` (or derive from existing props).
  - Know when it is in “All-tab person-selected mode” (if not already implicit in where it is used).

### Phase 2: Auto-Scroll Logic
- Implement a `useEffect` in the timeline component that:
  - Depends on:
    - `personId` (or the key that changes when a new person is selected).
    - Timeline messages array (so we know when they’ve loaded).
  - On effect:
    - If there is a `containerRef.current` and messages length > 0:
      - Schedule a scroll to bottom, e.g.:
        - Direct: `containerRef.current.scrollTop = containerRef.current.scrollHeight;`
        - Or `containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'auto' });`
    - Use `requestAnimationFrame` or a small `setTimeout(0)` if needed to ensure DOM layout is up to date before measuring `scrollHeight`.
- For virtualized lists:
  - Use the list API (e.g. `scrollToIndex(lastIndex)` or `scrollToItem`) rather than manipulating DOM scroll directly.
  - Guard the implementation so it gracefully no-ops if a specific virtualization API isn’t available (best-effort, not required in first pass).

### Phase 3: Scope to All-tab Person-Selected Mode Only
- In `UnifiedInboxPage` (or equivalent):
  - Ensure the auto-scroll timeline component is only used when:
    - `activeTab === 'all'`, and
    - A person is currently selected (e.g. `selectedPersonId != null`).
  - The classic 3-column mode for unlinked conversations should:
    - Continue using its existing components (not the auto-scrolling timeline).
    - Not be wrapped with the auto-scroll behavior.

### Safety Considerations

- **No data loss:**
  - Only affects scroll position; message content and selection remain unchanged.
- **User control:**
  - After the initial auto-scroll to bottom, users must retain full manual scroll control; do not re-force scrolling on every minor update.
- **Testing:**
  - Verify that:
    - On person selection in All tab, the timeline jumps to bottom and shows latest messages.
    - Switching between people in All tab correctly auto-scrolls per person.
    - The classic All-tab layout without a selected person remains unaffected.
    - Channel-specific tabs (Email/SMS/WhatsApp) are unaffected.
- **Rollback:**
  - If the scroll behavior causes regressions, remove or gate the auto-scroll effect behind a simple condition without touching data or routing.

---

## What NOT to Do

- Do not:
  - Change message ordering (must remain chronological, oldest to newest).
  - Add infinite scrolling, pagination, or “near-bottom” sticky logic.
  - Affect channel-specific conversation views or the classic 3-column All-tab mode without a selected person.
  - Introduce new persistent state for scroll positions in the database or global stores.

---

## Open Questions / Considerations

- If the timeline is virtualized:
  - Which virtualization library/API is in use, and what is the best way to “scroll to bottom” (e.g. by index vs. pixel offset)?
- Should we debounce or delay auto-scroll slightly to account for:
  - Slow rendering environments.
  - Additional layout effects that might adjust heights after the first paint.
- Future enhancement:
  - Consider a small affordance (e.g. “Jump to latest” button) if we ever add pagination or partial loading, but this is **explicitly out of scope** for this feature.

