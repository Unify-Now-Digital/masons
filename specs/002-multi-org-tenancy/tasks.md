---

description: "Task list for multi-organization tenancy (002-multi-org-tenancy)"
---

# Tasks: Multi-Organization (Multi-Tenancy) Support

**Input**: Design documents from `/specs/002-multi-org-tenancy/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Not requested in spec — no dedicated test tasks; use `npm run lint` / `npm test` in Polish phase.

**Organization**: Phases follow user stories **US1** (P1 tenant-safe use), **US2** (P2 admin), **US3** (P3 org switcher).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Table audit and feature module scaffolding before migrations.

- [X] T001 Write `specs/002-multi-org-tenancy/table-inventory.md` listing all `public` tables requiring `organization_id`, derived from auditing `supabase/migrations/*.sql` and [data-model.md](./data-model.md)
- [X] T002 [P] Create `src/modules/organizations/types/organization.types.ts` with `Organization`, `OrganizationMember`, and role union types aligned to [contracts/organization-context.md](./contracts/organization-context.md)
- [X] T003 [P] Create `src/modules/organizations/index.ts` exporting the module public surface per constitution (types + future components/hooks)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Schema, RLS, Edge Function tenant helpers, and React org context — **must complete before user story implementation**.

**⚠️ No user story work until this phase completes.**

- [X] T004 Create `supabase/migrations/YYYYMMDDHHmmss_create_organizations_and_organization_members.sql` with `public.organizations`, `public.organization_members`, constraints (`role` in `admin`|`member`), unique `(organization_id,user_id)`, indexes, RLS enabled, and policies for members to read their memberships
- [X] T005 Create `supabase/migrations/YYYYMMDDHHmmss_add_organization_id_core_batch_one.sql` adding nullable `organization_id` + FK to core tables: `orders`, `invoices`, `jobs`, `workers`, `worker_availability`, `job_workers` (adjust names to match actual schema in repo)
- [X] T006 Create `supabase/migrations/YYYYMMDDHHmmss_add_organization_id_core_batch_two.sql` adding nullable `organization_id` + FK for people/companies/products/inscriptions-related tables per `table-inventory.md`
- [X] T007 Create `supabase/migrations/YYYYMMDDHHmmss_add_organization_id_inbox_comms.sql` adding nullable `organization_id` + FK for `inbox_conversations`, `inbox_messages`, `gmail_connections`, WhatsApp connection tables per inventory
- [X] T008 Create `supabase/migrations/YYYYMMDDHHmmss_add_organization_id_remaining.sql` for any remaining tenant tables from `table-inventory.md` (payments, permits, activity_logs, AI tables, presets, etc.)
- [X] T009 Create `supabase/migrations/YYYYMMDDHHmmss_backfill_default_org_churchill.sql` inserting default org **Churchill**, backfilling `organization_id` on all scoped rows, and inserting `organization_members` rows for existing users (strategy per [research.md](./research.md))
- [X] T010 Create `supabase/migrations/YYYYMMDDHHmmss_org_rls_policies_tenant_isolation.sql` replacing/enhancing RLS so `select/insert/update/delete` on scoped tables require membership in row’s `organization_id` using `(select auth.uid())` patterns per constitution
- [X] T011 Add `supabase/functions/_shared/organizationMembership.ts` (or similarly named) exporting helpers to resolve `organization_id` and verify user membership for service-role callers per [contracts/edge-function-tenant.md](./contracts/edge-function-tenant.md)
- [X] T012 Update `supabase/functions/gmail-send-reply/index.ts` to use shared org/membership verification for inserts and Gmail connection scoping
- [X] T013 [P] Update `supabase/functions/gmail-sync-now/index.ts` to attach `organization_id` on message inserts and verify connection belongs to org
- [X] T014 [P] Update `supabase/functions/twilio-sms-webhook/index.ts` (and other inbox/webhook functions under `supabase/functions/` that write `inbox_*` or tenant data) to set/validate `organization_id` per inventory
- [X] T015 Audit remaining `supabase/functions/**/index.ts` that use service role on tenant tables; apply `contracts/edge-function-tenant.md` and document gaps in `specs/002-multi-org-tenancy/edge-functions-audit.md`
- [X] T016 Create `src/shared/context/OrganizationContext.tsx` implementing `OrganizationProvider`, `useOrganization`, loading memberships from Supabase, persisting last-selected org per user in `localStorage`, and exposing `setActiveOrganizationId` per [contracts/organization-context.md](./contracts/organization-context.md)
- [X] T017 Create `src/shared/lib/activeOrganizationStorage.ts` for stable storage keys (e.g. `activeOrganizationId` scoped by Supabase user id)
- [X] T018 Update `src/app/providers.tsx` to wrap the tree with `OrganizationProvider` inside `QueryClientProvider` so hooks and React Query coexist
- [X] T019 Update `src/components/layout/PageShell.tsx` to show a blocking empty/error state when `useOrganization()` has no valid membership (per spec edge cases) instead of rendering dashboard content
- [X] T020 Extend `src/shared/types/database.types.ts` (or regenerate from Supabase) to include `organizations` and `organization_members` Row types

**Checkpoint**: Migrations apply cleanly; RLS blocks cross-tenant reads in SQL smoke tests; org context resolves after login.

---

## Phase 3: User Story 1 — Tenant-safe daily use (Priority: P1) — MVP

**Goal**: All module data access is scoped to the active organization; inserts include `organization_id`; users never see other orgs’ data.

**Independent Test**: Two test users in two orgs — lists and detail views show only own org; create/update respects tenant ([spec.md](./spec.md) US1).

### Implementation (US1)

- [X] T021 [US1] Add `organization_id` filters and insert payloads to `src/modules/orders/api/orders.api.ts` and `src/modules/orders/hooks/useOrders.ts` using `useOrganization().organizationId`
- [ ] T022 [P] [US1] Scope Supabase queries and mutations in `src/modules/invoicing/api/invoicing.api.ts` and `src/modules/invoicing/hooks/useInvoices.ts` with active `organization_id`
- [ ] T023 [P] [US1] Scope `src/modules/payments/` API hooks (`src/modules/payments/api/*.ts`, `src/modules/payments/hooks/*.ts`) with `organization_id`
- [ ] T024 [US1] Scope `src/modules/inbox/api/inboxMessages.api.ts`, `src/modules/inbox/api/inboxConversations.api.ts`, and related inbox hooks under `src/modules/inbox/hooks/` with `organization_id` on all queries/inserts
- [ ] T025 [P] [US1] Scope `src/modules/customers/` (`api/`, `hooks/`) and `src/modules/companies/` with `organization_id`
- [ ] T026 [P] [US1] Scope `src/modules/jobs/api/`, `src/modules/map/api/`, and `src/modules/workers/api/` with `organization_id`
- [ ] T027 [US1] Scope `src/modules/memorials/`, `src/modules/inscriptions/`, `src/modules/proofs/api/proofs.api.ts` with `organization_id`
- [ ] T028 [US1] Scope `src/modules/permitForms/`, `src/modules/permitTracker/`, `src/modules/permitAgent/` Supabase access with `organization_id` where tenant data exists
- [ ] T029 [US1] Scope remaining modules that call Supabase (`src/modules/reporting/`, `src/modules/monitoring/`, `src/modules/team/`, `src/modules/notifications/`, `src/modules/settings/`, `src/modules/roles/`) — add `organization_id` or document exempt read-only globals in `table-inventory.md`
- [ ] T030 [US1] Add `organizationId` to React Query `queryKey` factories or shared keys in `src/modules/*/hooks/` so cache invalidates on org switch

**Checkpoint**: US1 complete — cross-org isolation verified manually per [quickstart.md](./quickstart.md).

---

## Phase 4: User Story 2 — Organization administration (Priority: P2)

**Goal**: Admins manage members and roles; members cannot access admin actions ([spec.md](./spec.md) US2).

**Independent Test**: Admin and member accounts in same org — admin can change membership; member receives denial on admin routes/actions.

### Implementation (US2)

- [X] T031 [US2] Add RLS policies or RPC patterns allowing **admin** role to `insert/update/delete` on `organization_members` for their org only (in new `supabase/migrations/YYYYMMDDHHmmss_org_admin_policies.sql`)
- [X] T032 [US2] Create `src/modules/organizations/api/organizationMembers.api.ts` for listing/updating members (uses Supabase client; relies on RLS)
- [X] T033 [US2] Create `src/modules/organizations/hooks/useOrganizationMembers.ts` exposing data for admin UI
- [X] T034 [US2] Create admin UI component under `src/modules/organizations/components/OrganizationMembersPanel.tsx` (or `OrganizationAdminSection.tsx`) and surface it from `src/modules/settings/pages/SettingsPage.tsx` when `useOrganization().role === 'admin'`

**Checkpoint**: US2 behaviors testable independently once US1 data scoping works.

---

## Phase 5: User Story 3 — Multiple organizations per user (Priority: P3)

**Goal**: Users with multiple memberships switch active org from sidebar; single-org users see no redundant switcher ([spec.md](./spec.md) US3).

**Independent Test**: One user in two orgs switches org — lists refresh to correct tenant; single-org user has no switcher.

### Implementation (US3)

- [X] T035 [US3] Create `src/modules/organizations/components/OrgSwitcher.tsx` using `useOrganization()`; hide when `memberships.length <= 1`
- [X] T036 [US3] Update `src/components/layout/Sidebar.tsx` to render `OrgSwitcher` and organization display name (replace or augment static “Churchill” / business branding section) per [plan.md](./plan.md)
- [X] T037 [US3] Ensure `OrganizationContext` calls `queryClient.invalidateQueries()` (or key-based reset) on active org change in `src/shared/context/OrganizationContext.tsx`

**Checkpoint**: US3 complete — org switch updates all cached module data.

---

## Phase 6: Polish & cross-cutting concerns

- [ ] T038 [P] Run `npm run lint` at repository root and fix any issues introduced by the feature
- [ ] T039 [P] Run `npm test` at repository root and address failures related to org changes
- [X] T040 Walk through validation steps in `specs/002-multi-org-tenancy/quickstart.md` and update that file with any discovered prerequisites
- [X] T041 [P] Re-read `specs/002-multi-org-tenancy/plan.md` Constitution Check and confirm dual router (`src/app/router.tsx`, `src/pages/`) unchanged in behavior except org context

---

## Dependencies & execution order

### Phase dependencies

| Phase | Depends on |
|-------|------------|
| Phase 1 Setup | Nothing |
| Phase 2 Foundational | Phase 1 complete |
| Phase 3 US1 | Phase 2 complete |
| Phase 4 US2 | Phase 2 complete; practical after T021–T024 show patterns |
| Phase 5 US3 | Phase 2 complete; best after US1 query keys (T030) for correct cache bust |
| Phase 6 Polish | All desired story phases complete |

### User story dependencies

- **US1**: Requires Foundational (Phase 2). No dependency on US2/US3 for core isolation.
- **US2**: Requires `organizations` + `organization_members` and RLS (Phase 2); logically after US1 data paths exist but admin UI can parallelize late US1.
- **US3**: Requires `OrganizationContext` (Phase 2) and benefits from US1 query key updates (T030).

### Parallel opportunities

- **T002, T003** in parallel (different files).
- **T013, T014** in parallel (different Edge Functions) after T011 shared helper exists.
- **T022, T023, T025, T026** in parallel (different modules) once T016–T020 land.
- **T038, T039, T041** in parallel in Polish phase.

### Parallel example (US1)

```text
# After org context exists, different developers can scope modules in parallel:
T022 src/modules/invoicing/
T023 src/modules/payments/
T025 src/modules/customers/
T026 src/modules/jobs/ + workers/
```

---

## Implementation strategy

### MVP first (US1 only)

1. Complete Phase 1 + Phase 2 (Foundational).
2. Complete Phase 3 (US1) through T030.
3. Stop and run manual isolation tests ([quickstart.md](./quickstart.md)).

### Incremental delivery

1. Add Phase 4 (US2) for admin UX.
2. Add Phase 5 (US3) for multi-org switcher.
3. Phase 6 polish.

---

## Task summary

| Metric | Value |
|--------|------|
| **Total tasks** | 41 |
| **Phase 1** | 3 |
| **Phase 2** | 17 |
| **US1** | 10 |
| **US2** | 4 |
| **US3** | 3 |
| **Polish** | 4 |
| **Parallel-marked [P]** | 12 |

**Suggested MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1) — tasks **T001–T030**.

---

## Notes

- Migration filenames use `YYYYMMDDHHmmss_` — replace with actual timestamps when creating files.
- Adjust table lists in T005–T008 if inventory reveals dependencies requiring different ordering (FKs).
- Do not commit secrets; Edge Functions continue to use env from Supabase dashboard.
