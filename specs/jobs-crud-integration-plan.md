# Implementation Plan: Jobs Module (Phase 1)

**Branch:** `feature/jobs-crud-integration`  
**Specification:** `specs/jobs-crud-integration-plan.md`

---

## Overview

Create a new Jobs CRUD module for managing installation/scheduling jobs. This module is separate from the Map module (`/modules/map`) and focuses on operational workflow management. Jobs can be linked to Orders and track status, dates, duration, priority, and notes.

**Note:** This is a NEW module at `src/modules/jobs/` - distinct from the Map module now at `src/modules/map/`.

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create job schema | Create | `src/modules/jobs/schemas/job.schema.ts` | High | None |
| 2 | Create data transform utils | Create | `src/modules/jobs/utils/jobTransform.ts` | High | None |
| 3 | Create CRUD hooks | Create | `src/modules/jobs/hooks/useJobs.ts` | High | None |
| 4 | Create CreateJobDrawer | Create | `src/modules/jobs/components/CreateJobDrawer.tsx` | High | Tasks 1-3 |
| 5 | Create EditJobDrawer | Create | `src/modules/jobs/components/EditJobDrawer.tsx` | High | Tasks 1-3 |
| 6 | Create DeleteJobDialog | Create | `src/modules/jobs/components/DeleteJobDialog.tsx` | High | Task 3 |
| 7 | Build JobsPage | Create | `src/modules/jobs/pages/JobsPage.tsx` | High | Tasks 1-6 |
| 8 | Add module barrel | Create | `src/modules/jobs/index.ts` | Medium | Tasks 1-7 |
| 9 | Update router | Update | `src/app/router.tsx` | High | Task 8 |
| 10 | Update sidebar nav | Update | `src/app/layout/AppSidebar.tsx` | High | Task 8 |
| 11 | Validate build & lint | Verify | - | High | Tasks 1-10 |

---

## Task 1: Create Job Schema

**File:** `src/modules/jobs/schemas/job.schema.ts`  
**Action:** CREATE

**Content requirements:**
- Export `jobFormSchema` using Zod.
- Fields:
  - `order_id` (optional, UUID string or null)
  - `customer_name` (required, trimmed, min length 1)
  - `location_name` (required, trimmed, min length 1) - cemetery/location name
  - `address` (required, trimmed, min length 1)
  - `latitude` (optional, number, nullable)
  - `longitude` (optional, number, nullable)
  - `status` (required enum: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled')
  - `scheduled_date` (optional, string date format or null)
  - `estimated_duration` (optional, trimmed string or null) - e.g., "2 hours", "4 hours"
  - `priority` (required enum: 'low' | 'medium' | 'high', default 'medium')
  - `notes` (optional, trimmed string or null)
- Allow empty string for optional string fields via `.optional().or(z.literal(''))`.
- Export `JobFormData = z.infer<typeof jobFormSchema>`.

**Schema Definition:**
```typescript
export const jobFormSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().trim().min(1, 'Customer name is required'),
  location_name: z.string().trim().min(1, 'Location name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: z.enum(['scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled']).default('scheduled'),
  scheduled_date: z.string().optional().nullable(),
  estimated_duration: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().optional().or(z.literal('')),
});
```

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/jobs/utils/jobTransform.ts`  
**Action:** CREATE

**Requirements:**
- Define `UIJob` interface (camelCase) with: `id`, `orderId`, `customerName`, `locationName`, `address`, `latitude`, `longitude`, `status`, `scheduledDate`, `estimatedDuration`, `priority`, `notes`, `createdAt`, `updatedAt`.
- Export functions:
  - `transformJobFromDb(job)` → camelCase fields (`order_id` → `orderId`, `customer_name` → `customerName`, etc.).
  - `transformJobsFromDb(jobs)` → array map wrapper.
  - `toJobInsert(form: JobFormData)` → snake_case payload for Supabase insert (omit id/timestamps, normalize empty strings to `null` for optional fields).
  - `toJobUpdate(form: JobFormData)` → partial update payload with same normalization.
- Keep helpers pure; no Supabase imports.

**Transform Functions:**
```typescript
// DB → UI
export function transformJobFromDb(job: Job): UIJob {
  return {
    id: job.id,
    orderId: job.order_id,
    customerName: job.customer_name,
    locationName: job.location_name,
    address: job.address,
    latitude: job.latitude,
    longitude: job.longitude,
    status: job.status,
    scheduledDate: job.scheduled_date || '',
    estimatedDuration: job.estimated_duration || '',
    priority: job.priority,
    notes: job.notes || '',
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

// UI → DB (Insert)
export function toJobInsert(form: JobFormData): JobInsert {
  return {
    order_id: form.order_id || null,
    customer_name: form.customer_name,
    location_name: form.location_name,
    address: form.address,
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    status: form.status,
    scheduled_date: form.scheduled_date || null,
    estimated_duration: form.estimated_duration || null,
    priority: form.priority,
    notes: form.notes || null,
  };
}
```

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/jobs/hooks/useJobs.ts`  
**Action:** CREATE

**Requirements:**
- Use TanStack Query + Supabase client from `@/shared/lib/supabase`.
- Define query keys: `jobsKeys = { all: ['jobs'], detail: (id) => ['jobs', id] }`.
- Implement hooks:
  - `useJobsList()` → fetch all jobs ordered by `scheduled_date` asc (nulls last), then `created_at` desc.
  - `useJob(id)` → fetch single (enabled when truthy).
  - `useCreateJob()` → insert via Supabase; on success invalidate `jobsKeys.all`.
  - `useUpdateJob()` → update by id; on success invalidate list + set detail cache.
  - `useDeleteJob()` → delete by id; on success invalidate list.
- Shape Supabase interactions similar to orders/customers API (throw on error, return typed rows).
- Types: create local `Job`/`JobInsert`/`JobUpdate` matching DB shape; export them for component use.

**Database Types:**
```typescript
export interface Job {
  id: string;
  order_id: string | null;
  customer_name: string;
  location_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
  scheduled_date: string | null;
  estimated_duration: string | null;
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type JobInsert = Omit<Job, 'id' | 'created_at' | 'updated_at'>;
export type JobUpdate = Partial<JobInsert>;
```

**Query Ordering:**
```typescript
async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Job[];
}
```

---

## Task 4: Create CreateJobDrawer Component

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Drawer UI from shared components; React Hook Form with `zodResolver(jobFormSchema)`.
- Fields:
  - **Order Selection** (Select dropdown):
    - Fetch orders using `useOrdersList()` hook
    - Display order ID + customer name
    - Optional field (can be null)
    - When order selected → auto-fill customer_name and location_name from order
  - **Customer Name*** (required, Input)
  - **Location Name*** (required, Input) - cemetery/location
  - **Address*** (required, Input)
  - **Status** (Select dropdown, required, default 'scheduled')
  - **Scheduled Date** (Date picker, optional)
  - **Priority** (Select dropdown, required, default 'medium')
  - **Estimated Duration** (Input, optional) - e.g., "2 hours"
  - **Latitude/Longitude** (Number inputs, optional) - for map integration
  - **Notes** (Textarea, optional)
- Submit calls `useCreateJob`; use `toJobInsert` for payload.
- Toast success/error; close on success; show loading state.
- Props: `open`, `onOpenChange`.

**Order Auto-fill Logic:**
```typescript
// When order_id changes, fetch order and populate fields
const selectedOrder = ordersData?.find(o => o.id === form.watch('order_id'));
useEffect(() => {
  if (selectedOrder) {
    form.setValue('customer_name', selectedOrder.customer_name);
    form.setValue('location_name', selectedOrder.location || '');
  }
}, [selectedOrder, form]);
```

---

## Task 5: Create EditJobDrawer Component

**File:** `src/modules/jobs/components/EditJobDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Same form + validation as Create drawer, prefilled from `job` prop (DB shape).
- Pre-fill all fields from existing job data.
- Order selection shows current order if linked.
- Submit uses `useUpdateJob`; payload via `toJobUpdate`.
- Toast success/error; close on success.
- Props: `open`, `onOpenChange`, `job: Job`.

**Default Values:**
```typescript
defaultValues: {
  order_id: job.order_id || null,
  customer_name: job.customer_name,
  location_name: job.location_name,
  address: job.address,
  latitude: job.latitude || null,
  longitude: job.longitude || null,
  status: job.status,
  scheduled_date: job.scheduled_date || null,
  estimated_duration: job.estimated_duration || '',
  priority: job.priority,
  notes: job.notes || '',
}
```

---

## Task 6: Create DeleteJobDialog Component

**File:** `src/modules/jobs/components/DeleteJobDialog.tsx`  
**Action:** CREATE

**Key features:**
- AlertDialog UI with confirmation copy including job customer name, location, and status.
- Uses `useDeleteJob`; loading state on destructive button; toast success/error.
- Props: `open`, `onOpenChange`, `job: Job`.

**Confirmation Message:**
```typescript
<AlertDialogDescription>
  This action cannot be undone. This will permanently delete the job for{' '}
  <strong>{job.customer_name}</strong> at <strong>{job.location_name}</strong>
  {job.status && ` (Status: ${job.status.replace('_', ' ')})`}.
</AlertDialogDescription>
```

---

## Task 7: Build JobsPage

**File:** `src/modules/jobs/pages/JobsPage.tsx`  
**Action:** CREATE

**Requirements:**
- Fetch data with `useJobsList`; transform via `transformJobsFromDb`.
- UI sections:
  - Header with title + description ("Manage installation jobs and schedules").
  - Actions:
    - Search input (debounced) filtering by `customerName`, `address`, `locationName`.
    - Status filter dropdown (optional) - filter by status enum values.
    - Date range filter (optional, Phase 1 can be simple) - filter by scheduled_date.
    - Button "New Job" opens Create drawer.
  - Table listing jobs (similar styling to Orders/Customers table) with columns:
    - Customer Name
    - Location
    - Address
    - Status (with color-coded badge)
    - Scheduled Date (formatted, or "Not scheduled")
    - Priority (with icon/color)
    - Duration
    - Created (relative or formatted)
    - Actions (Edit, Delete)
  - Row actions: Edit → opens Edit drawer with selected job; Delete → opens dialog.
- States:
  - Loading skeleton for table.
  - Empty state with CTA to create.
  - Error state with message + retry button (refetch).
- Toast on mutations handled in drawers/dialog.
- Keep module-local state for drawer/dialog open + selected job.

**Status Badge Colors:**
- `scheduled`: blue
- `in_progress`: yellow
- `ready_for_installation`: green
- `completed`: gray
- `cancelled`: red

**Priority Display:**
- `high`: red icon/text
- `medium`: yellow icon/text
- `low`: green icon/text

---

## Task 8: Add Module Barrel

**File:** `src/modules/jobs/index.ts`  
**Action:** CREATE

**Exports:**
- `JobsPage` from pages.
- Components as needed (`CreateJobDrawer`, `EditJobDrawer`, `DeleteJobDialog`).
- Hooks and types if required externally.

```typescript
export { JobsPage } from './pages/JobsPage';
export { CreateJobDrawer } from './components/CreateJobDrawer';
export { EditJobDrawer } from './components/EditJobDrawer';
export { DeleteJobDialog } from './components/DeleteJobDialog';
export * from './hooks/useJobs';
export * from './schemas/job.schema';
export * from './utils/jobTransform';
```

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add route under `/dashboard`:
```tsx
import { JobsPage } from "@/modules/jobs";
...
<Route path="jobs" element={<JobsPage />} />
```

**Full context:**
```typescript
<Route path="/dashboard" element={<DashboardLayout />}>
  {/* ... existing routes ... */}
  <Route path="jobs" element={<JobsPage />} />
  {/* ... other routes ... */}
</Route>
```

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:
- Title: "Jobs"
- URL: `/dashboard/jobs`
- Icon: `Hammer` or `Wrench` or `Briefcase` (lucide-react) - choose Workbench/Hammer icon as requested
- Position: under Management group, near Orders/Map.

**Import:**
```typescript
import { Hammer } from 'lucide-react';
// or
import { Wrench } from 'lucide-react';
// or
import { Briefcase } from 'lucide-react';
```

**Navigation Item:**
```typescript
const navigationItems = [
  // ... existing items ...
  { title: "Jobs", url: "/dashboard/jobs", icon: Hammer }, // or Wrench/Briefcase
];
```

---

## Task 11: Validation & QA

**Actions:**
- `npm run lint` and `npm run build` (ensure no TS/ESLint errors).
- Manual flows:
  - Create job → appears in list; drawer closes; toast shows.
  - Create job with order selected → customer/location auto-filled.
  - Edit job → changes reflected; drawer closes; toast shows.
  - Delete job → removed from list; dialog closes; toast shows.
  - Search/filter covers customer/address/location; empty state renders when no results.
  - Status filter works correctly.
  - Navigation link and route render without console errors.

---

## Target File Tree

```
src/modules/jobs/
├── components/
│   ├── CreateJobDrawer.tsx
│   ├── EditJobDrawer.tsx
│   └── DeleteJobDialog.tsx
├── hooks/
│   └── useJobs.ts
├── pages/
│   └── JobsPage.tsx
├── schemas/
│   └── job.schema.ts
├── utils/
│   └── jobTransform.ts
└── index.ts
```

---

## Zod Schema Definition

```typescript
import { z } from 'zod';

export const jobFormSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().trim().min(1, 'Customer name is required'),
  location_name: z.string().trim().min(1, 'Location name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: z.enum(['scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled']).default('scheduled'),
  scheduled_date: z.string().optional().nullable(),
  estimated_duration: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type JobFormData = z.infer<typeof jobFormSchema>;
```

**Validation Rules:**
- `customer_name`, `location_name`, `address` are required
- `order_id` must be valid UUID if provided
- `status` defaults to 'scheduled'
- `priority` defaults to 'medium'
- `latitude`/`longitude` are numbers or null
- `scheduled_date` is ISO date string or null

---

## Database Schema Reference

**Table:** `jobs` (already exists in Supabase)

**Columns:**
- `id` (uuid, PK)
- `order_id` (uuid, FK to orders, nullable)
- `customer_name` (text, required)
- `location_name` (text, required) - cemetery/location name
- `address` (text, required)
- `latitude` (numeric, nullable)
- `longitude` (numeric, nullable)
- `status` (enum: scheduled, in_progress, ready_for_installation, completed, cancelled)
- `scheduled_date` (date, nullable)
- `estimated_duration` (text, nullable) - e.g., "2 hours"
- `priority` (enum: low, medium, high)
- `notes` (text, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Note:** Table already exists - no migration needed for Phase 1.

---

## Transform Utilities Details

**File:** `src/modules/jobs/utils/jobTransform.ts`

**Functions:**

```typescript
import type { Job, JobInsert, JobUpdate } from '../hooks/useJobs';
import type { JobFormData } from '../schemas/job.schema';

// UI-friendly job format (camelCase)
export interface UIJob {
  id: string;
  orderId: string | null;
  customerName: string;
  locationName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  scheduledDate: string;
  estimatedDuration: string;
  priority: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transform database job to UI-friendly format
 */
export function transformJobFromDb(job: Job): UIJob {
  return {
    id: job.id,
    orderId: job.order_id,
    customerName: job.customer_name,
    locationName: job.location_name,
    address: job.address,
    latitude: job.latitude,
    longitude: job.longitude,
    status: job.status,
    scheduledDate: job.scheduled_date || '',
    estimatedDuration: job.estimated_duration || '',
    priority: job.priority,
    notes: job.notes || '',
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

/**
 * Transform array of database jobs to UI format
 */
export function transformJobsFromDb(jobs: Job[]): UIJob[] {
  return jobs.map(transformJobFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toJobInsert(form: JobFormData): JobInsert {
  return {
    order_id: form.order_id || null,
    customer_name: form.customer_name,
    location_name: form.location_name,
    address: form.address,
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    status: form.status,
    scheduled_date: form.scheduled_date || null,
    estimated_duration: form.estimated_duration || null,
    priority: form.priority,
    notes: form.notes || null,
  };
}

/**
 * Convert form data to database update payload
 */
export function toJobUpdate(form: JobFormData): JobUpdate {
  return {
    order_id: form.order_id || null,
    customer_name: form.customer_name,
    location_name: form.location_name,
    address: form.address,
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    status: form.status,
    scheduled_date: form.scheduled_date || null,
    estimated_duration: form.estimated_duration || null,
    priority: form.priority,
    notes: form.notes || null,
  };
}
```

---

## Order Integration Details

**Order Auto-fill in CreateJobDrawer:**

1. Fetch orders using `useOrdersList()` hook from `@/modules/orders`.
2. Display orders in Select dropdown:
   - Format: `{order.id} - {order.customer_name}`
   - Allow "None" option for unlinked jobs
3. When order selected:
   - Auto-fill `customer_name` from `order.customer_name`
   - Auto-fill `location_name` from `order.location` (if available)
   - Optionally auto-fill address if available
4. User can still edit auto-filled fields manually.

**Implementation Pattern:**
```typescript
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

const { data: ordersData } = useOrdersList();
const selectedOrderId = form.watch('order_id');
const selectedOrder = ordersData?.find(o => o.id === selectedOrderId);

useEffect(() => {
  if (selectedOrder) {
    form.setValue('customer_name', selectedOrder.customer_name);
    form.setValue('location_name', selectedOrder.location || '');
  }
}, [selectedOrder, form]);
```

---

## Validation Checklist

- [ ] Routes include `/dashboard/jobs` and render without errors
- [ ] Sidebar shows "Jobs" with Hammer/Wrench icon and active state
- [ ] Zod schema enforces required fields (customer_name, location_name, address)
- [ ] Status enum validation works correctly
- [ ] Priority enum validation works correctly
- [ ] Optional fields accept empty strings; payload normalizes to `null`
- [ ] Order selection dropdown works and auto-fills customer/location
- [ ] Query keys invalidate on create/update/delete; list refetches
- [ ] Drawers/dialog close on success; toasts fire for success/error
- [ ] Loading, empty, and error states render correctly
- [ ] Search filters customer/address/location in-memory on fetched data
- [ ] Status filter works correctly
- [ ] Table displays status badges with correct colors
- [ ] Table displays priority with correct styling
- [ ] Scheduled date displays correctly (formatted or "Not scheduled")
- [ ] All imports use `@/` aliases; no relative cross-module leaks
- [ ] `npm run lint` and `npm run build` succeed
- [ ] No TypeScript errors; all types properly exported
- [ ] Database table `jobs` exists and is accessible
- [ ] Order linking works (order_id FK relationship)

---

## Success Criteria

✅ Jobs module delivers live Supabase CRUD with working drawers/dialog, searchable table, route/sidebar integration, and clean build with no console errors. Query invalidation keeps list in sync after create/update/delete. Order integration allows linking jobs to orders with auto-fill functionality.

---

## Implementation Notes

### Order Integration
- Jobs can be linked to Orders via `order_id` foreign key
- When order selected, customer name and location auto-fill
- Jobs can exist without orders (standalone jobs)
- Order selection is optional but recommended for workflow tracking

### Status Workflow
- `scheduled` → Initial state
- `in_progress` → Job started
- `ready_for_installation` → Ready to install
- `completed` → Job finished
- `cancelled` → Job cancelled

### Priority Levels
- `high` → Urgent jobs (red styling)
- `medium` → Normal priority (yellow styling)
- `low` → Low priority (green styling)

### Date Handling
- `scheduled_date` stored as ISO date string or null
- Display formatted date or "Not scheduled" if null
- Date picker component from shadcn/ui

### Coordinates
- `latitude`/`longitude` optional for map integration
- Can be used by Map module (`/modules/map`) to display job locations
- Stored as numbers or null

### Module Distinction
- **Jobs Module** (`/modules/jobs`): CRUD for job records, workflow management
- **Map Module** (`/modules/map`): Visual map display, route optimization
- Both can share the same `jobs` database table
- Map module can read jobs data for display

---

## Form Field Details

### Order Selection
- **Type:** Select dropdown
- **Source:** `useOrdersList()` from orders module
- **Display:** `{order.id} - {order.customer_name}`
- **Optional:** Yes (can be null)
- **Auto-fill:** Customer name, location name when selected

### Status Selection
- **Type:** Select dropdown
- **Options:** scheduled, in_progress, ready_for_installation, completed, cancelled
- **Default:** scheduled
- **Required:** Yes

### Priority Selection
- **Type:** Select dropdown
- **Options:** low, medium, high
- **Default:** medium
- **Required:** Yes

### Scheduled Date
- **Type:** Date picker (shadcn/ui Calendar component)
- **Format:** ISO date string (YYYY-MM-DD)
- **Optional:** Yes
- **Display:** Formatted date or "Not scheduled"

### Estimated Duration
- **Type:** Text input
- **Format:** Free text (e.g., "2 hours", "4 hours", "1 day")
- **Optional:** Yes
- **Examples:** "2 hours", "4 hours", "1 day", "30 minutes"

---

*Specification created: Jobs Module Phase 1 CRUD Integration*  
*Ready for implementation via `/plan` command*

