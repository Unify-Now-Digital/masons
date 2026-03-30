# Fix Inbox Refresh/Reactivity Bug

## Overview

Specify a production-ready fix for Inbox reactivity so new inbound and outbound messages appear without full page reload across both Inbox modes (`Conversations` and `Customers`).

**Context:**
- Inbox uses React Query with Supabase tables as source of truth (`inbox_conversations`, `inbox_messages`).
- Inbox now has two additive UI modes:
  - conversations mode (channel conversation threads)
  - customers mode (person-unified mixed timeline)
- Reported bug: new messages only appear after manual reload.

**Goal:**
- Restore reliable real-time/polling/query refresh behavior for all inbox views.
- Keep existing UX/features unchanged (tabs, send routing, unread, context panel).

---

## Current State Analysis

### Conversation Entity Schema

**Table:** `inbox_conversations`

**Current Structure:**
- Queried by `fetchConversations` and `fetchConversation`.
- Indexed fields used in UI: `id`, `channel`, `person_id`, `unread_count`, `last_message_at`, `last_message_preview`, `status`.
- UI filters are applied via `ConversationFilters` (`status`, `channel`, `unread_only`, `unlinked_only`, `search`).

**Observations:**
- Conversation lists refresh via invalidation of `inboxKeys.conversations.all`.
- Customers mode thread list (`useCustomerThreads`) is derived from `useConversationsList(baseFilters)` and recomputes when conversations query refreshes.

### Message Entity Schema

**Table:** `inbox_messages`

**Current Structure:**
- Conversation mode thread: `useMessagesByConversation(conversationId)` -> `inboxKeys.messages.byConversation(id)`.
- Customers mode mixed thread: `usePersonUnifiedTimeline(personId)` -> `inboxKeys.messages.personTimeline(personId, conversationIds)`.
- Send path: `useSendReply` invalidates by-conversation key + conversations keys.

**Observations:**
- Person timeline query key is separate (`personTimeline`) and not invalidated by current page-level realtime fan-out.
- Customers mode component also uses a custom query key `['inbox','conversations','customer-view',personId]` not tied to shared inbox key helpers.

### Relationship Analysis

**Current Relationship:**
- `inbox_messages.conversation_id` links to `inbox_conversations.id`.
- Person-unified mode derives conversation IDs via `person_id` and loads messages with `.in(conversation_id, ids)`.

**Gaps/Issues:**
- Refresh fan-out is inconsistent across query families:
  - realtime/page invalidation refreshes conversation lists and `byConversation` message keys
  - it does not directly refresh `personTimeline` keys
  - it does not refresh customers-mode custom key (`customer-view`)
- Inbound refresh currently depends on realtime + Gmail polling; there is no generic fallback refresh for non-Gmail inbound paths when realtime misses/fails.

### Data Access Patterns

**How conversations are currently accessed:**
- `useConversationsList(filters)` with keys under `inboxKeys.conversations.lists(filters)`.
- Customers list: derived from the same query via `useCustomerThreads`.
- Customers conversation resolver (`CustomerConversationView`) currently uses a custom `useQuery` key instead of `inboxKeys`.

**How messages are currently accessed:**
- Conversation mode: by-conversation query key.
- Customers mode: person timeline query key based on `(personId, conversationIds)`.

**How they are queried together:**
- Person timeline: fetch conversations by person, derive sorted IDs, then fetch messages by those IDs.
- Outbound send is persisted correctly via existing APIs, but reactive visibility depends on correct invalidation of all relevant keys.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- None.

**Non-Destructive Constraints:**
- Keep `inbox_conversations` and `inbox_messages` as source of truth.
- No new tables/columns or schema mutations.
- Fix is query-refresh architecture only.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Introduce a single inbox refresh invalidation helper that invalidates:
  - `inboxKeys.conversations.all`
  - all inbox message keys prefix (covers `byConversation` + `personTimeline`)
  - any query currently outside key factory must be migrated into `inboxKeys` to avoid cache-scope mismatch
- Add a low-frequency fallback refetch for inbound paths when realtime is unavailable/missed:
  - keep realtime as primary
  - periodic `invalidateQueries` for inbox conversation/message prefixes as safety net

**Recommended Display Patterns:**
- No UI redesign required.
- Ensure both mode panels are fed by refreshed queries from the same refresh mechanism.

---

## Implementation Approach

### Phase 1: Root-cause hardening in query key architecture
- `src/modules/inbox/hooks/useInboxConversations.ts`
  - add explicit helper key for customer-view conversation set, or remove custom key usage by reusing existing `inboxKeys.conversations.lists({ status:'open', person_id })`.
- `src/modules/inbox/components/CustomerConversationView.tsx`
  - replace custom key `['inbox','conversations','customer-view',personId]` with shared key-family usage (`useConversationsList({ status:'open', person_id })`).

### Phase 2: Centralize inbox invalidation fan-out
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - extract a single `invalidateInboxData` function used by:
    - realtime flush path
    - optional fallback polling path
  - ensure it invalidates both conversation and all message query prefixes (`['inbox','messages']`), not only `byConversation(id)`.
- `src/modules/inbox/hooks/useInboxMessages.ts`
  - in `useSendReply.onSuccess`, include broad message-prefix invalidation (`['inbox','messages']`) in addition to by-conversation invalidation so customers timeline updates immediately after outbound send.

### Phase 3: Add inbound fallback refresh
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - keep existing realtime subscription.
  - add conservative fallback interval (e.g., 15-30s) that invalidates inbox conversation/message prefixes when page is active.
  - guard to avoid overlapping invalidations and unnecessary churn.

### Phase 4: Verify recomputation dependencies and selection safety
- `src/modules/inbox/hooks/useCustomerThreads.ts`
  - confirm aggregation memo dependencies include source conversation query output only (already mostly correct); no stale derived state outside memo.
- `src/modules/inbox/hooks/useInboxMessages.ts`
  - keep stable sort/dedupe logic; ensure person timeline re-renders when message cache invalidates.
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - keep current selected conversation/person fallback behavior unchanged.

### Safety Considerations
- Do not alter send transport behavior, only refresh invalidation behavior.
- Do not change tab/mode UX semantics.
- Keep unread operations and right-side person/order context wiring intact.
- Validate with both inbound (webhook/sync arrival) and outbound send flows.

---

## What NOT to Do

- Do not add new DB tables or replace storage model.
- Do not introduce mode-specific duplicate refresh logic in multiple components.
- Do not rely only on mode-local state updates (must refresh query cache as source of truth).
- Do not break existing channel-tab behavior, unread handling, send routing, or context panel behavior.

---

## Open Questions / Considerations

- Preferred fallback refresh interval (15s vs 30s) balancing freshness and load.
- Whether to condition fallback polling based on document visibility/focus.
- Whether realtime subscription status should be surfaced for diagnostics.

- **Root cause analysis (confirmed):**
  - cache-scope mismatch: customers mode uses a custom conversation query key outside shared inbox key family.
  - invalidation gap: current realtime/page invalidation fans out to conversations + `byConversation` but not all message-query families (`personTimeline`).
  - reliability gap: inbound refresh currently has no generic fallback beyond realtime/Gmail sync, so missed realtime events result in stale UI until manual reload.

- **Exact affected files:**
  - `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - `src/modules/inbox/hooks/useInboxConversations.ts`
  - `src/modules/inbox/hooks/useInboxMessages.ts`
  - `src/modules/inbox/components/CustomerConversationView.tsx`
  - `src/modules/inbox/hooks/useCustomerThreads.ts` (dependency verification only, likely minimal/no logic change)

- **Acceptance criteria:**
  1. New inbound messages appear without manual reload in:
     - conversations mode thread/list
     - customers mode list/mixed timeline
  2. New outbound messages sent from inbox appear immediately without manual reload in both modes.
  3. Existing tabs (`All`, `Unread`, `Urgent`, `Unlinked`) and channel-specific behavior remain unchanged.
  4. Customers mode retains mixed chronological timeline ordering by message timestamps.
  5. Unread behavior remains correct for both conversation and customer aggregates.
  6. No duplicate refresh loops or significant performance regressions.
