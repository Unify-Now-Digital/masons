# Implementation Plan: Organisation management and member roles

**Branch**: `004-org-member-roles` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification plus explicit engineering decisions (RPC surface, trigger-based last-admin guard, Settings-only UX, `OrgSwitcher` frozen).

**Note**: This file is the `/speckit.plan` output.

## Summary

Deliver **Settings-only** flows to **create** additional organisations (name → creator becomes Admin → switch active org), **add** members by **email** when an account exists, **remove** members, and **change roles** (Admin / Member), with **last-admin** protection enforced in the database and mirrored in the UI. All **mutating** operations go through **`SECURITY DEFINER` RPCs** that enforce **`user_is_admin_of_org`** where applicable; **`create_organization`** only ever ties the new org and Admin membership to **`auth.uid()`**. A **`BEFORE DELETE` / `BEFORE UPDATE OF role`** trigger on **`public.organization_members`** blocks any change that would leave **zero** Admins. Frontend: expose **`refetchMemberships()``** on organisation context; **Create organisation** modal follows **create → refetch → set active org → close on success only**. Replace direct PostgREST **update/delete** on memberships with RPCs. **Do not modify** `OrgSwitcher.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite + React 18); PostgreSQL (Supabase migrations)  
**Primary Dependencies**: `@supabase/supabase-js`, TanStack React Query, React Router v6, Tailwind + shadcn-style UI under `src/shared/components/ui`  
**Storage**: PostgreSQL — `public.organizations`, `public.organization_members`; helpers `public.user_is_admin_of_org`, `public.user_is_member_of_org`  
**Testing**: `npm run lint`; manual Settings flows + optional SQL checks from [quickstart.md](./quickstart.md)  
**Target Platform**: Web (desktop-first SPA)  
**Project Type**: Web application (React SPA + Supabase)  
**Performance Goals**: Member lists stay small (1–50 rows typical); RPC round-trips acceptable for admin-only actions  
**Constraints**: RLS remains the default boundary for direct table access; RPCs bypass RLS and **must** re-validate caller identity and org admin rules in-function; `SECURITY DEFINER` functions follow project SQL conventions (`search_path` pinned, fully qualified names — see [research.md](./research.md)); **`OrgSwitcher` unchanged**  
**Scale/Scope**: One Settings section, two new components, four RPCs, one trigger, context API extension, API module swap from PostgREST to RPC for mutations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|--------|
| Dual router (`src/app/` + `src/pages/`) | **Pass** | No route structure change; only `SettingsPage` composition and org module |
| Module boundaries | **Pass** | UI + org API in `src/modules/organizations/`; shared **`OrganizationContext`** in `src/shared/context/` extended with a narrow public method |
| Supabase + RLS | **Pass** | RLS unchanged for normal reads; mutations concentrated in audited RPCs + trigger so bypass is intentional and guarded |
| Secrets server-side | **Pass** | No new secrets; no Edge Function requirement |
| Additive-first | **Pass** | Additive migrations (trigger + functions + grants); avoid editing `OrgSwitcher.tsx` |

**Post-design re-check**: Still **Pass** — contracts document RPC-only mutations; trigger is additive enforcement.

## Project Structure

### Documentation (this feature)

```text
specs/004-org-member-roles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rpc-org-management.md
└── tasks.md              # /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
supabase/migrations/
├── … (new) organization_members last-admin trigger
├── … (new) rpc create_organization
├── … (new) rpc add_organization_member_by_email
├── … (new) rpc remove_organization_member
└── … (new) rpc change_member_role

src/modules/organizations/
├── api/
│   ├── organizationMembers.api.ts    # Replace direct update/delete with RPC calls
│   └── organizationManagement.rpc.ts # New: thin wrappers for org RPCs
├── components/
│   ├── CreateOrganizationModal.tsx   # New
│   ├── OrganizationMemberRoleSelect.tsx  # New
│   ├── OrganizationMembersPanel.tsx  # Extend: add by email, remove, role controls
│   └── OrgSwitcher.tsx               # DO NOT CHANGE
├── hooks/useOrganizationMembers.ts
├── types/organization.types.ts
└── index.ts                          # Export new components as needed

src/modules/settings/pages/
└── SettingsPage.tsx                  # Wire “Create organisation” + modal

src/shared/context/
└── OrganizationContext.tsx         # Add refetchMemberships(); optional preferredOrgId param
```

**Structure Decision**: Single Vite app under `src/`; org feature code in `src/modules/organizations/` per constitution; context stays in `src/shared/context/`.

## Complexity Tracking

No constitution violations requiring justification.

---

## Phase 0: Research

See [research.md](./research.md). Resolved items: RPC vs expanding RLS for `organizations` insert; email resolution rules; duplicate membership behaviour; ordering of trigger vs RPC deploy.

## Phase 1: Design artifacts

| Artifact | Purpose |
|----------|---------|
| [data-model.md](./data-model.md) | Tables, roles, trigger semantics |
| [contracts/rpc-org-management.md](./contracts/rpc-org-management.md) | RPC names, parameters, returns, errors |
| [quickstart.md](./quickstart.md) | Manual + SQL verification |

---

## Implementation task breakdown

Tasks are ordered **by dependency** (per product request: **migrations → types → context → UI**).

### A. Database migrations (deploy first)

| ID | Task | Risk |
|----|------|------|
| **M1** | Add **`organization_members`** trigger function + **`BEFORE DELETE`** and **`BEFORE UPDATE OF role`** triggers: compute whether the statement would leave **zero** rows with `role = 'admin'` for that `organization_id`; if so, **`RAISE EXCEPTION`** with a stable message (supports concurrent admins). | **R1** Trigger must ignore non-admin rows correctly when counting “remaining admins”. **R2** `UPDATE` must evaluate **post-change** admin count (include row’s new role). |
| **M2** | **`create_organization(p_name text)`** → **`returns uuid`** (new `organizations.id`): validate non-empty trimmed name; **`insert`** org; **`insert`** `organization_members` for **`auth.uid()`** as **`admin`**; single transaction; **`SECURITY DEFINER`**; **`search_path`** pinned; **`grant execute`** to `authenticated`. No `user_is_admin_of_org` gate (creator path only). | **R3** Name length / XSS not DB concern—trim + max length optional in RPC or UI. |
| **M3** | **`add_organization_member_by_email(p_organization_id uuid, p_email text)`**: assert **`user_is_admin_of_org(p_organization_id)`**; resolve **`auth.users`** by normalised email; **if not found** raise; **if already member** return no-op or raise (pick one per [research.md](./research.md)); else **`insert`** role **`member`**. | **R4** Case-folding email must match Supabase/auth behaviour. |
| **M4** | **`remove_organization_member(p_organization_id uuid, p_user_id uuid)`**: assert admin; **`delete`** membership row for `(p_organization_id, p_user_id)`; trigger enforces last admin. Params use **`user_id`**, not membership id. | **R5** Caller must not delete wrong org—always scope by `p_organization_id`. |
| **M5** | **`change_member_role(p_organization_id uuid, p_user_id uuid, p_role text)`**: assert admin; validate `p_role` in **`admin`/`member`**; **`update`**; trigger blocks last-admin demotion. | **R6** Same as M4 for scoping. |

### B. Types and generated client

| ID | Task | Risk |
|----|------|------|
| **T1** | Regenerate **`src/shared/types/database.types.ts`** (or project equivalent) so `supabase.rpc(...)` is typed for new functions. | Low — merge conflicts if parallel schema work |
| **T2** | Keep **`OrganizationRole`** in `organization.types.ts` aligned with DB check constraint (`admin` \| `member`). | Low |

### C. Shared context

| ID | Task | Risk |
|----|------|------|
| **C1** | **`OrganizationContext`**: implement **`refetchMemberships(preferredOrganizationId?: string)`** that re-runs the same load as initial effect, then optionally sets **`activeId`** to `preferredOrganizationId` when provided and present in the new list. Expose on context value. | **R7** Avoid race with unmount—use cancellation flag like existing effect. |
| **C2** | Ensure **`setActiveOrganizationId`** + storage behaviour unchanged for normal switching. | Low |

### D. Organisation module API

| ID | Task | Risk |
|----|------|------|
| **D1** | Add **`organizationManagement.rpc.ts`**: `createOrganization(name)`, `addMemberByEmail`, `removeMember`, `changeMemberRole` calling Supabase RPCs; map Postgres errors to user-facing messages where helpful. | **R8** Surface **not found** vs **permission** vs **last admin** distinctly. |
| **D2** | **`organizationMembers.api.ts`**: replace **`update`** / **`delete`** on `organization_members` with **`changeMemberRole`** / **`removeMember`** RPCs; keep **`fetchOrganizationMembers`** on existing **`get_organization_members_with_identity`** unless contract changes. | **R9** React Query keys must invalidate org list + members list after mutations. |

### E. UI (Settings + org module)

| ID | Task | Risk |
|----|------|------|
| **E1** | **`CreateOrganizationModal`**: single name field; submit calls **`createOrganization`**; on success **`await refetchMemberships(newId)`** then **`setActiveOrganizationId(newId)`** then close; **on error** keep open + toast/message. | **R10** Do not close modal on thrown errors. |
| **E2** | **`SettingsPage`**: “Create organisation” entry (button) opens modal only (not OrgSwitcher). | Low |
| **E3** | **`OrganizationMemberRoleSelect`**: controlled select Admin/Member; disable when change would violate last-admin (client mirror); still rely on server error if race. | **R11** Client disable rules must match server for typical cases. |
| **E4** | **`OrganizationMembersPanel`**: add email field + add button; per-row remove + role select; wire to hooks/mutations; **admin-only** panel unchanged at visibility level. | Low |
| **E5** | **`OrgSwitcher.tsx`**: **no edits**. | N/A |

### F. Verification

| ID | Task | Risk |
|----|------|------|
| **V1** | Follow [quickstart.md](./quickstart.md) on staging/local: create org, add/remove/role, last-admin attempts. | Requires two test accounts |

---

## Agent context

Updated via `.specify/scripts/powershell/update-agent-context.ps1 -AgentType cursor-agent` after this plan is filled (re-run if plan changes materially).
