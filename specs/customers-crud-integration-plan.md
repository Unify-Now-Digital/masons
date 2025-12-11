# Implementation Plan: Customers Module (Phase 1)

**Branch:** `feature/customers-crud-integration`  
**Specification:** `specs/customers-crud-integration-plan.md`

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create customer schema | Create | `src/modules/customers/schemas/customer.schema.ts` | High | None |
| 2 | Create data transform utils | Create | `src/modules/customers/utils/customerTransform.ts` | High | None |
| 3 | Create CRUD hooks | Create | `src/modules/customers/hooks/useCustomers.ts` | High | None |
| 4 | Create CreateCustomerDrawer | Create | `src/modules/customers/components/CreateCustomerDrawer.tsx` | High | Tasks 1-3 |
| 5 | Create EditCustomerDrawer | Create | `src/modules/customers/components/EditCustomerDrawer.tsx` | High | Tasks 1-3 |
| 6 | Create DeleteCustomerDialog | Create | `src/modules/customers/components/DeleteCustomerDialog.tsx` | High | Task 3 |
| 7 | Build CustomersPage | Create | `src/modules/customers/pages/CustomersPage.tsx` | High | Tasks 1-6 |
| 8 | Add module barrel | Create | `src/modules/customers/index.ts` | Medium | Tasks 1-7 |
| 9 | Update router | Update | `src/app/router.tsx` | High | Task 8 |
| 10 | Update sidebar nav | Update | `src/app/layout/AppSidebar.tsx` | High | Task 8 |
| 11 | Validate build & lint | Verify | - | High | Tasks 1-10 |

---

## Task 1: Create Customer Schema

**File:** `src/modules/customers/schemas/customer.schema.ts`  
**Action:** CREATE

**Content requirements:**
- Export `customerFormSchema` using Zod.
- Fields: `first_name` (required, trimmed), `last_name` (required, trimmed), `email` (optional, trimmed, `.email()` when non-empty), `phone` (optional, trimmed), `address` (optional, trimmed), `city` (optional, trimmed), `country` (optional, trimmed).
- Allow empty string for optional string fields via `.optional().or(z.literal(''))`.
- Export `CustomerFormData = z.infer<typeof customerFormSchema>`.

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/customers/utils/customerTransform.ts`  
**Action:** CREATE

**Requirements:**
- Define `UICustomer` interface (camelCase) with: `id`, `firstName`, `lastName`, `email`, `phone`, `address`, `city`, `country`, `createdAt`, `updatedAt`, and `fullName` derived helper.
- Export functions:
  - `transformCustomerFromDb(customer)` → camelCase fields + `fullName`.
  - `transformCustomersFromDb(customers)` → array map wrapper.
  - `toCustomerInsert(form: CustomerFormData)` → snake_case payload for Supabase insert (omit id/timestamps, normalize empty strings to `null` for optional fields).
  - `toCustomerUpdate(form: CustomerFormData)` → partial update payload with same normalization.
- Keep helpers pure; no Supabase imports.

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/customers/hooks/useCustomers.ts`  
**Action:** CREATE

**Requirements:**
- Use TanStack Query + Supabase client from `@/shared/lib/supabase`.
- Define query keys: `customersKeys = { all: ['customers'], detail: (id) => ['customers', id] }`.
- Implement hooks:
  - `useCustomersList()` → fetch all customers ordered by `last_name` asc.
  - `useCustomer(id)` → fetch single (enabled when truthy).
  - `useCreateCustomer()` → insert via Supabase; on success invalidate `customersKeys.all`.
  - `useUpdateCustomer()` → update by id; on success invalidate list + set detail cache.
  - `useDeleteCustomer()` → delete by id; on success invalidate list.
- Shape Supabase interactions similar to orders API (throw on error, return typed rows).
- Types: create local `Customer`/`CustomerInsert`/`CustomerUpdate` matching DB shape; export them for component use.

---

## Task 4: Create CreateCustomerDrawer Component

**File:** `src/modules/customers/components/CreateCustomerDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Drawer UI from shared components; React Hook Form with `zodResolver(customerFormSchema)`.
- Fields: first name*, last name*, email (optional, format), phone, address, city, country.
- Submit calls `useCreateCustomer`; use `toCustomerInsert` for payload.
- Toast success/error; close on success; show loading state.
- Props: `open`, `onOpenChange`.

---

## Task 5: Create EditCustomerDrawer Component

**File:** `src/modules/customers/components/EditCustomerDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Same form + validation as Create drawer, prefilled from `customer` prop (DB shape).
- Submit uses `useUpdateCustomer`; payload via `toCustomerUpdate`.
- Toast success/error; close on success.
- Props: `open`, `onOpenChange`, `customer: Customer`.

---

## Task 6: Create DeleteCustomerDialog Component

**File:** `src/modules/customers/components/DeleteCustomerDialog.tsx`  
**Action:** CREATE

**Key features:**
- AlertDialog UI with confirmation copy including customer full name/email.
- Uses `useDeleteCustomer`; loading state on destructive button; toast success/error.
- Props: `open`, `onOpenChange`, `customer: Customer`.

---

## Task 7: Build CustomersPage

**File:** `src/modules/customers/pages/CustomersPage.tsx`  
**Action:** CREATE

**Requirements:**
- Fetch data with `useCustomersList`; transform via `transformCustomersFromDb`.
- UI sections:
  - Header with title + description.
  - Actions: search input (debounced) filtering by `firstName`, `lastName`, `email`, `phone`; button "New Customer" opens Create drawer.
  - Table listing customers (similar styling to Orders table) with columns: Name, Email, Phone, City, Country, Created (relative or formatted), Actions.
  - Row actions: Edit → opens Edit drawer with selected customer; Delete → opens dialog.
- States:
  - Loading skeleton for table.
  - Empty state with CTA to create.
  - Error state with message + retry button (refetch).
- Toast on mutations handled in drawers/dialog.
- Keep module-local state for drawer/dialog open + selected customer.

---

## Task 8: Add Module Barrel

**File:** `src/modules/customers/index.ts`  
**Action:** CREATE

**Exports:**
- `CustomersPage` from pages.
- Components as needed (`CreateCustomerDrawer`, `EditCustomerDrawer`, `DeleteCustomerDialog`).
- Hooks and types if required externally.

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add route under `/dashboard`:
```tsx
import { CustomersPage } from "@/modules/customers";
...
<Route path="customers" element={<CustomersPage />} />
```

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:
- Title: "Customers"
- URL: `/dashboard/customers`
- Icon: `Users` (lucide-react)
- Position: under Management group, near Orders/Invoicing.

---

## Task 11: Validation & QA

**Actions:**
- `npm run lint` and `npm run build` (ensure no TS/ESLint errors).
- Manual flows:
  - Create customer → appears in list; drawer closes; toast shows.
  - Edit customer → changes reflected; drawer closes; toast shows.
  - Delete customer → removed from list; dialog closes; toast shows.
  - Search/filter covers name/email/phone; empty state renders when no results.
  - Navigation link and route render without console errors.

---

## Target File Tree

```
src/modules/customers/
├── components/
│   ├── CreateCustomerDrawer.tsx
│   ├── EditCustomerDrawer.tsx
│   └── DeleteCustomerDialog.tsx
├── hooks/
│   └── useCustomers.ts
├── pages/
│   └── CustomersPage.tsx
├── schemas/
│   └── customer.schema.ts
├── utils/
│   └── customerTransform.ts
└── index.ts
```

---

## Zod Schema Definition

```
customerFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
});
export type CustomerFormData = z.infer<typeof customerFormSchema>;
```

---

## Validation Checklist

- [ ] Routes include `/dashboard/customers` and render without errors.
- [ ] Sidebar shows "Customers" with correct icon and active state.
- [ ] Zod schema enforces required names and email format (when provided).
- [ ] Optional fields accept empty strings; payload normalizes to `null`.
- [ ] Query keys invalidate on create/update/delete; list refetches.
- [ ] Drawers/dialog close on success; toasts fire for success/error.
- [ ] Loading, empty, and error states render correctly.
- [ ] Search filters name/email/phone in-memory on fetched data.
- [ ] All imports use `@/` aliases; no relative cross-module leaks.
- [ ] `npm run lint` and `npm run build` succeed.

---

## Success Criteria

✅ Customers module delivers live Supabase CRUD with working drawers/dialog, searchable table, route/sidebar integration, and clean build with no console errors. Query invalidation keeps list in sync after create/update/delete.


