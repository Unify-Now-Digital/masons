# Phase 0 Research: Multi-Organization Tenancy

**Feature**: `002-multi-org-tenancy`  
**Date**: 2026-04-11

## 1. Tenant isolation model (database)

**Decision**: Enforce tenant boundaries primarily with **`organization_id`** on all organization-scoped rows, plus **`organization_members`** (user ↔ org ↔ role). RLS policies allow access when the row’s `organization_id` matches an organization the current user belongs to (via membership), with role checks for admin-only operations.

**Rationale**: Matches spec FR-003/FR-004 and constitution “RLS as guardrail.” Client-side filtering alone is insufficient; service-role Edge Functions must resolve or validate `organization_id` on every write path.

**Alternatives considered**:

- **JWT custom claims** carrying `organization_id`: reduces per-query membership joins but requires Auth hooks and token refresh on org switch; defer unless performance demands it.
- **Row-level `user_id` only** (current): cannot model multiple users per org or multi-org users; rejected.

## 2. Active organization on the client

**Decision**: **`React Context` + hook** (e.g. `useOrganization`) holding `organizationId`, `organizationName`, `role`, and `memberships[]`. Persist last-selected org id in **`localStorage`** (key scoped by user id) with in-memory default on first load after auth.

**Rationale**: Aligns with spec FR-005/FR-006 and assumptions; works with React Query cache invalidation when org switches.

**Alternatives considered**:

- **URL segment** (`/org/:orgId/dashboard/...`): stronger deep-linking but larger router refactor; optional later.
- **Zustand/global store only**: acceptable if aligned with project patterns; context is sufficient for v1.

## 3. Supabase client queries

**Decision**: Centralize **`organization_id`** in query filters where PostgREST cannot infer from RLS alone (optional defense-in-depth), and rely on **RLS** as the security boundary. All `.insert()` paths must set `organization_id` explicitly or via trigger default tied to session.

**Rationale**: Constitution requires RLS; explicit filters reduce accidental cross-tenant bugs in development and simplify debugging.

**Alternatives considered**:

- **Views per org**: heavy maintenance; rejected for v1.

## 4. Edge Functions (Deno)

**Decision**: Functions that insert/update tenant data using the **service role** must:

1. Authenticate the user (existing JWT pattern).
2. Resolve **allowed `organization_id`** from `organization_members` (or from resource being acted on) before writing.
3. Never trust raw `organization_id` from the client without verification against membership.

**Rationale**: Service role bypasses RLS; application logic must replicate tenant checks.

**Alternatives considered**:

- **Pass org only via header**: allowed if verified against membership in-function.

## 5. Migration / default org “Churchill”

**Decision**: Single migration (or ordered set) that: creates `organizations` + `organization_members`; inserts one row **Churchill**; backfills **`organization_id`** on listed core tables; backfills **membership** for existing users (e.g. each distinct `auth.users` that already has rows → member or admin of Churchill—policy TBD in implementation tasks).

**Rationale**: Spec FR-011; additive-first per constitution.

**Clarification resolved**: Existing users without rows still need a membership rule—handled in migration tasks (e.g. insert membership for all existing `auth.users` into Churchill, or only users with data—implementation choice documented in `tasks.md` later).

## 6. Admin capabilities (scope)

**Decision**: Minimum viable admin: **list/remove members**, **change role**, **view org display name**. User invites/new auth signup out of scope unless already in product; “add member” may be **operator inserts** into `organization_members` for v1.

**Rationale**: Spec FR-010 (no self-serve org creation); manual provisioning extends to memberships if needed.

## 7. Tables requiring `organization_id` (inventory)

Beyond spec examples, include dependent entities found in repo migrations: e.g. `order_*` satellite tables, `invoice_payments`, `order_payments`, `order_extras`, `activity_logs` (if per-tenant), `order_proofs`, WhatsApp/Gmail connection tables tied to inbox, `inbox_ai_*`, `table_view_presets`, payment/reconciliation tables, permit tracker tables, etc. Final list is finalized during migration design with a schema audit.

**Outcome**: No remaining **NEEDS CLARIFICATION** blockers for planning; open implementation details deferred to `tasks.md`.
