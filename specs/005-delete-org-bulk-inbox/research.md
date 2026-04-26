# Research: Delete Organization and Bulk Inbox Delete

## Decision 1: Use SECURITY DEFINER RPCs for destructive operations

- **Decision**: Implement both `delete_organization(p_organization_id uuid)` and `delete_conversations(p_conversation_ids uuid[])` as SECURITY DEFINER functions in migrations.
- **Rationale**: These operations need centralized authorization and validation guarantees that are stronger and easier to audit than duplicating logic in multiple client queries.
- **Alternatives considered**:
  - Client-side multi-step deletes via Supabase table APIs: rejected because authorization and scope checks are easier to bypass or diverge over time.
  - Edge Function deletion endpoints: rejected for this scope because database RPCs already fit the existing architecture and avoid extra network/service layer complexity.

## Decision 2: Enforce authorization in RPC body, not just UI

- **Decision**:
  - `delete_organization` must verify caller is admin of the target organization.
  - `delete_conversations` must verify caller is a member of the target organization for every conversation ID and reject mixed/foreign IDs.
- **Rationale**: UI checks are not security; the constitution requires DB-enforced authorization boundaries.
- **Alternatives considered**:
  - Trusting existing frontend `isAdmin` checks: rejected as insufficient security.
  - Separate RPCs for each conversation row delete: rejected as less efficient and harder to keep atomic.

## Decision 3: Add max-50 protection in RPC and UI

- **Decision**: Enforce 50-ID maximum in both Inbox selection UX and `delete_conversations` RPC validation.
- **Rationale**: UI-only caps can be bypassed; server-side guard prevents oversized destructive calls.
- **Alternatives considered**:
  - UI-only limit: rejected due to bypass risk.
  - No limit: rejected due to accidental mass deletion risk and poor operator safety.

## Decision 4: Treat organization deletion as hard delete with FK cascade verification migration

- **Decision**: Keep hard-delete requirement and add migration work to verify and align `organization_id -> organizations(id)` foreign keys for cascading behavior where required.
- **Rationale**: Existing tenant migrations added many `organization_id` FKs without explicit `on delete cascade`; hard-delete reliability requires deterministic child-row cleanup behavior.
- **Alternatives considered**:
  - Manually delete every child table in RPC: rejected due to brittle long-term maintenance and high risk of missing tables.
  - Convert feature to soft delete/archive: rejected as explicitly out of scope.

## Decision 5: Post-delete user state handled by OrganizationContext refresh

- **Decision**: After successful org deletion, frontend calls `refetchMemberships()` and relies on existing context behavior to pick next org or fall back to onboarding when none remain.
- **Rationale**: This behavior already exists and is used for membership changes; it avoids custom navigation hacks.
- **Alternatives considered**:
  - Hard redirect to specific route regardless of memberships: rejected because it can produce inconsistent state if memberships are stale.

## Decision 6: Keep "other members lose access on next login/session refresh" with no notification

- **Decision**: Do not add member notifications; rely on membership removal and RLS behavior.
- **Rationale**: Matches explicit scope and keeps rollout focused on deletion correctness.
- **Alternatives considered**:
  - Email/in-app notifications: rejected as out of scope.

## Decision 7: Inbox bulk-delete UX should include explicit count and select-all bounded behavior

- **Decision**: Add row-hover checkbox, header select-all (up to 50), toolbar delete action showing count, and confirmation dialog before final delete.
- **Rationale**: Meets requested user interaction pattern while preserving existing list architecture.
- **Alternatives considered**:
  - Keep current generic delete button without count/selection affordances: rejected due to poor clarity for destructive actions.
