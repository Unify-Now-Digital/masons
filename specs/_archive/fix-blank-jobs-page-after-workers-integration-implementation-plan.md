# Implementation Plan: Fix Blank Jobs Page After Workers Integration

**Branch:** `feature/fix-blank-jobs-page-after-workers-integration`  
**Specification:** `specs/fix-blank-jobs-page-after-workers-integration.md`

---

## Overview

This plan fixes the runtime crash causing a blank Jobs page after Workers module integration. The primary issue is a schema mismatch in EditJobDrawer where `order_id` (singular) is used but the schema requires `order_ids` (array). Secondary issues include missing defaultValues and unsafe array operations.

**Goal:** Fix the crash and ensure Jobs page renders correctly with all worker filtering functionality intact.

**Constraints:**
- Minimal code changes
- No database migrations
- No feature behavior changes
- Maintain backward compatibility

---

## Phase 1 — Reproduce + Confirm Crash Source

### Task 1.1: Identify Crash Location

**Action:** Review code to identify exact crash point

**Expected Findings:**
- EditJobDrawer form initialization fails due to schema mismatch
- `order_id` provided but schema expects `order_ids` array
- Missing `worker_ids` and `assigned_people_ids` in defaultValues

**Validation:**
- Confirm schema mismatch is the root cause
- Identify all affected components

---

## Phase 2 — Fix Schema/Form Default Mismatch (Primary Fix)

### Task 2.1: Update EditJobDrawer DefaultValues

**File:** `src/modules/jobs/components/EditJobDrawer.tsx`

**Changes Required:**
1. Remove `order_id` from defaultValues
2. Add `order_ids: job.order_id ? [job.order_id] : []` to defaultValues
3. Add `worker_ids: []` to defaultValues (will be populated from job_workers)
4. Add `assigned_people_ids: []` to defaultValues
5. Update form.reset() to match new structure
6. Remove `order_id` field from form (if still present in JSX)

**Code Changes:**
```typescript
// Before:
defaultValues: {
  order_id: job.order_id || null,
  // ... other fields
}

// After:
defaultValues: {
  order_ids: job.order_id ? [job.order_id] : [],
  worker_ids: [],
  assigned_people_ids: [],
  // ... other fields (remove order_id)
}
```

**Validation:**
- EditJobDrawer opens without Zod validation errors
- Form initializes correctly

---

### Task 2.2: Populate worker_ids from Job Assignments

**File:** `src/modules/jobs/components/EditJobDrawer.tsx`

**Changes Required:**
- Use `useWorkersByJob(job.id)` to get assigned workers
- Set `worker_ids` in defaultValues from assigned workers
- Update form.reset() to include worker_ids

**Code Changes:**
```typescript
const { data: assignedWorkers } = useWorkersByJob(job.id);

const defaultValues = useMemo(() => ({
  order_ids: job.order_id ? [job.order_id] : [],
  worker_ids: assignedWorkers?.map(w => w.id) || [],
  assigned_people_ids: [],
  // ... other fields
}), [job, assignedWorkers]);
```

**Validation:**
- Worker assignments show correctly in form
- Form updates when workers change

---

### Task 2.3: Update Schema Defaults (Optional Safety)

**File:** `src/modules/jobs/schemas/job.schema.ts`

**Changes Required:**
- Ensure `worker_ids` has `.default([])` for extra safety
- Consider making `order_ids` optional with default for EditJobDrawer compatibility

**Code Changes:**
```typescript
// Option 1: Keep as-is (order_ids required for CreateJobDrawer)
order_ids: z.array(z.string().uuid()).min(1, 'At least one order is required'),

// Option 2: Make optional for EditJobDrawer (if needed)
// order_ids: z.array(z.string().uuid()).optional().default([]),
```

**Decision:** Keep `order_ids` required (CreateJobDrawer needs it), ensure EditJobDrawer always provides it

**Validation:**
- Schema validation works for both CreateJobDrawer and EditJobDrawer

---

## Phase 3 — Defensive Rendering + Safe Queries (Secondary Fixes)

### Task 3.1: Add Guards in JobsPage

**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Changes Required:**
1. Guard `jobsData` access: `const jobs = jobsData || []`
2. Guard worker filter badge rendering
3. Ensure `selectedWorkerIds` is always initialized as array

**Code Changes:**
```typescript
// Ensure jobsData is always an array
const jobs = jobsData || [];

// Guard worker badge rendering
{selectedWorkerIds.map((workerId) => {
  const worker = workers?.find(w => w.id === workerId);
  if (!worker) return null; // Guard against undefined
  return <Badge key={workerId}>...</Badge>;
})}
```

**Validation:**
- JobsPage renders with undefined jobsData
- Worker filter badges don't crash on missing workers

---

### Task 3.2: Ensure Safe Query Execution

**File:** `src/modules/jobs/hooks/useJobs.ts`

**Changes Required:**
- Add explicit guard before worker filtering
- Ensure return type is always array (never undefined)

**Code Changes:**
```typescript
async function fetchJobs(options?: { workerIds?: string[] }) {
  let query = supabase.from('jobs').select('*')...;

  // Explicit guard: only filter if workerIds exist and have items
  if (options?.workerIds && Array.isArray(options.workerIds) && options.workerIds.length > 0) {
    // ... existing filtering logic
  }

  const { data, error } = await query;
  if (error) throw error;
  // Ensure always returns array
  return (data || []) as Job[];
}
```

**Validation:**
- Query works with undefined workerIds
- Query works with empty workerIds array
- Always returns array type

---

## Phase 4 — Validation

### Task 4.1: Test Jobs Page Scenarios

**Test Cases:**
1. Navigate to Jobs page with no worker filter
2. Navigate to Jobs page with worker filter selected
3. Navigate to Jobs page with worker filter that has no matching jobs
4. Open EditJobDrawer for existing job
5. Open CreateJobDrawer
6. Filter jobs by worker(s)

**Expected Results:**
- All scenarios render without blank screen
- No console errors
- All functionality works

---

### Task 4.2: Verify Build and Lint

**Actions:**
1. Run `npm run build` - must pass
2. Run `npm run lint` - must pass
3. Check for any TypeScript errors

**Validation:**
- Build succeeds
- No new linting errors
- No TypeScript compilation errors

---

## Deliverables Summary

- ✅ EditJobDrawer defaultValues fixed (order_ids, worker_ids, assigned_people_ids)
- ✅ JobsPage defensive guards added
- ✅ fetchJobs query safety improved
- ✅ Jobs page renders correctly in all scenarios
- ✅ No runtime crashes
- ✅ Build and lint pass

---

## Progress Tracking

- [ ] Phase 1: Reproduce + Confirm Crash Source
- [ ] Phase 2: Fix Schema/Form Default Mismatch
- [ ] Phase 3: Defensive Rendering + Safe Queries
- [ ] Phase 4: Validation

