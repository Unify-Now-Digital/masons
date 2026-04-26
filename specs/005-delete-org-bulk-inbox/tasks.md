# Tasks: Delete Organization and Bulk Inbox Delete

**Input**: Design documents from `specs/005-delete-org-bulk-inbox/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`  
**Ordering Rule**: Migration tasks first. No frontend task starts until all migration tasks are complete.

## Phase 1: Setup

- [ ] M1 [US1] Title: Migration — verify/add FK CASCADE on org child tables
  - File(s): `supabase/migrations/<timestamp>_org_delete_fk_cascade_alignment.sql`
  - Acceptance criteria:
    - Verifies and enforces `ON DELETE CASCADE` (or documented equivalent hard-delete path) for org-related dependencies including `organization_members`, `inbox_conversations`, `inbox_messages`, `orders`, `invoices`, `jobs`.
    - Documents and fixes any FK that would block hard-delete of `public.organizations`.
    - Migration is idempotent and safe to run in non-empty environments.
  - Blocked by: None
  - Risk flags: High data integrity risk; destructive schema behavior

- [ ] M2 [US1] Title: Migration — `delete_organization` SECURITY DEFINER RPC
  - File(s): `supabase/migrations/<timestamp>_rpc_delete_organization.sql`
  - Acceptance criteria:
    - Creates `public.delete_organization(p_organization_id uuid)` as `SECURITY DEFINER`.
    - Validates caller is authenticated and admin of target organization.
    - Hard-deletes target organization and returns `void`.
    - Grants execute to authenticated role only.
  - Blocked by: M1
  - Risk flags: High authorization risk; irreversible delete path

- [ ] M3 [US2] Title: Migration — `delete_conversations` SECURITY DEFINER RPC
  - File(s): `supabase/migrations/<timestamp>_rpc_delete_conversations.sql`
  - Acceptance criteria:
    - Creates `public.delete_conversations(p_conversation_ids uuid[])` as `SECURITY DEFINER`.
    - Validates caller is authenticated org member and payload size is `<= 50`.
    - Enforces ownership scope: all IDs belong to caller-authorized organization.
    - Hard-deletes conversations and dependent messages/children.
    - Returns count of deleted conversations.
  - Blocked by: M1
  - Risk flags: High authorization/scope risk; bulk destructive operation

**Checkpoint**: M1, M2, M3 complete. Frontend work may start only after this checkpoint.

---

## Phase 2: Foundational API/Type Wiring (Post-Migration)

- [ ] T1 [P] [US1] Title: Update Supabase function types for new RPCs
  - File(s): `src/shared/types/database.types.ts`
  - Acceptance criteria:
    - Adds typed definitions for `delete_organization` and `delete_conversations`.
    - `delete_conversations` return type includes deleted count.
    - Typecheck passes where RPC wrappers consume these function signatures.
  - Blocked by: M2, M3
  - Risk flags: Type drift risk if RPC signatures change

- [ ] T2 [P] [US1] Title: Add organization delete RPC wrapper
  - File(s): `src/modules/organizations/api/organizationDelete.rpc.ts`, `src/modules/organizations/index.ts`
  - Acceptance criteria:
    - Exposes wrapper to call `delete_organization(p_organization_id)`.
    - Normalizes RPC errors into actionable user-facing messages.
    - No direct table delete fallback remains in wrapper.
  - Blocked by: T1
  - Risk flags: Error mapping consistency risk

- [ ] T3 [P] [US2] Title: Add conversations delete RPC wrapper
  - File(s): `src/modules/inbox/api/conversationsDelete.rpc.ts`, `src/modules/inbox/index.ts` (if needed)
  - Acceptance criteria:
    - Exposes wrapper to call `delete_conversations(p_conversation_ids)`.
    - Enforces/guards max-50 at client boundary before request.
    - Returns deleted count to UI caller.
  - Blocked by: T1
  - Risk flags: Client/server constraint mismatch risk

---

## Phase 3: User Story 1 (P1) — Delete Organization

**Goal**: Admin can delete active organization from Settings via type-to-confirm danger modal.

**Independent test**: As admin, delete active org by exact name confirmation; confirm fallback to next org or onboarding and no admin action visible for non-admins.

- [ ] T4 [US1] Title: Build `DeleteOrganizationModal` (danger + type-to-confirm)
  - File(s): `src/modules/settings/components/DeleteOrganizationModal.tsx`
  - Acceptance criteria:
    - Modal uses destructive styling and explicit irreversible warning copy.
    - Confirm action remains disabled until exact org name match.
    - Calls delete handler and displays loading/error states.
  - Blocked by: T2
  - Risk flags: Accidental destructive UX risk

- [ ] T5 [US1] Title: Wire Settings page delete action and membership refresh
  - File(s): `src/modules/settings/pages/SettingsPage.tsx`
  - Acceptance criteria:
    - Adds "Delete organisation" button in Settings (danger style, admin-only visibility).
    - Opens `DeleteOrganizationModal` with active org name.
    - On success calls `refetchMemberships()` and respects existing active-org/onboarding behavior.
  - Blocked by: T4
  - Risk flags: State transition risk after org deletion

---

## Phase 4: User Story 2 (P2) — Bulk Delete Inbox Conversations

**Goal**: User can select up to 50 conversations across channels and hard-delete them with confirmation.

**Independent test**: Select conversations via row/header checkboxes, confirm deletion dialog, verify delete count, list refresh, and selection reset.

- [ ] T6 [US2] Title: Add row-level checkbox selection UI in conversation list
  - File(s): `src/modules/inbox/components/InboxConversationList.tsx`
  - Acceptance criteria:
    - Checkbox appears on hover per row.
    - Row checkbox toggles selected state without breaking conversation navigation.
    - Supports all list channels (email, SMS, WhatsApp).
  - Blocked by: T3
  - Risk flags: Interaction conflict risk (row click vs checkbox click)

- [ ] T7 [US2] Title: Add header select-all (max 50) and delete toolbar with count
  - File(s): `src/modules/inbox/components/InboxConversationList.tsx`
  - Acceptance criteria:
    - Header select-all checkbox selects current list items up to cap 50.
    - Delete action appears when 1+ selected and displays selected count.
    - UI clearly prevents selecting above 50.
  - Blocked by: T6
  - Risk flags: Selection state drift with filtered/realtime lists

- [ ] T8 [US2] Title: Add bulk delete confirmation dialog
  - File(s): `src/modules/inbox/components/InboxConversationList.tsx` (or `src/modules/inbox/components/BulkDeleteConversationsDialog.tsx` if extracted)
  - Acceptance criteria:
    - Confirmation text format: `Delete X conversations? This cannot be undone`.
    - Dialog supports cancel/confirm and blocks accidental one-click deletion.
    - Uses selected count from current selection state.
  - Blocked by: T7
  - Risk flags: UX clarity risk for destructive action

- [ ] T9 [US2] Title: Wire bulk delete mutation + cache invalidation in inbox page
  - File(s): `src/modules/inbox/pages/UnifiedInboxPage.tsx`, `src/modules/inbox/hooks/useInboxConversations.ts`, `src/modules/inbox/api/inboxConversations.api.ts`
  - Acceptance criteria:
    - Uses `delete_conversations` RPC wrapper flow for bulk deletion.
    - On success clears selection, resets invalid selected/open thread state, and invalidates inbox queries.
    - Surfaces RPC errors (authorization, >50, ownership mismatch) as user-visible failures.
  - Blocked by: T8
  - Risk flags: Cache inconsistency risk after destructive operations

---

## Phase 5: Verification & Safety Checks

- [ ] V1 [US3] Title: Verification SQL for cascade + RPC authorization + bounded deletes
  - File(s): `specs/005-delete-org-bulk-inbox/verification.sql`
  - Acceptance criteria:
    - Includes SQL checks for FK cascade coverage on required org child tables.
    - Includes positive/negative test queries for `delete_organization` admin gate.
    - Includes positive/negative test queries for `delete_conversations` membership/ownership and max-50 enforcement.
  - Blocked by: M1, M2, M3, T5, T9
  - Risk flags: False confidence risk if verification scenarios incomplete

---

## Dependencies & Execution Order

- Migration gate: `M1 -> (M2, M3)` and **no T* starts before M1/M2/M3 complete**.
- Foundational wiring: `T1 -> (T2, T3)`.
- User Story 1 chain: `T2 -> T4 -> T5`.
- User Story 2 chain: `T3 -> T6 -> T7 -> T8 -> T9`.
- Verification finalizer: `(M1,M2,M3,T5,T9) -> V1`.

## Parallel Opportunities

- `T2` and `T3` can run in parallel after `T1`.
- After migration gate and wrappers:
  - US1 track (`T4`, `T5`) can proceed independently from US2 track (`T6`..`T9`) once its own dependencies are met.

## Suggested MVP Scope

- **MVP**: Complete US1 only (`M1`, `M2`, `T1`, `T2`, `T4`, `T5`, plus minimum verification in `V1` for org delete path).
- **Increment 2**: Add US2 bulk delete track (`M3`, `T3`, `T6`-`T9`), then finish full `V1`.
