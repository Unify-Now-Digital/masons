# Implementation Plan: Companies Module (Phase 1)

**Branch:** `feature/companies-crud-integration`  
**Specification:** `specs/companies-crud-integration-plan.md`

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create company schema | Create | `src/modules/companies/schemas/company.schema.ts` | High | None |
| 2 | Create data transform utils | Create | `src/modules/companies/utils/companyTransform.ts` | High | None |
| 3 | Create CRUD hooks | Create | `src/modules/companies/hooks/useCompanies.ts` | High | None |
| 4 | Create CreateCompanyDrawer | Create | `src/modules/companies/components/CreateCompanyDrawer.tsx` | High | Tasks 1-3 |
| 5 | Create EditCompanyDrawer | Create | `src/modules/companies/components/EditCompanyDrawer.tsx` | High | Tasks 1-3 |
| 6 | Create DeleteCompanyDialog | Create | `src/modules/companies/components/DeleteCompanyDialog.tsx` | High | Task 3 |
| 7 | Build CompaniesPage | Create | `src/modules/companies/pages/CompaniesPage.tsx` | High | Tasks 1-6 |
| 8 | Add module barrel | Create | `src/modules/companies/index.ts` | Medium | Tasks 1-7 |
| 9 | Update router | Update | `src/app/router.tsx` | High | Task 8 |
| 10 | Update sidebar nav | Update | `src/app/layout/AppSidebar.tsx` | High | Task 8 |
| 11 | Validate build & lint | Verify | - | High | Tasks 1-10 |

---

## Task 1: Create Company Schema

**File:** `src/modules/companies/schemas/company.schema.ts`  
**Action:** CREATE

**Content requirements:**
- Export `companyFormSchema` using Zod.
- Fields:
  - `name` (required, trimmed, min length 1)
  - `address` (optional, trimmed)
  - `city` (optional, trimmed)
  - `country` (optional, trimmed)
  - `phone` (optional, trimmed)
  - `email` (optional, trimmed, `.email()` validation when non-empty)
  - `team_members` (optional array of strings, each trimmed)
  - `notes` (optional, trimmed)
- Allow empty string for optional string fields via `.optional().or(z.literal(''))`.
- For `team_members`, use `z.array(z.string().trim()).optional().default([])`.
- Export `CompanyFormData = z.infer<typeof companyFormSchema>`.

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/companies/utils/companyTransform.ts`  
**Action:** CREATE

**Requirements:**
- Define `UICompany` interface (camelCase) with: `id`, `name`, `address`, `city`, `country`, `phone`, `email`, `teamMembers` (string[]), `notes`, `createdAt`, `updatedAt`.
- Export functions:
  - `transformCompanyFromDb(company)` → camelCase fields (`team_members` → `teamMembers`).
  - `transformCompaniesFromDb(companies)` → array map wrapper.
  - `toCompanyInsert(form: CompanyFormData)` → snake_case payload for Supabase insert (omit id/timestamps, normalize empty strings to `null` for optional fields, convert `teamMembers` → `team_members`).
  - `toCompanyUpdate(form: CompanyFormData)` → partial update payload with same normalization.
- Keep helpers pure; no Supabase imports.

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/companies/hooks/useCompanies.ts`  
**Action:** CREATE

**Requirements:**
- Use TanStack Query + Supabase client from `@/shared/lib/supabase`.
- Define query keys: `companiesKeys = { all: ['companies'], detail: (id) => ['companies', id] }`.
- Implement hooks:
  - `useCompaniesList()` → fetch all companies ordered by `name` asc.
  - `useCompany(id)` → fetch single (enabled when truthy).
  - `useCreateCompany()` → insert via Supabase; on success invalidate `companiesKeys.all`.
  - `useUpdateCompany()` → update by id; on success invalidate list + set detail cache.
  - `useDeleteCompany()` → delete by id; on success invalidate list.
- Shape Supabase interactions similar to orders/customers API (throw on error, return typed rows).
- Types: create local `Company`/`CompanyInsert`/`CompanyUpdate` matching DB shape; export them for component use.

**Database Types:**
```typescript
export interface Company {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  team_members: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyInsert = Omit<Company, 'id' | 'created_at' | 'updated_at'>;
export type CompanyUpdate = Partial<CompanyInsert>;
```

---

## Task 4: Create CreateCompanyDrawer Component

**File:** `src/modules/companies/components/CreateCompanyDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Drawer UI from shared components; React Hook Form with `zodResolver(companyFormSchema)`.
- Fields:
  - Name* (required)
  - Address, City, Country (optional)
  - Phone, Email (optional, email format validation)
  - Team Members (multi-input or textarea for Phase 1 - simple comma-separated or line-separated names)
  - Notes (textarea, optional)
- Submit calls `useCreateCompany`; use `toCompanyInsert` for payload.
- Toast success/error; close on success; show loading state.
- Props: `open`, `onOpenChange`.

**Team Members Input:**
- For Phase 1, use a textarea where users can enter names separated by commas or newlines.
- Parse on submit: split by comma/newline, trim, filter empty strings.
- Store as `string[]` in form state.

---

## Task 5: Create EditCompanyDrawer Component

**File:** `src/modules/companies/components/EditCompanyDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Same form + validation as Create drawer, prefilled from `company` prop (DB shape).
- Pre-fill team members as comma-separated string for textarea display.
- Submit uses `useUpdateCompany`; payload via `toCompanyUpdate`.
- Toast success/error; close on success.
- Props: `open`, `onOpenChange`, `company: Company`.

---

## Task 6: Create DeleteCompanyDialog Component

**File:** `src/modules/companies/components/DeleteCompanyDialog.tsx`  
**Action:** CREATE

**Key features:**
- AlertDialog UI with confirmation copy including company name/email.
- Uses `useDeleteCompany`; loading state on destructive button; toast success/error.
- Props: `open`, `onOpenChange`, `company: Company`.

---

## Task 7: Build CompaniesPage

**File:** `src/modules/companies/pages/CompaniesPage.tsx`  
**Action:** CREATE

**Requirements:**
- Fetch data with `useCompaniesList`; transform via `transformCompaniesFromDb`.
- UI sections:
  - Header with title + description ("Manage company records and team assignments").
  - Actions: search input (debounced) filtering by `name`, `email`, `phone`; button "New Company" opens Create drawer.
  - Table listing companies (similar styling to Orders/Customers table) with columns:
    - Name
    - Email
    - Phone
    - City
    - Country
    - Team Members (display count or first few names)
    - Created (relative or formatted)
    - Actions (Edit, Delete)
  - Row actions: Edit → opens Edit drawer with selected company; Delete → opens dialog.
- States:
  - Loading skeleton for table.
  - Empty state with CTA to create.
  - Error state with message + retry button (refetch).
- Toast on mutations handled in drawers/dialog.
- Keep module-local state for drawer/dialog open + selected company.

---

## Task 8: Add Module Barrel

**File:** `src/modules/companies/index.ts`  
**Action:** CREATE

**Exports:**
- `CompaniesPage` from pages.
- Components as needed (`CreateCompanyDrawer`, `EditCompanyDrawer`, `DeleteCompanyDialog`).
- Hooks and types if required externally.

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add route under `/dashboard`:
```tsx
import { CompaniesPage } from "@/modules/companies";
...
<Route path="companies" element={<CompaniesPage />} />
```

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:
- Title: "Companies"
- URL: `/dashboard/companies`
- Icon: `Building2` (lucide-react)
- Position: under Management group, near Orders/Customers/Invoicing.

---

## Task 11: Validation & QA

**Actions:**
- `npm run lint` and `npm run build` (ensure no TS/ESLint errors).
- Manual flows:
  - Create company → appears in list; drawer closes; toast shows.
  - Edit company → changes reflected; drawer closes; toast shows.
  - Delete company → removed from list; dialog closes; toast shows.
  - Search/filter covers name/email/phone; empty state renders when no results.
  - Team members array persists correctly (create/edit).
  - Navigation link and route render without console errors.

---

## Target File Tree

```
src/modules/companies/
├── components/
│   ├── CreateCompanyDrawer.tsx
│   ├── EditCompanyDrawer.tsx
│   └── DeleteCompanyDialog.tsx
├── hooks/
│   └── useCompanies.ts
├── pages/
│   └── CompaniesPage.tsx
├── schemas/
│   └── company.schema.ts
├── utils/
│   └── companyTransform.ts
└── index.ts
```

---

## Zod Schema Definition

```typescript
export const companyFormSchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  team_members: z.array(z.string().trim()).optional().default([]),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type CompanyFormData = z.infer<typeof companyFormSchema>;
```

**Note:** For form input, `team_members` may be handled as a comma/newline-separated string in the UI, then parsed to array before validation.

---

## Database Migration

**File:** `supabase/migrations/YYYYMMDDHHmmss_create_companies_table.sql`  
**Action:** CREATE (separate task, not in this spec)

**SQL:**
```sql
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  city text,
  country text,
  phone text,
  email text,
  team_members text[] default '{}',
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.companies enable row level security;

-- Phase 1: Allow all operations (will be restricted in Phase 2)
create policy "Allow all operations on companies"
  on public.companies
  for all
  using (true)
  with check (true);

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_companies_updated_at
  before update on public.companies
  for each row
  execute function update_updated_at_column();
```

---

## Transform Utilities Details

**File:** `src/modules/companies/utils/companyTransform.ts`

**Functions:**

```typescript
// DB → UI
export function transformCompanyFromDb(company: Company): UICompany {
  return {
    id: company.id,
    name: company.name,
    address: company.address || '',
    city: company.city || '',
    country: company.country || '',
    phone: company.phone || '',
    email: company.email || '',
    teamMembers: company.team_members || [],
    notes: company.notes || '',
    createdAt: company.created_at,
    updatedAt: company.updated_at,
  };
}

// UI → DB (Insert)
export function toCompanyInsert(form: CompanyFormData): CompanyInsert {
  return {
    name: form.name,
    address: form.address || null,
    city: form.city || null,
    country: form.country || null,
    phone: form.phone || null,
    email: form.email || null,
    team_members: form.team_members || [],
    notes: form.notes || null,
  };
}

// UI → DB (Update)
export function toCompanyUpdate(form: CompanyFormData): CompanyUpdate {
  return {
    name: form.name,
    address: form.address || null,
    city: form.city || null,
    country: form.country || null,
    phone: form.phone || null,
    email: form.email || null,
    team_members: form.team_members || [],
    notes: form.notes || null,
  };
}
```

---

## Validation Checklist

- [ ] Routes include `/dashboard/companies` and render without errors.
- [ ] Sidebar shows "Companies" with Building2 icon and active state.
- [ ] Zod schema enforces required name and email format (when provided).
- [ ] Optional fields accept empty strings; payload normalizes to `null`.
- [ ] `team_members` array persists correctly (create/edit/display).
- [ ] Team members input parses comma/newline-separated names correctly.
- [ ] Query keys invalidate on create/update/delete; list refetches.
- [ ] Drawers/dialog close on success; toasts fire for success/error.
- [ ] Loading, empty, and error states render correctly.
- [ ] Search filters name/email/phone in-memory on fetched data.
- [ ] Table displays team members count or preview correctly.
- [ ] All imports use `@/` aliases; no relative cross-module leaks.
- [ ] `npm run lint` and `npm run build` succeed.
- [ ] Database migration creates table with RLS enabled.
- [ ] No TypeScript errors; all types properly exported.

---

## Success Criteria

✅ Companies module delivers live Supabase CRUD with working drawers/dialog, searchable table, route/sidebar integration, and clean build with no console errors. Query invalidation keeps list in sync after create/update/delete. Team members array field works correctly for Phase 1 (simple text array storage).

---

## Implementation Notes

### Team Members Field (Phase 1)
- Phase 1 uses a simple `text[]` array for team member names (no user accounts yet).
- UI: Textarea input where users enter names separated by commas or newlines.
- Parse on submit: split by comma/newline, trim each, filter empty strings.
- Display in table: show count (e.g., "3 members") or first few names with ellipsis.
- Future Phase 2: Replace with foreign keys to `users` table when user accounts are implemented.

### Database Considerations
- `team_members` column is `text[]` (PostgreSQL array type).
- Supabase handles arrays natively; no special serialization needed.
- RLS policy is permissive for Phase 1; will be restricted in Phase 2.

### Form Handling
- React Hook Form manages form state.
- Team members: store as array in form state, but display/edit as comma-separated string in textarea.
- Conversion helpers handle array ↔ string transformation.

---

*Specification created: Companies Module Phase 1 CRUD Integration*  
*Ready for implementation via `/plan` command*

