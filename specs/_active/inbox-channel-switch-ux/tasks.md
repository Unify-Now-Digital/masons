# Tasks: Inbox Channel Switching UX

**Feature**: Inbox Channel Switching UX  
**Branch**: `feature/inbox-channel-switch-ux`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Quickstart**: [quickstart.md](./quickstart.md)

**Format**: `- [ ] Tnnn [P] [USx] Description including file path`  
**Story labels**: [US1] Conversations tab, [US2] Customers tab, [US3] Channel-specific requirements (P2)

---

## Phase 1: Setup

- [x] T001 Run `npx tsc --noEmit` from `c:\Users\owner\Desktop\unify-memorial-mason-main` and fix any pre-existing errors on the branch before feature edits
- [x] T002 [P] Read manual scenarios in `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\_active\inbox-channel-switch-ux\quickstart.md` and note baseline UX gaps for retest after implementation

---

## Phase 2: Foundational (blocking)

- [x] T003 In `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\NewConversationModal.tsx`, make **email subject required**: update label from optional, add validation when `channel === 'email'`, block submit when `subject.trim()` is empty, pass trimmed non-null `subject` in `onStart` for email
- [x] T004 In `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\NewConversationModal.tsx`, add optional props `initialChannel`, `initialPersonId`, `lockChannel`; reset/sync internal state when `open` becomes true; hide channel toggles and new-recipient option when `lockChannel` is true

---

## Phase 3: User Story 1 (P1) — Conversations tab

- [x] T005 [US1] In `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\pages\UnifiedInboxPage.tsx`, rewrite `handleReplyChannelChange` (Conversations only): always `setChannelFilter`; resolve `personId` from selection or `emptyChannelStartContext`; find `latest` or set empty context + clear selection; **unlinked** (`personId` null): still switch channel and set context with `personId: null`
- [x] T006 [US1] In `UnifiedInboxPage.tsx`, clear `emptyChannelStartContext` on list select, new conversation success, customers tab view, generic New click; skip list auto-select while `emptyChannelStartContext` is set
- [x] T007 [US1] In `UnifiedInboxPage.tsx`, wire `NewConversationModal` prefill from Conversations empty state (`onOpenNewConversation`)
- [x] T008 [US1] In `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationView.tsx`, empty state: **link-person** copy when `!personId`; Email/WhatsApp + linked → **Start new conversation**; SMS → shared unsupported copy; `ChannelSelector` + callback
- [x] T009 [US1] Pass `emptyChannelContext` and handlers from `UnifiedInboxPage.tsx` into `ConversationView`

---

## Phase 4: User Story 2 (P1) — Customers tab

- [x] T010 [US2] In `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationThread.tsx`, when `enabledReplyChannels !== undefined`, use it as `availableChannels`; fix `effectiveDefault` sync for Customers
- [x] T011 [US2] In `ConversationThread.tsx` (merged former T011+T012): unified mode + `!activeConversationId` — disable send/textarea; add `onRequestStartConversation` + `startConversationContext`; **Start conversation** only when linked person + handle for channel; link-person / missing-handle / SMS unsupported copy; remove old warning-only line
- [x] T012 [US2] In `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\CustomerConversationView.tsx`, pass `startConversationContext` and `onRequestStartConversation` through to `ConversationThread`
- [x] T013 [US2] In `UnifiedInboxPage.tsx`, add `onRequestNewConversation` on `CustomerConversationView` to open shared modal with prefill

---

## Phase 5: User Story 3 (P2)

- [x] T014 [US3] In `ConversationThread.tsx`, default WhatsApp `replyMode` to `template` when `messages.length === 0` (full `messages` prop), `activeConversationId` set, and channel WhatsApp
- [x] T015 [US3] Shared SMS / link copy via `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\copy\channelSwitchMessages.ts` in `ConversationView` + `ConversationThread`

---

## Phase 6: Polish

- [x] T016 Run `npx tsc --noEmit` (post-implementation)
- [x] T017 [P] Manual scenarios in `quickstart.md`
- [x] T018 [P] Validation notes appended to `quickstart.md`

---

## Task summary

| Phase | Task IDs | Count |
|-------|-----------|-------|
| Setup | T001–T002 | 2 |
| Foundational | T003–T004 | 2 |
| US1 | T005–T009 | 5 |
| US2 | T010–T013 | 4 |
| US3 | T014–T015 | 2 |
| Polish | T016–T018 | 3 |
| **Total** | **T001–T018** | **18** |
