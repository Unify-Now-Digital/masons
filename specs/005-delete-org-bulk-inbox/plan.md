# Implementation Plan: Delete Organization and Bulk Inbox Delete

**Branch**: `005-delete-org-bulk-inbox` | **Date**: 2026-04-23 | **Spec**: `specs/005-delete-org-bulk-inbox/spec.md`  
**Input**: Feature specification from `specs/005-delete-org-bulk-inbox/spec.md`

## Summary

Implement two destructive workflows with explicit safeguards and tenancy enforcement:
1) admin-only organization deletion through a SECURITY DEFINER RPC (`delete_organization`) plus Settings confirmation modal, and
2) bounded bulk inbox deletion through a SECURITY DEFINER RPC (`delete_conversations`) with max-50 enforcement and inbox multi-select UX improvements.

Delivery order is migration-first (RPCs, FK cascade verification/fixes, policy coverage), then frontend wiring in Settings and Inbox.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), SQL/PLpgSQL (Supabase migrations/RPCs)  
**Primary Dependencies**: React 18, React Router, TanStack Query, Supabase JS client, shadcn/ui dialog/button primitives  
**Storage**: PostgreSQL (Supabase, RLS-enabled multi-organization tables)  
**Testing**: Existing lint/typecheck plus manual functional verification scripts and SQL verification queries  
**Target Platform**: Web application (desktop-first dashboard, responsive behavior preserved)  
**Project Type**: Single web app with Supabase backend and migration-driven schema changes  
**Performance Goals**: Bulk delete interaction remains responsive with up to 50 selected conversations; no full-page reload required  
**Constraints**: SECURITY DEFINER RPC authorization checks are mandatory; hard-delete only; max 50 conversation IDs per call  
**Scale/Scope**: Organization-wide hard delete path and inbox list/toolbar updates for all supported message channels

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Dual router constraint**: PASS. No router architecture changes; behavior stays within existing Settings and Inbox pages.
- **Module boundaries**: PASS. Frontend work remains in `src/modules/settings/*`, `src/modules/inbox/*`, and shared context usage; no cross-feature deep-import violations planned.
- **Supabase + RLS**: PASS with caveat. RPCs are SECURITY DEFINER and must enforce role/membership checks internally; resulting deletes remain tenant-scoped.
- **Secrets**: PASS. No secret-handling or edge-function requirement introduced.
- **Additive-first**: PARTIAL PASS. This feature intentionally introduces destructive operations; plan includes explicit confirmation UX, authorization checks, bounded scope checks, and rollback strategy.

## Project Structure

### Documentation (this feature)

```text
specs/005-delete-org-bulk-inbox/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── delete-organization-rpc.md
│   └── delete-conversations-rpc.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   ├── settings/
│   │   └── pages/SettingsPage.tsx
│   ├── inbox/
│   │   ├── pages/UnifiedInboxPage.tsx
│   │   ├── hooks/useInboxConversations.ts
│   │   ├── api/inboxConversations.api.ts
│   │   └── components/InboxConversationList.tsx
│   └── organizations/
│       └── components/ (existing modal patterns reused)
├── shared/
│   └── context/OrganizationContext.tsx
└── app/
    └── layout/ (existing access/onboarding behavior remains)

supabase/
├── migrations/
│   └── [new migration files for RPCs + FK cascade alignment]
```

**Structure Decision**: Keep all UI changes in existing Settings/Inbox modules and all hard-delete business logic in database migrations via SECURITY DEFINER RPCs. Frontend calls thin APIs/hooks that delegate authorization to RPC layer.

## Phase 0: Research & Decisions

See `research.md` for finalized decisions. Key outputs:
- authorization model for both RPCs,
- FK cascade strategy for organization hard delete,
- bulk delete max-50 enforcement location,
- post-delete organization state behavior.

## Phase 1: Design & Contracts

### Design Artifacts

- `data-model.md`: entity and state updates for Organization deletion intent and Inbox bulk selection/deletion.
- `contracts/delete-organization-rpc.md`: RPC contract, errors, and security gates.
- `contracts/delete-conversations-rpc.md`: RPC contract, max-50 bound, and ownership checks.
- `quickstart.md`: end-to-end implementation and manual verification flow.

### Migration-First Execution Plan (Dependency Ordered)

1. **Schema audit migration task**
   - Enumerate org-scoped foreign keys and verify delete behavior for `organizations` parent rows.
   - Identify non-cascade org FK constraints that would block hard delete and document conversion.
2. **RPC migration task: `delete_organization(p_organization_id uuid)`**
   - SECURITY DEFINER function.
   - Validate caller is authenticated and admin of target org.
   - Hard delete target org row.
   - Return deterministic success payload/void; raise clear authorization and not-found errors.
3. **RPC migration task: `delete_conversations(p_conversation_ids uuid[])`**
   - SECURITY DEFINER function.
   - Validate caller authenticated, array non-empty, and array length <= 50.
   - Validate every conversation belongs to caller’s organization membership scope.
   - Delete conversations in a way that ensures child messages/related rows are removed (cascade or explicit internal ordering).
4. **Policy verification task**
   - Ensure current RLS/policies remain compatible with RPC invocation paths and post-delete behavior.
5. **Frontend task: Settings delete organization UX**
   - Add danger-styled action.
   - Add exact-name confirmation modal; disable confirm until exact match.
   - Call RPC; on success trigger `refetchMemberships()` and rely on existing active-org/onboarding behavior.
6. **Frontend task: Inbox multi-select UX upgrades**
   - Checkbox on row hover, select-all in header (bounded to 50), delete toolbar with count.
   - Confirmation dialog text: "Delete X conversations? This cannot be undone."
   - On success clear selection and invalidate inbox queries.
7. **Frontend task: API/hook integration**
   - Route delete operations through RPC-backed API helpers.
   - Preserve existing optimistic/selection reset behavior while enforcing max bound.
8. **Verification task**
   - Execute SQL verification + UI regression paths across channels and organization contexts.

## Phase 2: Implementation Task Planning Approach

- Break work into migration-first tasks, then frontend tasks depending on RPC availability.
- Keep PR slices reviewable:
  1) migrations + contracts,
  2) settings delete UX,
  3) inbox bulk delete UX + hook/API updates,
  4) verification and polish.

## Post-Design Constitution Re-Check

- **Dual router constraint**: PASS (no router paradigm changes).
- **Module boundaries**: PASS (feature-local changes only).
- **Supabase + RLS**: PASS (RPCs enforce role/membership; tenant boundaries retained).
- **Secrets**: PASS (no privileged third-party secret flows added).
- **Additive-first**: ACCEPTED EXCEPTION (intentional destructive feature). Mitigation: explicit confirmation, role checks, array bounds, and validation-first execution.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Destructive hard-delete operations | Product scope explicitly requires irreversible deletion | Soft-delete/archive contradicts out-of-scope and user request |
