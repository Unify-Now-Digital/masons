# Quickstart: Fix Blank Jobs Page

## Problem Summary

The Jobs page goes blank after Workers module integration due to a schema mismatch in EditJobDrawer. The form expects `order_ids` (array) but provides `order_id` (scalar), causing Zod validation to fail.

## Quick Fix Steps

### Step 1: Fix EditJobDrawer DefaultValues

**File:** `src/modules/jobs/components/EditJobDrawer.tsx`

**Change defaultValues from:**
```typescript
defaultValues: {
  order_id: job.order_id || null,
  customer_name: job.customer_name,
  // ... other fields
}
```

**To:**
```typescript
const { data: assignedWorkers } = useWorkersByJob(job.id);

const defaultValues = useMemo(() => ({
  order_ids: job.order_id ? [job.order_id] : [],
  worker_ids: assignedWorkers?.map(w => w.id) || [],
  assigned_people_ids: [],
  customer_name: job.customer_name,
  // ... other fields (remove order_id)
}), [job, assignedWorkers]);
```

### Step 2: Update form.reset()

**In the same file, update the useEffect that resets the form:**
```typescript
useEffect(() => {
  form.reset({
    order_ids: job.order_id ? [job.order_id] : [],
    worker_ids: assignedWorkers?.map(w => w.id) || [],
    assigned_people_ids: [],
    // ... other fields
  });
}, [job, assignedWorkers, form]);
```

### Step 3: Add Guards in JobsPage

**File:** `src/modules/jobs/pages/JobsPage.tsx`

**Add guard for jobsData:**
```typescript
const jobs = jobsData || [];
const uiJobs = useMemo<UIJob[]>(() => {
  if (!jobs || jobs.length === 0) return [];
  return transformJobsFromDb(jobs);
}, [jobs]);
```

### Step 4: Guard Worker Filter Badges

**In the same file, guard worker badge rendering:**
```typescript
{selectedWorkerIds.map((workerId) => {
  const worker = workers?.find(w => w.id === workerId);
  if (!worker) return null;
  return <Badge key={workerId}>...</Badge>;
})}
```

## Testing Checklist

- [ ] Navigate to Jobs page - should load
- [ ] Open EditJobDrawer - should open without errors
- [ ] Select worker filter - should filter jobs
- [ ] Clear worker filter - should show all jobs
- [ ] Check browser console - no errors

## Expected Outcome

- Jobs page renders correctly
- EditJobDrawer opens without crashing
- Worker filtering works
- No console errors

