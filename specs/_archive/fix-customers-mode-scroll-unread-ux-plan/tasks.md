# Tasks: Fix Customers Mode Scroll and Unread UX

Branch: `feature/fix-customers-mode-scroll-unread-ux`  
Spec: `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/fix-customers-mode-scroll-unread-ux.md`

## Phase 1: Auto-scroll logic (Customers mode only) [X]

### Modify
- `src/modules/inbox/components/CustomerConversationView.tsx`
- `src/modules/inbox/components/ConversationThread.tsx`

### Exact changes
- Add scroll container ref ownership for customers mode.
- Track near-bottom state using scroll listener (`distanceFromBottom <= threshold`).
- Auto-scroll only on new messages when near-bottom is true.
- Keep initial open behavior at bottom.
- Ensure conversations mode path remains unchanged.

### Dependencies
- none

---

## Phase 2: Unread badge simplification [X]

### Modify
- `src/modules/inbox/hooks/useCustomerThreads.ts`
- `src/modules/inbox/types/inbox.types.ts`
- `src/modules/inbox/components/CustomerThreadList.tsx`

### Exact changes
- Add `hasUnread` derived boolean in customer row model.
- Keep numeric unread internal for logic, remove numeric rendering in customers list/header.
- Render `Unread` badge when `hasUnread` only.

### Dependencies
- none (can run parallel to phase 1 if file overlap is managed)

---

## Phase 3: Mark-as-read flow on customer open [X]

### Modify
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`

### Exact changes
- Add customers-mode effect:
  - on `selectedPersonId` open/change, find selected row
  - if `hasUnread` true, call existing `markAsReadMutation` with all row `conversationIds`
- Add guard ref to prevent mutation loops during same open cycle.
- Preserve existing manual mark-read button behavior.

### Dependencies
- Phase 2 (uses `hasUnread`)

---

## Phase 4: Edge-case handling and regression safety [X]

### Modify
- `src/modules/inbox/components/CustomerConversationView.tsx`
- `src/modules/inbox/components/ConversationThread.tsx`
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`

### Exact changes
- Handle rapid incoming messages without repeated jump.
- Ensure no auto-scroll on empty thread/no container.
- Ensure switching customers resets appropriate scroll/read guards.
- Confirm no cross-mode side effects.

### Dependencies
- Phases 1-3 complete

---

## Validation checklist
- New message while near bottom -> auto-scroll.
- New message while user scrolled up -> no forced scroll.
- Customers list shows only `Unread` badge (no counts).
- Opening unread customer thread clears unread state.
- Conversations mode unchanged.

