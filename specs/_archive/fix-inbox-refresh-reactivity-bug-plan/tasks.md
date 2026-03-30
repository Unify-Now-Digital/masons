# Tasks: Fix Inbox Refresh/Reactivity Bug

Branch: `feature/fix-inbox-refresh-reactivity`  
Spec: `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/fix-inbox-refresh-reactivity-bug.md`

## Phase 1: Query key normalization [X]

### Modify
- `src/modules/inbox/components/CustomerConversationView.tsx`
  - Replace custom query key usage with canonical inbox key path via existing inbox hooks.
- `src/modules/inbox/hooks/useInboxConversations.ts`
  - Add any missing canonical key helper if needed for customer-view parity.

### Changes
- Ensure customers mode consumes the same cache family as conversations mode.
- Remove key-scope mismatch.

### Dependencies
- none

---

## Phase 2: Invalidation fan-out wiring [X]

### Modify
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - Extract `invalidateInboxData` helper and use in realtime flush.
- `src/modules/inbox/hooks/useInboxMessages.ts`
  - Update `useSendReply.onSuccess` to include broad messages prefix invalidation.

### Changes
- Required invalidation set on inbound/outbound:
  - `inboxKeys.conversations.all`
  - `['inbox', 'messages']`

### Dependencies
- Phase 1 complete

---

## Phase 3: Aggregation reactivity safety [X]

### Modify
- `src/modules/inbox/hooks/useCustomerThreads.ts`
  - Verify memo dependencies and no stale derived state.
- `src/modules/inbox/hooks/useInboxMessages.ts`
  - Verify `useCustomerMessages`/`usePersonUnifiedTimeline` recompute on key invalidation.

### Changes
- Ensure customer rows and mixed timelines update as source queries refresh.
- Keep timestamp ordering and dedupe intact.

### Dependencies
- Phase 2 complete

---

## Phase 4: Fallback refresh backbone [X]

### Modify
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - Add low-frequency fallback invalidation interval.
  - Guard overlap and preserve performance.

### Changes
- Guarantee refresh path even if realtime misses events.
- Keep realtime primary, fallback secondary.

### Dependencies
- Phase 2 complete

---

## Phase 5: Edge cases and validation [X]

### Modify
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - Confirm selection safety on mode switching and updated data.
- `src/modules/inbox/components/ConversationView.tsx`
  - Verify no stale thread presentation after invalidation-driven refresh.
- `src/modules/inbox/components/CustomerConversationView.tsx`
  - Verify no stale person timeline after invalidation-driven refresh.

### Validation checklist
- inbound updates reflect in both modes without reload
- outbound updates reflect in both modes without reload
- mode switch does not show stale content
- rapid messages do not duplicate or reorder incorrectly
- no polling overlap or refresh storm

### Dependencies
- Phases 1-4 complete

---

## Phase 6: Polish and regression safety [X]

### Modify
- `specs/fix-inbox-refresh-reactivity-bug-plan/tasks.md`
  - mark tasks complete in implementation pass

### Regression gates
- existing tab behavior unchanged
- send routing unchanged
- unread semantics unchanged
- right-side context behavior unchanged

