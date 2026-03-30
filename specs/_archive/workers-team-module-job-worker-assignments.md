# Workers/Team Module + Job Worker Assignments

## Overview

Add a new **Workers (Team)** module to manage internal workers and allow assigning **multiple workers to a Job** (many-to-many relationship). Show assigned workers as **chips/avatars** with an **Assign** button. Include a simple **weekly availability** template per worker (non-blocking, informational).

**Context:**
- The app currently has a Jobs module that manages installation jobs
- Jobs can be created from Orders and have basic status tracking
- There is no current system for managing team members or assigning workers to jobs
- The app uses Supabase (PostgreSQL) with RLS policies for data access
- React Query hooks pattern is used for all data fetching and mutations
- UI follows shadcn/ui component patterns with React Hook Form + Zod validation

**Goal:**
- Enable CRUD operations for Workers (team members)
- Support many-to-many relationship between Jobs and Workers
- Display worker assignments in Job UI (chips/avatars)
- Allow filtering Jobs by assigned worker(s)
- Store simple weekly availability per worker (informational only, not enforced)
- Maintain backward compatibility with existing Jobs functionality

---

## Current State Analysis

### Jobs Schema

**Table:** `public.jobs`

**Current Structure:**
- `id uuid primary key default gen_random_uuid()`
- `order_id uuid references public.orders(id) on delete cascade`
- `customer_name text not null`
- `location_name text not null`
- `address text not null`
- `latitude decimal(10,8)`
- `longitude decimal(11,8)`
- `status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled'))`
- `scheduled_date date`
- `estimated_duration text`
- `priority text default 'medium' check (priority in ('low', 'medium', 'high'))`
- `notes text`
- `created_at timestamp with time zone default now()`
- `updated_at timestamp with time zone default now()`

**Observations:**
- Jobs table has no worker assignment fields
- No relationship exists between jobs and workers
- RLS policy allows all authenticated users full access
- Jobs can be linked to Orders via `order_id`
- Status and priority fields use CHECK constraints

### Relationship Analysis

**Current Relationship:**
- Jobs are linked to Orders via `order_id` (one-to-many: one Order can have multiple Jobs)
- No worker/team member entities exist
- No assignment mechanism exists

**Gaps/Issues:**
- Missing worker/team member management
- No way to assign workers to jobs
- No way to track which workers are assigned to which jobs
- No worker availability or scheduling information
- Jobs list cannot be filtered by worker assignments

### Data Access Patterns

**How Jobs are Currently Accessed:**
- React Query hooks in `src/modules/jobs/hooks/useJobs.ts`
- API functions in `src/modules/jobs/api/` (if exists)
- Direct Supabase queries using `.from('jobs')`
- Jobs list page at `/jobs` with search and status filtering
- CreateJobDrawer component for creating jobs with order selection

**How They Are Queried Together (if at all):**
- Jobs are displayed in a table with status badges
- Jobs can be filtered by status
- Jobs can be searched by customer name, location, etc.
- No worker-related queries exist

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**

1. **Create `workers` table:**
   - `id uuid primary key default gen_random_uuid()`
   - `full_name text not null`
   - `phone text null`
   - `role text not null` (CHECK constraint: 'installer', 'driver', 'stonecutter', 'other')
   - `notes text null`
   - `is_active boolean not null default true`
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`
   - Enable RLS
   - Create policies for authenticated users (allow all operations)
   - Create trigger for `updated_at`

2. **Create `worker_availability` table:**
   - `worker_id uuid primary key references workers(id) on delete cascade`
   - `mon_available boolean not null default true`
   - `tue_available boolean not null default true`
   - `wed_available boolean not null default true`
   - `thu_available boolean not null default true`
   - `fri_available boolean not null default true`
   - `sat_available boolean not null default false`
   - `sun_available boolean not null default false`
   - `start_time time null`
   - `end_time time null`
   - `notes text null`
   - `updated_at timestamptz not null default now()`
   - Enable RLS
   - Create policies for authenticated users
   - Create trigger for `updated_at`

3. **Create `job_workers` join table:**
   - `job_id uuid not null references jobs(id) on delete cascade`
   - `worker_id uuid not null references workers(id) on delete restrict`
   - `created_at timestamptz not null default now()`
   - Primary key: `(job_id, worker_id)`
   - Create indexes: `idx_job_workers_job_id` and `idx_job_workers_worker_id`
   - Enable RLS
   - Create policies for authenticated users

**Non-Destructive Constraints:**
- All changes are additive (new tables only)
- No modifications to existing `jobs` table
- No breaking changes to existing functionality
- Backward compatibility maintained

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Fetch workers: `SELECT * FROM workers WHERE is_active = true ORDER BY full_name`
- Fetch workers with availability: `SELECT w.*, wa.* FROM workers w LEFT JOIN worker_availability wa ON w.id = wa.worker_id`
- Fetch workers by job: `SELECT w.* FROM workers w INNER JOIN job_workers jw ON w.id = jw.worker_id WHERE jw.job_id = $1`
- Fetch jobs by worker: `SELECT j.* FROM jobs j INNER JOIN job_workers jw ON j.id = jw.job_id WHERE jw.worker_id = $1`
- Set workers for job: Delete all existing `job_workers` for job, then insert new ones

**Recommended Display Patterns:**
- Workers list: Table with search, active-only toggle, role badges
- Worker chips/avatars: Show worker initials or first letter in colored badge
- Job worker assignments: Display as horizontal chip list with "Assign" button
- Availability warning: Show badge/icon if worker is assigned but unavailable (optional)

---

## Implementation Approach

### Phase 1: Database Schema & Migrations
- Create migration file for `workers` table
- Create migration file for `worker_availability` table
- Create migration file for `job_workers` join table
- Add RLS policies for all new tables
- Add indexes for performance
- Test migrations on local Supabase instance

### Phase 2: Workers Module Foundation
- Create `src/modules/workers/` directory structure
- Create TypeScript types (`workers.types.ts`)
- Create Zod schemas (`worker.schema.ts`)
- Create API functions (`workers.api.ts`)
- Create React Query hooks (`useWorkers.ts`)
- Create utility functions (`workerTransform.ts`)

### Phase 3: Workers CRUD UI
- Create WorkersPage component (`/workers` route)
- Create WorkersList component with search and active-only toggle
- Create CreateWorkerDrawer component
- Create EditWorkerDrawer component
- Add navigation item for Workers module
- Implement availability editor (weekday toggles + optional times + notes)

### Phase 4: Job-Worker Assignment API & Hooks
- Create `useWorkersByJob(jobId)` hook
- Create `useSetWorkersForJob(jobId)` hook
- Create API functions for fetching and updating job-worker assignments
- Add worker assignment queries to jobs API

### Phase 5: Job UI Integration
- Update CreateJobDrawer to include worker multi-select
- Update Job details view to show assigned workers as chips
- Create AssignWorkersDialog component
- Add "Assign" button to Job details
- Display worker avatars/chips with names

### Phase 6: Jobs Filter by Worker
- Add worker filter control to JobsPage
- Implement multi-select worker filter
- Update jobs query to support worker filtering
- Add filter state management

### Phase 7: Polish & Testing
- Add availability warning badges (optional, non-blocking)
- Test all CRUD operations
- Test job-worker assignments
- Test filtering functionality
- Verify backward compatibility
- Run linting and build checks

### Safety Considerations
- All migrations are additive (no data loss risk)
- Use `on delete restrict` for worker_id in job_workers to prevent accidental deletion
- Use `on delete cascade` for job_id to clean up assignments when job is deleted
- RLS policies ensure data access control
- Test migrations on development database first
- Maintain backward compatibility with existing Jobs functionality

---

## What NOT to Do

- **No hard delete for workers:** Use `is_active=false` instead (soft delete)
- **No worker login/portal:** Workers are managed internally, no authentication for workers
- **No scheduling conflict enforcement:** Availability is informational only
- **No company linkage:** Workers are not linked to companies (future feature)
- **No automatic assignment:** All assignments are manual
- **No worker performance tracking:** Out of scope for this feature
- **No time tracking:** Out of scope for this feature
- **No destructive migrations:** Do not modify existing tables in breaking ways

---

## Open Questions / Considerations

1. **Worker Avatar/Initials:** Should we use full name initials, first letter only, or allow photo uploads? (Recommendation: Start with initials, add photos later if needed)

2. **Role Enum:** Should role be a CHECK constraint or a separate table? (Recommendation: Use CHECK constraint for simplicity, can migrate to table later if needed)

3. **Availability Time Format:** Should we use `time` type or store as text? (Recommendation: Use `time` type for proper time handling)

4. **Worker Assignment UI Location:** Should worker assignment be in CreateJobDrawer, Job details, or both? (Answer: Both - during creation and in details view)

5. **Filter UI Pattern:** Should worker filter be a multi-select dropdown, checkboxes, or chips? (Recommendation: Multi-select dropdown similar to existing filters)

6. **Availability Warning Display:** Where should availability warnings appear? (Recommendation: In AssignWorkersDialog as a badge/icon next to unavailable workers)

7. **Default Availability:** Should new workers default to Mon-Fri available? (Answer: Yes, as specified in schema)

8. **Worker Phone Format:** Should phone numbers be validated or stored as-is? (Recommendation: Store as-is, add validation later if needed)

---

## Technical Details

### Module Structure
```
src/modules/workers/
├── api/
│   └── workers.api.ts
├── components/
│   ├── CreateWorkerDrawer.tsx
│   ├── EditWorkerDrawer.tsx
│   ├── DeleteWorkerDialog.tsx (soft delete via is_active)
│   └── WorkerAvailabilityEditor.tsx
├── hooks/
│   └── useWorkers.ts
├── pages/
│   └── WorkersPage.tsx
├── schemas/
│   └── worker.schema.ts
├── types/
│   └── workers.types.ts
├── utils/
│   └── workerTransform.ts
└── index.ts
```

### Job Integration Points
- `src/modules/jobs/components/CreateJobDrawer.tsx` - Add worker multi-select
- `src/modules/jobs/components/EditJobDrawer.tsx` - Add worker assignment section
- `src/modules/jobs/pages/JobsPage.tsx` - Add worker filter
- `src/modules/jobs/api/` - Add worker assignment queries
- `src/modules/jobs/hooks/useJobs.ts` - Add worker-related hooks

### Database Migration Files
- `supabase/migrations/YYYYMMDDHHmmss_create_workers_table.sql`
- `supabase/migrations/YYYYMMDDHHmmss_create_worker_availability_table.sql`
- `supabase/migrations/YYYYMMDDHHmmss_create_job_workers_table.sql`

### RLS Policy Pattern
Following existing app pattern:
```sql
create policy "Allow all access to [table]" on public.[table]
  for all using (true) with check (true);
```

### React Query Hook Pattern
Following existing pattern from `useOrders.ts`:
- Query keys: `workersKeys.all`, `workersKeys.detail(id)`, `workersKeys.byJob(jobId)`
- Hooks: `useWorkersList()`, `useWorker(id)`, `useCreateWorker()`, `useUpdateWorker()`, `useSetWorkerActive()`
- Mutations invalidate relevant query keys

---

## Acceptance Criteria

- ✅ Can create/edit workers with all required fields (full_name, phone, role, notes, is_active)
- ✅ Can set weekly availability per worker (weekday toggles, optional times, notes)
- ✅ Can assign/unassign multiple workers to jobs from CreateJobDrawer
- ✅ Can assign/unassign multiple workers to jobs from Job details view
- ✅ Job shows assigned workers as chips/avatars with names
- ✅ Jobs list can be filtered by worker(s) (multi-select)
- ✅ Worker list has search by name/phone
- ✅ Worker list has "Active only" toggle
- ✅ No hard delete for workers (uses is_active=false)
- ✅ Build + lint pass
- ✅ No destructive migrations
- ✅ Backward compatibility maintained
- ✅ All new tables have RLS enabled
- ✅ All queries use proper indexes

---

## Success Metrics

- Workers module is accessible via navigation
- Workers can be created, edited, and deactivated
- Workers can be assigned to jobs during creation
- Workers can be assigned/unassigned from existing jobs
- Jobs display assigned workers visually
- Jobs can be filtered by assigned worker(s)
- Weekly availability is stored and can be edited
- All database operations respect RLS policies
- No regressions in existing Jobs functionality

