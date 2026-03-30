# Tasks: Add Workers Column to Jobs List

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Add batch fetch API function | Create | `src/modules/workers/api/workers.api.ts` | High | None | 1 |
| 1.2 | Add React Query hook for batch fetch | Create | `src/modules/workers/hooks/useWorkers.ts` | High | 1.1 | 1 |
| 2.1 | (Optional) Create worker chips component | Create | `src/modules/jobs/components/JobWorkersChips.tsx` | Low | None | 2 |
| 3.1 | Add Workers column header | Update | `src/modules/jobs/pages/JobsPage.tsx` | High | None | 3 |
| 3.2 | Fetch workers for visible jobs | Update | `src/modules/jobs/pages/JobsPage.tsx` | High | 1.2 | 3 |
| 3.3 | Render workers column cells | Update | `src/modules/jobs/pages/JobsPage.tsx` | High | 3.1, 3.2 | 3 |
| 4.1 | Verify performance (no N+1) | Verify | - | High | 3.3 | 4 |
| 4.2 | Test compatibility scenarios | Verify | - | High | 3.3 | 4 |
| 4.3 | Polish UX (tooltips, responsive) | Update | `src/modules/jobs/pages/JobsPage.tsx` | Medium | 3.3 | 4 |
| 4.4 | Final checks (build, lint) | Verify | - | High | 3.3 | 4 |

---

## Phase 1: Batch Fetch API (No N+1)

### Task 1.1: Add Batch Fetch API Function

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/workers/api/workers.api.ts`

**Description:**
Add `fetchWorkersByJobs()` function to batch fetch workers for multiple jobs in a single query.

**Changes Required:**
1. Add function signature: `fetchWorkersByJobs(jobIds: string[]): Promise<Record<string, Worker[]>>`
2. Early return for empty jobIds: `if (jobIds.length === 0) return {};`
3. Query `job_workers` with `.in('job_id', jobIds)` and `.select('job_id, workers(*)')`
4. Group results by `job_id` in client
5. Filter out null workers from join
6. Return mapping: `{ [jobId: string]: Worker[] }`

**Acceptance Criteria:**
- [ ] Function handles empty jobIds array
- [ ] Function handles jobs with no workers (returns empty array)
- [ ] Function groups workers correctly by job_id
- [ ] Function filters null workers
- [ ] Function exports correctly

**Validation:**
- Test with empty array
- Test with jobs that have workers
- Test with jobs that have no workers
- Test with null workers in join

---

### Task 1.2: Add React Query Hook for Batch Fetch

**Type:** CREATE  
**Priority:** High  
**Dependencies:** Task 1.1  
**File:** `src/modules/workers/hooks/useWorkers.ts`

**Description:**
Add `useWorkersByJobs()` React Query hook for batch fetching workers.

**Changes Required:**
1. Import `fetchWorkersByJobs` from API
2. Import `useMemo` from React
3. Add hook: `useWorkersByJobs(jobIds: string[])`
4. Sort jobIds for stable cache key: `const sortedJobIds = useMemo(() => [...jobIds].sort(), [jobIds])`
5. Use `useQuery` with:
   - Query key: `['workers', 'byJobs', sortedJobIds]`
   - Query function: `() => fetchWorkersByJobs(sortedJobIds)`
   - Enabled: `sortedJobIds.length > 0`
6. Export hook

**Acceptance Criteria:**
- [ ] Hook only runs when jobIds.length > 0
- [ ] Cache key is stable (sorted jobIds)
- [ ] Returns correct type: `Record<string, Worker[]> | undefined`
- [ ] Hook exports correctly

**Validation:**
- Test hook with empty array (disabled)
- Test hook with valid jobIds (fetches data)
- Test cache key stability
- Test error handling

---

## Phase 2: Worker Chips Renderer (Reuse Styling)

### Task 2.1: (Optional) Create Worker Chips Component

**Type:** CREATE (Optional)  
**Priority:** Low  
**Dependencies:** None  
**File:** `src/modules/jobs/components/JobWorkersChips.tsx`

**Description:**
Create reusable component for rendering worker chips (optional - can inline in JobsPage).

**Decision:** Inline in JobsPage for simplicity (per spec)

**If Creating Component:**
- Props: `workers: Worker[]`, `maxVisible?: number` (default 3)
- Render chips with initials, name, role
- Show "+N more" if workers.length > maxVisible
- Use Tooltip for full name + role

**Acceptance Criteria:**
- [ ] Component renders workers as chips
- [ ] Shows max 3 chips with "+N more"
- [ ] Tooltips work correctly
- [ ] Styling matches EditJobDrawer

**Validation:**
- Test with 0, 1, 3, 5+ workers
- Test tooltips
- Test styling consistency

---

## Phase 3: JobsPage Column

### Task 3.1: Add Workers Column Header

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Description:**
Add "Workers" column header to Jobs table.

**Changes Required:**
1. Add `<TableHead>Workers</TableHead>` in TableHeader
2. Position after "Priority" column (before "Duration")
3. Ensure proper spacing and alignment

**Acceptance Criteria:**
- [ ] Column header appears in table
- [ ] Positioned correctly (after Priority)
- [ ] Styling matches other columns

**Validation:**
- Column header visible in table
- Correct position
- Consistent styling

---

### Task 3.2: Fetch Workers for Visible Jobs

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Task 1.2  
**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Description:**
Use batch hook to fetch workers for all visible jobs.

**Changes Required:**
1. Import `useWorkersByJobs` from workers hooks
2. Import `useMemo` if not already imported
3. Extract job IDs: `const jobIds = useMemo(() => filteredJobs.map(j => j.id), [filteredJobs])`
4. Call hook: `const { data: workersByJobId, isLoading: isLoadingWorkers } = useWorkersByJobs(jobIds)`

**Acceptance Criteria:**
- [ ] Job IDs extracted from filteredJobs
- [ ] Hook called with job IDs
- [ ] Loading state available
- [ ] Data available in workersByJobId

**Validation:**
- Hook fetches workers for visible jobs
- Only one query per page load
- React Query caching works

---

### Task 3.3: Render Workers Column Cells

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Tasks 3.1, 3.2  
**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Description:**
Render worker chips in each job row's Workers column.

**Changes Required:**
1. Import `Tooltip`, `TooltipTrigger`, `TooltipContent` from shadcn/ui
2. For each job row, get workers: `const workers = workersByJobId?.[job.id] ?? []`
3. Render loading state: Skeleton if `isLoadingWorkers`
4. Render empty state: "—" if `workers.length === 0`
5. Render worker chips:
   - Show max 3 chips
   - Each chip: Badge with initials avatar, name
   - Tooltip shows full name + role
   - Show "+N more" if workers.length > 3
6. Use same styling as EditJobDrawer (smaller for table)

**Acceptance Criteria:**
- [ ] Workers display as chips with initials
- [ ] Max 3 chips visible, "+N more" if >3
- [ ] Empty state shows "—"
- [ ] Tooltips show full name + role
- [ ] Styling matches EditJobDrawer (scaled down)
- [ ] Loading state shows skeleton

**Validation:**
- Test with 0, 1, 3, 5+ workers
- Test empty state
- Test tooltips
- Test loading state
- Test styling consistency

---

## Phase 4: Polish & Testing

### Task 4.1: Verify Performance (No N+1)

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** Task 3.3

**Description:**
Verify that batch fetching works correctly and no N+1 queries occur.

**Actions:**
1. Open browser DevTools Network tab
2. Navigate to Jobs page
3. Verify only ONE request to `job_workers` table
4. Verify no per-row requests
5. Check React Query cache (refetch doesn't trigger on re-render)

**Acceptance Criteria:**
- [ ] Single batch request per page load
- [ ] No N+1 queries
- [ ] React Query caching prevents unnecessary refetches

**Validation:**
- Network tab shows single query
- No per-row requests
- Cache works correctly

---

### Task 4.2: Test Compatibility Scenarios

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** Task 3.3

**Description:**
Test all compatibility scenarios to ensure feature works correctly.

**Test Cases:**
1. Jobs page with no worker filter
2. Jobs page with worker filter selected
3. Jobs with 0 workers (show "—")
4. Jobs with 1 worker (show chip)
5. Jobs with 3 workers (show all 3 chips)
6. Jobs with 5+ workers (show 3 + "+N more")
7. Empty jobs list
8. Loading state

**Acceptance Criteria:**
- [ ] All scenarios work correctly
- [ ] No runtime errors
- [ ] UI is consistent

**Validation:**
- All test cases pass
- No console errors
- UI works as expected

---

### Task 4.3: Polish UX (Tooltips, Responsive)

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** Task 3.3  
**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Description:**
Add final UX polish: tooltips, responsive behavior, spacing.

**Changes Required:**
1. Verify tooltips show full name + role on hover
2. Verify responsive behavior (chips wrap on smaller screens)
3. Verify spacing matches other columns
4. Verify "+N more" badge is visible and styled correctly

**Acceptance Criteria:**
- [ ] Tooltips work correctly
- [ ] Responsive layout works
- [ ] Spacing is consistent
- [ ] No layout issues

**Validation:**
- Tooltips appear on hover
- Layout works on different screen sizes
- Spacing is consistent
- No visual issues

---

### Task 4.4: Final Checks (Build, Lint)

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** Task 3.3

**Description:**
Run final checks to ensure code quality.

**Actions:**
1. Run `npm run build` - must pass
2. Run `npm run lint` - must pass
3. Check for TypeScript errors
4. Manual testing of all scenarios

**Acceptance Criteria:**
- [ ] Build passes
- [ ] Lint passes
- [ ] No TypeScript errors
- [ ] All acceptance criteria met

**Validation:**
- All checks pass
- Code is production-ready

---

## Execution Order

**Sequential Phases:**
- Phase 1 → Phase 2 → Phase 3 → Phase 4

**Within Phases:**
- Phase 1: Task 1.1 → Task 1.2 (sequential)
- Phase 2: Task 2.1 (optional, can skip)
- Phase 3: Task 3.1 → Task 3.2 → Task 3.3 (sequential)
- Phase 4: Tasks 4.1-4.4 (can run in parallel after 3.3)

---

## Progress Tracking

**Phase 1: Batch Fetch API (No N+1)**
- [X] Task 1.1: Add batch fetch API function
- [X] Task 1.2: Add React Query hook for batch fetch

**Phase 2: Worker Chips Renderer (Reuse Styling)**
- [ ] Task 2.1: (Optional) Create worker chips component (Skipped - inlined in JobsPage)

**Phase 3: JobsPage Column**
- [X] Task 3.1: Add Workers column header
- [X] Task 3.2: Fetch workers for visible jobs
- [X] Task 3.3: Render workers column cells

**Phase 4: Polish & Testing**
- [X] Task 4.1: Verify performance (no N+1)
- [X] Task 4.2: Test compatibility scenarios
- [X] Task 4.3: Polish UX (tooltips, responsive)
- [X] Task 4.4: Final checks (build, lint)

