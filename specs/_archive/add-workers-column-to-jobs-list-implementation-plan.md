# Implementation Plan: Add "Workers" Column to Jobs List

**Branch:** `feature/add-workers-column-to-jobs-list`  
**Specification:** `specs/add-workers-column-to-jobs-list.md`

---

## Overview

This plan implements a new "Workers" column in the Jobs table that displays assigned workers per job as chips/avatars with initials. The implementation uses batch fetching to avoid N+1 queries and maintains consistency with EditJobDrawer worker display styling.

**Goal:** Add workers visibility to Jobs list without performance degradation or database changes.

**Constraints:**
- No database migrations
- UI-only changes
- Batch fetching required (no per-row queries)
- Maintain existing functionality

---

## Phase 1 — Batch Fetch API (No N+1)

### Task 1.1: Add Batch Fetch API Function

**File:** `src/modules/workers/api/workers.api.ts`

**Changes Required:**
1. Add `fetchWorkersByJobs(jobIds: string[]): Promise<Record<string, Worker[]>>`
2. Implement using single query with join (Option A):
   - Query `job_workers` with `.in('job_id', jobIds)`
   - Select `job_id, workers(*)` to join worker data
   - Group results by `job_id` in client
3. Handle edge cases:
   - If `jobIds.length === 0`, return `{}` immediately
   - Filter out null workers from join
   - Return empty array for jobs with no workers

**Code Structure:**
```typescript
export async function fetchWorkersByJobs(jobIds: string[]): Promise<Record<string, Worker[]>> {
  if (jobIds.length === 0) return {};
  
  const { data, error } = await supabase
    .from('job_workers')
    .select('job_id, workers(*)')
    .in('job_id', jobIds);

  if (error) throw error;

  // Group by job_id
  const workersByJob: Record<string, Worker[]> = {};
  (data || []).forEach((item: { job_id: string; workers: Worker | null }) => {
    if (item.workers) {
      if (!workersByJob[item.job_id]) {
        workersByJob[item.job_id] = [];
      }
      workersByJob[item.job_id].push(item.workers);
    }
  });

  return workersByJob;
}
```

**Validation:**
- Handles empty jobIds array
- Handles jobs with no workers (returns empty array for that job)
- Groups correctly by job_id
- Filters null workers

---

### Task 1.2: Add React Query Hook

**File:** `src/modules/workers/hooks/useWorkers.ts`

**Changes Required:**
1. Add `useWorkersByJobs(jobIds: string[])` hook
2. Use `useQuery` with:
   - Query key: `['workers', 'byJobs', sortedJobIds]` (sort for stable cache key)
   - Query function: `fetchWorkersByJobs`
   - Enabled: `jobIds.length > 0`
3. Return `{ data, isLoading, error }`

**Code Structure:**
```typescript
export function useWorkersByJobs(jobIds: string[]) {
  const sortedJobIds = useMemo(() => [...jobIds].sort(), [jobIds]);
  
  return useQuery({
    queryKey: ['workers', 'byJobs', sortedJobIds],
    queryFn: () => fetchWorkersByJobs(sortedJobIds),
    enabled: sortedJobIds.length > 0,
  });
}
```

**Validation:**
- Hook only runs when jobIds.length > 0
- Cache key is stable (sorted jobIds)
- Returns correct type: `Record<string, Worker[]> | undefined`

---

## Phase 2 — Worker Chips Renderer (Reuse Styling)

### Task 2.1: Create Worker Chips Component (Optional)

**File:** `src/modules/jobs/components/JobWorkersChips.tsx` (optional, can inline)

**Decision:** Inline in JobsPage for simplicity (per spec decision)

**Alternative:** If creating component:
- Props: `workers: Worker[]`, `maxVisible?: number` (default 3)
- Render chips with initials, name, role
- Show "+N more" badge if workers.length > maxVisible
- Use Tooltip for full name + role on hover

**For now:** Will inline in JobsPage to match EditJobDrawer pattern

---

### Task 2.2: Extract Initials Utility (Optional)

**File:** `src/modules/jobs/utils/workerUtils.ts` (optional)

**Decision:** Inline initials calculation in JobsPage (simple enough)

**Alternative:** If extracting:
```typescript
export function getWorkerInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
```

**For now:** Will inline in JobsPage

---

## Phase 3 — JobsPage Column

### Task 3.1: Add Workers Column Header

**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Changes Required:**
1. Add "Workers" column header in TableHeader
2. Position after "Priority" column (per spec)
3. Ensure proper spacing and alignment

**Code Location:**
```typescript
<TableHeader>
  <TableRow>
    <TableHead>Customer</TableHead>
    <TableHead>Location</TableHead>
    <TableHead>Address</TableHead>
    <TableHead>Status</TableHead>
    <TableHead>Scheduled Date</TableHead>
    <TableHead>Priority</TableHead>
    <TableHead>Workers</TableHead> {/* NEW */}
    <TableHead>Duration</TableHead>
    <TableHead>Created</TableHead>
    <TableHead className="text-right">Actions</TableHead>
  </TableRow>
</TableHeader>
```

**Validation:**
- Column header appears in correct position
- Styling matches other columns

---

### Task 3.2: Fetch Workers for Visible Jobs

**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Changes Required:**
1. Import `useWorkersByJobs` hook
2. Extract job IDs from `filteredJobs`: `const jobIds = filteredJobs.map(j => j.id)`
3. Call hook: `const { data: workersByJobId, isLoading: isLoadingWorkers } = useWorkersByJobs(jobIds)`
4. Handle loading/error states

**Code Structure:**
```typescript
const jobIds = useMemo(() => filteredJobs.map(j => j.id), [filteredJobs]);
const { data: workersByJobId, isLoading: isLoadingWorkers } = useWorkersByJobs(jobIds);
```

**Validation:**
- Only fetches for visible/filtered jobs
- Handles empty jobIds array
- React Query caching works correctly

---

### Task 3.3: Render Workers Column Cells

**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Changes Required:**
1. For each job row, get workers: `const workers = workersByJobId?.[job.id] ?? []`
2. Render worker chips (max 3 visible):
   - Use Badge component with same styling as EditJobDrawer
   - Show initials in circular avatar
   - Show full name and role
   - If workers.length > 3, show first 3 + "+N more" badge
3. Empty state: Show "—" in muted text
4. Add Tooltip for each chip showing full name + role

**Code Structure:**
```typescript
<TableCell>
  {isLoadingWorkers ? (
    <Skeleton className="h-6 w-20" />
  ) : workers.length === 0 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <div className="flex flex-wrap gap-1">
      {workers.slice(0, 3).map((worker) => {
        const initials = worker.full_name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        return (
          <Tooltip key={worker.id}>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="h-6 px-2 text-xs">
                <span className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] mr-1">
                  {initials}
                </span>
                {worker.full_name}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {worker.full_name} ({worker.role})
            </TooltipContent>
          </Tooltip>
        );
      })}
      {workers.length > 3 && (
        <Badge variant="outline" className="h-6 px-2 text-xs">
          +{workers.length - 3} more
        </Badge>
      )}
    </div>
  )}
</TableCell>
```

**Validation:**
- Workers display correctly for jobs with workers
- Empty state shows for jobs with no workers
- "+N more" appears when workers.length > 3
- Tooltips work on hover
- Styling matches EditJobDrawer

---

## Phase 4 — Polish & Testing

### Task 4.1: Performance Verification

**Actions:**
1. Open browser DevTools Network tab
2. Navigate to Jobs page
3. Verify only ONE request to `job_workers` table (batch fetch)
4. Verify no per-row requests
5. Check React Query cache is working (refetch doesn't trigger on re-render)

**Validation:**
- Single batch request per page load
- No N+1 queries
- React Query caching prevents unnecessary refetches

---

### Task 4.2: Compatibility Testing

**Test Cases:**
1. Jobs page with no worker filter
2. Jobs page with worker filter selected
3. Jobs with 0 workers (show "—")
4. Jobs with 1 worker (show chip)
5. Jobs with 3 workers (show all 3 chips)
6. Jobs with 5+ workers (show 3 + "+N more")
7. Empty jobs list
8. Loading state (skeleton or empty)

**Validation:**
- All scenarios work correctly
- No runtime errors
- UI is consistent

---

### Task 4.3: UX Polish

**Actions:**
1. Verify responsive behavior (chips wrap on smaller screens)
2. Verify tooltips show full name + role
3. Verify spacing matches other columns
4. Verify "+N more" badge is clickable (optional: show tooltip with all workers)

**Validation:**
- Responsive layout works
- Tooltips are helpful
- Spacing is consistent
- No layout issues

---

### Task 4.4: Final Checks

**Actions:**
1. Run `npm run build` - must pass
2. Run `npm run lint` - must pass
3. Check for TypeScript errors
4. Manual testing of all scenarios

**Validation:**
- Build passes
- Lint passes
- No TypeScript errors
- All acceptance criteria met

---

## Deliverables Summary

- ✅ Batch fetch API function: `fetchWorkersByJobs()`
- ✅ React Query hook: `useWorkersByJobs()`
- ✅ Workers column in JobsPage table
- ✅ Worker chips with initials, name, role
- ✅ "+N more" indicator for overflow
- ✅ Empty state handling
- ✅ Tooltips for worker details
- ✅ No database changes
- ✅ No N+1 queries
- ✅ Performance optimized

---

## Progress Tracking

- [ ] Phase 1: Batch Fetch API (No N+1)
- [ ] Phase 2: Worker Chips Renderer (Reuse Styling)
- [ ] Phase 3: JobsPage Column
- [ ] Phase 4: Polish & Testing

