# Add "Workers" Column to Jobs List (JobsPage)

## Overview

Add a new "Workers" column to the Jobs table/list in JobsPage that displays assigned workers per job as chips/avatars with initials, similar to the EditJobDrawer workers section. This provides visibility into worker assignments directly in the jobs list without needing to open each job.

**Context:**
- Workers module exists and worker assignment to jobs is functional
- Worker filtering by jobs works
- EditJobDrawer shows workers as chips/avatars with initials
- JobsPage currently does not display assigned workers in the table

**Goal:**
- Display assigned workers per job in a new "Workers" column
- Show workers as chips/avatars with initials (consistent with EditJobDrawer)
- Maintain performance with efficient batch fetching
- No database changes required

---

## Current State Analysis

### Jobs Table Structure

**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Current Columns:**
- Customer
- Location
- Address
- Status
- Scheduled Date
- Priority
- Duration
- Created
- Actions

**Observations:**
- Table uses `filteredJobs` (UIJob[]) for rendering
- Each row renders job data from `transformJobsFromDb()`
- No worker information is currently displayed

### Worker Assignment Data Model

**Tables:**
- `job_workers` (join table): `job_id`, `worker_id`, `created_at`
- `workers`: `id`, `full_name`, `role`, `is_active`, etc.

**Current Data Access:**
- `useWorkersByJob(jobId)` - fetches workers for a single job
- `fetchWorkersByJob(jobId)` - API function for single job
- Used in EditJobDrawer to show assigned workers

**Observations:**
- Single-job worker fetching exists
- No batch fetching for multiple jobs
- Would cause N+1 queries if used per row

### EditJobDrawer Worker Display

**File:** `src/modules/jobs/components/EditJobDrawer.tsx`

**Current Implementation:**
- Uses `useWorkersByJob(job.id)` to fetch workers
- Displays workers as Badge components with:
  - Initials in circular avatar (first 2 letters of name)
  - Full name
  - Role in parentheses
- Styling: `variant="secondary"`, `h-8 px-3`, flex layout with gap

**Observations:**
- Worker chip styling is consistent and reusable
- Initials calculation: `worker.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)`
- Empty state: "No workers assigned" text

---

## Recommended Implementation

### Database Changes

**Migrations Required:**
- None (no database changes needed)

**Non-Destructive Constraints:**
- All changes are UI-only
- No schema modifications
- Backward compatible

### Query/Data-Access Alignment

**Recommended Query Pattern:**

**Option A: Single Query with Join (Preferred)**
```typescript
// Fetch all job_workers for visible jobs in one query
const { data: jobWorkers } = await supabase
  .from('job_workers')
  .select('job_id, workers(*)')
  .in('job_id', jobIds);

// Group by job_id in client
const workersByJob = jobWorkers?.reduce((acc, jw) => {
  if (!acc[jw.job_id]) acc[jw.job_id] = [];
  if (jw.workers) acc[jw.job_id].push(jw.workers);
  return acc;
}, {} as Record<string, Worker[]>);
```

**Option B: Two-Step Fetch**
```typescript
// Step 1: Get job_workers rows
const { data: jobWorkers } = await supabase
  .from('job_workers')
  .select('job_id, worker_id')
  .in('job_id', jobIds);

// Step 2: Get unique worker IDs and fetch workers
const workerIds = [...new Set(jobWorkers?.map(jw => jw.worker_id) || [])];
const { data: workers } = await supabase
  .from('workers')
  .select('*')
  .in('id', workerIds);

// Step 3: Map workers to jobs
const workersByJob = jobWorkers?.reduce((acc, jw) => {
  const worker = workers?.find(w => w.id === jw.worker_id);
  if (worker) {
    if (!acc[jw.job_id]) acc[jw.job_id] = [];
    acc[jw.job_id].push(worker);
  }
  return acc;
}, {} as Record<string, Worker[]>);
```

**Decision:** Use Option A (single query with join) for better performance and simplicity.

**Recommended Display Pattern:**
- Add "Workers" column header between "Priority" and "Duration" (or at end before "Actions")
- For each job row:
  - If workers exist: Show chips/avatars (max 3 visible, "+N more" if >3)
  - If no workers: Show "—" or "No workers" in muted text
- Use tooltip on hover to show full name + role
- Reuse Badge component styling from EditJobDrawer

---

## Implementation Approach

### Phase 1: Create Batch Worker Fetch API

1. **Add batch fetch function:**
   - File: `src/modules/workers/api/workers.api.ts`
   - Function: `fetchWorkersByJobs(jobIds: string[]): Promise<Record<string, Worker[]>>`
   - Implementation: Single query with join, group by job_id
   - Return mapping: `{ [jobId: string]: Worker[] }`

2. **Add React Query hook:**
   - File: `src/modules/workers/hooks/useWorkers.ts`
   - Hook: `useWorkersByJobs(jobIds: string[])`
   - Use `useQuery` with proper key and query function
   - Return `{ data: Record<string, Worker[]> | undefined, isLoading, error }`

3. **Test API function:**
   - Verify it handles empty jobIds array
   - Verify it handles jobs with no workers
   - Verify grouping works correctly

### Phase 2: Create Reusable Worker Chips Component (Optional)

1. **Create component:**
   - File: `src/modules/jobs/components/JobWorkersChips.tsx` (optional)
   - Props: `workers: Worker[]`, `maxVisible?: number`
   - Render chips with initials, name, role
   - Show "+N more" if workers.length > maxVisible
   - Or inline in JobsPage if component reuse not needed

2. **Reuse EditJobDrawer styling:**
   - Extract initials calculation to utility if needed
   - Use same Badge variant and styling

### Phase 3: Add Workers Column to JobsPage

1. **Update JobsPage:**
   - Add "Workers" column header in TableHeader
   - Use `useWorkersByJobs()` hook with `filteredJobs.map(j => j.id)`
   - For each job row, render workers chips or placeholder
   - Handle loading state (show skeleton or empty)
   - Handle error state gracefully

2. **Column positioning:**
   - Place between "Priority" and "Duration" columns
   - Or at end before "Actions" column

3. **Performance considerations:**
   - Only fetch workers for currently visible/filtered jobs
   - Use React Query caching to avoid refetches
   - Consider pagination if job list is very large

### Phase 4: Polish & Testing

1. **Empty states:**
   - Show "—" or "No workers" for jobs with no assignments
   - Ensure styling is consistent and subtle

2. **Tooltips:**
   - Add tooltip on worker chips showing full name + role
   - Use existing Tooltip component from shadcn/ui

3. **Responsive behavior:**
   - Ensure column works on smaller screens
   - Consider truncation or wrapping for many workers

4. **Testing:**
   - Test with jobs that have 0, 1, 2, 3+ workers
   - Test with worker filter active
   - Test with no jobs
   - Verify no performance degradation

---

## What NOT to Do

- **Do NOT add database migrations** (no schema changes needed)
- **Do NOT modify existing worker assignment functionality**
- **Do NOT change EditJobDrawer worker display**
- **Do NOT add worker editing from the Jobs list** (keep it read-only)
- **Do NOT fetch workers individually per job** (use batch fetch)

---

## Open Questions / Considerations

1. **Column positioning:**
   - Where should "Workers" column be placed?
   - Options: After "Priority", before "Duration", or at end before "Actions"
   - **Decision:** After "Priority" for logical grouping

2. **Max visible workers:**
   - Should we limit visible chips (e.g., max 3) with "+N more"?
   - Or show all workers (may cause layout issues with many workers)
   - **Decision:** Show max 3 chips, "+N more" if >3, tooltip shows all

3. **Component reuse:**
   - Should we extract worker chips to a shared component?
   - Or inline in JobsPage for simplicity?
   - **Decision:** Inline for now, extract later if needed elsewhere

4. **Performance with large lists:**
   - What if there are 100+ jobs visible?
   - Should we limit batch fetch size or paginate?
   - **Decision:** Fetch all visible jobs (React Query will cache), monitor performance

5. **Loading state:**
   - How to show loading state for workers column?
   - Options: Skeleton, spinner, or just empty until loaded
   - **Decision:** Show empty/placeholder until loaded (workers are secondary info)

---

## Acceptance Criteria

- ✅ Jobs page shows a "Workers" column in the table
- ✅ Each job row displays assigned workers as chips/avatars with initials
- ✅ Workers display matches EditJobDrawer styling (Badge with initials, name, role)
- ✅ Jobs with no workers show "—" or "No workers" placeholder
- ✅ Tooltip on hover shows full worker name + role
- ✅ Batch fetching used (no N+1 queries)
- ✅ Works correctly with worker filter active
- ✅ Works correctly with no worker filter
- ✅ No runtime errors
- ✅ No noticeable performance degradation
- ✅ Build and lint pass
- ✅ Responsive on smaller screens

---

## Success Metrics

- Workers column visible and functional in Jobs table
- Performance remains acceptable with typical job list sizes (10-50 jobs)
- UI is consistent with EditJobDrawer worker display
- No regressions in existing Jobs page functionality

