---
description: "Task list for Shared WhatsApp UI and Sender Identity"
---

# Tasks: Shared WhatsApp UI and Sender Identity

**Input**: Design documents from `specs/_active/shared-whatsapp-ui/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api-contracts.md ✅ contracts/ui-contracts.md ✅ quickstart.md ✅

**Tests**: No mandatory automated TDD requested; include manual validation tasks from `quickstart.md`.

**Organization**: Tasks are grouped by user story for independent implementation and testing. Changes are limited to WhatsApp scope only.

## Path Conventions

- Frontend Inbox module: `src/modules/inbox/`
- App layout: `src/app/layout/`
- Edge functions: `supabase/functions/`

---

## Phase 1: Setup

**Purpose**: Confirm feature context and baseline.

- [x] T001 Verify feature docs are present in `specs/_active/shared-whatsapp-ui/` (`spec.md`, `plan.md`, `research.md`, `contracts/`, `quickstart.md`)
- [ ] T002 Verify local baseline by running `npm run dev` from `c:/Users/owner/Desktop/unify-memorial-mason-main`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prepare shared data needed by both user stories.

⚠️ **CRITICAL**: Complete before user-story phases.

- [x] T003 Add outbound metadata typing for `sender_email` in `src/modules/inbox/types/inbox.types.ts` without changing existing non-WhatsApp behavior
- [x] T004 Add current-user email access for thread sender-label resolution in `src/modules/inbox/components/ConversationThread.tsx` (read-only state source, no channel behavior changes)

**Checkpoint**: Message model and user email context are ready for WhatsApp-only sender label logic.

---

## Phase 3: User Story 1 - Shared WhatsApp Status with Admin-Only Controls (Priority: P1) 🎯 MVP

**Goal**: All users see WhatsApp status; only admin sees control actions.

**Independent Test**: Non-admin sees status-only top bar; admin sees full dropdown controls.

- [x] T005 [US1] Add `isAdmin` prop contract in `src/modules/inbox/components/WhatsAppConnectionStatus.tsx`
- [x] T008 [US1] Compute `isAdmin` in `src/app/layout/DashboardLayout.tsx` from authenticated `user.email` and `import.meta.env.VITE_ADMIN_EMAIL`
- [x] T009 [US1] Pass admin flag from `src/app/layout/DashboardLayout.tsx` into `src/modules/inbox/components/WhatsAppConnectionStatus.tsx`
- [x] T006 [US1] Gate action controls in `src/modules/inbox/components/WhatsAppConnectionStatus.tsx` so non-admin users only see indicator + status label
- [x] T007 [US1] Keep full existing control set visible for admin users in `src/modules/inbox/components/WhatsAppConnectionStatus.tsx`
- [x] T010 [US1] Add missing-env fallback behavior in `src/app/layout/DashboardLayout.tsx` so empty `VITE_ADMIN_EMAIL` yields no admin controls for any user

**Checkpoint**: Admin gating is enforced in UI with status visible to all users.

---

## Phase 4: User Story 2 - WhatsApp Outbound Sender Identity (Priority: P1)

**Goal**: Persist `meta.sender_email` for outbound WhatsApp sends and display correct sender label on outbound WhatsApp bubbles only.

**Independent Test**: Outbound WhatsApp bubbles show `You`/email/fallback logic correctly while inbound and non-WhatsApp labels remain unchanged.

- [x] T011 [US2] Add additive `meta.sender_email` persistence to outbound insert success path in `supabase/functions/inbox-twilio-send/index.ts`
- [x] T012 [US2] Add additive `meta.sender_email` persistence to outbound insert failure path in `supabase/functions/inbox-twilio-send/index.ts`
- [x] T013 [US2] Preserve existing metadata keys when writing `meta.sender_email` in `supabase/functions/inbox-twilio-send/index.ts`
- [x] T014 [US2] Read outbound WhatsApp `meta.sender_email` in `src/modules/inbox/components/ConversationThread.tsx` and derive sender label (`You` same user, email different user, `You` fallback missing)
- [x] T015 [US2] Restrict sender-label override to outbound WhatsApp only in `src/modules/inbox/components/ConversationThread.tsx`
- [x] T016 [US2] Keep existing inbound and non-WhatsApp sender-name behavior unchanged in `src/modules/inbox/components/ConversationThread.tsx`
- [x] T017 [US2] Update `src/modules/inbox/components/InboxMessageBubble.tsx` only as needed to display computed sender label without changing existing layout semantics

**Checkpoint**: WhatsApp outbound sender identity is persisted and rendered with backward-compatible fallback.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validate no regressions and capture verification evidence.

- [x] T018 Run `npx tsc --noEmit` from `c:/Users/owner/Desktop/unify-memorial-mason-main` and resolve introduced type errors only
- [ ] T019 [P] Run quickstart Scenario 1 in `specs/_active/shared-whatsapp-ui/quickstart.md` (non-admin status-only view)
- [ ] T020 [P] Run quickstart Scenario 2 in `specs/_active/shared-whatsapp-ui/quickstart.md` (admin controls visible)
- [ ] T021 [P] Run quickstart Scenario 3 in `specs/_active/shared-whatsapp-ui/quickstart.md` (WhatsApp sender metadata persisted)
- [ ] T022 [P] Run quickstart Scenario 4 in `specs/_active/shared-whatsapp-ui/quickstart.md` (WhatsApp outbound label logic)
- [ ] T023 [P] Run quickstart Scenario 5 in `specs/_active/shared-whatsapp-ui/quickstart.md` (inbound/email/SMS unchanged)
- [ ] T024 [P] Run quickstart Scenario 6 in `specs/_active/shared-whatsapp-ui/quickstart.md` (missing admin env fallback)
- [ ] T025 Document final validation notes and known limitations in `specs/_active/shared-whatsapp-ui/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies
- Phase 2 (Foundational): depends on Phase 1; blocks all user stories
- Phase 3 (US1): depends on Phase 2
- Phase 4 (US2): depends on Phase 2
- Phase 5 (Polish): depends on completion of Phase 3 and Phase 4

### User Story Dependencies

- **US1 (P1)**: independent once foundational context is ready
- **US2 (P1)**: independent once foundational context is ready

### Within-Story Sequencing

- US1: T005 -> T008 -> T009 -> T006 -> T007 -> T010
- US2: T011 -> T012 -> T013 -> T014 -> T015 -> T016 -> T017

---

## Parallel Execution Examples

### US1 parallel opportunity after admin derivation

```bash
# After T008, these can run in parallel:
# T006 control gating in WhatsAppConnectionStatus.tsx
# T010 missing-env fallback behavior in DashboardLayout.tsx
```

### Polish parallel opportunity

```bash
# After T018, manual verification tasks can run in parallel:
# T019, T020, T021, T022, T023, T024
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2
2. Deliver US1 (admin-only controls + all-user status visibility)
3. Validate Scenarios 1 and 2

### Incremental Delivery

1. Add US2 metadata persistence in `inbox-twilio-send`
2. Add US2 sender-label rendering in thread
3. Validate Scenarios 3-6 and document outcomes
