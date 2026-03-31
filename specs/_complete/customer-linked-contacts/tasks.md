---
description: "Task list for Customer Linked Contacts — Visibility + Proof-Send Resolution"
---

# Tasks: Customer Linked Contacts — Visibility + Proof-Send Resolution

**Input**: Design documents from `specs/_active/customer-linked-contacts/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ui-contracts.md ✅

**Tests**: Not requested — manual verification via quickstart.md scenarios.

**Call-site audit (completed before task generation)**:
- `ProofSendModal` is instantiated in exactly **one** place: `DraftScreen` inside `ProofPanel.tsx`. No other file instantiates it directly.
- `customerEmail`/`customerPhone` as ProofPanel props appear only in `ProofPanel.tsx` and `OrderDetailsSidebar.tsx`. No other component passes these props.

## Path Conventions

- **Customers module**: `src/modules/customers/` (hooks/, components/, index.ts)
- **Proofs module**: `src/modules/proofs/components/`
- **Orders module**: `src/modules/orders/components/`
- **Shared UI**: `src/shared/components/ui/`

---

## Phase 1: Foundational (Hook + Export)

**Purpose**: The `useLinkedContactsByCustomer` hook is required by all three user story phases. It must exist before any consuming component is built.

⚠️ **CRITICAL**: T002 and T003 both depend on T001.

- [X] T001 Create `src/modules/customers/hooks/useLinkedContacts.ts` — new file: export `LinkedContact` interface `{ channel: 'email' | 'sms' | 'whatsapp'; handle: string }`, export `linkedContactsKeys.byCustomer(customerId)` query key, implement `fetchLinkedContacts(customerId)` (direct Supabase query: `.from('inbox_conversations').select('channel, primary_handle').eq('person_id', customerId).eq('link_state', 'linked')` with client-side dedup by `channel:handle.trim().toLowerCase()`), export `useLinkedContactsByCustomer(customerId: string | null | undefined)` React Query hook (enabled: `!!customerId`) per `data-model.md §2`

- [X] T002 Update `src/modules/customers/index.ts` (ADDITIVE) — add exports: `useLinkedContactsByCustomer`, `linkedContactsKeys`, and `type LinkedContact` from `./hooks/useLinkedContacts`; depends on T001

**Checkpoint**: Hook and export exist. `useLinkedContactsByCustomer` can be imported from `@/modules/customers`.

---

## Phase 2: User Story 1 — Staff Sees All Linked Contacts in Customer Detail (Priority: P1) 🎯

**Goal**: Staff can open the Customer edit drawer and see all linked contacts (from Inbox) in a read-only section, with empty state if none exist.

**Independent Test**: Quickstart Scenarios 1 and 2 — open edit drawer for customer with and without linked conversations.

- [X] T003 [US1] Update `src/modules/customers/components/EditCustomerDrawer.tsx` (ADDITIVE ONLY) — add imports: `useLinkedContactsByCustomer` from `@/modules/customers`, `Badge` from `@/shared/components/ui/badge`; add inline `LinkedContactsSection` component (renders linked contacts with channel badge + handle, empty state per `contracts/ui-contracts.md §1`); insert `<LinkedContactsSection customerId={customer.id} />` block inside the form, after the last `FormField`, before `<DrawerFooter>` — no changes to existing form fields or submit logic; depends on T001, T002

**Checkpoint US1**: Run Quickstart Scenario 1 (see linked contacts) and Scenario 2 (empty state). Existing edit form save flow must be unbroken.

---

## Phase 3: User Story 2 — Staff Selects the Correct Contact When Sending a Proof (Priority: P1)

**Goal**: ProofSendModal fetches all available contacts for the customer internally and shows a radio-group picker when multiple options exist per channel.

**Independent Test**: Quickstart Scenarios 3–6 — single option pre-selected, multiple options radio group, zero options disabled, deduplication.

⚠️ **PROP SIGNATURE CHANGE WARNING**: T004 removes `customerEmail` and `customerPhone` props from `ProofSendModal`. The ONLY call site is `DraftScreen` inside `ProofPanel.tsx`, updated in T005. T004 and T005 must be executed sequentially — do NOT deploy T004 alone without T005.

### Implementation for User Story 2

- [X] T004 [US2] Update `src/modules/proofs/components/ProofSendModal.tsx` (PROP SIGNATURE CHANGE) — (a) add imports: `useLinkedContactsByCustomer, type LinkedContact` from `@/modules/customers`; `useCustomer` from `@/modules/customers/hooks/useCustomers`; `RadioGroup, RadioGroupItem` from `@/shared/components/ui/radio-group`; (b) replace props: remove `customerEmail?: string | null` and `customerPhone?: string | null`, add `customerId?: string | null`; (c) add internal data fetching: `useLinkedContactsByCustomer(customerId)` and `useCustomer(customerId ?? '')` with `enabled: !!customerId`; (d) implement `buildEmailOptions` and `buildPhoneOptions` helpers (merge static + linked, dedup by normalised value, static marked "(Primary)") per `data-model.md §3`; (e) add state: `selectedEmail` + `selectedPhone` with auto-select `useEffect` when exactly one option; (f) replace channel checkboxes with radio-group pickers per `contracts/ui-contracts.md §2`: pre-selected single option shown inline, radio group visible when multiple options + checkbox checked, disabled with tooltip when zero options; (g) update send gating (`emailReady`, `whatsAppReady`, `channelsSelected`) and `handleSend` to use resolved contact values per `contracts/ui-contracts.md §2 handleSend`; depends on T001, T002

- [X] T005 [US2] Update `src/modules/proofs/components/ProofPanel.tsx` (PROP SIGNATURE CHANGE) — (a) update `ProofPanelProps` interface: remove `customerEmail?: string | null` and `customerPhone?: string | null`, add `customerId?: string | null`; (b) update `DraftScreen` internal component: update its prop interface (remove `customerEmail`/`customerPhone`, add `customerId`), update `ProofSendModal` call inside `DraftScreen` to pass `customerId={customerId}` instead of `customerEmail`/`customerPhone`; (c) update main `ProofPanel` component body: remove destructuring of `customerEmail`/`customerPhone`, add `customerId` to destructuring; (d) update `DraftScreen` call in render to pass `customerId={customerId}` instead of `customerEmail`/`customerPhone`; ⚠️ ProofPanel will NOT compile until T006 is also complete (TypeScript will error on the removed props at the OrderDetailsSidebar call site); depends on T004

- [X] T006 [US2] Update `src/modules/orders/components/OrderDetailsSidebar.tsx` (SIMPLIFICATION) — (a) remove from import: `useOrderPeople` from `'../hooks/useOrders'` (verify no other usage of `useOrderPeople` in this file before removing); (b) remove lines: `const { data: orderPeople } = useOrderPeople(order?.id ?? null);`, `const primaryPerson = ...`, `const proofCustomerEmail = ...`, `const proofCustomerPhone = ...`; (c) update `<ProofPanel>` call: remove `customerEmail={proofCustomerEmail}` and `customerPhone={proofCustomerPhone}`, add `customerId={order.person_id ?? null}`; ⚠️ this task MUST follow T005 — together T005 + T006 form a single atomic prop migration; depends on T005

**Checkpoint US2**: Run Quickstart Scenarios 3–7 — contact picker works for all scenarios, `orderPeople` network request no longer appears in browser Network tab on sidebar open.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T007 Run `npm run build` from repo root — fix any TypeScript errors introduced by T003–T006; verify `ProofSendModal`, `ProofPanel`, `DraftScreen`, `OrderDetailsSidebar` all compile cleanly; common issues: forgotten prop in ProofPanel DraftScreen invocation, `useCustomer` import path drift, `RadioGroup` not imported

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately; BLOCKS all other phases
- **US1 (Phase 2)**: Depends on Phase 1 (T001, T002); independent of US2
- **US2 (Phase 3)**: Depends on Phase 1 (T001, T002); T004 → T005 → T006 are strictly sequential within the phase
- **Polish (Phase 4)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Only needs Phase 1 complete; independent of US2
- **US2 (P1)**: Needs Phase 1 complete; T004/T005/T006 sequential (prop signature migration chain)

### Prop Signature Migration Chain

```
T004: ProofSendModal removes customerEmail/customerPhone
  ↓
T005: ProofPanel removes customerEmail/customerPhone, adds customerId
      (updates DraftScreen + ProofSendModal call)
  ↓
T006: OrderDetailsSidebar removes proofCustomerEmail/Phone, adds customerId
      (removes useOrderPeople)
```

T003 (EditCustomerDrawer) is **independent** of the prop chain — can run after Phase 1 in parallel with T004.

### Parallel Opportunities

After Phase 1 complete (T001, T002), these can run in parallel:

```bash
# T003 (EditCustomerDrawer — different file) can run in parallel with T004
T003: EditCustomerDrawer.tsx — US1, no prop dependency
T004: ProofSendModal.tsx     — US2 prop chain start
```

T005 and T006 are NOT parallelisable — T006 strictly follows T005.

---

## Implementation Strategy

### MVP (all P1 — deliver together)

1. Complete Phase 1 (T001, T002) — CRITICAL gate
2. Complete T003 and T004 in parallel — both depend only on Phase 1
3. Complete T005 immediately after T004
4. Complete T006 immediately after T005
5. Run T007 (build clean)
6. **Validate**: Quickstart Scenarios 1–7

### Key rules preserved in tasks

- `useLinkedContactsByCustomer` defined ONCE in `src/modules/customers/hooks/useLinkedContacts.ts`, imported everywhere via `@/modules/customers`
- `useCustomer` imported directly from `@/modules/customers/hooks/useCustomers` inside `ProofSendModal` (or via `@/modules/customers`)
- `RadioGroup`/`RadioGroupItem` from `src/shared/components/ui/radio-group.tsx` (already exists — no new dependency)
- T005 + T006 are one atomic migration — never leave them partially applied
