# Unified Inbox — Read/Unread UX Upgrade (Auto-read on open + toggle both ways)

## Overview

Improve Unified Inbox read/unread ergonomics so that conversations behave like a modern inbox: opening an unread conversation marks it as read, and operators can flip read/unread state in both directions from a clear control.

**Context:**
- Unified Inbox currently supports Email/SMS/WhatsApp conversations with unread counts and badges.
- Clicking a conversation does not change its unread state; users must explicitly use a one-way "Mark as Read" action, which only ever transitions unread → read.
- This work is UI + API behavior only: no database schema changes, no changes to sync logic (e.g. Gmail), and no layout/min-w-0 adjustments.

**Goal:**
- Ensure that opening a conversation reliably clears its unread badge via an auto "mark as read" behavior, without spamming the backend.
- Replace the one-way "Mark as Read" control with a two-way, state-aware toggle that supports read ↔ unread and stays in sync across tabs and the conversation list.

---

## Current State Analysis

### Unified Inbox Conversation Schema

**Table:** `public.inbox_conversations` (assumed)

**Current Structure:**
- Likely includes core identifiers and routing:
  - `id` (PK)
  - `company_id`
  - `channel` (enum: `email`, `sms`, `whatsapp`, possibly others)
  - `subject` / `preview_text`
  - `person_id` / `order_id` links (for People/Orders tying)
- Unread-related fields (inferred from app behavior and badges):
  - `unread_count` (integer) per conversation, used to derive badges and “unread vs read” state.
  - Optional `last_read_at` / `last_seen_message_id` fields may exist, but current UX only clearly surfaces counts.
- RLS:
  - Standard per-company RLS assumed; not impacted by this feature.

**Observations:**
- The UX models unread/read primarily via `unread_count`, with the implicit definition:
  - **unread conversation**: `unread_count > 0`
  - **read conversation**: `unread_count === 0`
- The existing “Mark as Read” action already calls an API/mutation that:
  - Transitions a conversation into the “read” state (likely setting `unread_count = 0` and/or updating a `last_read_at` style field).
  - Updates list badges and possibly the selected conversation header.
- There is currently no explicit “Mark as Unread” operation:
  - Agents cannot flag a conversation as unread for follow-up once they’ve opened it.

### Unified Inbox Messages Schema

**Table:** `public.inbox_messages` (assumed)

**Current Structure:**
- Per-message fields (not directly changed by this spec, but relevant for semantics):
  - `id`, `conversation_id`, `direction` (inbound/outbound), `channel`, `external_message_id`, timestamps.
  - Potential read-tracking fields (e.g. `read_at`) are not currently used by UI logic.

**Observations:**
- Message-level data is not being changed by this feature.
- Any existing message-level read markers should remain untouched; the UX will rely on conversation-level unread semantics.

### Relationship Analysis

**Current Relationship:**
- 1:N relationship between `inbox_conversations` and `inbox_messages` via `conversation_id`.
- Unread counts are likely derived from:
  - A materialized or cached counter on `inbox_conversations.unread_count`, maintained by sync processes and send/receive flows.
  - Or via a view that aggregates unread messages per conversation (less likely given description).

**Gaps/Issues:**
- Read state is “sticky” and manual:
  - Opening an unread conversation does not automatically clear its unread badge.
  - Users must explicitly click “Mark as Read”, which is easy to forget and not aligned with typical email/SMS inboxes.
- No way to mark a conversation as unread:
  - Agents can’t quickly flag a conversation they’ve opened but want to return to later.
  - This reduces the Unified Inbox’s effectiveness as a personal task queue.

### Data Access Patterns

**How Unified Inbox Conversations Are Currently Accessed:**
- List queries per tab:
  - All, Email, SMS, WhatsApp tabs share the same underlying conversation records with different filters on `channel`.
  - Unread counts and badges are displayed both:
    - Per-conversation in the list.
    - As aggregate counts per tab (via existing derived queries).
- The list drives a `selectedConversationId` in React state (e.g. in `UnifiedInboxPage`).

**How Messages Are Currently Accessed:**
- When a conversation is selected:
  - Messages are fetched via `useInboxMessages` / API for that `selectedConversationId`.
  - Scroll behavior, pagination, and sync are handled in existing hooks/components and are **out of scope** for this feature.

**How They Are Queried Together (if at all):**
- UI typically:
  - Fetches conversations via `useInboxConversations` / `inboxConversations.api.ts`.
  - On selection, fetches messages via `inboxMessages.api.ts` and renders `ConversationView`.
  - Uses `unread_count` from the conversation list to render the unread badge and to determine whether to show “Mark as Read”.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **None.** This feature explicitly avoids schema changes.
- All behavior should be implemented using existing fields:
  - `unread_count` as the primary indicator of unread status.
  - Any existing `last_read_at` / similar fields used by the current “Mark as Read” mutation should continue to be used and updated by that mutation.

**Non-Destructive Constraints:**
- No new tables, columns, or constraints.
- No renames or deletions.
- All behavior is implemented via:
  - New or extended API/mutation handlers.
  - Updated client logic (React hooks and components).

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Reuse the existing “mark as read” API:
  - For **auto-mark-as-read on open**:
    - Trigger the existing `markConversationAsRead` mutation when a conversation is selected **only if** `unread_count > 0`.
    - Implement a per-conversation debounce/guard so repeated selections of the same read conversation do not re-fire the mutation.
  - For **Mark as Read toggle state**:
    - Continue using the same mutation when transitioning from unread → read via the button.
- Introduce or extend a companion “mark as unread” API:
  - Either:
    - Add a new mutation endpoint that sets the conversation to “unread” (e.g. `markConversationAsUnread`), or
    - Extend the existing mutation to accept a `target_state: 'read' | 'unread'` parameter and branch logic server-side.
  - Server-side behavior when marking as unread:
    - If the data model is **unread-count-only**:
      - Set `unread_count` to `1` (minimum) for the selected conversation (do **not** attempt to restore the historical unread count).
    - If there is a richer **read-status** mechanism (`is_read`, `last_read_at`, etc.):
      - Use that mechanism to represent “unread” (e.g. clear `last_read_at`, set `is_read = false`) and let existing sync processes recompute `unread_count` as needed.

**Recommended Display Patterns:**
- Conversation list:
  - For each conversation:
    - Treat `unread_count > 0` as unread (badge visible).
    - Treat `unread_count === 0` as read (no badge).
  - After local optimistic updates to read/unread:
    - Immediately update the local `unread_count` for that conversation.
    - Reflect that in all tabs that share the same conversation (e.g. All + channel-specific tab).
- Conversation header / toolbar:
  - Replace the single-direction “Mark as Read” button with a dynamic control:
    - Label: **"Mark as Read"** when `unread_count > 0`.
    - Label: **"Mark as Unread"** when `unread_count === 0`.
  - Ensure the button’s disabled/loading state reflects in-flight mutations.

---

## Implementation Approach

### Phase 1: Auto-mark Read on Conversation Open
- **Wire auto-mark-on-open behavior:**
  - In `UnifiedInboxPage` (or the central selection handler), detect when `selectedConversationId` changes.
  - When a new conversation is selected:
    - Look up its current `unread_count` from the local `useInboxConversations` cache.
    - If `unread_count > 0` and the channel is one of Email/SMS/WhatsApp:
      - Fire the `markConversationAsRead` mutation.
      - Update the local cache optimistically:
        - Set `unread_count` to `0` for that conversation across all tabs/filters.
      - Update any derived UI state that drives the toolbar button label.
- **Avoid network spam:**
  - Implement a guard/debounce per `conversation_id`:
    - Track a simple in-memory map (in hook state or React Query mutation state) of conversations that have already been auto-marked in this session.
    - If the user re-selects the same conversation and its `unread_count` is already `0`, do not re-fire the mutation.
  - Only fire the mutation when transitioning from unread → read:
    - `if (conversation.unread_count > 0) { /* call mutation */ }`.
- **Error handling for auto-read:**
  - If the mutation fails:
    - Either:
      - Roll back the optimistic `unread_count` change for that conversation, or
      - Trigger a refetch of conversations to resync counts from the server.
  - Show a non-intrusive toast explaining that marking as read failed and the list has been refreshed.

### Phase 2: Read/Unread Toggle Button
- **Dynamic button label and behavior:**
  - In `UnifiedInboxPage` toolbar (or `ConversationHeader`):
    - Replace the one-way "Mark as Read" button with a toggle that:
      - Inspects the currently selected conversation’s `unread_count`.
      - Renders:
        - **"Mark as Read"** when `unread_count > 0` (calling the existing read mutation).
        - **"Mark as Unread"** when `unread_count === 0` (calling the new/sibling unread mutation).
    - Ensure the button is hidden or disabled when there is no `selectedConversationId`.
- **Mutation integration:**
  - Read:
    - Reuse `markConversationAsRead` with:
      - Optimistic `unread_count = 0` update across conversation caches.
      - Error handling: roll back or refetch as above.
  - Unread:
    - Add `markConversationAsUnread` (or extend the existing mutation with a `target_state` parameter) to:
      - Set `unread_count` to `1` when the underlying model is count-based.
      - Or toggle `is_read` / `last_read_at` fields when present, letting server recompute counts.
    - Optimistically update `unread_count`:
      - If using count-based semantics: set to `1`.
      - Ensure that any aggregate unread counters (e.g. per-tab totals) are updated as part of the same cache transaction.
- **Bulk behavior (if multi-select exists):**
  - If the Unified Inbox already supports multi-select for bulk actions:
    - When multiple conversations are selected:
      - Use the same button to apply the action across all selected conversations.
      - Define simple rules:
        - If bulk “Mark as Read”: target conversations with `unread_count > 0`.
        - If bulk “Mark as Unread”: target conversations regardless of current state (all become `unread_count = 1` or `is_read = false`).
      - Apply optimistic updates and error handling per conversation or via a batched mutation if supported.
  - If no multi-select:
    - Scope the toggle to the currently selected conversation only.

### Phase 3: Polish, Consistency, and QA
- **State consistency across tabs:**
  - Ensure that updates to a conversation’s `unread_count` via:
    - Auto-mark-on-open.
    - Manual read/unread toggle.
  - Are propagated to:
    - All tab views that include that conversation (All, Email, SMS, WhatsApp).
    - Any header or sidebar UI that depends on aggregate unread counts.
- **No layout regressions:**
  - Avoid changing any existing `min-w-0`, flex, or grid classes in:
    - `UnifiedInboxPage`
    - `ConversationList` / `ConversationView`
    - `ConversationHeader`, `ConversationThread`, or related components.
- **Error and loading UX:**
  - Use existing toast/notification patterns for mutation errors.
  - Ensure the toggle and auto-mark logic do not block message rendering or scrolling.

### Safety Considerations
- **No data loss:**
  - All changes only adjust read/unread state; they do not modify message bodies, participants, or links to orders/people.
  - No destructive migrations or schema changes.
- **Testing and verification:**
  - Add or update tests for:
    - Auto-mark-on-open behavior.
    - Read ↔ unread toggling, including optimistic updates and rollback.
    - Consistent unread counts across All and channel-specific tabs.
  - Manually test channels:
    - Email-only conversations.
    - SMS-only conversations.
    - WhatsApp-only conversations.
    - Mixed sessions switching between tabs.
- **Rollback strategies:**
  - If issues arise:
    - Revert the new toggle wiring and auto-mark-on-open logic to the prior explicit “Mark as Read” behavior.
    - Since no schema changes exist, rollback is limited to code deploy.

---

## What NOT to Do

- Do **not** introduce any new database tables, columns, or triggers.
- Do **not** change message fetching, scrolling, or pagination behavior in `ConversationView` or `ConversationThread`.
- Do **not** alter People-linking logic or any inference related to `person_id` / `order_id`.
- Do **not** change Gmail or other channel sync behavior; this feature is purely about how the app interprets and presents read state.
- Do **not** modify global layout primitives (`AppSidebar`, main content shell, shared drawer components) beyond what is strictly necessary to add the toggle button.
- Do **not** attempt to restore historical unread counts when marking as unread; always set a minimal unread state (e.g. `unread_count = 1`) when using a count-based model.

---

## Open Questions / Considerations

- **Exact underlying model:** Confirm whether unread is modeled purely via `unread_count` or also via `last_read_at` / `is_read` fields; this affects how the unread mutation should be implemented.
- **Cross-device semantics:** When an agent marks a conversation as unread on one device, should all other sessions show it as unread immediately (likely yes, via real-time or periodic refresh)?
- **Bulk UX:** If bulk selection is present, should the button label change to indicate the count of selected conversations (e.g. “Mark 3 as Read”) or remain generic?
- **Audit trail:** If there is a requirement to log read/unread transitions for auditing, ensure that new mutations are instrumented consistently with existing “Mark as Read” calls.
- **Performance:** Monitor for any noticeable increase in write load from auto-mark-on-open in high-volume inboxes; if needed, consider batching or rate-limiting strategies server-side.

