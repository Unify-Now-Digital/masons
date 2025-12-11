# Implementation Plan: Memorials Module (Phase 1)

**Branch:** `feature/memorials-crud-integration`  
**Specification:** `specs/memorials-crud-integration-plan.md`

---

## Overview

Create a new Memorials CRUD module for managing client memorial records for installed/planned memorials. Each memorial MUST belong to an Order (order_id required) and can optionally link to a Job (job_id). Used for tracking installed memorials, status, condition, and inscriptions.

**Database Schema:** Already created in Supabase - `public.memorials` table exists with all required fields.

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create memorial schema | Create | `src/modules/memorials/schemas/memorial.schema.ts` | High | None |
| 2 | Create data transform utils | Create | `src/modules/memorials/utils/memorialTransform.ts` | High | None |
| 3 | Create CRUD hooks | Create | `src/modules/memorials/hooks/useMemorials.ts` | High | None |
| 4 | Create CreateMemorialDrawer | Create | `src/modules/memorials/components/CreateMemorialDrawer.tsx` | High | Tasks 1-3 |
| 5 | Create EditMemorialDrawer | Create | `src/modules/memorials/components/EditMemorialDrawer.tsx` | High | Tasks 1-3 |
| 6 | Create DeleteMemorialDialog | Create | `src/modules/memorials/components/DeleteMemorialDialog.tsx` | High | Task 3 |
| 7 | Build MemorialsPage | Create | `src/modules/memorials/pages/MemorialsPage.tsx` | High | Tasks 1-6 |
| 8 | Add module barrel | Create | `src/modules/memorials/index.ts` | Medium | Tasks 1-7 |
| 9 | Update router | Update | `src/app/router.tsx` | High | Task 8 |
| 10 | Update sidebar nav | Update | `src/app/layout/AppSidebar.tsx` | High | Task 8 |
| 11 | Validate build & lint | Verify | - | High | Tasks 1-10 |

---

## Task 1: Create Memorial Schema

**File:** `src/modules/memorials/schemas/memorial.schema.ts`  
**Action:** CREATE

**Content requirements:**
- Export `memorialFormSchema` using Zod.
- Required fields:
  - `orderId` (required, UUID string) - MUST belong to an Order
  - `deceasedName` (required, trimmed, min length 1)
  - `cemeteryName` (required, trimmed, min length 1)
  - `memorialType` (required, trimmed, min length 1)
  - `status` (required enum: 'planned' | 'in_progress' | 'installed' | 'removed', default 'planned')
- Optional fields:
  - `jobId` (optional, UUID string or null) - link to Job
  - `dateOfBirth` (optional, string date format or null)
  - `dateOfDeath` (optional, string date format or null)
  - `cemeterySection` (optional, trimmed string or null)
  - `cemeteryPlot` (optional, trimmed string or null)
  - `material` (optional, trimmed string or null)
  - `color` (optional, trimmed string or null)
  - `dimensions` (optional, trimmed string or null)
  - `inscriptionText` (optional, trimmed string or null)
  - `inscriptionLanguage` (optional, trimmed string or null)
  - `installationDate` (optional, string date format or null)
  - `condition` (optional, trimmed string or null)
  - `notes` (optional, trimmed string or null)
- Allow empty string for optional string fields via `.optional().or(z.literal(''))`.
- Export `MemorialFormData = z.infer<typeof memorialFormSchema>`.

**Schema Definition:**
```typescript
export const memorialFormSchema = z.object({
  orderId: z.string().uuid('Order is required'),
  jobId: z.string().uuid().optional().nullable(),
  deceasedName: z.string().trim().min(1, 'Deceased name is required'),
  dateOfBirth: z.string().optional().nullable(),
  dateOfDeath: z.string().optional().nullable(),
  cemeteryName: z.string().trim().min(1, 'Cemetery name is required'),
  cemeterySection: z.string().trim().optional().or(z.literal('')),
  cemeteryPlot: z.string().trim().optional().or(z.literal('')),
  memorialType: z.string().trim().min(1, 'Memorial type is required'),
  material: z.string().trim().optional().or(z.literal('')),
  color: z.string().trim().optional().or(z.literal('')),
  dimensions: z.string().trim().optional().or(z.literal('')),
  inscriptionText: z.string().trim().optional().or(z.literal('')),
  inscriptionLanguage: z.string().trim().optional().or(z.literal('')),
  installationDate: z.string().optional().nullable(),
  status: z.enum(['planned', 'in_progress', 'installed', 'removed']).default('planned'),
  condition: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type MemorialFormData = z.infer<typeof memorialFormSchema>;
```

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/memorials/utils/memorialTransform.ts`  
**Action:** CREATE

**Requirements:**
- Define `UIMemorial` interface (camelCase) with all fields in camelCase format.
- Export functions:
  - `transformMemorialFromDb(memorial)` → camelCase fields (`order_id` → `orderId`, `deceased_name` → `deceasedName`, `date_of_birth` → `dateOfBirth`, etc.).
  - `transformMemorialsFromDb(memorials)` → array map wrapper.
  - `toMemorialInsert(form: MemorialFormData)` → snake_case payload for Supabase insert (omit id/timestamps, normalize empty strings to `null` for optional fields, convert dates to ISO format or null).
  - `toMemorialUpdate(form: MemorialFormData)` → partial update payload with same normalization.
- Keep helpers pure; no Supabase imports.

**UIMemorial Interface:**
```typescript
export interface UIMemorial {
  id: string;
  orderId: string;
  jobId: string | null;
  deceasedName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  cemeteryName: string;
  cemeterySection: string | null;
  cemeteryPlot: string | null;
  memorialType: string;
  material: string | null;
  color: string | null;
  dimensions: string | null;
  inscriptionText: string | null;
  inscriptionLanguage: string | null;
  installationDate: string | null;
  status: 'planned' | 'in_progress' | 'installed' | 'removed';
  condition: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Transform Functions:**
```typescript
const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export function transformMemorialFromDb(memorial: Memorial): UIMemorial {
  return {
    id: memorial.id,
    orderId: memorial.order_id,
    jobId: memorial.job_id,
    deceasedName: memorial.deceased_name,
    dateOfBirth: memorial.date_of_birth || null,
    dateOfDeath: memorial.date_of_death || null,
    cemeteryName: memorial.cemetery_name,
    cemeterySection: memorial.cemetery_section || null,
    cemeteryPlot: memorial.cemetery_plot || null,
    memorialType: memorial.memorial_type,
    material: memorial.material || null,
    color: memorial.color || null,
    dimensions: memorial.dimensions || null,
    inscriptionText: memorial.inscription_text || null,
    inscriptionLanguage: memorial.inscription_language || null,
    installationDate: memorial.installation_date || null,
    status: memorial.status,
    condition: memorial.condition || null,
    notes: memorial.notes || null,
    createdAt: memorial.created_at,
    updatedAt: memorial.updated_at,
  };
}

export function transformMemorialsFromDb(memorials: Memorial[]): UIMemorial[] {
  return memorials.map(transformMemorialFromDb);
}

export function toMemorialInsert(form: MemorialFormData): MemorialInsert {
  return {
    order_id: form.orderId,
    job_id: form.jobId || null,
    deceased_name: form.deceasedName.trim(),
    date_of_birth: normalizeOptional(form.dateOfBirth),
    date_of_death: normalizeOptional(form.dateOfDeath),
    cemetery_name: form.cemeteryName.trim(),
    cemetery_section: normalizeOptional(form.cemeterySection),
    cemetery_plot: normalizeOptional(form.cemeteryPlot),
    memorial_type: form.memorialType.trim(),
    material: normalizeOptional(form.material),
    color: normalizeOptional(form.color),
    dimensions: normalizeOptional(form.dimensions),
    inscription_text: normalizeOptional(form.inscriptionText),
    inscription_language: normalizeOptional(form.inscriptionLanguage),
    installation_date: normalizeOptional(form.installationDate),
    status: form.status,
    condition: normalizeOptional(form.condition),
    notes: normalizeOptional(form.notes),
  };
}

export function toMemorialUpdate(form: MemorialFormData): MemorialUpdate {
  return {
    order_id: form.orderId,
    job_id: form.jobId || null,
    deceased_name: form.deceasedName.trim(),
    date_of_birth: normalizeOptional(form.dateOfBirth),
    date_of_death: normalizeOptional(form.dateOfDeath),
    cemetery_name: form.cemeteryName.trim(),
    cemetery_section: normalizeOptional(form.cemeterySection),
    cemetery_plot: normalizeOptional(form.cemeteryPlot),
    memorial_type: form.memorialType.trim(),
    material: normalizeOptional(form.material),
    color: normalizeOptional(form.color),
    dimensions: normalizeOptional(form.dimensions),
    inscription_text: normalizeOptional(form.inscriptionText),
    inscription_language: normalizeOptional(form.inscriptionLanguage),
    installation_date: normalizeOptional(form.installationDate),
    status: form.status,
    condition: normalizeOptional(form.condition),
    notes: normalizeOptional(form.notes),
  };
}
```

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/memorials/hooks/useMemorials.ts`  
**Action:** CREATE

**Requirements:**
- Use TanStack Query + Supabase client from `@/shared/lib/supabase`.
- Define query keys: `memorialsKeys = { all: ['memorials'], detail: (id) => ['memorials', id] }`.
- Implement hooks:
  - `useMemorialsList()` → fetch all memorials ordered by `installation_date DESC NULLS LAST`, then `created_at DESC`.
  - `useMemorial(id)` → fetch single (enabled when truthy).
  - `useCreateMemorial()` → insert via Supabase; on success invalidate `memorialsKeys.all`.
  - `useUpdateMemorial()` → update by id; on success invalidate list + set detail cache.
  - `useDeleteMemorial()` → delete by id; on success invalidate list.
- Shape Supabase interactions similar to orders/jobs API (throw on error, return typed rows).
- Types: create local `Memorial`/`MemorialInsert`/`MemorialUpdate` matching DB shape; export them for component use.

**Database Types:**
```typescript
export interface Memorial {
  id: string;
  order_id: string;
  job_id: string | null;
  deceased_name: string;
  date_of_birth: string | null;
  date_of_death: string | null;
  cemetery_name: string;
  cemetery_section: string | null;
  cemetery_plot: string | null;
  memorial_type: string;
  material: string | null;
  color: string | null;
  dimensions: string | null;
  inscription_text: string | null;
  inscription_language: string | null;
  installation_date: string | null;
  status: 'planned' | 'in_progress' | 'installed' | 'removed';
  condition: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type MemorialInsert = Omit<Memorial, 'id' | 'created_at' | 'updated_at'>;
export type MemorialUpdate = Partial<MemorialInsert>;
```

**Hook Implementation:**
```typescript
async function fetchMemorials() {
  const { data, error } = await supabase
    .from('memorials')
    .select('*')
    .order('installation_date', { ascending: false, nullsLast: true })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Memorial[];
}

async function fetchMemorial(id: string) {
  const { data, error } = await supabase
    .from('memorials')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function createMemorial(memorial: MemorialInsert) {
  const { data, error } = await supabase
    .from('memorials')
    .insert(memorial)
    .select()
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function updateMemorial(id: string, updates: MemorialUpdate) {
  const { data, error } = await supabase
    .from('memorials')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function deleteMemorial(id: string) {
  const { error } = await supabase
    .from('memorials')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
```

---

## Task 4: Create CreateMemorialDrawer Component

**File:** `src/modules/memorials/components/CreateMemorialDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Drawer UI from shared components; React Hook Form with `zodResolver(memorialFormSchema)`.
- Order dropdown:
  - Load orders from `useOrdersList()` hook (from Orders module).
  - When an order is selected, auto-fill:
    - `cemeteryName` from `order.location` (if available).
    - Optionally `material`/`color` from order if available (future enhancement).
- Fields organized in sections:
  - **Required Fields:**
    - Order* (Select dropdown - required)
    - Deceased Name* (Input - required)
    - Cemetery Name* (Input - required, auto-filled from order)
    - Memorial Type* (Input - required)
    - Status* (Select - required, default 'planned')
  - **Deceased Information:**
    - Date of Birth (Date picker - optional)
    - Date of Death (Date picker - optional)
  - **Cemetery Details:**
    - Cemetery Section (Input - optional)
    - Cemetery Plot (Input - optional)
  - **Memorial Details:**
    - Material (Input - optional)
    - Color (Input - optional)
    - Dimensions (Input - optional)
  - **Inscription:**
    - Inscription Text (Textarea - optional)
    - Inscription Language (Input - optional)
  - **Installation:**
    - Installation Date (Date picker - optional)
    - Condition (Input - optional)
  - **Links:**
    - Job (Select dropdown - optional, placeholder for now)
  - **Notes:**
    - Notes (Textarea - optional)
- Submit calls `useCreateMemorial`; use `toMemorialInsert` for payload.
- Toast success/error; close on success; show loading state.
- Props: `open`, `onOpenChange`.

**Order Auto-fill Logic:**
```typescript
const selectedOrderId = form.watch('orderId');
const selectedOrder = ordersData?.find((o) => o.id === selectedOrderId);

useEffect(() => {
  if (selectedOrder && open) {
    if (selectedOrder.location) {
      form.setValue('cemeteryName', selectedOrder.location);
    }
  }
}, [selectedOrder, open, form]);
```

---

## Task 5: Create EditMemorialDrawer Component

**File:** `src/modules/memorials/components/EditMemorialDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Same form + validation as Create drawer, prefilled from `memorial` prop (DB shape).
- Transform DB memorial to form data using transform utilities.
- Pre-fill all fields including dates (convert date strings to form format).
- Submit uses `useUpdateMemorial`; payload via `toMemorialUpdate`.
- Toast success/error; close on success.
- Props: `open`, `onOpenChange`, `memorial: Memorial`.

**Form Pre-fill:**
```typescript
const form = useForm<MemorialFormData>({
  resolver: zodResolver(memorialFormSchema),
  defaultValues: {
    orderId: memorial.order_id,
    jobId: memorial.job_id || null,
    deceasedName: memorial.deceased_name,
    dateOfBirth: memorial.date_of_birth || null,
    dateOfDeath: memorial.date_of_death || null,
    cemeteryName: memorial.cemetery_name,
    cemeterySection: memorial.cemetery_section || '',
    cemeteryPlot: memorial.cemetery_plot || '',
    memorialType: memorial.memorial_type,
    material: memorial.material || '',
    color: memorial.color || '',
    dimensions: memorial.dimensions || '',
    inscriptionText: memorial.inscription_text || '',
    inscriptionLanguage: memorial.inscription_language || '',
    installationDate: memorial.installation_date || null,
    status: memorial.status,
    condition: memorial.condition || '',
    notes: memorial.notes || '',
  },
});
```

---

## Task 6: Create DeleteMemorialDialog Component

**File:** `src/modules/memorials/components/DeleteMemorialDialog.tsx`  
**Action:** CREATE

**Key features:**
- AlertDialog UI with confirmation copy including deceased name and cemetery name.
- Uses `useDeleteMemorial`; loading state on destructive button; toast success/error.
- Props: `open`, `onOpenChange`, `memorial: Memorial`.

**Dialog Content:**
```typescript
<AlertDialogDescription>
  Are you sure you want to delete the memorial for {memorial.deceased_name} at {memorial.cemetery_name}?
  This action cannot be undone.
</AlertDialogDescription>
```

---

## Task 7: Build MemorialsPage

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`  
**Action:** CREATE

**Requirements:**
- Fetch data with `useMemorialsList`; transform via `transformMemorialsFromDb`.
- UI sections:
  - Header with title "Memorials" + description "Manage client memorial records for installed/planned memorials".
  - Actions:
    - Search input (debounced) filtering by `deceasedName`, `cemeteryName`, `cemeteryPlot`, `memorialType`.
    - Status filter dropdown: planned / in_progress / installed / removed / all.
    - Button "New Memorial" opens Create drawer.
  - Table listing memorials (similar styling to Orders/Jobs table) with columns:
    - Deceased (deceasedName)
    - Cemetery (cemeteryName + section/plot if available)
    - Memorial Type
    - Status (with badge styling)
    - Installation Date (formatted, or "Not installed" if null)
    - Linked Order (show order ID or customer name from order)
    - Actions (Edit, Delete)
  - Row actions: Edit → opens Edit drawer with selected memorial; Delete → opens dialog.
- States:
  - Loading skeleton for table.
  - Empty state with CTA to create.
  - Error state with message + retry button (refetch).
- Toast on mutations handled in drawers/dialog.
- Keep module-local state for drawer/dialog open + selected memorial.

**Search Filter Logic:**
```typescript
const filteredMemorials = useMemo(() => {
  if (!memorials) return [];
  
  let filtered = memorials;
  
  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.deceasedName.toLowerCase().includes(query) ||
        m.cemeteryName.toLowerCase().includes(query) ||
        (m.cemeteryPlot && m.cemeteryPlot.toLowerCase().includes(query)) ||
        m.memorialType.toLowerCase().includes(query)
    );
  }
  
  // Status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter((m) => m.status === statusFilter);
  }
  
  return filtered;
}, [memorials, searchQuery, statusFilter]);
```

---

## Task 8: Add Module Barrel

**File:** `src/modules/memorials/index.ts`  
**Action:** CREATE

**Exports:**
- `MemorialsPage` from pages.
- Components: `CreateMemorialDrawer`, `EditMemorialDrawer`, `DeleteMemorialDialog`.
- Hooks and types if required externally.

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add route under `/dashboard`:
```tsx
import { MemorialsPage } from "@/modules/memorials";
...
<Route path="memorials" element={<MemorialsPage />} />
```

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:
- Title: "Memorials"
- URL: `/dashboard/memorials`
- Icon: `Landmark` or `GalleryHorizontal` (lucide-react) - choose closest match
- Position: under operational section, near Orders/Jobs/Memorials.

**Icon Import:**
```tsx
import { Landmark } from 'lucide-react';
// or
import { GalleryHorizontal } from 'lucide-react';
```

---

## Task 11: Validation & QA

**Actions:**
- `npm run lint` and `npm run build` (ensure no TS/ESLint errors).
- Manual flows:
  - Create memorial → appears in list; drawer closes; toast shows.
  - Edit memorial → changes reflected; drawer closes; toast shows.
  - Delete memorial → removed from list; dialog closes; toast shows.
  - Search/filter covers deceasedName/cemeteryName/cemeteryPlot/memorialType; empty state renders when no results.
  - Status filter works correctly.
  - Order dropdown loads and auto-fills cemetery name.
  - Date fields format correctly (display and save).
  - Navigation link and route render without console errors.

---

## Target File Tree

```
src/modules/memorials/
├── components/
│   ├── CreateMemorialDrawer.tsx
│   ├── EditMemorialDrawer.tsx
│   └── DeleteMemorialDialog.tsx
├── hooks/
│   └── useMemorials.ts
├── pages/
│   └── MemorialsPage.tsx
├── schemas/
│   └── memorial.schema.ts
├── utils/
│   └── memorialTransform.ts
└── index.ts
```

---

## Database Schema Reference

**Table:** `public.memorials` (already exists in Supabase)

**Fields:**
- `id` uuid PK
- `order_id` uuid NOT NULL FK → public.orders(id) ON DELETE CASCADE
- `job_id` uuid NULL FK → public.jobs(id) ON DELETE SET NULL
- `deceased_name` text NOT NULL
- `date_of_birth` date NULL
- `date_of_death` date NULL
- `cemetery_name` text NOT NULL
- `cemetery_section` text NULL
- `cemetery_plot` text NULL
- `memorial_type` text NOT NULL
- `material` text NULL
- `color` text NULL
- `dimensions` text NULL
- `inscription_text` text NULL
- `inscription_language` text NULL
- `installation_date` date NULL
- `status` text DEFAULT 'planned' CHECK (status in ('planned','in_progress','installed','removed'))
- `condition` text NULL
- `notes` text NULL
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

**Note:** Table already exists - no migration needed.

---

## Validation Checklist

- [ ] Routes include `/dashboard/memorials` and render without errors.
- [ ] Sidebar shows "Memorials" with appropriate icon and active state.
- [ ] Zod schema enforces required fields: orderId, deceasedName, cemeteryName, memorialType, status.
- [ ] Optional fields accept empty strings; payload normalizes to `null`.
- [ ] Date fields (dateOfBirth, dateOfDeath, installationDate) format correctly for display and database.
- [ ] Query keys invalidate on create/update/delete; list refetches.
- [ ] Drawers/dialog close on success; toasts fire for success/error.
- [ ] Loading, empty, and error states render correctly.
- [ ] Search filters deceasedName/cemeteryName/cemeteryPlot/memorialType in-memory on fetched data.
- [ ] Status filter works correctly (planned/in_progress/installed/removed/all).
- [ ] Table displays cemetery info (name + section/plot) correctly.
- [ ] Installation date displays formatted or "Not installed" if null.
- [ ] Linked order displays order ID or customer name.
- [ ] Order dropdown loads from useOrdersList and auto-fills cemeteryName.
- [ ] Job dropdown placeholder works (optional field).
- [ ] All imports use `@/` aliases; no relative cross-module leaks.
- [ ] `npm run lint` and `npm run build` succeed.
- [ ] No TypeScript errors; all types properly exported.
- [ ] Transform functions correctly map dates (date strings ↔ form dates).
- [ ] Transform functions correctly map status enum.
- [ ] No usage of `any` types.
- [ ] No changes to existing modules (Orders, Jobs, Map, Customers, Companies, Invoicing).

---

## Success Criteria

✅ Memorials module delivers live Supabase CRUD with working drawers/dialog, searchable table with status filtering, route/sidebar integration, and clean build with no console errors. Query invalidation keeps list in sync after create/update/delete. Order dropdown auto-fills cemetery name. All date fields format correctly. Memorial MUST belong to an Order (order_id required).

---

## Implementation Notes

### Order Requirement
- Every memorial MUST have an `order_id` - this is enforced at the database level (NOT NULL constraint).
- The form should require order selection before allowing submission.
- When an order is selected, auto-fill cemetery name from order.location if available.

### Job Link (Optional)
- `job_id` is optional - memorials can exist without being linked to a job.
- For Phase 1, the job dropdown can be a simple placeholder or basic select.
- Future Phase 2: Enhance job selection with proper job list loading.

### Date Handling
- Dates come from database as date strings (YYYY-MM-DD format).
- Form fields use date pickers that output ISO date strings.
- Transform functions handle conversion between date strings and form values.
- Display dates formatted using date-fns `format()` function.

### Status Values
- Status enum: 'planned' | 'in_progress' | 'installed' | 'removed'
- Default: 'planned'
- Display with badge styling (similar to Jobs status badges).

### Cemetery Information
- Cemetery name is required.
- Cemetery section and plot are optional.
- Display format: "Cemetery Name" or "Cemetery Name - Section Plot" if both available.

### Memorial Type
- Free-form text input for Phase 1.
- Future Phase 2: Could be a dropdown with predefined types.

---

*Specification created: Memorials Module Phase 1 CRUD Integration*  
*Ready for implementation via `/plan` command*

