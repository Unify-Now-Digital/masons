# Implementation Plan: Workers/Team Module + Job Worker Assignments

**Branch:** `feature/workers-team-module-job-worker-assignments`  
**Specification:** `specs/workers-team-module-job-worker-assignments.md`

---

## Overview

This implementation plan adds a complete Workers (Team) module with CRUD operations and many-to-many Job ↔ Worker assignments. The plan is structured in 7 phases, from database schema creation through UI integration and polish.

**Goal:** Enable full worker management and job-worker assignment functionality while maintaining backward compatibility.

**Constraints:**
- Additive-only database changes (no destructive migrations)
- All new tables must have RLS enabled
- Follow existing app patterns (React Query, shadcn/ui, Zod validation)
- Maintain backward compatibility with existing Jobs functionality

---

## Phase 1 — Database (Additive Only)

### Task 1.1: Create Migration for `workers` Table

**File:** `supabase/migrations/YYYYMMDDHHmmss_create_workers_table.sql`

**Description:**
Create the core workers table with all required fields, constraints, RLS policies, and triggers.

**Migration Content:**
```sql
-- Create workers table
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text null,
  role text not null check (role in ('installer', 'driver', 'stonecutter', 'other')),
  notes text null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.workers enable row level security;

-- Create RLS policy (allow all authenticated users)
create policy "Allow all access to workers" on public.workers
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_workers_updated_at
  before update on public.workers
  for each row execute function public.update_updated_at_column();

-- Create indexes
create index if not exists idx_workers_is_active on public.workers(is_active);
create index if not exists idx_workers_role on public.workers(role);

-- Add table comment
comment on table public.workers is 'Internal workers/team members who can be assigned to jobs.';
```

**Validation:**
- Table created successfully
- RLS enabled
- Policy allows authenticated access
- Trigger created
- Indexes created

---

### Task 1.2: Create Migration for `worker_availability` Table

**File:** `supabase/migrations/YYYYMMDDHHmmss_create_worker_availability_table.sql`

**Description:**
Create worker availability table with weekly availability booleans and optional time windows.

**Migration Content:**
```sql
-- Create worker_availability table
create table if not exists public.worker_availability (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  mon_available boolean not null default true,
  tue_available boolean not null default true,
  wed_available boolean not null default true,
  thu_available boolean not null default true,
  fri_available boolean not null default true,
  sat_available boolean not null default false,
  sun_available boolean not null default false,
  start_time time null,
  end_time time null,
  notes text null,
  updated_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.worker_availability enable row level security;

-- Create RLS policy
create policy "Allow all access to worker_availability" on public.worker_availability
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_worker_availability_updated_at
  before update on public.worker_availability
  for each row execute function public.update_updated_at_column();

-- Add table comment
comment on table public.worker_availability is 'Weekly availability template for workers. Informational only, not enforced.';
```

**Validation:**
- Table created with correct defaults (Mon-Fri true, Sat-Sun false)
- Foreign key constraint on worker_id with cascade delete
- RLS enabled and policy created
- Trigger created

---

### Task 1.3: Create Migration for `job_workers` Join Table

**File:** `supabase/migrations/YYYYMMDDHHmmss_create_job_workers_table.sql`

**Description:**
Create many-to-many join table linking jobs and workers.

**Migration Content:**
```sql
-- Create job_workers join table
create table if not exists public.job_workers (
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete restrict,
  created_at timestamp with time zone not null default now(),
  primary key (job_id, worker_id)
);

-- Enable RLS
alter table public.job_workers enable row level security;

-- Create RLS policy
create policy "Allow all access to job_workers" on public.job_workers
  for all using (true) with check (true);

-- Create indexes for query performance
create index if not exists idx_job_workers_job_id on public.job_workers(job_id);
create index if not exists idx_job_workers_worker_id on public.job_workers(worker_id);

-- Add table comment
comment on table public.job_workers is 'Many-to-many relationship between jobs and workers.';
```

**Validation:**
- Composite primary key created
- Foreign keys with correct delete behavior (cascade for jobs, restrict for workers)
- Indexes created on both foreign keys
- RLS enabled

---

### Task 1.4: Validate Migrations Locally

**Action:** Test all migrations on local Supabase instance

**Validation Steps:**
1. Run migrations in order
2. Verify tables created correctly
3. Verify RLS policies work
4. Verify triggers fire correctly
5. Test foreign key constraints
6. Verify no errors or warnings

**Expected Outcome:**
- All migrations apply successfully
- No destructive changes detected
- All constraints and indexes created

---

## Phase 2 — Types & Data Access Layer

### Task 2.1: Create TypeScript Types

**File:** `src/modules/workers/types/workers.types.ts` (NEW)

**Description:**
Define TypeScript types for Worker, WorkerAvailability, and JobWorker entities.

**Types:**
```typescript
export interface Worker {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'installer' | 'driver' | 'stonecutter' | 'other';
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkerAvailability {
  worker_id: string;
  mon_available: boolean;
  tue_available: boolean;
  wed_available: boolean;
  thu_available: boolean;
  fri_available: boolean;
  sat_available: boolean;
  sun_available: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  updated_at: string;
}

export interface WorkerWithAvailability extends Worker {
  availability?: WorkerAvailability | null;
}

export interface JobWorker {
  job_id: string;
  worker_id: string;
  created_at: string;
}

export interface WorkerInsert {
  full_name: string;
  phone?: string | null;
  role: 'installer' | 'driver' | 'stonecutter' | 'other';
  notes?: string | null;
  is_active?: boolean;
}

export interface WorkerUpdate {
  full_name?: string;
  phone?: string | null;
  role?: 'installer' | 'driver' | 'stonecutter' | 'other';
  notes?: string | null;
  is_active?: boolean;
}

export interface WorkerAvailabilityInsert {
  worker_id: string;
  mon_available?: boolean;
  tue_available?: boolean;
  wed_available?: boolean;
  thu_available?: boolean;
  fri_available?: boolean;
  sat_available?: boolean;
  sun_available?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
}
```

**Validation:**
- All types match database schema
- Types are exported correctly
- Nullable fields properly typed

---

### Task 2.2: Create Workers API Functions

**File:** `src/modules/workers/api/workers.api.ts` (NEW)

**Description:**
Implement API functions for CRUD operations on workers and availability.

**Functions:**
```typescript
import { supabase } from '@/shared/lib/supabase';
import type { Worker, WorkerInsert, WorkerUpdate, WorkerAvailability, WorkerAvailabilityInsert } from '../types/workers.types';

export async function fetchWorkers(options?: { search?: string; activeOnly?: boolean }) {
  let query = supabase
    .from('workers')
    .select('*')
    .order('full_name', { ascending: true });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  if (options?.search) {
    const search = options.search.toLowerCase();
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Worker[];
}

export async function fetchWorker(id: string) {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Worker;
}

export async function fetchWorkerWithAvailability(id: string) {
  const { data, error } = await supabase
    .from('workers')
    .select('*, worker_availability(*)')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Worker & { worker_availability: WorkerAvailability | null };
}

export async function createWorker(worker: WorkerInsert) {
  const { data, error } = await supabase
    .from('workers')
    .insert(worker)
    .select()
    .single();
  
  if (error) throw error;
  return data as Worker;
}

export async function updateWorker(id: string, updates: WorkerUpdate) {
  const { data, error } = await supabase
    .from('workers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Worker;
}

export async function upsertWorkerAvailability(availability: WorkerAvailabilityInsert) {
  const { data, error } = await supabase
    .from('worker_availability')
    .upsert(availability, { onConflict: 'worker_id' })
    .select()
    .single();
  
  if (error) throw error;
  return data as WorkerAvailability;
}

export async function fetchWorkersByJob(jobId: string) {
  const { data, error } = await supabase
    .from('job_workers')
    .select('worker_id, workers(*)')
    .eq('job_id', jobId);
  
  if (error) throw error;
  return (data || []).map((item: any) => item.workers) as Worker[];
}

export async function setWorkersForJob(jobId: string, workerIds: string[]) {
  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from('job_workers')
    .delete()
    .eq('job_id', jobId);
  
  if (deleteError) throw deleteError;
  
  // Insert new assignments
  if (workerIds.length > 0) {
    const assignments = workerIds.map(workerId => ({
      job_id: jobId,
      worker_id: workerId,
    }));
    
    const { error: insertError } = await supabase
      .from('job_workers')
      .insert(assignments);
    
    if (insertError) throw insertError;
  }
  
  return { jobId, workerIds };
}
```

**Validation:**
- All functions handle errors correctly
- Query patterns match existing app style
- Types are correct

---

### Task 2.3: Create React Query Hooks

**File:** `src/modules/workers/hooks/useWorkers.ts` (NEW)

**Description:**
Create React Query hooks following existing patterns.

**Hooks:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkers,
  fetchWorker,
  fetchWorkerWithAvailability,
  createWorker,
  updateWorker,
  upsertWorkerAvailability,
  fetchWorkersByJob,
  setWorkersForJob,
} from '../api/workers.api';
import type { WorkerInsert, WorkerUpdate, WorkerAvailabilityInsert } from '../types/workers.types';

export const workersKeys = {
  all: ['workers'] as const,
  detail: (id: string) => ['workers', id] as const,
  byJob: (jobId: string) => ['workers', 'byJob', jobId] as const,
  list: (options?: { search?: string; activeOnly?: boolean }) => 
    ['workers', 'list', options] as const,
};

export function useWorkers(options?: { search?: string; activeOnly?: boolean }) {
  return useQuery({
    queryKey: workersKeys.list(options),
    queryFn: () => fetchWorkers(options),
  });
}

export function useWorker(id: string) {
  return useQuery({
    queryKey: workersKeys.detail(id),
    queryFn: () => fetchWorker(id),
    enabled: !!id,
  });
}

export function useWorkerWithAvailability(id: string) {
  return useQuery({
    queryKey: ['workers', id, 'withAvailability'],
    queryFn: () => fetchWorkerWithAvailability(id),
    enabled: !!id,
  });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (worker: WorkerInsert) => createWorker(worker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workersKeys.all });
    },
  });
}

export function useUpdateWorker() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: WorkerUpdate }) =>
      updateWorker(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workersKeys.all });
      queryClient.setQueryData(workersKeys.detail(data.id), data);
    },
  });
}

export function useUpsertWorkerAvailability() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (availability: WorkerAvailabilityInsert) =>
      upsertWorkerAvailability(availability),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workers', data.worker_id] });
    },
  });
}

export function useWorkersByJob(jobId: string) {
  return useQuery({
    queryKey: workersKeys.byJob(jobId),
    queryFn: () => fetchWorkersByJob(jobId),
    enabled: !!jobId,
  });
}

export function useSetWorkersForJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ jobId, workerIds }: { jobId: string; workerIds: string[] }) =>
      setWorkersForJob(jobId, workerIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workersKeys.byJob(data.jobId) });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
```

**Validation:**
- Query keys follow existing patterns
- Mutations invalidate correct queries
- Hooks are properly typed

---

### Task 2.4: Extend Jobs API for Worker Filtering

**File:** `src/modules/jobs/api/jobs.api.ts` (UPDATE or CREATE)

**Description:**
Add worker filtering support to jobs list query.

**Changes:**
```typescript
export async function fetchJobs(options?: { workerIds?: string[] }) {
  let query = supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.workerIds && options.workerIds.length > 0) {
    // Filter jobs that have any of the specified workers assigned
    query = query.in('id', 
      supabase
        .from('job_workers')
        .select('job_id')
        .in('worker_id', options.workerIds)
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Job[];
}
```

**Validation:**
- Filter works correctly with worker IDs
- Returns jobs that have at least one matching worker
- Handles empty workerIds array

---

## Phase 3 — Workers Module UI

### Task 3.1: Add Workers Route and Navigation

**Files:**
- `src/pages/Dashboard.tsx` (UPDATE) - Add `/workers` route
- Navigation component (UPDATE) - Add "Workers" nav item

**Changes:**
- Add route: `<Route path="workers" element={<WorkersPage />} />`
- Add nav item with icon

**Validation:**
- Route accessible
- Navigation item visible

---

### Task 3.2: Create Workers List Page

**File:** `src/modules/workers/pages/WorkersPage.tsx` (NEW)

**Description:**
Create main workers list page with search, active-only toggle, and table.

**Features:**
- Search input (name/phone)
- "Active only" toggle
- "New Worker" button
- Table with columns: Name, Role, Phone, Status, Actions
- Edit/Delete actions per row

**Validation:**
- Search works correctly
- Active-only toggle filters correctly
- Table displays all workers

---

### Task 3.3: Create Worker Form Components

**Files:**
- `src/modules/workers/components/CreateWorkerDrawer.tsx` (NEW)
- `src/modules/workers/components/EditWorkerDrawer.tsx` (NEW)
- `src/modules/workers/components/DeleteWorkerDialog.tsx` (NEW)

**Description:**
Create drawer components for creating/editing workers and soft-delete dialog.

**Form Fields:**
- Full name (required)
- Phone (optional)
- Role (select: installer/driver/stonecutter/other)
- Notes (optional textarea)
- Is Active (checkbox, default true)

**Validation:**
- Form validation with Zod schema
- Create/update works correctly
- Soft delete sets is_active=false

---

### Task 3.4: Create Availability Editor Component

**File:** `src/modules/workers/components/WorkerAvailabilityEditor.tsx` (NEW)

**Description:**
Create component for editing weekly availability.

**Features:**
- Checkbox for each weekday (Mon-Sun)
- Optional start_time and end_time inputs
- Optional notes field
- Save button

**Validation:**
- Availability saves correctly
- Defaults to Mon-Fri true, Sat-Sun false

---

## Phase 4 — Job Creation Integration

### Task 4.1: Extend CreateJobDrawer

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx` (UPDATE)

**Description:**
Add worker multi-select section to job creation form.

**Changes:**
- Add worker multi-select field
- Default to active workers only
- Include in form schema
- Save worker assignments on job creation

**Validation:**
- Workers can be selected during job creation
- Assignments saved correctly
- Non-blocking if no workers selected

---

## Phase 5 — Job Details Integration

### Task 5.1: Add Workers Card to Job Details

**File:** `src/modules/jobs/components/EditJobDrawer.tsx` or Job details view (UPDATE)

**Description:**
Display assigned workers as chips/avatars with "Assign" button.

**Features:**
- Show assigned workers as chips with initials
- "Assign Workers" button opens dialog
- Display worker name and role

**Validation:**
- Workers display correctly
- Chips show initials/name

---

### Task 5.2: Create Assign Workers Dialog

**File:** `src/modules/jobs/components/AssignWorkersDialog.tsx` (NEW)

**Description:**
Create dialog for assigning/unassigning workers to a job.

**Features:**
- Multi-select list of workers
- Toggle to include inactive workers
- Optional availability warning badges
- Save button replaces entire assignment list

**Validation:**
- Can assign multiple workers
- Can unassign all workers
- Save works correctly

---

## Phase 6 — Jobs List Filtering

### Task 6.1: Add Worker Filter Control

**File:** `src/modules/jobs/pages/JobsPage.tsx` (UPDATE)

**Description:**
Add worker filter to jobs list page.

**Features:**
- Multi-select dropdown for workers
- Filter jobs by selected worker(s)
- Combines with existing status/search filters

**Validation:**
- Filter works correctly
- Combines with other filters

---

## Phase 7 — UX Polish & Guardrails

### Task 7.1: Add Tooltips and Warnings

**Description:**
Add tooltips to worker chips showing name + role, optional availability warnings.

**Validation:**
- Tooltips display correctly
- Warnings appear when appropriate

---

### Task 7.2: Add Loading/Empty/Error States

**Description:**
Ensure all components have proper loading, empty, and error states.

**Validation:**
- States display correctly
- Error handling works

---

### Task 7.3: Final QA

**Actions:**
1. Run `npm run build` - must pass
2. Run `npm run lint` - must pass
3. Test all CRUD operations
4. Test job-worker assignments
5. Test filtering
6. Verify no regressions in Jobs/Map/Invoicing

**Validation:**
- All checks pass
- No regressions found

---

## Deliverables Summary

- ✅ Three database migrations (workers, worker_availability, job_workers)
- ✅ Complete Workers module (CRUD UI)
- ✅ Job-worker assignment functionality
- ✅ Jobs filtering by worker
- ✅ Weekly availability management
- ✅ All RLS policies enabled
- ✅ Backward compatible implementation

---

## Progress Tracking

- [ ] Phase 1: Database migrations
- [ ] Phase 2: Types & Data Access Layer
- [ ] Phase 3: Workers Module UI
- [ ] Phase 4: Job Creation Integration
- [ ] Phase 5: Job Details Integration
- [ ] Phase 6: Jobs List Filtering
- [ ] Phase 7: UX Polish & Guardrails

