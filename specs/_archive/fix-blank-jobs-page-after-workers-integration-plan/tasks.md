# Tasks: Fix Blank Jobs Page After Workers Integration

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Identify crash location and root cause | Verify | - | High | None | 1 |
| 2.1 | Fix EditJobDrawer defaultValues (order_ids) | Update | `src/modules/jobs/components/EditJobDrawer.tsx` | High | 1.1 | 2 |
| 2.2 | Populate worker_ids from job assignments | Update | `src/modules/jobs/components/EditJobDrawer.tsx` | High | 2.1 | 2 |
| 2.3 | Add assigned_people_ids to defaultValues | Update | `src/modules/jobs/components/EditJobDrawer.tsx` | High | 2.1 | 2 |
| 2.4 | Remove order_id field usage | Update | `src/modules/jobs/components/EditJobDrawer.tsx` | High | 2.1 | 2 |
| 3.1 | Add defensive guards in JobsPage | Update | `src/modules/jobs/pages/JobsPage.tsx` | High | 2.1-2.4 | 3 |
| 3.2 | Guard worker filter badge rendering | Update | `src/modules/jobs/pages/JobsPage.tsx` | High | 3.1 | 3 |
| 3.3 | Ensure safe query execution | Update | `src/modules/jobs/hooks/useJobs.ts` | High | None | 3 |
| 4.1 | Test Jobs page scenarios | Verify | - | High | 2.1-3.3 | 4 |
| 4.2 | Verify build and lint | Verify | - | High | 2.1-3.3 | 4 |

---

## Phase 1: Reproduce + Confirm Crash Source

### Task 1.1: Identify Crash Location and Root Cause

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** None

**Description:**
Review code to identify exact crash point and confirm schema mismatch is the root cause.

**Actions:**
1. Review `EditJobDrawer.tsx` defaultValues
2. Compare with `job.schema.ts` requirements
3. Identify missing fields
4. Confirm schema mismatch (`order_id` vs `order_ids`)

**Expected Findings:**
- EditJobDrawer uses `order_id` but schema requires `order_ids`
- Missing `worker_ids` in defaultValues
- Missing `assigned_people_ids` in defaultValues
- Form validation fails on initialization

**Validation:**
- Root cause confirmed
- All affected components identified

---

## Phase 2: Fix Schema/Form Default Mismatch (Primary Fix)

### Task 2.1: Fix EditJobDrawer defaultValues (order_ids)

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Task 1.1  
**File:** `src/modules/jobs/components/EditJobDrawer.tsx`

**Description:**
Replace `order_id` with `order_ids` array in defaultValues and form.reset().

**Changes Required:**
```typescript
// Remove:
order_id: job.order_id || null,

// Add:
order_ids: job.order_id ? [job.order_id] : [],
```

**Acceptance Criteria:**
- [ ] `order_id` removed from defaultValues
- [ ] `order_ids` added to defaultValues
- [ ] `order_ids` added to form.reset()
- [ ] Form initializes without Zod errors

**Validation:**
- EditJobDrawer opens without crashing
- No Zod validation errors in console

---

### Task 2.2: Populate worker_ids from Job Assignments

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Task 2.1  
**File:** `src/modules/jobs/components/EditJobDrawer.tsx`

**Description:**
Use `useWorkersByJob()` to fetch assigned workers and populate `worker_ids` in form.

**Changes Required:**
1. Hook already exists: `const { data: assignedWorkers } = useWorkersByJob(job.id);`
2. Add to defaultValues: `worker_ids: assignedWorkers?.map(w => w.id) || []`
3. Update form.reset() to include worker_ids
4. Use `useMemo` to compute defaultValues with assignedWorkers dependency

**Acceptance Criteria:**
- [ ] `worker_ids` populated from assigned workers
- [ ] Defaults to `[]` if no workers assigned
- [ ] Updates when workers change

**Validation:**
- Worker assignments show in form
- Form updates correctly

---

### Task 2.3: Add assigned_people_ids to defaultValues

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Task 2.1  
**File:** `src/modules/jobs/components/EditJobDrawer.tsx`

**Description:**
Add `assigned_people_ids: []` to defaultValues for completeness.

**Changes Required:**
- Add `assigned_people_ids: []` to defaultValues
- Add to form.reset()

**Acceptance Criteria:**
- [ ] `assigned_people_ids` in defaultValues
- [ ] Defaults to empty array

**Validation:**
- Form initializes correctly
- No undefined values

---

### Task 2.4: Remove order_id Field Usage

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Task 2.1  
**File:** `src/modules/jobs/components/EditJobDrawer.tsx`

**Description:**
Remove any remaining usage of `order_id` field in form (if present in JSX).

**Changes Required:**
- Remove `order_id` FormField if exists
- Remove `selectedOrderId` watch if no longer needed
- Update any logic that references `order_id`

**Acceptance Criteria:**
- [ ] No `order_id` field in form JSX
- [ ] No references to `order_id` in form logic
- [ ] All references use `order_ids` array

**Validation:**
- Form works correctly
- No TypeScript errors

---

## Phase 3: Defensive Rendering + Safe Queries

### Task 3.1: Add Defensive Guards in JobsPage

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Tasks 2.1-2.4  
**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Description:**
Add guards to prevent crashes from undefined data.

**Changes Required:**
```typescript
// Guard jobsData
const jobs = jobsData || [];

// Use 'jobs' instead of 'jobsData' in uiJobs computation
const uiJobs = useMemo<UIJob[]>(() => {
  if (!jobs || jobs.length === 0) return [];
  return transformJobsFromDb(jobs);
}, [jobs]);
```

**Acceptance Criteria:**
- [ ] `jobsData` guarded with `|| []`
- [ ] All array operations use guarded value
- [ ] Component handles undefined data gracefully

**Validation:**
- JobsPage renders with undefined jobsData
- No crashes during loading

---

### Task 3.2: Guard Worker Filter Badge Rendering

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** Task 3.1  
**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Description:**
Add guards to worker filter badge rendering to prevent crashes on missing workers.

**Changes Required:**
```typescript
{selectedWorkerIds.map((workerId) => {
  const worker = workers?.find(w => w.id === workerId);
  if (!worker) return null; // Guard against undefined
  return <Badge key={workerId}>...</Badge>;
})}
```

**Acceptance Criteria:**
- [ ] Worker badges guarded with null check
- [ ] Missing workers don't cause crash
- [ ] Filter works correctly

**Validation:**
- Worker filter renders correctly
- No crashes on missing workers

---

### Task 3.3: Ensure Safe Query Execution

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/jobs/hooks/useJobs.ts`

**Description:**
Add explicit guards to fetchJobs to ensure safe query execution.

**Changes Required:**
```typescript
// Add explicit array check
if (options?.workerIds && Array.isArray(options.workerIds) && options.workerIds.length > 0) {
  // ... filtering logic
}

// Ensure always returns array
return (data || []) as Job[];
```

**Acceptance Criteria:**
- [ ] Explicit array check before filtering
- [ ] Query always returns array (never undefined)
- [ ] Edge cases handled

**Validation:**
- Query works with undefined workerIds
- Query works with empty array
- Always returns array type

---

## Phase 4: Validation

### Task 4.1: Test Jobs Page Scenarios

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** Tasks 2.1-3.3

**Description:**
Test all Jobs page scenarios to ensure no crashes.

**Test Cases:**
1. Navigate to Jobs page with no worker filter
2. Navigate to Jobs page with worker filter selected
3. Navigate to Jobs page with worker filter that has no matching jobs
4. Open EditJobDrawer for existing job
5. Open CreateJobDrawer
6. Filter jobs by worker(s)
7. Clear worker filter

**Acceptance Criteria:**
- [ ] All scenarios render without blank screen
- [ ] No console errors
- [ ] All functionality works
- [ ] EditJobDrawer opens correctly

**Validation:**
- Manual testing passes
- No runtime errors

---

### Task 4.2: Verify Build and Lint

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** Tasks 2.1-3.3

**Description:**
Run build and lint to ensure no new errors.

**Actions:**
1. Run `npm run build`
2. Run `npm run lint`
3. Check TypeScript compilation

**Acceptance Criteria:**
- [ ] Build passes
- [ ] Lint passes
- [ ] No TypeScript errors
- [ ] No new warnings

**Validation:**
- All checks pass
- Code is production-ready

---

## Execution Order

**Sequential Phases:**
- Phase 1 → Phase 2 → Phase 3 → Phase 4

**Within Phases:**
- Phase 1: Task 1.1 (single task)
- Phase 2: Tasks 2.1 → 2.2 → 2.3 → 2.4 (sequential)
- Phase 3: Tasks 3.1 → 3.2 (sequential), Task 3.3 (parallel)
- Phase 4: Tasks 4.1 → 4.2 (sequential)

---

## Progress Tracking

**Phase 1: Reproduce + Confirm Crash Source**
- [X] Task 1.1: Identify crash location and root cause

**Phase 2: Fix Schema/Form Default Mismatch**
- [X] Task 2.1: Fix EditJobDrawer defaultValues (order_ids)
- [X] Task 2.2: Populate worker_ids from job assignments
- [X] Task 2.3: Add assigned_people_ids to defaultValues
- [X] Task 2.4: Remove order_id field usage

**Phase 3: Defensive Rendering + Safe Queries**
- [X] Task 3.1: Add defensive guards in JobsPage
- [X] Task 3.2: Guard worker filter badge rendering
- [X] Task 3.3: Ensure safe query execution

**Phase 4: Validation**
- [X] Task 4.1: Test Jobs page scenarios
- [X] Task 4.2: Verify build and lint

