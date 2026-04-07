# Tasks: WhatsApp 24-Hour Session Window (Composer)

**Input**: Design documents from `specs/_active/whatsapp-24h-composer/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-conversation-thread-whatsapp-session.md](./contracts/ui-conversation-thread-whatsapp-session.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested in spec — no automated test tasks. Validation via `quickstart.md` + `tsc`.

**Single file scope**: All implementation tasks target **`src/modules/inbox/components/ConversationThread.tsx`** only.

## Format: `[ID] [Story?] Description`

- **[Story]**: `[US1]` `[US2]` `[US3]` map to spec user stories; setup/foundation/polish omit story label.

---

## Phase 1: Setup

**Purpose**: Align implementer with contracts and constraints before editing code.

- [x] T001 Review [spec.md](./spec.md) FR-001–FR-010 and [contracts/ui-conversation-thread-whatsapp-session.md](./contracts/ui-conversation-thread-whatsapp-session.md) acceptance rules before coding.

---

## Phase 2: Foundational (Blocking)

**Purpose**: Derived session state used by all user stories — must land before UI polish.

**⚠️** No user-story-specific UI work until `isWhatsAppSessionClosed` is correct.

- [x] T002 In `src/modules/inbox/components/ConversationThread.tsx`, add a 24-hour window constant (ms) and `useMemo` chain: filter `messages` to `conversation_id === activeConversationId`, `channel === 'whatsapp'`, `direction === 'inbound'`; compute latest inbound by `sent_at` (fallback `created_at` per [research.md](./research.md)); derive `isWhatsAppSessionClosed` when `activeChannel === 'whatsapp'` and (`!activeConversationId` OR no scoped inbound OR last inbound older than 24 hours from `Date.now()`).

---

## Phase 3: User Story 1 — Open session & non-WhatsApp (Priority: P1) 🎯 MVP

**Goal**: Staff see when freeform is allowed: open session = no banner, toggle available; Email/SMS unaffected.

**Independent Test**: WhatsApp + last inbound within 24 hours → no banner, toggle works; switch to Email/SMS → no WhatsApp banner (spec User Story 1).

- [x] T003 [US1] In `src/modules/inbox/components/ConversationThread.tsx`, replace the existing `lastInboundMessage` memo used for `useSuggestedReply` with the **scoped** last inbound WhatsApp message for `activeConversationId` (same filter as FR-010 / T002) so mixed timelines do not use SMS/email as “last inbound.”

---

## Phase 4: User Story 2 — Closed session banner & template-only (Priority: P1)

**Goal**: Closed session → amber banner, `replyMode` template, toggle hidden.

**Independent Test**: Last inbound older than 24 hours or no inbound → banner + template-only + no toggle (spec User Story 2).

- [x] T004 [US2] In `src/modules/inbox/components/ConversationThread.tsx`, add `useEffect` that runs when `isWhatsAppSessionClosed` is true: `setReplyMode('template')` and `setTemplatesOpen(true)`; reconcile with existing effects that set `replyMode` (WhatsApp empty thread ~lines 456–461 and `isTemplateAllowed` ~449–454) so one coherent behaviour — no conflicting jumps between freeform and template. **Verify `handleSendReply` cannot submit freeform when `isWhatsAppSessionClosed` is true** — confirm `replyMode` is locked to template before send executes (defensive guard if state is ever stale).

- [x] T005 [US2] In `src/modules/inbox/components/ConversationThread.tsx`, render an inline amber/yellow banner **above** the reply composer block (inside the `!readOnly` footer area, above the ChannelSelector / reply row) with copy matching [contracts/ui-conversation-thread-whatsapp-session.md](./contracts/ui-conversation-thread-whatsapp-session.md) when `isWhatsAppSessionClosed && isTemplateAllowed`.

- [x] T006 [US2] In `src/modules/inbox/components/ConversationThread.tsx`, render the Freeform/Template mode buttons only when `isTemplateAllowed && !isWhatsAppSessionClosed` so closed sessions are template-only with no toggle (FR-006). **Confirm `isWhatsAppSessionClosed` is false when `activeChannel` is email or SMS** — no banner or toggle lock should appear on non-WhatsApp channels.

---

## Phase 5: User Story 3 — No inbound yet / outbound-only (Priority: P2)

**Goal**: Only outbound messages in loaded history → treated as closed (spec User Story 3).

**Independent Test**: WhatsApp thread with outbound only → same closed UI as User Story 2.

- [x] T007 [US3] In `src/modules/inbox/components/ConversationThread.tsx`, verify `isWhatsAppSessionClosed` is true when scoped inbound list is empty (outbound-only or no messages); adjust T002 memos only if an edge case fails (e.g. null `activeConversationId` with WhatsApp selected).

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Typecheck and manual regression per spec FR-008.

- [x] T008 Run `npx tsc --noEmit` from repository root and fix any errors introduced in `src/modules/inbox/components/ConversationThread.tsx`.

- [x] T009 Follow [quickstart.md](./quickstart.md) sections A–E for manual verification (open session, closed stale, no inbound, Email/SMS regression, mixed timeline).

---

## Dependencies & Execution Order

### Phase order

| Phase | Depends on |
|-------|------------|
| Phase 1 Setup | — |
| Phase 2 Foundational | Phase 1 |
| Phase 3 US1 | Phase 2 |
| Phase 4 US2 | Phase 2 (T003 can follow T002; T004–T006 depend on T002) |
| Phase 5 US3 | Phase 2 (T007 validates T002); run after US2 if preferred |
| Phase 6 Polish | Phases 3–5 complete |

### User story dependencies

- **US1** (T003): Depends on T002 scoped memos.
- **US2** (T004–T006): Depends on T002; T004 → T005 → T006 recommended (same file, logical order).
- **US3** (T007): Validates T002; can run after T006.

### Parallel opportunities

- **None within implementation**: Single file `ConversationThread.tsx` — tasks are sequential to avoid merge conflicts.
- **T008** can run as soon as code compiles; **T009** after T008.

### MVP scope

**Minimum shippable slice**: Complete **Phase 2** + **Phase 4** (T002, T004, T005, T006) — delivers closed-session UX. **T003** (US1) should ship with MVP so suggestions and session use the same inbound scope. **T007** confirms outbound-only edge case.

---

## Implementation Strategy

1. T001 → T002 (core boolean).
2. T003 (suggested reply alignment).
3. T004 → T005 → T006 (closed-session behaviour + UI).
4. T007 (edge validation).
5. T008 → T009.

---

## Notes

- Do not add new components, hooks, or backend files (per [plan.md](./plan.md)).
- If `git` branch `feature/whatsapp-24h-composer` is not checked out, create/switch before committing.
