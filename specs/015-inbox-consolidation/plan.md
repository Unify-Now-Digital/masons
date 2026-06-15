# Implementation Plan: Inbox Consolidation — Unified Native Inbox

**Branch**: `015-inbox-consolidation` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/015-inbox-consolidation/spec.md`  
**Trunk**: `staging` | **Stack**: React 18 + TypeScript + Vite, Tailwind, shadcn/gardens UI, TanStack Query, React Router v6, Supabase (Postgres + RLS + Edge Functions)

## Summary

Merge enquiry triage into the operational native inbox at `/dashboard/inbox`: **Enquiries** segment (**two-column** human funnel: New → In progress; linked enquiries leave the board with confirmation) + **All / Linked** segment (existing conversations/customers behaviour). Retire `/dashboard/enquiry-triage` with redirect and delete `src/modules/enquiryTriage/`. Add `enquiry_stage` column on `inbox_conversations` (enum includes `order_created` as a **DB state on link**, not a board column). Fix AC-005 org stamps on client `createMessage` and edge inbound writers. Reuse existing inbox components and `CreateOrderDrawer`; person reads via `public.people` only.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React 18); SQL migrations; Deno Edge Functions  
**Primary Dependencies**: TanStack React Query, Supabase JS client, React Router v6, gardens UI primitives  
**Storage**: PostgreSQL — `inbox_conversations`, `inbox_messages`, `people`; additive `enquiry_stage` column  
**Testing**: `npm run lint`; manual verification per [quickstart.md](./quickstart.md)  
**Target Platform**: Web dashboard (`/dashboard/inbox`)  
**Project Type**: Frontend module extension + one migration + one edge-function patch  
**Performance Goals**: Single conversations fetch per segment; pipeline columns client-derived from fetch (same as triage today)  
**Constraints**: Dual-scoped visibility unchanged; no RLS edits; no org-ID code forks; GHL inbox untouched  
**Scale/Scope**: ~1 migration, ~8 new/updated inbox files, 4 files deleted, 3 routing/nav files updated, 2 write-path fixes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Dual router constraint | PASS | Changes only `src/app/router.tsx` + `src/pages/NotFound.tsx` untouched; redirect route stays in app shell |
| Module boundaries | PASS | New code under `src/modules/inbox/`; `enquiryTriage` deleted; `CreateOrderDrawer` via orders public export |
| Supabase + RLS | PASS | Additive column only; no policy changes; stage inherits row visibility |
| Secrets / Edge Functions | PASS | `twilio-sms-webhook` org stamp fix only; `ghl-webhook` unchanged (no inbox writes) |
| Additive-first | PASS | Column add + UI merge; module deletion explicit with redirect |

## Phase 0: Research

Completed — see [research.md](./research.md). Key resolved decisions:

1. **Enquiry stage** → `inbox_conversations.enquiry_stage`; per-user-private on email (acceptable); workshop-shared on WhatsApp/SMS  
2. **Triage retirement** → redirect + delete 4-file module  
3. **Org stamp** → `inboxMessages.api.ts` + `twilio-sms-webhook` (not `ghl-webhook` — audit shows no inbox insert)  
4. **Routing** → existing `src/app/router.tsx` pattern confirmed  
5. **Reuse** → operational inbox components + `CreateOrderDrawer` extension for prefill

## Phase 1: Design

| Artifact | Path |
|----------|------|
| Data model | [data-model.md](./data-model.md) |
| UI/API contract | [contracts/inbox-consolidation.md](./contracts/inbox-consolidation.md) |
| Quickstart | [quickstart.md](./quickstart.md) |

### Agent context update

Ran `.specify/scripts/powershell/update-agent-context.ps1 -AgentType cursor-agent` (script ran before plan body was finalised; no new stack beyond existing Vite/React/Supabase).

## Post-Design Constitution Check

All gates PASS. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/015-inbox-consolidation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── inbox-consolidation.md
├── checklists/
│   └── requirements.md
└── tasks.md                    # Created by /speckit.tasks
```

### Source Code

```text
supabase/migrations/
└── YYYYMMDDHHmmss_inbox_enquiry_stage.sql     # NEW

supabase/functions/twilio-sms-webhook/
└── index.ts                                    # UPDATE — org from parent conversation

src/app/
└── router.tsx                                  # UPDATE — redirect, remove EnquiryTriagePage

src/components/layout/
├── Sidebar.tsx                                 # UPDATE — Inbox → /dashboard/inbox
└── PageShell.tsx                               # UPDATE — remove enquiry-triage titles

src/modules/inbox/
├── api/
│   ├── inboxMessages.api.ts                    # UPDATE — parent org stamp (AC-005)
│   ├── inboxConversations.api.ts               # UPDATE — linkConversationToOrder, enquiry_stage filter
│   └── enquiryPipeline.api.ts                  # NEW — unlinked open conversations + people join
├── hooks/
│   ├── useEnquiryPipeline.ts                   # NEW
│   └── useUpdateEnquiryStage.ts                # NEW
├── components/
│   ├── EnquiryPipelineBoard.tsx                # NEW — lifted from EnquiryTriagePage (no AI)
│   ├── EnquiryPipelineCard.tsx                 # NEW
│   ├── EnquiryCreateOrderPanel.tsx             # NEW — wraps CreateOrderDrawer
│   └── InboxRightPanel.tsx                     # NEW — state-driven: order context vs create order
├── pages/
│   └── UnifiedInboxPage.tsx                    # UPDATE — segment rail, wire pipeline, remove extractions
├── types/
│   └── inbox.types.ts                          # UPDATE — enquiry_stage on conversation
└── index.ts                                    # unchanged exports

src/modules/orders/components/
└── CreateOrderDrawer.tsx                       # UPDATE — optional prefill props only

src/modules/enquiryTriage/                      # DELETE entire directory (4 files)
```

**Structure Decision**: Single owning module (`inbox`). Pipeline UI is lifted, not reimplemented. Orders module receives minimal `CreateOrderDrawer` prop extension for prefill — no new order-creation path.

---

## Explicit Decision 1: Enquiry stage persistence & RLS

### Storage chosen

**Column `inbox_conversations.enquiry_stage`** (`new` | `in_progress` | `order_created`, default `new`). All three values remain in the migration check constraint; **`order_created` is persisted on order link** but is **not** rendered as a UI board column.

See [data-model.md](./data-model.md) for migration SQL.

### UI funnel (two columns only)

| Board column | `enquiry_stage` on row | Notes |
|--------------|------------------------|-------|
| **New** | `new` (default) | Unlinked open conversation |
| **In progress** | `in_progress` | Staff explicitly advanced |
| *(none)* | `order_created` after link | Row has `order_id` set → **excluded from fetch**; card **leaves the board** with brief confirmation |

### RLS consequence (addressed directly)

| Channel | Row `user_id` | Who sees stage |
|---------|---------------|----------------|
| Email | Set to mailbox owner | **Owner only** — stage is per-user-private, same as the email thread |
| WhatsApp / SMS | `NULL` (shared) | **Whole workshop** — any member sees and can advance shared enquiries |

### Decision: per-user-private email stage is acceptable

Email enquiries are owned by the user who connected Gmail (`user_id` on insert in `inboxConversations.api.ts`). Workshop-wide stage on email would require either breaking email privacy or a parallel stage table — both rejected.

**We do NOT change RLS policies.** Stage visibility follows conversation row visibility under existing policies. Enquiries fetches reuse `fetchConversations` / `useConversationsList` — same visibility as All / Linked.

**On order link**: set `order_id` and `enquiry_stage = 'order_created'` via `linkConversationToOrder`; the card **leaves the Enquiries funnel** (fetch requires `order_id IS NULL`) with a brief confirmation — it does **not** move to a third column.

---

## Explicit Decision 2: `/enquiry-triage` retirement

### Redirect (real route, not dead import)

In `src/app/router.tsx`:

```tsx
import { Navigate } from "react-router-dom";

// Remove: import { EnquiryTriagePage } from "@/modules/enquiryTriage";

<Route
  path="enquiry-triage"
  element={<Navigate to="/dashboard/inbox?segment=enquiries" replace />}
/>
```

Preserve `?conversation=<uuid>` from old URLs via redirect helper or `useEffect` in `UnifiedInboxPage` reading location on mount.

### Module removal (complete file list)

| File | Action |
|------|--------|
| `src/modules/enquiryTriage/pages/EnquiryTriagePage.tsx` | **Delete** — pipeline markup lifted to `EnquiryPipelineBoard.tsx` |
| `src/modules/enquiryTriage/hooks/useEnquiryTriage.ts` | **Delete** — replaced by `useEnquiryPipeline.ts` |
| `src/modules/enquiryTriage/api/enquiryTriage.api.ts` | **Delete** — replaced by `enquiryPipeline.api.ts` (no extraction fetch) |
| `src/modules/enquiryTriage/index.ts` | **Delete** |

### Navigation updates

- `Sidebar.tsx` line ~84: `to: '/dashboard/inbox'`
- `PageShell.tsx`: remove `'enquiry-triage'` from title/subtitle maps; ensure `'inbox'` has appropriate copy

### Verification gate

```bash
rg "enquiryTriage|enquiry-triage" src/ --glob '!**/UnifiedInboxPage.tsx'
```

Only allowed remaining `enquiry-triage` reference: redirect route path string in `router.tsx`.

---

## Explicit Decision 3: Org stamp on conversation + message writes (AC-005, widened)

### Scope correction (post-audit)

Audit of all 9 inbox_messages writers corrected the original assumption.
The gap is NOT twilio-sms-webhook (already stamps, line 320) — it is three
Gmail/proof functions that stamp neither their conversation insert nor their
message insert. AC-005's "message writes" is widened to **conversation AND
message inserts**: an unstamped inbox_conversations insert writes a null-org
parent, which a correct message stamp then can't recover from.

### Verified already-stamped (no change — 6 functions)

gmail-send-first-message (188), gmail-send-reply (261), inbox-gmail-send (282),
inbox-sms-send (128/152), inbox-twilio-send (192/219), gmail-sync-now (402/509).

### Fixes required

| Function | Conv insert | Msg insert | Org source |
|----------|-------------|------------|------------|
| client `inboxMessages.api.ts` | n/a | ≈30 | SELECT org from parent inbox_conversations by conversation_id; throw if null |
| inbox-gmail-new-thread | 179 | 213 | resolveOrganizationIdForUser(supabase, userId, connection.organization_id) |
| inbox-gmail-sync | 271 | 318 | resolve once after conversationId settled (found-or-created) |
| proof-send (email) | 395 | 416 | order/proof record the dispatch acts on — NOT a gmail connection |
| proof-send (whatsapp) | 511 | 530 | same order/proof-derived org |

### twilio-sms-webhook — verify only

Already stamps organization_id: tenantOrgId (320) and backfills conv org
(267–268). Optional hardening: prefer existingConv.organization_id over
connection-resolved tenantOrgId on the message insert. Not required for 015.

### No backfill required

Pre-fix null-org row count in both inbox_conversations and inbox_messages
is 0 (verified via dashboard) — these service-role functions left no orphan
data. Forward fix only.

### Verification (RLS-bypass aware)

These are service-role inserts: RLS is bypassed, so the insert succeeds with
or without org. The test is NOT "message sends" (it always did) — it is "new
row lands with non-null organization_id matching the parent conversation."
grep -L organization_id across the five fixed functions' insert payloads must
return empty before Phase A is complete.

---

## Explicit Decision 4: Routing within dual-router convention

Confirmed per `constitution.md` and repo layout:

- **`src/app/router.tsx`**: All dashboard routes, including inbox consolidation and enquiry-triage redirect  
- **`src/pages/`**: Legacy singletons (`NotFound.tsx`) — **not** used for inbox  

No new router pattern. `UnifiedInboxPage` remains the route element for `path="inbox"`.

---

## Implementation phases

### Phase A — Schema + write paths (can land first)

1. Add migration `inbox_enquiry_stage`  
2. Fix `inboxMessages.api.ts` org stamp  
3. Fix `twilio-sms-webhook` parent-org stamp on existing-conversation branch  
4. Extend `inbox.types.ts` with `enquiry_stage`

### Phase B — Inbox module: pipeline + panel

1. Create `enquiryPipeline.api.ts` — fetch open unlinked conversations (`order_id IS NULL`); bucket **New** / **In progress** only; join person from `people` for card display  
2. Create `EnquiryPipelineBoard` + `EnquiryPipelineCard` — **two-column** funnel (New → In progress); port visual layout from deleted triage page; on order link remove card + brief confirmation; remove AI stages/badges/extraction  
3. Create `useUpdateEnquiryStage` mutation  
4. Create `EnquiryCreateOrderPanel` — deterministic prefill; open `CreateOrderDrawer`  
5. Extend `CreateOrderDrawer` with optional `initialPersonId`, `initialCustomerName`, `initialCustomerEmail`, `initialCustomerPhone`, `onCreated?(orderId)`  
6. Add `linkConversationToOrder` in `inboxConversations.api.ts`  
7. Create `InboxRightPanel` — switches `PersonOrdersPanel` vs `EnquiryCreateOrderPanel` based on `order_id` + segment

### Phase C — UnifiedInboxPage integration

1. Add segment rail: **Enquiries** | **All / Linked** (URL `segment` param)  
2. `segment=enquiries` → pipeline + thread + right panel  
3. `segment=all` → existing `viewMode` conversations/customers (unchanged behaviour)  
4. Remove `useEnquiryExtractions` and extraction-driven bucket inputs from page + `ConversationView`  
5. Channel filters apply per active segment

### Phase D — Navigation retirement

1. Router redirect  
2. Sidebar + PageShell  
3. Delete `src/modules/enquiryTriage/`  
4. Run quickstart smoke tests

---

## Out of scope (do not implement)

- GHL inbox (`/ghl-inbox`, `src/modules/ghl-inbox/`, `ghl-webhook` behaviour)  
- GHL history backfill into native tables  
- AI extraction worker / `inbox_enquiry_extraction` UI or pipeline  
- RLS policy changes  
- Per-org code branching  

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Email visibility regression in Enquiries | Reuse same `fetchConversations` path; two-user smoke test in quickstart |
| Pipeline visual drift | Lift JSX/CSS from `EnquiryTriagePage` before delete; **two columns** only (not three); side-by-side screenshot check |
| CreateOrderDrawer prefill scope creep | Only person/contact fields; no inscription/product AI fields |
| `ghl-webhook` named in spec but not a writer | Documented in research; edge fix targets `twilio-sms-webhook` |

---

## Next step

Run **`/speckit.tasks`** to break phases A–D into ordered, testable tasks.
