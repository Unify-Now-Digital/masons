---
description: "Task list for 004-org-member-roles (organisation management + member roles)"
---

# Tasks: Organisation management and member roles

**Input**: `specs/004-org-member-roles/` — [spec.md](./spec.md), [plan.md](./plan.md), [contracts/rpc-org-management.md](./contracts/rpc-org-management.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Prerequisites**: On git branch `004-org-member-roles` (or equivalent), Supabase CLI / DB access for migrations.

**Ordering (strict)**: **All M1–M5 migrations complete first** → **T1 types** → **C1 context** → **D1 + D2 API** → **UI: E1 modal → E2 role select → E3 panel → E4 Settings** → **V1 verification SQL**.

**Tests**: No automated test tasks unless added later; manual steps in [quickstart.md](./quickstart.md) and [verification.sql](./verification.sql).

---

## Phase 1: Setup

**Purpose**: Confirm environment; no feature code yet.

- [x] T000 Confirm local branch and Supabase project target before applying migrations

  - **Title**: Branch and DB target sanity check  
  - **Files changed**: _none_ (read-only)  
  - **Acceptance criteria**: Checked out `004-org-member-roles`; `supabase link` / `.env` points at intended project.  
  - **Blocked by**: None  
  - **Risk flags**: Wrong DB if misconfigured  

---

## Phase 2: Foundational — database (blocking)

**Purpose**: **No application tasks (types, context, API, UI) start until T001–T005 are merged/applied.**  
Implements [contracts/rpc-org-management.md](./contracts/rpc-org-management.md) and [plan.md](./plan.md) §A.

- [x] T001 M1 — Last-admin guard trigger on `organization_members`

  - **Title**: `BEFORE DELETE` / `BEFORE UPDATE OF role` trigger prevents zero admins per org  
  - **Files changed**: `supabase/migrations/<timestamp>_organization_members_last_admin_guard.sql` (single new migration file; name timestamp per repo convention)  
  - **Acceptance criteria**: Trigger raises on illegal delete/update; legal multi-admin changes succeed; `search_path` / qualifier style matches project DB rules.  
  - **Blocked by**: None  
  - **Risk flags**: **R1** wrong admin count logic; **R2** UPDATE must use post-change role when counting  

- [x] T002 M2 — `create_organization` RPC

  - **Title**: Atomic create org + creator admin membership  
  - **Files changed**: `supabase/migrations/<timestamp>_rpc_create_organization.sql`  
  - **Acceptance criteria**: `SECURITY DEFINER`; returns new org `uuid`; `insert` org + `organization_members` for `auth.uid()` as `admin` in one transaction; `grant execute` to `authenticated`; pinned `search_path`; no `user_is_admin_of_org` gate.  
  - **Blocked by**: T001  
  - **Risk flags**: **R3** empty name / length — reject in RPC or document UI-only with DB fallback  

- [x] T003 M3 — `add_organization_member_by_email` RPC

  - **Title**: Admin-only add by email via `auth.users` lookup  
  - **Files changed**: `supabase/migrations/<timestamp>_rpc_add_organization_member_by_email.sql`  
  - **Acceptance criteria**: Requires `user_is_admin_of_org(p_organization_id)` before DML; normalised email; **not found** raises clear error; new row `role = 'member'`; `grant execute` to `authenticated`.  
  - **Blocked by**: T001, T002  
  - **Risk flags**: **R4** email case-folding vs Supabase Auth  
  - **Decision required before proceeding**: Duplicate member: **ON CONFLICT DO NOTHING** + detect no insert vs **raise** — pick one and document in migration comment (see [research.md](./research.md) §4).  

- [x] T004 M4 — `remove_organization_member` RPC

  - **Title**: Admin-only remove by `(organization_id, user_id)`  
  - **Files changed**: `supabase/migrations/<timestamp>_rpc_remove_organization_member.sql`  
  - **Acceptance criteria**: `user_is_admin_of_org` before `delete`; deletes row for `(p_organization_id, p_user_id)`; last admin blocked by trigger; `grant execute` to `authenticated`.  
  - **Blocked by**: T001–T003  
  - **Risk flags**: **R5** wrong org scope if params swapped  

- [x] T005 M5 — `change_member_role` RPC

  - **Title**: Admin-only role update with trigger backstop  
  - **Files changed**: `supabase/migrations/<timestamp>_rpc_change_member_role.sql`  
  - **Acceptance criteria**: `user_is_admin_of_org` before `update`; `p_role` restricted to `admin`/`member`; last-admin demotion blocked by trigger; `grant execute` to `authenticated`.  
  - **Blocked by**: T001–T004  
  - **Risk flags**: **R6** same as R5  

**Checkpoint**: All migrations applied on target DB; RPCs callable from SQL editor with test JWT context.

---

## Phase 3: Types (after migrations)

- [x] T006 T1 — Regenerate Supabase TypeScript types for new RPCs

  - **Title**: Typed `supabase.rpc` for org management functions  
  - **Files changed**: `src/shared/types/database.types.ts` (regenerated or hand-edited to match actual migration signatures)  
  - **Acceptance criteria**: New RPC names and argument types match live DB; project compiles.  
  - **Blocked by**: T001–T005  
  - **Risk flags**: Merge conflicts if schema changed elsewhere  
  - **Decision required before proceeding**: Final **`returns`** shape for `add_organization_member_by_email` (void vs row) must match migrations before locking types.  

---

## Phase 4: Shared context (before any UI)

- [x] T007 C1 — `refetchMemberships` on `OrganizationContext`

  - **Title**: Expose refetch + optional preferred active org id  
  - **Files changed**: `src/shared/context/OrganizationContext.tsx`  
  - **Acceptance criteria**: `refetchMemberships(preferredOrganizationId?: string)` re-runs membership + org name load; when `preferredOrganizationId` is in the new list, set active org + persist to storage; cancellation on unmount; existing `setActiveOrganizationId` behaviour unchanged for normal switching.  
  - **Blocked by**: T006  
  - **Risk flags**: **R7** race on unmount  

---

## Phase 5: Organisation API / RPC wrappers (before UI)

- [x] T008 D1 — `organizationManagement.rpc.ts`

  - **Title**: Thin typed wrappers for org RPCs + error mapping  
  - **Files changed**: `src/modules/organizations/api/organizationManagement.rpc.ts` (new)  
  - **Acceptance criteria**: `createOrganization`, `addMemberByEmail`, `removeMember`, `changeMemberRole` call `supabase.rpc`; distinguish not-found / permission / last-admin messages where practical.  
  - **Blocked by**: T006, T007  
  - **Risk flags**: **R8** opaque Postgres errors  

- [x] T009 D2 — Replace PostgREST mutations with RPCs

  - **Title**: Member role/remove via RPC only  
  - **Files changed**: `src/modules/organizations/api/organizationMembers.api.ts`; optionally `src/modules/organizations/hooks/useOrganizationMembers.ts` if query invalidation is centralised there  
  - **Acceptance criteria**: No direct `.from('organization_members').update` / `.delete` for these operations; uses D1 wrappers or equivalent `supabase.rpc`; `fetchOrganizationMembers` unchanged (`get_organization_members_with_identity`).  
  - **Blocked by**: T008  
  - **Risk flags**: **R9** stale UI if React Query keys not invalidated after mutations  

---

## Phase 6: UI (strict order: modal → role select → panel → Settings)

### User Story mapping

| Task | Primary spec coverage |
|------|------------------------|
| T010 [US1] | User Story 1 — Create organisation from Settings |
| T011–T013 [US2][US3] | User Stories 2–3 — Add by email; remove; role change |

- [x] T010 [US1] E1 — `CreateOrganizationModal`

  - **Title**: Settings-only create-org modal (name field, success path closes)  
  - **Files changed**: `src/modules/organizations/components/CreateOrganizationModal.tsx` (new)  
  - **Acceptance criteria**: Submit calls `createOrganization` from D1; on success `await refetchMemberships(newId)` then `setActiveOrganizationId(newId)` then close; on error modal stays open with user-visible error; does not touch `OrgSwitcher.tsx`.  
  - **Blocked by**: T007, T008  
  - **Risk flags**: **R10** closing modal on error  

- [x] T011 [US3] E2 — `OrganizationMemberRoleSelect`

  - **Title**: Controlled Admin/Member select with client last-admin mirror  
  - **Files changed**: `src/modules/organizations/components/OrganizationMemberRoleSelect.tsx` (new)  
  - **Acceptance criteria**: Props: current member, org admin list or counts enough to disable illegal demotion; emits intended role; still surfaces server error on race.  
  - **Blocked by**: T009  
  - **Risk flags**: **R11** client/server mismatch for edge counts  

- [x] T012 [US2][US3] E3 — Extend `OrganizationMembersPanel`

  - **Title**: Add by email, remove, integrate role select  
  - **Files changed**: `src/modules/organizations/components/OrganizationMembersPanel.tsx`; `src/modules/organizations/hooks/useOrganizationMembers.ts` (and/or small mutation helper) if needed for mutations + invalidation  
  - **Acceptance criteria**: Admin-only visibility unchanged; email field + add; per-row remove + `OrganizationMemberRoleSelect`; uses API from `organizationMembers.api.ts` / D1; invalidates member list after mutations.  
  - **Blocked by**: T009, T011  
  - **Risk flags**: Low (UI wiring)  

- [x] T013 [US1] E4 — Wire modal on `SettingsPage`

  - **Title**: “Create organisation” opens modal; exports updated  
  - **Files changed**: `src/modules/settings/pages/SettingsPage.tsx`; `src/modules/organizations/index.ts` (export `CreateOrganizationModal` and any other public components per module convention)  
  - **Acceptance criteria**: Button opens T010 modal; page does not add creation to `src/modules/organizations/components/OrgSwitcher.tsx` (**file must not change**).  
  - **Blocked by**: T010  
  - **Risk flags**: Low  

**Checkpoint**: [quickstart.md](./quickstart.md) flows pass for create org, add/remove, role changes, last-admin blocks.

---

## Phase 7: Verification artefact

- [x] T014 V1 — SQL verification script

  - **Title**: Repeatable RPC + trigger checks  
  - **Files changed**: `specs/004-org-member-roles/verification.sql` (new)  
  - **Acceptance criteria**: Script documents calls or SQL snippets to assert: RPCs exist; non-admin JWT cannot mutate; last-admin delete/update fails; `create_organization` binds creator only (manual steps with placeholders documented).  
  - **Blocked by**: T001–T005  
  - **Risk flags**: Requires two test users / manual substitution of UUIDs  

---

## Phase 8: Polish & cross-cutting

- [x] T015 Run `npm run lint` and fix any issues in touched files

  - **Title**: Lint pass for org/settings edits  
  - **Files changed**: Any files flagged by ESLint in the above paths  
  - **Acceptance criteria**: `npm run lint` exits zero.  
  - **Blocked by**: T006–T013  
  - **Risk flags**: Low  

- [x] T016 Confirm `OrganizationRole` type aligns with DB constraint

  - **Title**: Types drift guard  
  - **Files changed**: `src/modules/organizations/types/organization.types.ts` (only if adjustment needed)  
  - **Acceptance criteria**: `admin` \| `member` only, matches migrations.  
  - **Blocked by**: T006  
  - **Risk flags**: Low  

---

## Dependencies & execution order

```text
T000
  ↓
T001 (M1) → T002 (M2) → T003 (M3) → T004 (M4) → T005 (M5)
  ↓
T006 (T1 types)
  ↓
T007 (C1 context)
  ↓
T008 (D1) → T009 (D2)
  ↓
T010 (E1 modal) ──────────────────────────────┐
  ↓                                            │
T011 (E2 role select)                           │
  ↓                                            │
T012 (E3 panel)                                 │
  ↓                                            │
T013 (E4 Settings) ←──────────────────────────┘
  ↓
T014 (V1) can start after T005; full run after T013
T015 after T013; T016 after T006 (can parallel T015 with T014 after T005)
```

**Parallel opportunities**: **None** for M1–M5 (single chain). After T005, **T014** can be drafted in parallel with T006–T009 if desired (different files). **T016** can run after T006 alongside later UI work.

---

## User story → task map

| Story | Priority | Tasks | Independent test (from spec) |
|-------|----------|-------|--------------------------------|
| US1 Create organisation | P1 | T010, T013 (+ backend T002,T007,T008) | Settings: create org → user is Admin → switcher still works |
| US2 Add by email | P2 | T003, T012 (+ T008–T009) | Add existing user; unknown email errors; duplicate handled per decision |
| US3 Remove / change role | P3 | T001,T004,T005, T011,T012 | Remove + role change; last-admin blocked UI + DB |

---

## Implementation strategy

### MVP first

1. Complete **T001–T005** (migrations).  
2. **T006–T009** (types, context, API).  
3. **T010 + T013** (modal + Settings button) → validate **US1** without member CRUD UI.  
4. Add **T011–T012** for full **US2/US3**.

### Suggested MVP scope

**T001–T010, T013** (organisations creatable and switchable) before shipping member-management UI, **or** ship all through **T015** for one release — product call.

---

## Format validation

- Every implementable task uses the required checklist line: `- [ ] <TaskID> …` with **exact file paths** in the structured block.  
- **[US#]** labels appear only on user-story phase tasks **T010–T013**.  
- **No `[P]`** markers: migrations and downstream chain are sequential by design.

---

## Notes

- **Do not edit** `src/modules/organizations/components/OrgSwitcher.tsx`.  
- RPC parameter shape: **`(p_organization_id, p_user_id)`** — not membership row id ([contracts/rpc-org-management.md](./contracts/rpc-org-management.md)).  
- Re-run **T006** if any migration signature changes after first pass.
