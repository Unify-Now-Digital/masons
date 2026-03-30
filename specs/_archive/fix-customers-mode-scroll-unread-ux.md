# Fix Customers Mode Scroll and Unread UX

## Overview

Define a focused, additive UX fix for Inbox `Customers` mode to address: (1) non-ideal auto-scroll behavior, (2) unread badge simplification to boolean state, and (3) mark-as-read on customer thread open.

**Context:**
- Inbox has two modes: `Conversations` and `Customers`.
- Refresh/reactivity is already working; issue is now customers-mode UX only.
- Existing inbox behavior in conversations mode must remain unchanged.

**Goal:**
- Implement standard chat-like conditional auto-scroll in customers mode.
- Replace unread numeric badges with a simple boolean `Unread` badge in customers mode.
- Mark all conversations for selected person as read when opening a customer thread, with immediate UI response.

---

## Current State Analysis

### Conversation Aggregation Entity

**Table:** `inbox_conversations`

**Current Structure:**
- Queried via `useConversationsList(filters)` in `src/modules/inbox/hooks/useInboxConversations.ts`.
- Customers rows are derived in `src/modules/inbox/hooks/useCustomerThreads.ts`.
- Per-row unread is aggregated as numeric sum (`unreadCount`) across grouped conversations by `person_id`.

**Observations:**
- Customers list renders numeric unread count (`{row.unreadCount} unread`) in `CustomerThreadList`.
- Header also shows numeric aggregate (`{unreadTotal} new`).
- No boolean `hasUnread` model yet in hook/types.

### Customer Mixed Timeline Entity

**Table:** `inbox_messages`

**Current Structure:**
- Customer view loads mixed messages via `useCustomerMessages(personId)` (`usePersonUnifiedTimeline` alias).
- Timeline is rendered through `ConversationThread`.
- `ConversationThread` currently auto-scrolls to bottom on every message change (`scrollTo(...scrollHeight)` effect).

**Observations:**
- Current behavior is global in `ConversationThread`, not customers-mode-specific.
- It may forcibly jump users when reading older messages, conflicting with expected “near-bottom only” behavior.
- `CustomerConversationView` does not currently pass or own a dedicated scroll-near-bottom policy.

### Relationship Analysis

**Current Relationship:**
- Customers mode groups `inbox_conversations` by `person_id`.
- Selected customer thread maps to many conversation IDs.
- Opening a customer thread displays all messages across those conversation IDs.

**Gaps/Issues:**
- No explicit “mark all person conversations read on open” trigger in customers mode.
- Unread state is count-based, while requirement is boolean badge.
- Scroll behavior lacks near-bottom guard and mode-local control.

### Data Access Patterns

**How customer threads are currently accessed:**
- `useCustomerThreads({ baseFilters, channelFilter, listFilter })` returns rows with:
  - `unreadCount`
  - `latestConversationIdByChannel`
  - `conversationIds`

**How customer messages are currently accessed:**
- `useCustomerMessages(personId)` -> sorted mixed timeline.
- `CustomerConversationView` computes channel map and renders `ConversationThread`.

**How they are queried together:**
- `UnifiedInboxPage` controls selected person and passes to `CustomerConversationView`.
- Mark read/unread action currently depends on toolbar button (`handleToggleReadUnread`) and selected customer row.
- No automatic read mark on thread open.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- None.

**Non-Destructive Constraints:**
- Keep existing conversation/message tables and unread backend model unchanged.
- Perform UX-only changes in hook/component layer.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Keep `useCustomerThreads` as derived query consumer from `useConversationsList`.
- Add derived boolean `hasUnread` in customers hook output (or compute in component from unread sum).
- Reuse existing `useMarkAsRead` mutation and existing `conversationIds` list for person-level auto-read.

**Recommended Display Patterns:**
- Replace numeric unread indicator with a single `Unread` badge when `hasUnread === true`.
- Remove all numeric unread display in customers mode list/header.
- Keep conversations mode unread UX untouched.

---

## Implementation Approach

### Phase 1: Customers-mode auto-scroll behavior
- `src/modules/inbox/components/CustomerConversationView.tsx`
  - Own customers-mode scroll behavior via local scroll container ref + near-bottom tracking state.
  - Pass a mode-aware prop to timeline layer (or dedicated scroll behavior callback) indicating whether auto-scroll should run.
- `src/modules/inbox/components/ConversationThread.tsx`
  - Add conditional auto-scroll support:
    - detect `distanceFromBottom = scrollHeight - scrollTop - clientHeight`
    - treat as near-bottom when `distanceFromBottom <= threshold` (recommended 96-140px)
    - only auto-scroll on new messages if near-bottom is true
  - Ensure this conditional path is applied only when invoked by customers mode.

### Phase 2: Unread boolean badge simplification
- `src/modules/inbox/hooks/useCustomerThreads.ts`
  - Add `hasUnread` derived field (`unreadCount > 0`) to each row model.
  - Keep `unreadCount` internal if needed for existing actions, but no longer used for customers UI text.
- `src/modules/inbox/types/inbox.types.ts`
  - Extend `CustomerThreadRow` with `hasUnread: boolean`.
- `src/modules/inbox/components/CustomerThreadList.tsx`
  - Replace numeric badge text with simple `Unread` badge.
  - Remove numeric “x new” header count in customers mode; use neutral header label.

### Phase 3: Mark all person conversations as read on open
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - Add customers-mode effect:
    - when `viewMode === 'customers'` and `selectedPersonId` changes / selected row resolved
    - if row `hasUnread` and not already auto-marked for same person in current session cycle, call `useMarkAsRead` with all `conversationIds`
  - Use local ref set (similar to existing `autoReadOnceRef` pattern) keyed by `personId` to avoid duplicate mutation loops.
  - Keep manual toolbar toggle behavior intact.

### Phase 4: UI immediacy + safety
- Ensure optimistic/invalidated updates reflect immediately after mark-as-read.
- Keep mode isolation:
  - no behavior change in conversations mode scroll/read logic.
  - no change to send routing or refresh backbone.

### Safety Considerations
- Do not alter backend unread data semantics.
- Do not introduce cross-mode side effects by changing shared conversation-mode path.
- Test against rapid inbound message bursts to ensure no jumpy UI.

---

## What NOT to Do

- Do not change conversations mode unread or scroll behavior.
- Do not redesign unread storage model or add DB schema changes.
- Do not force-scroll when user is reviewing older messages.
- Do not remove existing manual read/unread controls.

---

## Open Questions / Considerations

- Recommended near-bottom threshold (`96px` or `120px`) for best UX on variable bubble sizes.
- Whether “mark as read on open” should retrigger when revisiting same person after new inbound messages in-session (recommended: yes, keyed by current unread state not only person id).
- Whether to show unread badge before channel chips or after, for best visual prominence.

- **Exact affected files:**
  - `src/modules/inbox/components/CustomerConversationView.tsx`
  - `src/modules/inbox/components/ConversationThread.tsx`
  - `src/modules/inbox/components/CustomerThreadList.tsx`
  - `src/modules/inbox/hooks/useCustomerThreads.ts`
  - `src/modules/inbox/types/inbox.types.ts`
  - `src/modules/inbox/pages/UnifiedInboxPage.tsx`

- **Edge cases:**
  - user scrolled far up while new message arrives: no auto-scroll.
  - user near bottom while new message arrives: smooth/instant scroll to latest (consistent behavior).
  - rapid inbound burst: single stable scroll behavior, no oscillation.
  - switching conversations <-> customers mode: no scroll state leakage.
  - opening customer with multiple channel conversations: all marked read together once loaded.

- **Acceptance criteria:**
  1. In customers mode, new messages auto-scroll only when user is near bottom.
  2. In customers mode, no numeric unread counts are shown; only a boolean `Unread` badge appears when applicable.
  3. Opening a customer thread marks all that person’s conversations as read and UI updates immediately.
  4. Conversations mode behavior remains unchanged.
  5. Existing refresh/reactivity, send routing, unread mutation wiring, and right-side context continue to work.
