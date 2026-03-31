---
description: "Task list for Proof Agent"
---

# Tasks: Proof Agent

**Input**: Design documents from `specs/_active/proof-agent/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api-contracts.md ✅ contracts/ui-contracts.md ✅

**Tests**: Not requested — manual verification via quickstart.md scenarios.

**Organization**: Phase 1 (DB) → Phase 2 (Foundational infra) → Phases 3–6 (User Stories P1→P2) → Phase 7 (Polish). Phases 1–2 block everything; user story phases are sequential within their story and partially parallel across stories once foundational work is done.

## Path Conventions

- **Backend**: `supabase/functions/<name>/index.ts`, `supabase/functions/_shared/`
- **Frontend feature module**: `src/modules/proofs/` (api/, hooks/, types/, schemas/, components/, utils/)
- **Touched existing files**: `src/modules/orders/components/`, `src/modules/jobs/components/`, `src/modules/jobs/pages/` — **ADDITIVE ONLY**

---

## Phase 1: Database Setup

**Purpose**: Create the new `order_proofs` table and `proof-renders` storage bucket. No code can run against the new schema until both migrations are applied.

⚠️ **CRITICAL**: Apply both migrations in order via the Supabase dashboard SQL editor before any other task.

- [x] T001 Apply Migration 1 — execute `create_order_proofs_table` SQL block from `specs/_active/proof-agent/data-model.md §1` in the Supabase dashboard SQL editor: creates `public.order_proofs` table, indexes, updated_at trigger, and RLS policies (select/insert/update, user_id = auth.uid())

- [x] T002 Apply Migration 2 — execute `create_proof_renders_bucket` SQL block from `specs/_active/proof-agent/data-model.md §2` in the Supabase dashboard SQL editor: inserts the `proof-renders` private storage bucket and three storage object RLS policies (upload/read/delete, path prefix = auth.uid()); depends on T001

**Checkpoint**: Verify in Supabase Table Editor that `order_proofs` table exists with all columns and RLS enabled. Verify in Storage that `proof-renders` bucket exists as private.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, state helpers, API functions, hooks, and module index that every user story phase depends on. These are pure additions — no existing files are touched.

⚠️ **CRITICAL**: All user story phases depend on T007–T009 being complete.

- [x] T003 [P] Create `supabase/functions/_shared/proofUtils.ts` — export `getProofSignedUrl(supabase: SupabaseClient, storagePath: string, expiresIn = 3600): Promise<string>` that calls `supabase.storage.from('proof-renders').createSignedUrl(storagePath, expiresIn)` and throws on error; used by `proof-generate` and `proof-send`

- [x] T004 [P] Create `src/modules/proofs/types/proofs.types.ts` — export all TypeScript interfaces from `data-model.md §3`: `ProofState`, `ProofRenderMethod`, `ProofSentVia`, `ProofApprovedBy`, `OrderProof`, `OrderProofInsert`, `ProofGenerateRequest`, `ProofGenerateResponse`, `ProofSendRequest`, `ProofSendResponse`

- [x] T005 [P] Create `src/modules/proofs/schemas/proof.schema.ts` — export Zod schemas: `proofGenerateFormSchema` (inscription_text required min 1, stone_photo_url required url, font_style optional string, additional_instructions optional string) and `proofSendFormSchema` (channels array min 1, customer_email optional email, customer_phone optional string, message_text optional string)

- [x] T006 [P] Create `src/modules/proofs/utils/proofState.ts` — export the five pure helper functions from `data-model.md §6`: `isProofApproved`, `canSendProof`, `canApproveProof`, `canRequestChanges`, `canRegenerateProof`; each takes `OrderProof | null | undefined` and returns `boolean`

- [x] T007 Create `src/modules/proofs/api/proofs.api.ts` — export: (a) `fetchProofByOrder(orderId: string): Promise<OrderProof | null>` — Supabase select from `order_proofs` where `order_id = orderId` ordered by `created_at DESC limit 1`; (b) `approveProof(proofId: string): Promise<void>` — update `state='approved'`, `approved_at`, `approved_by='staff_manual'` where `id=proofId AND state='sent'`, throw if 0 rows affected; (c) `requestProofChanges(proofId, changesNote: string): Promise<void>` — update `state='changes_requested'`, `changes_requested_at`, `changes_note` where `id=proofId AND state='sent'`, throw if 0 rows affected; (d) stubs for `generateProof` and `sendProof` (mark TODO — filled in T011 and T016); depends on T004

- [x] T008 Create `src/modules/proofs/hooks/useProofs.ts` — export: `proofKeys` query key object; `useProofByOrder(orderId: string | null)` query (enabled only when orderId is non-null); `useApproveProof()` mutation (invalidates `proofKeys.byOrder` on success); `useRequestProofChanges()` mutation (invalidates `proofKeys.byOrder` on success); stubs for `useGenerateProof` and `useSendProof` (mark TODO — filled in T011 and T016); import all from `../api/proofs.api` and `../types/proofs.types`; depends on T007

- [x] T009 Create `src/modules/proofs/index.ts` — export `ProofPanel`, `ProofGenerateForm`, `ProofSendModal`, `ProofApprovalBadge` from `./components/*` and `useProofByOrder`, `isProofApproved` from `./hooks/useProofs` and `./utils/proofState`; depends on T008 (complete after components created in later tasks — file can be stubbed now with TODO comments)

**Checkpoint**: Foundation complete — types compile, API functions and hooks exist, module index is in place.

---

## Phase 3: User Story 1 — Staff Generates a Proof (Priority: P1) 🎯 MVP

**Goal**: Staff can open any Order, trigger proof generation with pre-populated inscription text + stone photo, and see the rendered draft image in the Order detail sidebar.

**Independent Test**: Quickstart Scenarios 1 and 2 — AI render and manual render from the Order sidebar.

- [x] T010 [US1] Create `supabase/functions/proof-generate/index.ts` — follow the server behaviour spec in `contracts/api-contracts.md §proof-generate`: (a) user JWT auth via `_shared/auth.ts getUserFromRequest`; (b) validate required fields; (c) reject if approved proof already exists for order (409); (d) upsert proof row to `state='generating'`; (e) download `stone_photo_url` server-side; (f) call OpenAI `POST https://api.openai.com/v1/images/edits` with `image` FormData + prompt; (g) on success: upload PNG to `proof-renders/{user_id}/{order_id}/{proof_id}.png` using service role client, update row to `state='draft'`, `render_url=storagePath`, `render_method='ai_image'`, `render_provider='openai'`, `render_meta=raw_openai_response`; (h) on failure: update row to `state='failed'`, `last_error`, `render_meta=raw_error`; (i) return signed URL via `getProofSignedUrl` from `_shared/proofUtils.ts`; read `OPENAI_API_KEY` from `Deno.env.get`; depends on T001, T002, T003

- [x] T011 [US1] Implement `generateProof(params: ProofGenerateRequest): Promise<ProofGenerateResponse>` in `src/modules/proofs/api/proofs.api.ts` (replace stub from T007) — calls `supabase.functions.invoke('proof-generate', { body: params, headers: { Authorization: Bearer token } })`; add `useGenerateProof()` mutation to `src/modules/proofs/hooks/useProofs.ts` (replace stub from T008) — invalidates `proofKeys.byOrder(params.order_id)` on success; depends on T010, T008

- [x] T012 [US1] Create `src/modules/proofs/components/ProofGenerateForm.tsx` — Dialog/Sheet containing: (a) Textarea for `inscription_text` (required, pre-populated from `initialInscriptionText` prop); (b) Input for `stone_photo_url` (required, pre-populated from `initialStonePhotoUrl` prop); (c) Select for `font_style` (serif/sans-serif/script/custom); (d) Textarea for `additional_instructions` (optional, pre-populated from `changesNote` prop when `isChangesRequested=true`); (e) "Generate" Button wired to `useGenerateProof` mutation; loading + error states per `contracts/ui-contracts.md §ProofGenerateForm`; props: `ProofGenerateFormProps` from ui-contracts.md; depends on T005, T011

- [x] T013 [US1] Create `src/modules/proofs/components/ProofPanel.tsx` — state-driven card component; uses `useProofByOrder(orderId)` and `isProofApproved`; renders the correct screen for all 7 proof states (not_started, generating, draft, sent, approved, changes_requested, failed) as specified in `contracts/ui-contracts.md §ProofPanel`; for `draft` state: fetch signed URL via `supabase.storage.from('proof-renders').createSignedUrl(proof.render_url, 3600)` and render image; opens `ProofGenerateForm` for generation/regeneration flows; opens `ProofSendModal` for send flow (renders as disabled/placeholder until ProofSendModal exists in T017); "Mark Approved" and "Request Changes" buttons wired to `useApproveProof`/`useRequestProofChanges`; depends on T006, T008, T012

- [x] T014 [US1] Update `src/modules/orders/components/OrderDetailsSidebar.tsx` (ADDITIVE ONLY) — import `ProofPanel` from `@/modules/proofs`; add a `<ProofPanel>` section after the inscriptions section; pass props: `orderId={order.id}`, `orderProductPhotoUrl={order.product_photo_url ?? null}`, `orderInscriptionText={inscriptions?.[0]?.inscription_text ?? null}` (using existing `inscriptions` data already fetched in this component), `customerEmail={order.customer_email ?? null}`, `customerPhone={order.customer_phone ?? null}`; depends on T013

**Checkpoint**: US1 complete — run Quickstart Scenarios 1 and 2. Verify proof generates, image displays, state transitions to `draft`.

---

## Phase 4: User Story 2 — Staff Sends Proof to Customer (Priority: P1)

**Goal**: Staff can send the draft proof image to the customer via email and/or WhatsApp with an Inbox conversation created for each channel.

**Independent Test**: Quickstart Scenarios 3 and 4 — email send, WhatsApp send.

- [x] T015 [US2] Create `supabase/functions/proof-send/index.ts` — ⚠️ **REVIEW NOTE**: Before implementing, re-read `specs/_active/proof-agent/research.md §2` which confirms existing `inbox-twilio-send` and `inbox-gmail-send` are text-only and CANNOT be reused for image delivery — the direct provider call path is required. Implement per `contracts/api-contracts.md §proof-send`: (a) user JWT auth; (b) load proof row and verify `state='draft'`, return 409 with `current_state` if not; (c) generate signed URL via `getProofSignedUrl`; (d) for each requested channel: Email — use Gmail API `messages.send` with multipart MIME (text/plain body + image/png attachment), load Gmail credentials from env, create `inbox_conversations` row + `inbox_messages` row + call `attemptAutoLink`; WhatsApp — call Twilio Messages API with `MediaUrl=[signed_url]`, resolve credentials via `whatsappRoutingResolver`, create `inbox_conversations` + `inbox_messages` rows + `attemptAutoLink`; (e) update proof to `state='sent'`, `sent_via`, `sent_at`, `inbox_conversation_id`; depends on T001, T003, T010

- [x] T016 [US2] Implement `sendProof(params: ProofSendRequest): Promise<ProofSendResponse>` in `src/modules/proofs/api/proofs.api.ts` (replace stub from T007) — calls `supabase.functions.invoke('proof-send', { body: params, headers })` with user Bearer token; add `useSendProof()` mutation to `src/modules/proofs/hooks/useProofs.ts` (replace stub from T008) — invalidates `proofKeys.byOrder` on success; depends on T015, T008

- [x] T017 [US2] Create `src/modules/proofs/components/ProofSendModal.tsx` — Dialog with channel checkboxes (Email, WhatsApp), email/phone input fields pre-populated from props, optional message_text textarea, proof image thumbnail (from `renderUrl` prop), "Send" Button wired to `useSendProof`; loading/success/error screens per `contracts/ui-contracts.md §ProofSendModal`; update `ProofPanel.tsx` (T013) to open this modal from the `draft` state "Send to Customer" button (ADDITIVE only — replace the placeholder); props: `ProofSendModalProps` from ui-contracts.md; depends on T016

**Checkpoint**: US2 complete — run Quickstart Scenarios 3 and 4. Verify proof transitions to `sent`, Inbox shows new conversation with image.

---

## Phase 5: User Story 3 — Staff Marks Proof Approved + User Story 5 — Job Start Gate (Priority: P1)

**Goal**: Staff can mark a sent proof approved from the Order sidebar. A Job linked to an Order without an approved proof cannot be set to "In Progress".

**Independent Test**: Quickstart Scenarios 5, 6, 7, and 10 — approve proof, gate passes, gate blocks, badge in lists.

- [x] T018 [US3] Create `src/modules/proofs/components/ProofApprovalBadge.tsx` — read-only Badge component; maps `ProofState | null` to badge label + variant per `contracts/ui-contracts.md §ProofApprovalBadge`; green only for `state === 'approved'`; props: `{ state: ProofState | null | undefined; size?: 'sm' | 'default' }`; depends on T004

- [x] T019 [US3] Verify `useApproveProof` in `src/modules/proofs/hooks/useProofs.ts` — confirm `approveProof` in `proofs.api.ts` uses `.eq('state', 'sent')` DB-level guard and throws if 0 rows affected; if not, fix now; also verify `ProofPanel.tsx` renders the "Mark Approved" button only when `canApproveProof(proof)` returns true; make any required corrections (ADDITIVE); depends on T013, T008

- [x] T020 [P] [US5] Update `src/modules/jobs/components/EditJobDrawer.tsx` (ADDITIVE ONLY) — import `useProofByOrder` from `@/modules/proofs` and `isProofApproved` from `@/modules/proofs`; add `const { data: latestProof } = useProofByOrder(job.order_id ?? null)`; add `const jobStartBlocked = !!job.order_id && !isProofApproved(latestProof)`; wrap the `SelectItem value="in_progress"` in a `<Tooltip>` with `disabled={jobStartBlocked}` and `TooltipContent` reading "Proof not yet approved — approve the customer proof before starting this job" per `contracts/ui-contracts.md §Job Start Gate`; depends on T006, T008, T018

- [x] T021 [P] [US5] Update `src/modules/jobs/pages/JobsPage.tsx` (ADDITIVE ONLY) — import `ProofApprovalBadge` from `@/modules/proofs`; for each job row that has `order_id`, derive proof state by adding a `useProofsByOrders` pattern or use per-row `useProofByOrder` calls (if performance acceptable — note in implementation if a batch query is needed); render `<ProofApprovalBadge state={proofState} size="sm" />` in a new column/cell alongside existing status badges; depends on T018, T008

**Checkpoint**: US3 + US5 complete — run Quickstart Scenarios 5, 6, 7, 10. Verify approve works, Job gate blocks/passes, badge shows in Order list and Job list.

---

## Phase 6: User Story 4 — Customer Requests Changes (Priority: P2)

**Goal**: Staff can record a customer change request on a sent proof, and the proof flows back through the generation cycle with the previous change note pre-populated.

**Independent Test**: Quickstart Scenario 8 — request changes, regenerate, re-send.

- [x] T022 [US4] Verify full `changes_requested` flow in `src/modules/proofs/components/ProofPanel.tsx` — confirm (a) `changes_requested` state renders the `changes_note` text and a "Regenerate" button; (b) "Regenerate" opens `ProofGenerateForm` with `isChangesRequested=true` and `changesNote=proof.changes_note`; (c) `useRequestProofChanges` uses `.eq('state', 'sent')` guard in `proofs.api.ts`; make any required additive corrections to `ProofPanel.tsx` and `proofs.api.ts`; depends on T013, T007

**Checkpoint**: US4 complete — run Quickstart Scenario 8. Verify change note is pre-filled in ProofGenerateForm when reopened from `changes_requested` state.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T023 Finalise `src/modules/proofs/index.ts` (T009 stub) — replace all TODO comments with real exports of all components (ProofPanel, ProofGenerateForm, ProofSendModal, ProofApprovalBadge) and utilities (useProofByOrder, isProofApproved); ensure all files referenced in T014, T020, T021 import via `@/modules/proofs` public surface; depends on T017, T018

- [x] T024 Run `npm run lint` from repo root and fix any TypeScript or ESLint errors introduced by T003–T023 — common issues: implicit `any` on OpenAI/Twilio response types in edge functions, unused imports after stubs replaced, missing return types on API functions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Database (Phase 1)**: No dependencies — apply immediately; BLOCKS everything
- **Foundational (Phase 2)**: Depends on Phase 1; BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (T003, T004, T005, T006, T007, T008)
- **US2 (Phase 4)**: Depends on T003 (shared util) and T013 (ProofPanel exists to wire modal into)
- **US3 + US5 (Phase 5)**: T018 depends on T004; T019 depends on T013, T008; T020/T021 depend on T006, T008, T018
- **US4 (Phase 6)**: Depends on T013 (ProofPanel), T007 (API)
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Foundation (Phase 2) must be complete — no dependency on US2, US3, US4, US5
- **US2 (P1)**: Depends on US1 (needs ProofPanel for wiring, needs proof-generate deployed for a draft proof to exist)
- **US3 + US5 (P1)**: US3 depends on US2 (needs a sent proof); US5 only depends on Foundation + T018
- **US4 (P2)**: Depends on US2 (needs a sent proof to request changes on)

### Parallel Opportunities

After Phase 2 (Foundation complete), these can run in parallel (different files):

```bash
# Parallel group A — can start together after T009:
T010: proof-generate/index.ts  (edge function)
T012: ProofGenerateForm.tsx    (frontend)
T018: ProofApprovalBadge.tsx   (frontend, different file)

# Parallel group B — after Phase 3 (US1) complete:
T015: proof-send/index.ts      (edge function)
T020: EditJobDrawer.tsx        (frontend, different module)
T021: JobsPage.tsx             (frontend, different file)
```

Within Phase 2, T003–T006 can all run in parallel (different files).

---

## Implementation Strategy

### MVP First (US1 + US3 + US5 — Proof Generation and Job Gate)

1. Apply Phase 1 (T001–T002) — database ready
2. Complete Phase 2 (T003–T009) — foundation
3. Complete Phase 3 US1 (T010–T014) — staff can generate proofs
4. Complete T018, T020, T021 (ProofApprovalBadge + Job gate) — without proof send/approve, badge shows "Draft" and gate blocks
5. **STOP AND VALIDATE**: Quickstart Scenarios 1, 2, 6, 10

### Full P1 Delivery

6. Complete Phase 4 US2 (T015–T017) — staff can send proofs
7. Complete Phase 5 US3 (T019) — staff can approve proofs
8. **STOP AND VALIDATE**: Quickstart Scenarios 3–7, 10

### Full P1+P2 Delivery

9. Complete Phase 6 US4 (T022) — change request cycle
10. Complete Phase 7 (T023–T024) — polish
11. **Validate**: Quickstart Scenarios 8, 9

---

## Notes

- `ADDITIVE ONLY` tasks MUST NOT refactor, rename, or move existing logic — only add new props, imports, and JSX sections
- T015 carries a `⚠️ REVIEW NOTE` — re-read `research.md §2` before implementing to confirm direct provider calls are required (existing send functions are text-only)
- `proof-generate` requires `OPENAI_API_KEY` set as a Supabase project secret before deployment — verify this before running Scenario 1
- T021 (ProofApprovalBadge in JobsPage) may need a batch query pattern if per-row individual queries are too expensive — flag this at implementation time and use `useProofByOrder` per-row first, then optimise if needed
- The `.eq('state', 'sent')` guard on direct Supabase updates (T007, T019, T022) is critical — it prevents approve/request-changes from accidentally running on wrong states even if a concurrent update races the client-side check
