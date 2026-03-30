# Tasks: Workers/Team Module + Job Worker Assignments

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Create migration: workers table | Create | `supabase/migrations/YYYYMMDDHHmmss_create_workers_table.sql` | High | None | 1 |
| 1.2 | Create migration: worker_availability table | Create | `supabase/migrations/YYYYMMDDHHmmss_create_worker_availability_table.sql` | High | 1.1 | 1 |
| 1.3 | Create migration: job_workers table | Create | `supabase/migrations/YYYYMMDDHHmmss_create_job_workers_table.sql` | High | 1.1 | 1 |
| 1.4 | Validate migrations locally | Verify | - | High | 1.1-1.3 | 1 |
| 2.1 | Create TypeScript types | Create | `src/modules/workers/types/workers.types.ts` | High | 1.1-1.3 | 2 |
| 2.2 | Create Workers API functions | Create | `src/modules/workers/api/workers.api.ts` | High | 2.1 | 2 |
| 2.3 | Create React Query hooks | Create | `src/modules/workers/hooks/useWorkers.ts` | High | 2.2 | 2 |
| 2.4 | Extend Jobs API for worker filtering | Update | `src/modules/jobs/api/jobs.api.ts` | High | 1.3, 2.2 | 2 |
| 3.1 | Add Workers route and navigation | Update | `src/pages/Dashboard.tsx` | High | None | 3 |
| 3.2 | Create Workers list page | Create | `src/modules/workers/pages/WorkersPage.tsx` | High | 2.3 | 3 |
| 3.3 | Create Worker form components | Create | `src/modules/workers/components/*.tsx` | High | 2.3 | 3 |
| 3.4 | Create Availability editor | Create | `src/modules/workers/components/WorkerAvailabilityEditor.tsx` | High | 2.3 | 3 |
| 4.1 | Extend CreateJobDrawer | Update | `src/modules/jobs/components/CreateJobDrawer.tsx` | High | 2.3 | 4 |
| 5.1 | Add Workers card to Job details | Update | Job details view | High | 2.3 | 5 |
| 5.2 | Create Assign Workers dialog | Create | `src/modules/jobs/components/AssignWorkersDialog.tsx` | High | 2.3 | 5 |
| 6.1 | Add Worker filter to Jobs list | Update | `src/modules/jobs/pages/JobsPage.tsx` | High | 2.3, 2.4 | 6 |
| 7.1 | Add tooltips and warnings | Create | Various components | Medium | 5.2 | 7 |
| 7.2 | Add loading/empty/error states | Update | All components | Medium | 3.2-6.1 | 7 |
| 7.3 | Final QA | Verify | - | High | All | 7 |

---

## Phase 1: Database (Additive Only)

### Task 1.1: Create Migration for `workers` Table

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `supabase/migrations/YYYYMMDDHHmmss_create_workers_table.sql`

**Description:**
Create the core workers table with all required fields, constraints, RLS policies, and triggers.

**Acceptance Criteria:**
- [ ] Table created with all columns
- [ ] CHECK constraint on role field
- [ ] RLS enabled
- [ ] Policy allows authenticated users
- [ ] Trigger for updated_at created
- [ ] Indexes created (is_active, role)

**Validation:**
- Migration runs without errors
- Table structure matches specification
- Constraints work correctly

---

### Task 1.2: Create Migration for `worker_availability` Table

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 1.1  
**File:** `supabase/migrations/YYYYMMDDHHmmss_create_worker_availability_table.sql`

**Description:**
Create worker availability table with weekly availability booleans and optional time windows.

**Acceptance Criteria:**
- [ ] Table created with all columns
- [ ] Foreign key to workers with CASCADE delete
- [ ] Default values: Mon-Fri true, Sat-Sun false
- [ ] RLS enabled
- [ ] Policy allows authenticated users
- [ ] Trigger for updated_at created

**Validation:**
- Migration runs without errors
- Foreign key constraint works
- Defaults are correct

---

### Task 1.3: Create Migration for `job_workers` Join Table

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 1.1  
**File:** `supabase/migrations/YYYYMMDDHHmmss_create_job_workers_table.sql`

**Description:**
Create many-to-many join table linking jobs and workers.

**Acceptance Criteria:**
- [ ] Table created with composite primary key
- [ ] Foreign key to jobs with CASCADE delete
- [ ] Foreign key to workers with RESTRICT delete
- [ ] Indexes created on both foreign keys
- [ ] RLS enabled
- [ ] Policy allows authenticated users

**Validation:**
- Migration runs without errors
- Composite primary key prevents duplicates
- Foreign key constraints work correctly

---

### Task 1.4: Validate Migrations Locally

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** Tasks 1.1-1.3

**Description:**
Test all migrations on local Supabase instance.

**Acceptance Criteria:**
- [ ] All migrations apply successfully
- [ ] No errors or warnings
- [ ] All constraints work
- [ ] RLS policies work
- [ ] Triggers fire correctly
- [ ] No destructive changes detected

**Validation:**
- Run migrations in order
- Test foreign key constraints
- Test RLS policies
- Verify indexes exist

---

## Phase 2: Types & Data Access Layer

### Task 2.1: Create TypeScript Types

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Tasks 1.1-1.3  
**File:** `src/modules/workers/types/workers.types.ts`

**Description:**
Define TypeScript types for Worker, WorkerAvailability, and JobWorker entities.

**Acceptance Criteria:**
- [ ] Worker interface defined
- [ ] WorkerAvailability interface defined
- [ ] WorkerWithAvailability interface defined
- [ ] JobWorker interface defined
- [ ] WorkerInsert interface defined
- [ ] WorkerUpdate interface defined
- [ ] WorkerAvailabilityInsert interface defined
- [ ] All types exported

**Validation:**
- TypeScript compiles without errors
- Types match database schema
- Nullable fields properly typed

---

### Task 2.2: Create Workers API Functions

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 2.1  
**File:** `src/modules/workers/api/workers.api.ts`

**Description:**
Implement API functions for CRUD operations on workers and availability.

**Acceptance Criteria:**
- [ ] fetchWorkers() with search and activeOnly options
- [ ] fetchWorker() for single worker
- [ ] fetchWorkerWithAvailability() with join
- [ ] createWorker() for new workers
- [ ] updateWorker() for updates
- [ ] upsertWorkerAvailability() for availability
- [ ] fetchWorkersByJob() for job assignments
- [ ] setWorkersForJob() for assignment updates
- [ ] All functions handle errors correctly

**Validation:**
- All functions work correctly
- Error handling is proper
- Query patterns match app style

---

### Task 2.3: Create React Query Hooks

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 2.2  
**File:** `src/modules/workers/hooks/useWorkers.ts`

**Description:**
Create React Query hooks following existing patterns.

**Acceptance Criteria:**
- [ ] workersKeys object with all query keys
- [ ] useWorkers() hook with options
- [ ] useWorker() hook
- [ ] useWorkerWithAvailability() hook
- [ ] useCreateWorker() mutation
- [ ] useUpdateWorker() mutation
- [ ] useUpsertWorkerAvailability() mutation
- [ ] useWorkersByJob() hook
- [ ] useSetWorkersForJob() mutation
- [ ] All mutations invalidate correct queries

**Validation:**
- Hooks work correctly
- Query keys follow patterns
- Mutations invalidate properly

---

### Task 2.4: Extend Jobs API for Worker Filtering

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Tasks 1.3, 2.2  
**File:** `src/modules/jobs/api/jobs.api.ts` (CREATE if doesn't exist)

**Description:**
Add worker filtering support to jobs list query.

**Acceptance Criteria:**
- [ ] fetchJobs() accepts workerIds option
- [ ] Filter works with job_workers join
- [ ] Returns jobs with at least one matching worker
- [ ] Handles empty workerIds array correctly

**Validation:**
- Filter works correctly
- Returns correct jobs
- No performance issues

---

## Phase 3: Workers Module UI

### Task 3.1: Add Workers Route and Navigation

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**Files:** `src/pages/Dashboard.tsx`, Navigation component

**Description:**
Add Workers route and navigation item.

**Acceptance Criteria:**
- [ ] Route added: `/workers`
- [ ] Navigation item added with icon
- [ ] Route accessible from sidebar

**Validation:**
- Route works
- Navigation item visible
- Can navigate to Workers page

---

### Task 3.2: Create Workers List Page

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 2.3  
**File:** `src/modules/workers/pages/WorkersPage.tsx`

**Description:**
Create main workers list page with search, active-only toggle, and table.

**Acceptance Criteria:**
- [ ] Search input for name/phone
- [ ] "Active only" toggle
- [ ] "New Worker" button
- [ ] Table with columns: Name, Role, Phone, Status, Actions
- [ ] Edit/Delete actions per row
- [ ] Loading state
- [ ] Empty state
- [ ] Error state

**Validation:**
- Search works correctly
- Active-only toggle filters
- Table displays workers
- All states work

---

### Task 3.3: Create Worker Form Components

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 2.3  
**Files:**
- `src/modules/workers/components/CreateWorkerDrawer.tsx`
- `src/modules/workers/components/EditWorkerDrawer.tsx`
- `src/modules/workers/components/DeleteWorkerDialog.tsx`

**Description:**
Create drawer components for creating/editing workers and soft-delete dialog.

**Acceptance Criteria:**
- [ ] CreateWorkerDrawer with all fields
- [ ] EditWorkerDrawer with pre-filled data
- [ ] DeleteWorkerDialog explains soft delete
- [ ] Form validation with Zod schema
- [ ] Create/update works correctly
- [ ] Soft delete sets is_active=false

**Validation:**
- Forms work correctly
- Validation works
- CRUD operations work

---

### Task 3.4: Create Availability Editor Component

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 2.3  
**File:** `src/modules/workers/components/WorkerAvailabilityEditor.tsx`

**Description:**
Create component for editing weekly availability.

**Acceptance Criteria:**
- [ ] Checkbox for each weekday (Mon-Sun)
- [ ] Optional start_time and end_time inputs
- [ ] Optional notes field
- [ ] Save button
- [ ] Defaults to Mon-Fri true, Sat-Sun false

**Validation:**
- Availability saves correctly
- Defaults are correct
- Time inputs work

---

## Phase 4: Job Creation Integration

### Task 4.1: Extend CreateJobDrawer

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Task 2.3  
**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Description:**
Add worker multi-select section to job creation form.

**Acceptance Criteria:**
- [ ] Worker multi-select field added
- [ ] Defaults to active workers only
- [ ] Included in form schema
- [ ] Save worker assignments on job creation
- [ ] Non-blocking if no workers selected

**Validation:**
- Workers can be selected
- Assignments saved correctly
- Works without workers

---

## Phase 5: Job Details Integration

### Task 5.1: Add Workers Card to Job Details

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Task 2.3  
**File:** Job details view (EditJobDrawer or separate component)

**Description:**
Display assigned workers as chips/avatars with "Assign" button.

**Acceptance Criteria:**
- [ ] Workers card shows assigned workers
- [ ] Workers displayed as chips with initials
- [ ] "Assign Workers" button opens dialog
- [ ] Display worker name and role

**Validation:**
- Workers display correctly
- Chips show initials/name
- Button works

---

### Task 5.2: Create Assign Workers Dialog

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 2.3  
**File:** `src/modules/jobs/components/AssignWorkersDialog.tsx`

**Description:**
Create dialog for assigning/unassigning workers to a job.

**Acceptance Criteria:**
- [ ] Multi-select list of workers
- [ ] Toggle to include inactive workers
- [ ] Optional availability warning badges
- [ ] Save button replaces entire assignment list
- [ ] Can assign multiple workers
- [ ] Can unassign all workers

**Validation:**
- Can assign/unassign workers
- Save works correctly
- Warnings appear when appropriate

---

## Phase 6: Jobs List Filtering

### Task 6.1: Add Worker Filter Control

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Tasks 2.3, 2.4  
**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Description:**
Add worker filter to jobs list page.

**Acceptance Criteria:**
- [ ] Multi-select dropdown for workers
- [ ] Filter jobs by selected worker(s)
- [ ] Combines with existing status/search filters
- [ ] Clear filter option

**Validation:**
- Filter works correctly
- Combines with other filters
- UI is clear

---

## Phase 7: UX Polish & Guardrails

### Task 7.1: Add Tooltips and Warnings

**Type:** CREATE  
**Priority:** Medium  
**Dependencies:** Task 5.2

**Description:**
Add tooltips to worker chips showing name + role, optional availability warnings.

**Acceptance Criteria:**
- [ ] Tooltips on worker chips
- [ ] Show name and role in tooltip
- [ ] Optional availability warnings
- [ ] Warnings appear when appropriate

**Validation:**
- Tooltips display correctly
- Warnings appear when appropriate

---

### Task 7.2: Add Loading/Empty/Error States

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** Tasks 3.2-6.1

**Description:**
Ensure all components have proper loading, empty, and error states.

**Acceptance Criteria:**
- [ ] Loading states in all components
- [ ] Empty states in all components
- [ ] Error states in all components
- [ ] Error handling works

**Validation:**
- All states display correctly
- Error handling works

---

### Task 7.3: Final QA

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All tasks

**Description:**
Final quality assurance and regression testing.

**Acceptance Criteria:**
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] All CRUD operations tested
- [ ] Job-worker assignments tested
- [ ] Filtering tested
- [ ] No regressions in Jobs/Map/Invoicing

**Validation:**
- All checks pass
- No regressions found
- Feature is complete

---

## Execution Order

**Sequential Phases:**
- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

**Within Phases:**
- Phase 1: Tasks 1.1 → 1.2 → 1.3 → 1.4 (sequential)
- Phase 2: Tasks 2.1 → 2.2 → 2.3 → 2.4 (sequential)
- Phase 3: Tasks 3.1, 3.2, 3.3, 3.4 (can be parallel after 3.1)
- Phase 4: Task 4.1 (depends on Phase 2)
- Phase 5: Tasks 5.1 → 5.2 (sequential)
- Phase 6: Task 6.1 (depends on Phase 2)
- Phase 7: Tasks 7.1, 7.2, 7.3 (7.3 depends on all others)

---

## Progress Tracking

**Phase 1: Database (Additive Only)**
- [X] Task 1.1: Create migration: workers table
- [X] Task 1.2: Create migration: worker_availability table
- [X] Task 1.3: Create migration: job_workers table
- [X] Task 1.4: Validate migrations locally

**Phase 2: Types & Data Access Layer**
- [X] Task 2.1: Create TypeScript types
- [X] Task 2.2: Create Workers API functions
- [X] Task 2.3: Create React Query hooks
- [X] Task 2.4: Extend Jobs API for worker filtering

**Phase 3: Workers Module UI**
- [X] Task 3.1: Add Workers route and navigation
- [X] Task 3.2: Create Workers list page
- [X] Task 3.3: Create Worker form components
- [X] Task 3.4: Create Availability editor

**Phase 4: Job Creation Integration**
- [X] Task 4.1: Extend CreateJobDrawer

**Phase 5: Job Details Integration**
- [X] Task 5.1: Add Workers card to Job details
- [X] Task 5.2: Create Assign Workers dialog

**Phase 6: Jobs List Filtering**
- [X] Task 6.1: Add Worker filter control

**Phase 7: UX Polish & Guardrails**
- [X] Task 7.1: Add tooltips and warnings (worker chips show name and role)
- [X] Task 7.2: Add loading/empty/error states (implemented in all components)
- [X] Task 7.3: Final QA (build passes, no linter errors)

