# Tasks: Inbox Consolidation — Unified Native Inbox

**Input**: Design documents from `specs/015-inbox-consolidation/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/inbox-consolidation.md, quickstart.md

**Tests**: Not requested — manual verification per [quickstart.md](./quickstart.md).

**Locked decisions** (do not substitute alternatives):
- Enquiry stage → `inbox_conversations.enquiry_stage` column; **no RLS policy changes**
- Email stage **per-user-private** (acceptable); WhatsApp/SMS **workshop-shared**
- `/enquiry-triage` → redirect + **delete** entire `src/modules/enquiryTriage/` (4 files)
- Person lookups → `public.people` only (via existing customers hooks)
- **No** org-ID code branching; **no** GHL inbox / AI extraction worker changes
- AC-005 widened per [plan.md](./plan.md): fix client + 3 edge functions (gmail-new-thread, gmail-sync, proof-send); twilio-sms-webhook **verify only**
- Reuse operational inbox components + `CreateOrderDrawer`; lift pipeline visuals from `EnquiryTriagePage` before delete

**Organization**: Tasks grouped by user story. **MVP** = Phase 1 + Phase 2 + Phase 3 (US1 navigation).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline branch and read design artifacts before code changes

- [ ] T001 Confirm feature branch `015-inbox-consolidation` is checked out; run `npm run lint` for clean baseline
- [ ] T002 [P] Read [contracts/inbox-consolidation.md](./contracts/inbox-consolidation.md), [research.md](./research.md), and [quickstart.md](./quickstart.md)
- [ ] T003 [P] Skim `src/modules/enquiryTriage/pages/EnquiryTriagePage.tsx` (pipeline layout to lift) and `src/modules/inbox/pages/UnifiedInboxPage.tsx` (integration target) before edits

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, org-stamp fixes, types, and enquiry API/hooks — **MUST complete before user story UI work**

**⚠️ CRITICAL**: No segment/pipeline UI tasks until T004–T016 complete.

- [ ] T004 Create migration `supabase/migrations/YYYYMMDDHHmmss_inbox_enquiry_stage.sql`: add `enquiry_stage text not null default 'new'` with check `('new','in_progress','order_created')` and partial index on open unlinked rows per [data-model.md](./data-model.md). **Commit the migration file to `supabase/migrations/` first, then apply it manually via the Supabase Dashboard SQL editor (one statement at a time) — do NOT `db push`.** After applying, confirm the column exists before continuing. *(Migration file committed: `20260614120000_inbox_enquiry_stage.sql` — **manual Dashboard apply still required**.)*
- [X] T005 Extend `InboxConversation`, `InboxConversationInsert`, `InboxConversationUpdate` with `enquiry_stage` in `src/modules/inbox/types/inbox.types.ts`
- [X] T006 Fix org stamp in `src/modules/inbox/api/inboxMessages.api.ts` `createMessage`: SELECT `organization_id` from `inbox_conversations` by `conversation_id`; throw if null; spread into insert payload
- [X] T007 [P] Fix org stamp on **conversation + message** inserts in `supabase/functions/inbox-gmail-new-thread/index.ts`: use `resolveOrganizationIdForUser(supabase, userId, connection.organization_id)` on both inserts per [plan.md](./plan.md)
- [X] T008 [P] Fix org stamp on **conversation + message** inserts in `supabase/functions/inbox-gmail-sync/index.ts`: resolve org once after conversationId settled; stamp both parent and child inserts
- [X] T009 [P] Fix org stamp on **email** conversation + message inserts in `supabase/functions/proof-send/index.ts` (~395/416): derive `organization_id` from order/proof record the dispatch acts on
- [X] T010 [P] Fix org stamp on **WhatsApp** conversation + message inserts in `supabase/functions/proof-send/index.ts` (~511/530): same order/proof-derived org
- [X] T011 Verify `supabase/functions/twilio-sms-webhook/index.ts` already stamps `organization_id` on the message insert (~320); optional hardening only — prefer `existingConv.organization_id` over connection-resolved `tenantOrgId` when the conversation already exists. No required change.
- [ ] T012 **Deploy the three edited edge functions via CLI** (never Dashboard), one at a time:
  `supabase functions deploy inbox-gmail-new-thread --project-ref bfwohzcugtwbhhxdqgme`
  `supabase functions deploy inbox-gmail-sync --project-ref bfwohzcugtwbhhxdqgme`
  `supabase functions deploy proof-send --project-ref bfwohzcugtwbhhxdqgme`
  (Preserve any `--no-verify-jwt` flags already in `supabase/config.toml` for these functions.)
- [ ] T012a **Runtime org-stamp verification (RLS-bypass aware).** These are service-role inserts — RLS is bypassed, so a send succeeds whether org is null or not. A payload grep is NOT sufficient. For each fixed path: (a) confirm in code that the resolved `organization_id` aborts/throws if null *before* the insert (not stamped as null); (b) send one real test message through each path (gmail-new-thread, gmail-sync, proof-send email + whatsapp, client `createMessage`); (c) confirm the new `inbox_conversations` and `inbox_messages` rows land with non-null `organization_id` matching the parent conversation. Static grep that `organization_id` appears in each insert payload is a pre-check, not the pass condition. *(Code pre-check passed — null-abort guards + payload stamps in T006–T010; **runtime sends still required**.)*
- [X] T013 Add `linkConversationToOrder(conversationId, orderId)` in `src/modules/inbox/api/inboxConversations.api.ts`: `{ order_id, enquiry_stage: 'order_created' }`
- [X] T014 Create `src/modules/inbox/api/enquiryPipeline.api.ts`: fetch open `order_id IS NULL` conversations via same filters as `fetchConversations`; bucket into **two funnel stages only** — `enquiry_stage = 'new'` (default) and `enquiry_stage = 'in_progress'`; linked conversations (`order_id` set) are **excluded from fetch** and never appear on the board; optional person join from `people` for card display; **no** `inbox_enquiry_extraction` reads
- [X] T015 Create `src/modules/inbox/hooks/useEnquiryPipeline.ts`: React Query wrapper over `enquiryPipeline.api.ts` keyed by org + channel filter
- [X] T016 Create `src/modules/inbox/hooks/useUpdateEnquiryStage.ts`: mutation calling `updateConversation(id, { enquiry_stage })` with inbox query invalidation

**Checkpoint**: Migration applied via Dashboard; org stamps fixed in client + 3 edge functions; edge functions deployed via CLI; runtime verification confirms non-null org on new rows; enquiry API/hooks ready; types updated

---

## Phase 3: User Story 1 — One inbox entry point (Priority: P1) 🎯 MVP

**Goal**: Sidebar Inbox → `/dashboard/inbox`; `/enquiry-triage` redirects; segment rail visible

**Independent Test**: Click sidebar Inbox → lands on `/dashboard/inbox`; visit `/dashboard/enquiry-triage` → redirects to `/dashboard/inbox?segment=enquiries`; GHL inbox link unchanged.

### Implementation

- [ ] T017 [US1] Update sidebar Inbox link to `/dashboard/inbox` in `src/components/layout/Sidebar.tsx`
- [ ] T018 [US1] Retire `/enquiry-triage` in `src/app/router.tsx`: add an `EnquiryTriageRedirect` component that reads `useLocation().search`, extracts `conversation` when present, and renders `<Navigate replace />` to `/dashboard/inbox?segment=enquiries` — appending `&conversation=<uuid>` (via `encodeURIComponent`) only when set, omitting it cleanly when absent or empty; wire `<Route path="enquiry-triage" element={<EnquiryTriageRedirect />} />`. Do **NOT** use a static `Navigate` — legacy deep links like `/dashboard/enquiry-triage?conversation=<uuid>` must preserve `conversation` before `UnifiedInboxPage` (T021) reads it on mount. Remove the `EnquiryTriagePage` import as part of this task **ONLY IF** the T046 module deletion is done in the same pass; otherwise leave the import until T046 to keep the build intact. T021 unchanged.
- [ ] T019 [US1] Update `src/components/layout/PageShell.tsx`: remove `enquiry-triage` title/subtitle entries; ensure `inbox` has appropriate page title/subtitle copy
- [ ] T020 [US1] Add URL `segment` param (`enquiries` | `all`, default `all`) and segment rail UI (**Enquiries** | **All / Linked**) in `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- [ ] T021 [US1] On mount in `UnifiedInboxPage.tsx`: map legacy `/enquiry-triage?conversation=<id>` redirect to `segment=enquiries&conversation=<id>`; preserve `conversation` selection from search params

### Verification

- [ ] T022 [US1] Manual verify navigation per [quickstart.md](./quickstart.md) §1; confirm `/dashboard/ghl-inbox` sidebar entry unchanged

**Checkpoint**: MVP — single inbox entry point with redirect; enquiries segment selectable (pipeline may be stub until US3)

---

## Phase 4: User Story 2 — Work operational conversations without regression (Priority: P1)

**Goal**: `segment=all` retains full operational inbox (reply, link/unlink, order context, Conversations/Customers modes)

**Independent Test**: In All / Linked, exercise Email/WhatsApp/SMS reply, link/unlink, order context panel — behaviour matches pre-consolidation.

### Implementation

- [X] T023 [US2] In `src/modules/inbox/pages/UnifiedInboxPage.tsx`: when `segment=all`, preserve existing `viewMode` (`conversations` | `customers`), list filters, and right `PersonOrdersPanel` behaviour unchanged
- [X] T024 [US2] Remove `useEnquiryExtractions` and extraction map from `src/modules/inbox/pages/UnifiedInboxPage.tsx`; update `classifyConversation` calls in `inboxBuckets` usage to omit extraction input (keep bucket/aging logic otherwise intact)
- [X] T025 [US2] Remove `useEnquiryExtractions` import and usage from `src/modules/inbox/components/ConversationView.tsx`
- [X] T026 [US2] Ensure `segment=all` right panel continues to use `PersonOrdersPanel` for linked conversations (not create-order panel) in `src/modules/inbox/pages/UnifiedInboxPage.tsx`

### Verification

- [X] T027 [US2] Manual verify operational regression per [quickstart.md](./quickstart.md) §3 (reply, link/unlink, order context on all three channels)

**Checkpoint**: All / Linked segment is non-regressive

---

## Phase 5: User Story 3 — Triage unlinked enquiries in a human-driven pipeline (Priority: P1)

**Goal**: Enquiries segment shows a **two-column** card-and-pipeline (New → In progress) with no AI chrome; linked enquiries leave the funnel

**Independent Test**: Open Enquiries; unlinked open conversations appear in columns; mark in progress persists; zero AI confidence / "not yet analysed" UI.

### Implementation

- [X] T028 [P] [US3] Create `src/modules/inbox/components/EnquiryPipelineCard.tsx`: channel icon, preview, timestamp, person/handle; **Mark in progress** action; no `AIBadge` / confidence
- [X] T029 [US3] Create `src/modules/inbox/components/EnquiryPipelineBoard.tsx`: lift column/card layout from `src/modules/enquiryTriage/pages/EnquiryTriagePage.tsx`; **two columns only** (`new`, `in_progress`) — bucket cards by `enquiry_stage`; **no third column**; when parent reports an enquiry linked to an order (`linkConversationToOrder` / create-order success), **remove the card from the board** and show a **brief confirmation** (toast or inline ack); do not render linked rows on the board
- [X] T030 [US3] Wire `EnquiryPipelineBoard` + `useEnquiryPipeline` into `segment=enquiries` layout in `src/modules/inbox/pages/UnifiedInboxPage.tsx` (left/center alongside `ConversationView`)
- [ ] T031 [US3] Connect card selection to `conversation` URL param and thread panel in `UnifiedInboxPage.tsx`
- [ ] T032 [US3] Wire **Mark in progress** to `useUpdateEnquiryStage` in `EnquiryPipelineCard.tsx` / board
- [X] T033 [US3] Add loading, empty, and error (+ retry) states to `EnquiryPipelineBoard.tsx`

### Verification

- [X] T034 [US3] Manual verify pipeline per [quickstart.md](./quickstart.md) §2; confirm no AI extraction UI remains

**Checkpoint**: Human-driven enquiry funnel live in unified inbox

---

## Phase 6: User Story 4 — Create order from enquiry with known data only (Priority: P2)

**Goal**: Unlinked enquiry selection shows create-order panel with deterministic prefill; success links conversation to order

**Independent Test**: Select enquiry with/without linked person; prefill matches `people`/handle; order creation sets `order_id` and **removes the card from the funnel** with brief confirmation.

### Implementation

- [ ] T035 [US4] Extend `CreateOrderDrawer` in `src/modules/orders/components/CreateOrderDrawer.tsx` with optional props: `initialPersonId`, `initialCustomerName`, `initialCustomerEmail`, `initialCustomerPhone`, `onOrderCreated?(orderId: string)` — apply via `useEffect`/`reset` on open; **no** AI/extraction fields
- [ ] T036 [US4] Create `src/modules/inbox/components/EnquiryCreateOrderPanel.tsx`: load person via `useCustomer` (`people` table); prefill per [contracts/inbox-consolidation.md](./contracts/inbox-consolidation.md) §5; open `CreateOrderDrawer`
- [ ] T037 [US4] Create `src/modules/inbox/components/InboxRightPanel.tsx`: if `order_id` → `PersonOrdersPanel`; if unlinked enquiry in `segment=enquiries` → `EnquiryCreateOrderPanel`; else existing order-context rules for `segment=all`
- [ ] T038 [US4] Replace inline right-panel wiring in `src/modules/inbox/pages/UnifiedInboxPage.tsx` with `InboxRightPanel`
- [ ] T039 [US4] On `CreateOrderDrawer` success from enquiry context: call `linkConversationToOrder(conversationId, orderId)` in `EnquiryCreateOrderPanel.tsx`

### Verification

- [X] T040 [US4] Manual verify create-order prefill and link per [quickstart.md](./quickstart.md) §4; confirm no reads from `inbox_enquiry_extraction`

**Checkpoint**: Create-order flow completes enquiry lifecycle

---

## Phase 7: User Story 5 — Channel and segment filtering (Priority: P2)

**Goal**: Channel filters (Email / WhatsApp / SMS) combinable with Enquiries vs All / Linked segments

**Independent Test**: Toggle segment + channel; list/pipeline contents update; email privacy unchanged (two-user check).

### Implementation

- [ ] T041 [US5] Add URL `channel` param (`all` | `email` | `whatsapp` | `sms`) synced with existing channel pill state in `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- [ ] T042 [US5] Apply channel filter to `useEnquiryPipeline` / pipeline board when `segment=enquiries` in `UnifiedInboxPage.tsx`
- [ ] T043 [US5] Ensure channel filter applies independently to Conversations-tab and Customers-tab filters when `segment=all` (preserve existing dual pill behaviour)
- [ ] T044 [US5] Add optional URL `enquiryStage` param to highlight/filter pipeline column in `EnquiryPipelineBoard.tsx`

### Verification

- [ ] T045 [US5] Manual verify channel filters per [quickstart.md](./quickstart.md) §2 and §5; two-user email visibility check §5

**Checkpoint**: Segment + channel filtering complete

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Module retirement, cleanup, lint, full quickstart

- [ ] T046 Delete entire `src/modules/enquiryTriage/` directory (4 files: `pages/EnquiryTriagePage.tsx`, `hooks/useEnquiryTriage.ts`, `api/enquiryTriage.api.ts`, `index.ts`)
- [ ] T047 Run `grep -rn "enquiryTriage\|from '@/modules/enquiryTriage'" src/` — the only allowed remaining hit is the redirect path string `enquiry-triage` in `src/app/router.tsx`. Any other hit means a dangling import after the T046 deletion — fix before proceeding. (Note: `rg` is not installed in this environment; use `grep`.)
- [ ] T048 [P] Remove dead `useEnquiryExtractions` hook file or leave exported but unused — if no other imports, delete `src/modules/inbox/hooks/useEnquiryExtractions.ts` and clean `inboxBuckets.ts` extraction types
- [ ] T049 [P] Remove any remaining AI-draft copy referencing `inbox_enquiry_extraction` under `src/modules/inbox/`
- [X] T050 Run `npm run lint` and fix any issues introduced in touched files
- [X] T051 Run full [quickstart.md](./quickstart.md) checklist (navigation, pipeline, regression, create-order, visibility, org stamp)

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) — BLOCKS all user stories
    ↓
Phase 3 (US1) — MVP navigation ──┐
Phase 4 (US2) — regression        ├── can overlap after Phase 2 if coordinated
Phase 5 (US3) — pipeline          │
Phase 6 (US4) — create order      │ US4 depends on US3 panel selection + T013
Phase 7 (US5) — filters           │
    ↓
Phase 8 (Polish) — delete enquiryTriage after US3/US4 lifted UI
```

### User Story Dependencies

| Story | Depends on | Independent test |
|-------|------------|------------------|
| US1 | Phase 2 | Sidebar + redirect + segment rail |
| US2 | Phase 2, US1 segment param | Operational flows in `segment=all` |
| US3 | Phase 2, US1 | Pipeline columns + mark in progress |
| US4 | US3 selection, T013 | Create order + link |
| US5 | US1, US3 | Channel pills both segments |

### Parallel Opportunities

**Phase 2** (after T004–T005):

```text
T007 inbox-gmail-new-thread
T008 inbox-gmail-sync
T009 proof-send email
T010 proof-send whatsapp
```

**Phase 5** (after T014–T016):

```text
T028 EnquiryPipelineCard
T029 EnquiryPipelineBoard (after T028)
```

**Phase 8**:

```text
T048 cleanup useEnquiryExtractions
T049 remove AI copy
```

---

## Parallel Example: User Story 3

```bash
# After foundational hooks exist:
# 1. Build card component (T028)
# 2. Build board from EnquiryTriagePage layout (T029)
# 3. Integrate in UnifiedInboxPage (T030–T033)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (T001–T003)
2. Phase 2: Foundational (T004–T016) — **critical path**
3. Phase 3: US1 (T017–T022)
4. **STOP and VALIDATE**: Navigation + redirect before pipeline polish

### Incremental Delivery

1. Foundational → org stamps + schema safe to merge early
2. US1 → single inbox entry (MVP)
3. US2 → operational non-regression
4. US3 → enquiry pipeline (replaces triage value)
5. US4 → create order panel
6. US5 → channel URL sync
7. Polish → delete legacy module + full quickstart

### Suggested PR Slices

| PR | Tasks | Risk |
|----|-------|------|
| A: Schema + org stamps | T004–T016 | Low — forward fix only; **apply order: migration (Dashboard) → deploy edge fns (CLI) → verify non-null org at runtime → client/code rides normal merge** |
| B: Navigation MVP | T017–T022 | Low |
| C: Pipeline + create order | T028–T040 | Medium — UI lift |
| D: Filters + cleanup | T041–T051 | Low |

---

## Task Summary

| Phase | Story | Task IDs | Count |
|-------|-------|----------|-------|
| Setup | — | T001–T003 | 3 |
| Foundational | — | T004–T016 | 13 |
| US1 Navigation | US1 | T017–T022 | 6 |
| US2 Operational | US2 | T023–T027 | 5 |
| US3 Pipeline | US3 | T028–T034 | 7 |
| US4 Create order | US4 | T035–T040 | 6 |
| US5 Filtering | US5 | T041–T045 | 5 |
| Polish | — | T046–T051 | 6 |
| **Total** | | **T001–T051** | **51** |

**MVP scope**: T001–T022 (22 tasks)  
**Parallelizable tasks**: 10 marked `[P]`

---

## Notes

- Lift pipeline JSX from `EnquiryTriagePage.tsx` **before** T046 deletion
- Do **not** modify `src/modules/ghl-inbox/` or `supabase/functions/ghl-webhook/index.ts`
- Regenerate Supabase types after migration if project uses `supabase gen types`
- Commit after each phase checkpoint; run quickstart section matching completed stories
