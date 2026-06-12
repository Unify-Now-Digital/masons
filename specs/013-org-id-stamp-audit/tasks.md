# Tasks: Organisation-Scoped Insert Stamp Audit

**Input**: Design documents from `specs/013-org-id-stamp-audit/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/org-stamp-insert.md, quickstart.md

**Tests**: Not requested — manual verification per [quickstart.md](./quickstart.md) only.

**Organization**: Tasks grouped by user story. **MVP** = Phase 1 + Phase 2 + Phase 3 (US1 inscriptions + invoices) + manual smoke on fixed paths.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline audit before any code changes

- [ ] T001 Run insert-site grep audit per [quickstart.md](./quickstart.md): `rg "\.insert\(" src/ --glob "*.{ts,tsx}"` and cross-check in-scope tables; record results in task notes or PR description
- [ ] T002 [P] Read reference pattern in `src/modules/orders/api/orders.api.ts` (`upsertOrderPeople`, `createAdditionalOption`) and [contracts/org-stamp-insert.md](./contracts/org-stamp-insert.md)
- [ ] T003 [P] Confirm feature branch `013-org-id-stamp-audit` is checked out; run `npm run lint` to establish clean baseline

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Document pre-audit status for all 11 in-scope tables — **complete before fixes**

**⚠️ CRITICAL**: No user-story fix tasks start until T004–T015 inventory is done (confirms verify-only vs fix).

- [ ] T004 Mark **orders** verify-only: confirm `createOrder` stamps `organization_id` in `src/modules/orders/api/orders.api.ts`
- [ ] T005 [P] Mark **order_people** / **order_additional_options** reference-only (exclude from fix work) in `src/modules/orders/api/orders.api.ts`
- [ ] T006 [P] Inventory **cemeteries** insert in `src/modules/cemeteries/hooks/useCemeteries.ts` — expect ✅ stamp via `organizationId`
- [ ] T007 [P] Inventory **companies** insert in `src/modules/companies/hooks/useCompanies.ts` — expect ✅ stamp via context
- [ ] T008 [P] Inventory **products** insert in `src/modules/products/hooks/useProducts.ts` — expect ✅ stamp via context
- [ ] T009 [P] Inventory **payments** insert in `src/modules/payments/hooks/usePayments.ts` — expect ✅ stamp via context
- [ ] T010 [P] Inventory **permit_forms** insert in `src/modules/permitForms/api/permitForms.api.ts` — expect ✅ stamp via param
- [ ] T011 [P] Inventory **inbox_conversations** insert in `src/modules/inbox/api/inboxConversations.api.ts` — expect ✅ stamp on row
- [ ] T012 Inventory **inscriptions** insert in `src/modules/inscriptions/hooks/useInscriptions.ts` — expect ❌ missing org (fix in US1)
- [ ] T013 Inventory **invoices** insert in `src/modules/invoicing/api/invoicing.api.ts` — expect ⚠️ caller-dependent (fix in US1)
- [ ] T014 Inventory **inbox_messages** insert in `src/modules/inbox/api/inboxMessages.api.ts` and `src/modules/inbox/hooks/useInboxMessages.ts` — expect ❌ `useSaveInternalNote` missing org (fix in US3)
- [ ] T015 Inventory **table_view_presets** insert in `src/shared/tableViewPresets/api/tableViewPresets.api.ts` — expect ❌ missing org + unscoped fetch (fix in US2)
- [ ] T016 Inventory **invoice_payments** inserts in `supabase/functions/stripe-webhook/index.ts` — expect ❌ `insertInvoicePaymentOnce` missing org (fix in US4)

**Checkpoint**: Inventory table complete; exactly 4 src fix targets + 1 Edge fix target confirmed

---

## Phase 3: User Story 1 — Order-related child data persists reliably (Priority: P1) 🎯 MVP

**Goal**: Inscriptions and invoices save with correct org scope; payments path verified

**Independent Test**: On a test order, add inscription → reload → visible with org id. Create invoice → appears in active org invoice list. No 42501 in network tab.

### Implementation

- [X] T017 [US1] In `src/modules/inscriptions/hooks/useInscriptions.ts` `createInscription`: when `order_id` present, select `organization_id` from `orders` by id; throw if missing; insert `{ ...inscription, organization_id }`
- [ ] T018 [US1] Refactor `src/modules/invoicing/api/invoicing.api.ts` `createInvoice(invoice, organizationId)`: throw if `!organizationId`; insert `{ ...invoice, organization_id: organizationId }`
- [ ] T019 [US1] Update `src/modules/invoicing/hooks/useInvoices.ts` `useCreateInvoice`: pass `organizationId` from `useOrganization()` to `createInvoice`; throw `'No organization selected'` if unset
- [ ] T020 [P] [US1] Review `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`: remove redundant `organization_id` from payload if API now authoritative (optional cleanup; keep if harmless)

### Verification

- [ ] T021 [US1] Manual verify **inscriptions**: add inscription on test order; confirm row + org id per [quickstart.md](./quickstart.md)
- [ ] T022 [US1] Manual verify **invoices**: create invoice via drawer; confirm list visibility + org id
- [ ] T023 [P] [US1] Manual verify **payments** (verify-only): record payment on invoice; confirm org stamped in `src/modules/payments/hooks/usePayments.ts`

**Checkpoint**: US1 acceptance scenarios pass; inscription + invoice no longer silently fail

---

## Phase 4: User Story 2 — Top-level workshop reference data persists (Priority: P1)

**Goal**: Table view presets org-scoped; reference entities confirmed

**Independent Test**: Save column preset on orders table → reload → preset persists for active org only.

### Implementation

- [ ] T024 [US2] Add `organizationId` param to `createPreset` in `src/shared/tableViewPresets/api/tableViewPresets.api.ts`; stamp insert; throw if unset
- [ ] T025 [US2] Add `organizationId` param to `fetchPresetsByModule` in `src/shared/tableViewPresets/api/tableViewPresets.api.ts`; filter `.eq('organization_id', organizationId)`
- [ ] T026 [US2] Scope unset-default queries in `src/shared/tableViewPresets/api/tableViewPresets.api.ts` (`createPreset`, `updatePreset`, `setDefaultPreset`) by `organization_id`
- [ ] T027 [US2] Wire `useOrganization()` in `src/shared/tableViewPresets/hooks/useTableViewPresets.ts`: pass org to create/fetch; include org in React Query keys
- [ ] T028 [P] [US2] Confirm `src/shared/tableViewPresets/components/PresetsTab.tsx` works with updated hooks (no code change expected if hooks API unchanged)

### Verification

- [ ] T029 [P] [US2] Manual verify **table_view_presets**: save preset; reload; org-scoped per [quickstart.md](./quickstart.md)
- [ ] T030 [P] [US2] Manual verify **products** in `src/modules/products/hooks/useProducts.ts` (verify-only)
- [ ] T031 [P] [US2] Manual verify **cemeteries** in `src/modules/cemeteries/hooks/useCemeteries.ts` (verify-only)
- [ ] T032 [P] [US2] Manual verify **companies** in `src/modules/companies/hooks/useCompanies.ts` (verify-only)
- [ ] T033 [P] [US2] Manual verify **permit_forms** in `src/modules/permitForms/api/permitForms.api.ts` (verify-only)

**Checkpoint**: Presets save and list per org; top-level reference tables confirmed

---

## Phase 5: User Story 3 — Inbox conversations and messages persist (Priority: P1)

**Goal**: Internal notes and messages stamp org from parent conversation

**Independent Test**: On Sears Melvin org (`3770972d-1bbd-417b-b413-297e844db285`), add internal note → visible in thread; no 42501.

### Implementation

- [ ] T034 [US3] In `src/modules/inbox/api/inboxMessages.api.ts` `createMessage`: select `organization_id` from `inbox_conversations` by `conversation_id`; throw if missing; stamp insert payload
- [ ] T035 [P] [US3] Confirm `src/modules/inbox/hooks/useInboxMessages.ts` `useSaveInternalNote` inherits fix via `createMessage` (no duplicate lookup if API handles it)

### Verification

- [ ] T036 [US3] Manual verify **inbox_messages**: internal note on Sears Melvin conversation per [quickstart.md](./quickstart.md)
- [ ] T037 [P] [US3] Manual verify **inbox_conversations** in `src/modules/inbox/api/inboxConversations.api.ts` (verify-only)

**Checkpoint**: Inbox message saves persist; live Churchill data not used for throwaway tests

---

## Phase 6: User Story 4 — Invoice payment reconciliation records persist (Priority: P1)

**Goal**: `invoice_payments` rows include org id on all webhook paths; single fix coordinated with 012 Stripe work

**Independent Test**: Test-mode Stripe payment → `invoice_payments` row with `organization_id` matching invoice; visible in payment history UI.

### Implementation

- [ ] T038 [US4] Extend `insertInvoicePaymentOnce` opts with required `organization_id` in `supabase/functions/stripe-webhook/index.ts` per [contracts/org-stamp-insert.md](./contracts/org-stamp-insert.md)
- [ ] T039 [US4] Pass `organization_id` at all `insertInvoicePaymentOnce` call sites in `supabase/functions/stripe-webhook/index.ts` (~lines 289, 465, 546) from invoice row or `urlOrganizationId` after ownership check
- [ ] T040 [US4] Refactor checkout-path inline `invoice_payments` insert (~line 392) in `supabase/functions/stripe-webhook/index.ts` to use `insertInvoicePaymentOnce` helper (unify stamping)

### Verification

- [ ] T041 [US4] Manual verify **invoice_payments**: complete test Stripe payment; SQL spot-check + UI payment history per [quickstart.md](./quickstart.md)
- [ ] T042 [US4] **User task (CLI)**: Deploy `npx supabase functions deploy stripe-webhook --project-ref <project-ref>` after T038–T040

**Checkpoint**: No `invoice_payments insert error` from missing org; rows visible to authenticated staff

---

## Phase 7: User Story 5 — Audit completeness and regression prevention (Priority: P2)

**Goal**: All 11 tables tracked; reference patterns regression-free; grep audit closed

**Independent Test**: Per-table checklist in quickstart fully checked; order_people + order_additional_options still pass.

### Verification

- [ ] T043 [US5] Manual verify **orders** create path in `src/modules/orders/api/orders.api.ts` (verify-only)
- [ ] T044 [P] [US5] Regression verify **order_additional_options** + **order_people** in `src/modules/orders/api/orders.api.ts` per [quickstart.md](./quickstart.md)
- [ ] T045 [US5] Re-run grep audit from T001; confirm zero in-scope inserts omit `organization_id` stamp in `src/`
- [ ] T046 [US5] Complete full per-table checklist in [quickstart.md](./quickstart.md); mark pass/fail for all 11 in-scope tables + 2 reference tables

**Checkpoint**: SC-001 / SC-002 satisfied — 100% in-scope tables verified

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Error surfacing, lint, documentation

- [ ] T047 Ensure fixed mutation paths throw on insert error (no silent success) in `src/modules/inscriptions/hooks/useInscriptions.ts`, `src/modules/invoicing/hooks/useInvoices.ts`, `src/modules/inbox/api/inboxMessages.api.ts`, `src/shared/tableViewPresets/hooks/useTableViewPresets.ts`
- [ ] T048 [P] Run `npm run lint` and fix any issues introduced by stamp changes
- [ ] T049 [P] Update [quickstart.md](./quickstart.md) checklist with actual pass/fail dates if any table required unexpected fixes during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup) ──► Phase 2 (Inventory) ──► Phases 3–6 (US1–US4 fixes, parallel where marked [P])
                                         ──► Phase 7 (US5 audit close)
                                         ──► Phase 8 (Polish)
```

### User Story Dependencies

| Story | Depends on | Can parallel with |
|-------|------------|-------------------|
| US1 (inscriptions, invoices) | Phase 2 | US2, US3 after T017–T019 pattern understood |
| US2 (table_view_presets) | Phase 2 | US1, US3 |
| US3 (inbox_messages) | Phase 2 | US1, US2 |
| US4 (invoice_payments) | Phase 2 | US1–US3 (different repo area: Edge vs src) |
| US5 (audit close) | US1–US4 complete | — |

### Parallel Opportunities

**After Phase 2 inventory complete:**

```text
Parallel batch A (src fixes):
  T017 [US1] inscriptions
  T024–T027 [US2] table_view_presets
  T034 [US3] inbox_messages

Parallel batch B (after US1 invoice API shape settled):
  T018–T019 [US1] invoices

Parallel batch C (Edge, independent):
  T038–T040 [US4] stripe-webhook

Parallel batch D (verify-only, any time after Phase 2):
  T023, T030–T033, T037, T043, T044
```

---

## Implementation Strategy

### MVP First (US1 core)

1. Complete Phase 1 + Phase 2 (inventory)
2. Fix **inscriptions** + **invoices** (T017–T019)
3. Manual smoke T021–T022
4. Deploy/demo if inscription silent-loss was the reported production pain

### Incremental Delivery

1. US1 → US2 → US3 → US4 → US5 → Polish
2. Edge deploy (T042) can ship after US4 code merge independently of src deploy
3. Verify-only tables need no code unless inventory (T006–T011) finds unexpected gaps

---

## Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| 1 Setup | T001–T003 | — |
| 2 Foundational | T004–T016 | — |
| 3 US1 | T017–T023 | Order child data |
| 4 US2 | T024–T033 | Top-level / presets |
| 5 US3 | T034–T037 | Inbox messages |
| 6 US4 | T038–T042 | Invoice payments |
| 7 US5 | T043–T046 | Audit close |
| 8 Polish | T047–T049 | — |
| **Total** | **49 tasks** | |

| User Story | Task count | Fix tasks | Verify tasks |
|------------|------------|-----------|--------------|
| US1 | 7 | 4 | 3 |
| US2 | 10 | 5 | 5 |
| US3 | 4 | 2 | 2 |
| US4 | 5 | 3 | 2 |
| US5 | 4 | 0 | 4 |
| Setup + Foundational + Polish | 19 | — | — |

---

## Next command

`/speckit.implement` — start with Phase 1–2, then US1 (T017–T019) as MVP.
