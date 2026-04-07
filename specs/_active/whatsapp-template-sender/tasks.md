---
description: "Task list for WhatsApp Template Sender"
---

# Tasks: WhatsApp Template Sender

**Input**: Design documents from `specs/_active/whatsapp-template-sender/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api-contracts.md ✅ contracts/ui-contracts.md ✅ quickstart.md ✅  

**Tests**: Not requested as mandatory automated TDD; include manual validation tasks from quickstart scenarios.

**Organization**: Tasks are grouped by user story for independent delivery and testing. Freeform WhatsApp send remains backward-compatible across all phases.

## Path Conventions

- Frontend Inbox module: `src/modules/inbox/`
- Edge functions: `supabase/functions/`

---

## Phase 1: Setup

**Purpose**: Prepare baseline and confirm feature branch context.

- [ ] T001 Verify branch/spec context and open docs in `specs/_active/whatsapp-template-sender/` (`spec.md`, `plan.md`, `research.md`, `contracts/`, `quickstart.md`)
- [ ] T002 Verify local app runs with Inbox route available by running `npm run dev` from repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add additive request contract support shared by all user stories.

⚠️ **CRITICAL**: Complete before user-story phases.

- [x] T003 Update request/response typings in `src/modules/inbox/api/inboxTwilio.api.ts` to support additive template payload (`contentSid`, `contentVariables`, optional rendered `body_text`)
- [x] T004 Update `useSendReply` mutation input model in `src/modules/inbox/hooks/useInboxMessages.ts` to allow WhatsApp freeform and WhatsApp template send payloads while preserving email/SMS branches unchanged
- [x] T028 Create `supabase/functions/fetch-whatsapp-templates/index.ts` for server-mediated template retrieval from Twilio Content API, returning approved templates only
- [x] T005 Update request parsing/validation in `supabase/functions/inbox-twilio-send/index.ts` to accept either freeform (`body_text`) or template (`contentSid` + `contentVariables`) without breaking existing freeform validation behavior
- [x] T006 Update Twilio API request construction in `supabase/functions/inbox-twilio-send/index.ts` to send `Body` for freeform and `ContentSid` + `ContentVariables` for template mode
- [x] T007 Ensure message persistence in `supabase/functions/inbox-twilio-send/index.ts` stores fully rendered template text in `inbox_messages.body_text` for template sends, and preserves existing freeform storage behavior

**Checkpoint**: API contract supports both send modes; freeform path remains valid.

---

## Phase 3: User Story 1 - Choose Send Mode in WhatsApp Reply (Priority: P1) 🎯 MVP

**Goal**: Staff can manually switch WhatsApp composer between freeform and template modes.

**Independent Test**: In a WhatsApp conversation, mode switch appears and works; in non-WhatsApp channels, template controls are hidden.

- [x] T008 [US1] Add composer mode state and WhatsApp-only mode toggle UI in `src/modules/inbox/components/ConversationThread.tsx`
- [x] T009 [US1] Keep existing freeform textarea/send controls active in freeform mode in `src/modules/inbox/components/ConversationThread.tsx`
- [x] T010 [US1] Add channel-guarded visibility logic in `src/modules/inbox/components/ConversationThread.tsx` so template mode UI is unavailable when selected channel is not `whatsapp`

**Checkpoint**: Manual mode switching works and does not affect other channels.

---

## Phase 4: User Story 2 - Select Approved Template and Edit Variables (Priority: P1)

**Goal**: In template mode, staff select approved templates and edit prefilled variables.

**Independent Test**: Opening selector fetches approved templates live; selecting one shows editable variable inputs with prefills.

- [x] T011 [US2] Add template selector open-state and live-fetch trigger in `src/modules/inbox/components/ConversationThread.tsx` (fetch each selector open)
- [x] T012 [US2] Implement server-mediated template list retrieval in `src/modules/inbox/api/inboxTwilio.api.ts` by invoking `fetch-whatsapp-templates` edge function for approved templates
- [x] T013 [US2] Render approved template dropdown and selection state in `src/modules/inbox/components/ConversationThread.tsx`
- [x] T014 [US2] Render variable form for selected template in `src/modules/inbox/components/ConversationThread.tsx` with editable fields
- [x] T015 [US2] Implement variable prefill mapping in `src/modules/inbox/components/ConversationThread.tsx` using current conversation/order context for customer values and authenticated user email for staff `{{2}}`
- [x] T016 [US2] Add template-form validation and clear error states in `src/modules/inbox/components/ConversationThread.tsx` where required variables are all `{{N}}` placeholders parsed from template body and any empty/whitespace-only value blocks send

**Checkpoint**: Template selection + variable editing complete with live list load and validation.

---

## Phase 5: User Story 3 - Send Template Through Existing WhatsApp Send Flow (Priority: P1)

**Goal**: Template sends use `contentSid` + `contentVariables` and appear as normal outbound messages.

**Independent Test**: Template send succeeds, timeline shows outbound message body as rendered text, and failure paths show actionable errors.

- [x] T017 [US3] Extend send handler wiring in `src/modules/inbox/components/ConversationThread.tsx` to submit template payload (`contentSid`, `contentVariables`, rendered `body_text`) via existing mutation path
- [x] T018 [US3] Implement additive template send branch in `src/modules/inbox/hooks/useInboxMessages.ts` for WhatsApp while preserving freeform branch and existing email/SMS branch behavior
- [x] T019 [US3] Persist Twilio/template metadata additively in `supabase/functions/inbox-twilio-send/index.ts` message insert paths (sent/failed) without schema changes
- [x] T020 [US3] Update conversation last-preview update logic in `supabase/functions/inbox-twilio-send/index.ts` to use rendered body for template sends and existing body for freeform sends
- [x] T021 [US3] Ensure frontend error handling in `src/modules/inbox/api/inboxTwilio.api.ts` continues to surface structured Twilio/managed errors for both send modes

**Checkpoint**: Template send integrated through existing path with backward compatibility.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate non-regression, formatting, and acceptance scenarios.

- [x] T022 Run `npx tsc --noEmit` from repo root and resolve any TypeScript errors introduced by T003-T021
- [ ] T023 [P] Run manual Quickstart Scenario 1 (freeform regression) using `specs/_active/whatsapp-template-sender/quickstart.md`
- [ ] T024 [P] Run manual Quickstart Scenario 3 (live template fetch per selector open) using `specs/_active/whatsapp-template-sender/quickstart.md`
- [ ] T025 [P] Run manual Quickstart Scenarios 4-6 (prefill/edit/send/validation) using `specs/_active/whatsapp-template-sender/quickstart.md`
- [ ] T026 [P] Run manual Quickstart Scenario 7 (email/SMS unchanged) using `specs/_active/whatsapp-template-sender/quickstart.md`
- [ ] T027 Document final validation notes and known limitations in `specs/_active/whatsapp-template-sender/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies
- Phase 2 (Foundational): depends on Phase 1; blocks all user stories
- Phase 3 (US1): depends on Phase 2
- Phase 4 (US2): depends on Phase 3 (composer mode UI exists)
- Phase 5 (US3): depends on Phases 2 and 4
- Phase 6 (Polish): depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: independent entry UX on top of foundational contract support
- **US2 (P1)**: depends on US1 toggle surface
- **US3 (P1)**: depends on US2 template-selection data and foundational backend support

### Within-Story Sequencing

- Foundational: T003 -> T004 -> T028 -> T005 -> T006 -> T007
- US1: T008 -> T009 -> T010
- US2: T011 -> T012 -> T013 -> T014 -> T015 -> T016
- US3: T017 -> T018 -> T019 -> T020 -> T021

---

## Parallel Execution Examples

### US2 parallel opportunity after selector scaffolding

```bash
# After T013, these can be parallelized:
# T014 variable form rendering (ConversationThread.tsx)
# T012 API retrieval helper work (inboxTwilio.api.ts)
```

### Polish parallel opportunity

```bash
# Manual verification tasks can run in parallel after T022:
# T023, T024, T025, T026
```

---

## Implementation Strategy

### MVP first (minimum releasable)

1. Complete Phase 1 and Phase 2
2. Deliver US1 (mode switch + WhatsApp-only visibility)
3. Deliver US2 (template select + editable variables)
4. Deliver US3 (send path integration)
5. Validate with T022 and Quickstart Scenarios 1, 4, 5

### Incremental delivery

1. Ship US1 as UI-only additive change
2. Ship US2 with live template retrieval and prefills
3. Ship US3 backend + mutation wiring with freeform regression checks
4. Polish and cross-channel validation
