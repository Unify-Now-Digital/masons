# Tasks: Customer-Centric Unified Inbox Mode

Branch: `feature/customer-centric-unified-inbox-mode`  
Spec: `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/customer-centric-unified-inbox-mode.md`

## Phase 1: Data aggregation layer (hooks/selectors) [X]

### Modify
- `src/modules/inbox/hooks/useInboxMessages.ts`
  - Add `useCustomerMessages(personId)` as clear wrapper over unified timeline.
  - Add selector helper for stable sort/dedupe (`sent_at`, fallbacks).
- `src/modules/inbox/types/inbox.types.ts`
  - Add UI aggregate types (`CustomerThreadRow`, channel map type).

### Create
- `src/modules/inbox/hooks/useCustomerThreads.ts`
  - Implement `useCustomerThreads({ listFilter, channelFilter, searchQuery })`.
  - Group conversations by `person_id`, aggregate unread and latest message metadata.
  - Build `latestConversationIdByChannel` and `defaultReplyChannel`.

### Depends on
- Existing `useConversationsList`.

---

## Phase 2: Sidebar (customer threads list) [X]

### Modify
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - Add `viewMode` state and active person selection path.
  - Branch left panel rendering by mode.
- `src/modules/inbox/components/InboxConversationList.tsx`
  - Keep existing conversation mode behavior unchanged.
  - Extract shared list-header/filter UI if needed.

### Create
- `src/modules/inbox/components/CustomerThreadList.tsx`
  - Render one row per `CustomerThreadRow`.
  - Show combined unread badge, latest preview, timestamp, and channel indicators.
  - Selects person row and drives center panel.

### Depends on
- Phase 1 `useCustomerThreads`.

---

## Phase 3: Unified conversation view (mixed timeline) [X]

### Modify
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - In customer mode, render unified customer thread view in center.
- `src/modules/inbox/components/ConversationThread.tsx`
  - Ensure message channel badge appears consistently.
  - Ensure email content remains full-form rendering in unified mode.

### Create
- `src/modules/inbox/components/CustomerConversationView.tsx`
  - Loads `useCustomerMessages(selectedPersonId)`.
  - Passes mixed messages into `ConversationThread`.
  - Handles empty/loading/error states for customer mode.

### Depends on
- Phase 1 selectors, Phase 2 selection state.

---

## Phase 4: Reply/channel selector + send routing [X]

### Modify
- `src/modules/inbox/components/ReplyChannelPills.tsx`
  - Support disabled state per channel option (not hide-only).
- `src/modules/inbox/components/ConversationThread.tsx`
  - Accept explicit channel availability map.
  - Default to latest inbound channel from customer context.
  - Resolve `conversation_id` by selected channel before send.
- `src/modules/inbox/hooks/useInboxMessages.ts`
  - Keep `useSendReply` unchanged for transport.
  - Add unified cache invalidation helper for person timeline key.

### Create
- `src/modules/inbox/components/ChannelSelector.tsx`
  - Small wrapper around channel pills with disabled tooltips/text.

### Depends on
- Phase 1 channel map.
- Phase 3 customer conversation view.

---

## Phase 5: Unread aggregation and mark-read behavior [X]

### Modify
- `src/modules/inbox/hooks/useCustomerThreads.ts`
  - Compute combined unread count as sum of grouped conversations.
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - In customer mode, "Mark as Read/Unread" applies to all mapped conversation IDs for selected customer row.
- `src/modules/inbox/hooks/useInboxConversations.ts`
  - Reuse existing `useMarkAsRead` / `useMarkAsUnread`; no new backend methods.

### Depends on
- Phase 2 customer row selection and grouped conversation IDs.

---

## Phase 6: Edge cases, performance, and polish [X]

### Modify
- `src/modules/inbox/hooks/useCustomerThreads.ts`
  - Memoize grouped outputs by stable input signatures.
  - Guard against duplicate conversation/message contributions.
- `src/modules/inbox/components/CustomerConversationView.tsx`
  - Handle missing names, missing handles, and no available channels.
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - Preserve current behavior for `unlinked` tab in conversation mode; exclude unlinked from customer mode.

### Edge cases to explicitly validate
- Multiple emails/phones: route to latest active conversation in selected channel.
- No inbound messages: default to first enabled channel.
- Missing `sent_at`: sort fallback by `created_at`.
- Null `person_id`: excluded from customer mode.
- Realtime updates while in customer mode: unified timeline invalidates correctly.

### Performance requirements
- Avoid O(n^2) grouping; use maps.
- Use `useMemo` for all aggregation and channel map derivations.
- Keep list virtualization optional; only introduce if needed.

### Depends on
- All prior phases.

---

## Phase Dependencies Summary
- Phase 1 -> foundation for all later phases.
- Phase 2 depends on 1.
- Phase 3 depends on 1 + 2.
- Phase 4 depends on 1 + 3.
- Phase 5 depends on 1 + 2.
- Phase 6 depends on 1-5.

