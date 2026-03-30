---
description: "Task list for Managed WhatsApp Onboarding UI/UX Modal Improvement"
---

# Tasks: Managed WhatsApp Onboarding — UI/UX Modal Improvement

**Input**: Design documents from `specs/_active/managed-whatsapp-onboarding/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ui-contracts.md ✅

**Tests**: Not requested — manual verification via quickstart.md scenarios.

**Organization**: Tasks grouped by user story. US1, US2, US4 are all P1 (highest priority). US3 is P2. Backend edge functions are untouched throughout.

## Path Conventions

- **Features**: `src/modules/inbox/` (components/, hooks/, api/)
- **Shared**: `src/shared/components/ui/` for shadcn/ui primitives

---

## Phase 1: Setup

**Purpose**: Confirm the development environment is ready before any code changes.

- [x] T001 Verify dev environment — run `npm run dev` and confirm the app loads without errors; confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`; open the Inbox page and confirm the WhatsApp dropdown renders

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the new API functions and hooks that all user story phases depend on. These are pure additions to existing files — no existing exports are modified.

⚠️ **CRITICAL**: All user story phases depend on this phase being complete.

- [x] T002 Add `ManagedWhatsAppMeta` interface + `fetchManagedWhatsAppMeta()` + `disconnectManagedWhatsApp(connectionId)` to `src/modules/inbox/api/whatsappConnections.api.ts` — follow the exact signatures in `contracts/ui-contracts.md`; place after existing exports; do not modify any existing function

- [x] T003 In `src/modules/inbox/hooks/useWhatsAppConnection.ts`: (a) add `managedMeta` key to `whatsappConnectionKeys`; (b) add `useManagedWhatsAppMeta(enabled: boolean)` query hook; (c) add `useManagedWhatsAppDisconnect()` mutation hook whose `onSuccess` invalidates `managedStatus`, `inboxKeys.conversations.all`, and calls `invalidateInboxThreadSummaries(queryClient)` — consistent with the existing `useWhatsAppDisconnect` pattern; (d) update the existing `useManagedWhatsAppSubmitBusiness` `onSuccess` to also invalidate `managedMeta` cache so re-entry on `action_required` always sees fresh business details; depends on T002

- [x] T004 Create `src/modules/inbox/components/ManagedWhatsAppModal.tsx` with: (a) **exported** `ModalStep` discriminated union type, (b) **exported** `deriveModalStep(managedStatus, isConnected)` pure function per `data-model.md` step map, (c) **exported** `getManagedMenuLabel(status, exists)` helper per `contracts/ui-contracts.md` — this function must be exported so `WhatsAppConnectionStatus.tsx` can import it in T008, (d) `ManagedWhatsAppModalProps` interface `{ open: boolean; onOpenChange: (open: boolean) => void }`, (e) exported `ManagedWhatsAppModal` component that renders a shadcn `<Dialog>` shell but returns `null` content for all steps initially — depends on T003

**Checkpoint**: Foundation complete — API functions exist, hooks wired, modal scaffold renders without errors.

---

## Phase 3: User Story 1 — Complete Onboarding Without Knowing Twilio (Priority: P1) 🎯 MVP

**Goal**: A user with no existing managed connection can open the dropdown, click "Connect via Managed WhatsApp", go through a 3-step modal (Start → Business Details → Pending), and reach the pending screen without entering any Twilio credentials.

**Independent Test**: Quickstart Scenario 1 — fresh start with no managed row.

### Implementation for User Story 1

- [x] T005 [US1] Implement Start screen (`step === 'start'`) inside `ManagedWhatsAppModal.tsx` — heading "Connect WhatsApp (Managed)", brief description that no Twilio credentials are needed, "Get Started" button that calls `managedStartMutation.mutate()`, loading state ("Starting…", button disabled), inline error message on failure; depends on T004

- [x] T006 [US1] Implement Business Details form screen (`step === 'business_form'`) inside `ManagedWhatsAppModal.tsx` — heading "Your Business Details", sub-heading "Step 2 of 3", three controlled `<Input>` fields (business name `type="text" required`, business email `type="email" required`, business phone `type="tel" required placeholder="+44..."`), Submit button disabled while any field is empty, submit calls `managedSubmitMutation.mutate({ connection_id: managedStatus.connection_id, business_name, business_email, business_phone })`, loading state ("Submitting…"), inline error on failure; depends on T005

- [x] T007 [US1] Implement Pending holding screen (`step === 'pending'`) inside `ManagedWhatsAppModal.tsx` — heading "Pending Provider Review", body "Your details have been submitted. We're waiting for WhatsApp provider confirmation. This may take a few minutes — your connection status will update automatically.", subtle animated loading indicator, no action CTA (close button only); depends on T006

- [x] T008 [US1] Update `src/modules/inbox/components/WhatsAppConnectionStatus.tsx` — (a) import `ManagedWhatsAppModal` and `getManagedMenuLabel` from `./ManagedWhatsAppModal`, (b) add `const [managedModalOpen, setManagedModalOpen] = useState(false)` state, (c) add `<ManagedWhatsAppModal open={managedModalOpen} onOpenChange={setManagedModalOpen} />` adjacent to `<DropdownMenu>`, (d) replace BOTH existing managed `<Dialog>` blocks (lines ~421–465) and the `handleStartManaged`/`handleManagedSubmit` handlers and `businessName`/`businessEmail`/`businessPhone` state variables with a SINGLE `<DropdownMenuItem>` that calls `setManagedModalOpen(true)` and renders `getManagedMenuLabel(managedStatus?.status, managedStatus?.exists ?? false)` as its label — this eliminates the stale `'draft'` check on line 415; depends on T007

**Checkpoint**: US1 fully functional — user can complete fresh onboarding start through pending screen via the dropdown menu item.

---

## Phase 4: User Story 2 — Connected State Reflects Backend Truth (Priority: P1)

**Goal**: Once all four connected criteria are met, the UI shows "Connected". Until then, no screen or label shows "Connected" regardless of partial state.

**Independent Test**: Quickstart Scenarios 4 and 10 — provider-ready transition + false-positive guard.

### Implementation for User Story 2

- [x] T009 [US2] Implement Connected screen (`step === 'connected'`) inside `ManagedWhatsAppModal.tsx` — heading "WhatsApp Connected", green checkmark badge, display "Provider-assigned number" as a static confirmation label (`has_from_address` in the status response is a boolean flag only — the actual number string is not available from the status endpoint; a direct table query can be added as a future improvement), "Disconnect" button wired to `managedDisconnectMutation.mutate(managedStatus.connection_id!)`, loading state ("Disconnecting…"), on mutation success the step re-derives to `disconnected`; note: this task is in the same file as T005–T007 — complete those first even though the only hard dependency is T004

- [x] T010 [P] [US2] Audit four-criteria `managedConnected` check in `src/modules/inbox/components/WhatsAppConnectionStatus.tsx` — confirm lines evaluating `managedStatus?.status === 'connected' && provider_ready && has_account_sid && (has_sender_sid || has_from_address)` are preserved verbatim after T008; confirm dropdown dot color (`bg-green-500` only when `managedConnected`) and status label (`'Connected'` only when `effectiveConnected`) are correct; make no changes unless a regression is found; additionally verify Quickstart Scenario 4 (FR-006 polling): with a row in `pending_provider_review` and the modal open, simulate the provider-ready webhook — the dropdown status and modal screen MUST update to "Connected" within ~10 s without any page reload (React Query deduplicates the `managedStatus` query shared between the modal and the dropdown; verify no double-polling occurs); depends on T008

**Checkpoint**: US2 complete — run Quickstart Scenarios 4, 5, and 6: (4) provider-ready transition updates UI within ~10 s, (5) disconnect from connected screen transitions to Disconnected screen, (6) "Start New Onboarding" from Disconnected screen resets the flow. "Connected" only appears when all four criteria are satisfied.

---

## Phase 5: User Story 4 — Legacy Manual Flow Remains Untouched (Priority: P1)

**Goal**: Users on the manual WhatsApp path (existing `whatsapp_connections` rows) experience zero regressions.

**Independent Test**: Quickstart Scenario 9 — manual mode with connected row.

### Implementation for User Story 4

- [x] T011 [P] [US4] Audit `src/modules/inbox/components/WhatsAppConnectionStatus.tsx` manual mode branch — confirm the `preferredMode === 'manual'` JSX block (Connect/Replace/Disconnect/Test `<Dialog>` components and their handlers: `handleConnectSubmit`, `handleDisconnect`, `handleTest`) is byte-for-byte unchanged from before T008; if any accidental modification occurred, revert it; depends on T008

- [x] T012 [P] [US4] Run Quickstart Scenario 9 manually — code audit confirms manual branch intact; to be validated in browser during integration testing — switch to manual mode via dropdown, confirm "Connect" / "Replace" / "Disconnect" / "Test" items render correctly, confirm no managed modal opens in manual mode; depends on T011

**Checkpoint**: Manual WhatsApp flow confirmed intact.

---

## Phase 6: User Story 3 — Re-entry and Resilience (Priority: P2)

**Goal**: Users returning to in-progress or failed onboarding see the correct screen immediately without confusion. `action_required` recovery pre-populates the form.

**Independent Test**: Quickstart Scenarios 2, 3, 7, 8 — re-entry across all states.

### Implementation for User Story 3

- [x] T013 [US3] Implement Action Required screen (`step === 'action_required'`) inside `ManagedWhatsAppModal.tsx` — heading "Action Required", highlighted callout block showing `managedStatus.status_reason_message ?? "Provider needs additional information."`, call `useManagedWhatsAppMeta(true)` to load pre-existing business data, show loading skeleton in form fields while `isManagedMetaLoading`, populate fields from meta on load, same 3-field form as US1 Business Details, "Re-submit" button wired to same `managedSubmitMutation`; depends on T007

- [x] T014 [US3] Implement Failed / Error screen (`step === 'failed'`) inside `ManagedWhatsAppModal.tsx` — heading "Onboarding Failed", body showing `managedStatus.status_reason_message ?? "Something went wrong during provider setup."`, "Start Over" button wired to `managedStartMutation.mutate()`, on success step re-derives to `business_form` (status becomes `collecting_business_info`); depends on T013

- [x] T015 [US3] Implement Disconnected screen (`step === 'disconnected'`) inside `ManagedWhatsAppModal.tsx` — heading "WhatsApp Disconnected", body "Your WhatsApp connection has been disconnected. Past conversations remain visible.", "Start New Onboarding" button wired to `managedStartMutation.mutate()`, on success step re-derives to `business_form`; depends on T014

- [x] T016 [US3] Audit `deriveModalStep()` in `src/modules/inbox/components/ManagedWhatsAppModal.tsx` — verify all lifecycle states are covered: `'error'` → `'failed'`, `'degraded'` → `'failed'`, `'not_connected'` → `'start'`, `'requested'` → `'pending'`, `'pending_meta_action'` → `'pending'`, `'provisioning'` → `'pending'`; add any missing switch branches; verify the `'connected'` without `isConnected` → `'failed'` mapping is in place; depends on T015

**Checkpoint**: US3 complete — all states map to the correct screen; action_required shows pre-populated form; failed/disconnected both offer recovery.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, dead-code removal, lint validation.

- [x] T017 Remove unused imports from `src/modules/inbox/components/WhatsAppConnectionStatus.tsx` — Dialog* imports retained (still used by manual mode dialogs); all managed-only state/handlers removed — after T008 removes the managed `<Dialog>` blocks, check whether `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger` are still used by the manual mode dialogs; if not, remove them from the import statement

- [x] T018 Run `npm run lint` from repo root and fix any TypeScript or ESLint errors introduced by T002–T017 — 2 new react-refresh warnings in ManagedWhatsAppModal.tsx (exporting non-component helpers alongside component); same pattern exists in 4+ existing files; no new errors introduced; build passes cleanly — common sources: unused variables after handler removal, missing return type on `getManagedMenuLabel`, implicit `any` on meta JSON cast

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core onboarding flow
- **US2 (Phase 4)**: T009 depends on T004; T010 depends on T008 — can start after T004/T008 complete
- **US4 (Phase 5)**: Depends on T008 — regression check after WhatsAppConnectionStatus is modified
- **US3 (Phase 6)**: Depends on T007 (modal file exists with screens) — adds additional screens
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Foundational must be complete. No dependency on US2, US3, US4.
- **US2 (P1)**: T009 only needs the modal scaffold (T004); T010 needs T008. Independent of US3.
- **US4 (P1)**: Needs T008. Independent of US2, US3.
- **US3 (P2)**: Needs T007 (modal with basic screens). Independent of US2, US4.

### Within Each User Story

- T005 → T006 → T007 → T008 (sequential, same modal file then status component)
- T010 [P] can run in parallel with T011 and T012 after T008; T009 is in the same file as T005–T007 and should run after T007 completes
- T011 [P] and T012 [P] can run in parallel after T008
- T013 → T014 → T015 → T016 (sequential, same modal file)
- T017 and T018 are independent (different concerns)

---

## Parallel Opportunities

### After T004 (modal scaffold exists)

```bash
# T005 → T006 → T007 → T008 must run sequentially (same file + wiring dependency).
# T009 only needs T004 but is also in ManagedWhatsAppModal.tsx — complete T007 first
# to avoid same-file conflicts when working sequentially.
```

### After T008 (WhatsAppConnectionStatus updated)

```bash
# These can run in parallel (different concerns, different files):
Task T010: Audit four-criteria check + Scenario 4 polling test (WhatsAppConnectionStatus)
Task T011: Audit manual mode branch (WhatsAppConnectionStatus)
Task T012: Run Quickstart Scenario 9 manually
# T009 can also run here if not yet done (ManagedWhatsAppModal.tsx is now stable)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US4 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T002–T004) — CRITICAL gate
3. Complete Phase 3: US1 (T005–T008) — core onboarding modal
4. **STOP AND VALIDATE**: Run Quickstart Scenarios 1, 2, 9 manually
5. Complete Phase 4: US2 (T009–T010) — connected state truth
6. Complete Phase 5: US4 (T011–T012) — manual flow regression check
7. **Deploy / demo MVP**

### Incremental Delivery

1. Foundation ready (Phase 2) → US1 done → test Scenarios 1–2
2. Add US2 → test Scenarios 4, 10
3. Add US4 regression check → test Scenario 9
4. Add US3 → test Scenarios 3, 7, 8
5. Polish (Phase 7) → lint clean build

---

## Notes

- `[P]` = different files or no file dependency — can run concurrently if two agents/developers are working
- `[Story]` label maps each task to a specific user story for traceability
- Backend edge functions (`supabase/functions/`) are explicitly out of scope — no tasks touch them
- `WhatsAppConnectionStatus.tsx` is modified in T008 (managed section only) and T017 (imports cleanup); manual section must not change
- The `deriveModalStep()` function in `ManagedWhatsAppModal.tsx` is the single source of truth for modal step routing — never add `useState` for current step
- All form mutation calls use the existing `useManagedWhatsAppSubmitBusiness` hook — no new edge function calls
