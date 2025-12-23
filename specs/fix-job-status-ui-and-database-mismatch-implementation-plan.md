# Implementation Plan: Fix Job status UI and database mismatch

## Overview

This plan fixes the mismatch between Job status UI values and database CHECK constraint values. The UI currently uses human-readable labels (`'Planned'`, `'In Progress'`, `'Completed'`), but the database requires canonical lowercase values (`'planned'`, `'in_progress'`, `'completed'`).

**Goal:** Ensure Job creation succeeds by using canonical database values while displaying human-readable labels in the UI.

**Constraints:**
- UI/validation layer changes only
- No database schema changes
- No migrations
- Backward compatibility required

---

## Phase 1: Update Zod Schema

### Task 1.1: Update Job Form Schema Status Enum

**File:** `src/modules/jobs/schemas/job.schema.ts`

**Current State:**
```typescript
status: z.enum(['Planned', 'In Progress', 'Completed']).default('Planned'),
```

**Change Required:**
Update the enum to use database-compatible values:
```typescript
status: z.enum(['planned', 'in_progress', 'completed']).default('planned'),
```

**Rationale:**
- Database CHECK constraint requires: `'planned'`, `'in_progress'`, `'completed'`
- Schema validation must match database constraint
- Default value updated to match new enum

**Validation:**
- Schema compiles without errors
- Validation accepts only DB-compatible values
- Default value is `'planned'`

---

## Phase 2: Update TypeScript Interface

### Task 2.1: Update Job Interface Status Type

**File:** `src/modules/jobs/hooks/useJobs.ts`

**Current State:**
```typescript
status: 'Planned' | 'In Progress' | 'Completed';
```

**Change Required:**
Update the type to use database-compatible values:
```typescript
status: 'planned' | 'in_progress' | 'completed';
```

**Rationale:**
- TypeScript types must match database values
- Type safety ensures correct values are used throughout codebase
- `JobInsert` and `JobUpdate` types automatically inherit the change

**Validation:**
- TypeScript compiles without errors
- Type inference works correctly
- No type errors in dependent files

---

## Phase 3: Update UI Component

### Task 3.1: Update CreateJobDrawer Select Options

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Location:** Lines 296-320 (Status Select field)

**Current State:**
```typescript
<SelectContent>
  <SelectItem value="Planned">Planned</SelectItem>
  <SelectItem value="In Progress">In Progress</SelectItem>
  <SelectItem value="Completed">Completed</SelectItem>
</SelectContent>
```

**Change Required:**
Update SelectItem values to use DB-compatible values while keeping human-readable labels:
```typescript
<SelectContent>
  <SelectItem value="planned">Planned</SelectItem>
  <SelectItem value="in_progress">In Progress</SelectItem>
  <SelectItem value="completed">Completed</SelectItem>
</SelectContent>
```

**Also Update Default Value:**
```typescript
value={field.value || 'planned'}
```

**And Update Form Default Values:**
```typescript
defaultValues: {
  // ... other fields
  status: 'planned', // Changed from 'Planned'
  // ... other fields
},
```

**And Update Form Reset:**
```typescript
form.reset({
  // ... other fields
  status: 'planned', // Changed from 'Planned'
  // ... other fields
});
```

**Rationale:**
- Select component `value` prop stores the actual database value
- Display text (between tags) shows human-readable label
- Form state now uses DB-compatible values
- Submission sends correct values to database

**Validation:**
- Select dropdown displays labels correctly
- Form submission sends DB-compatible values
- Default value is `'planned'`

---

## Phase 4: Update Transform Utility

### Task 4.1: Verify Transform Uses DB Values

**File:** `src/modules/jobs/utils/jobTransform.ts`

**Current State:**
The transform utility passes `status` through as-is:
```typescript
status: jobData.status,
```

**Change Required:**
No changes needed. The transform utility already passes status through correctly. However, we should verify:
1. `toJobInsert` receives form data with DB-compatible status values
2. `toJobUpdate` receives form data with DB-compatible status values
3. `transformJobFromDb` handles any legacy status values from database

**Add Legacy Status Handling (Optional but Recommended):**
Update `transformJobFromDb` to handle legacy status values gracefully:
```typescript
export function transformJobFromDb(job: Job): UIJob {
  // Map legacy status values to new values (for backward compatibility)
  let statusValue = job.status;
  const legacyStatusMap: Record<string, string> = {
    'scheduled': 'planned',
    'ready_for_installation': 'in_progress',
    'cancelled': 'completed', // or handle separately
  };
  if (legacyStatusMap[job.status]) {
    statusValue = legacyStatusMap[job.status];
  }
  
  return {
    // ... other fields
    status: statusValue,
    // ... other fields
  };
}
```

**Note:** This is optional. If legacy status values exist, they will be passed through as-is. The UI may need to handle displaying legacy values separately.

**Validation:**
- Transform passes status through correctly
- No errors when reading existing Jobs
- Legacy values handled gracefully (if mapping added)

---

## Phase 5: Verification and Testing

### Task 5.1: TypeScript Compilation

**Verification Steps:**
1. Run `npm run build` to check TypeScript compilation
2. Verify no type errors
3. Verify all imports resolve correctly

**Expected Result:**
- Build succeeds without errors
- No TypeScript errors
- No type warnings

### Task 5.2: Form Validation Testing

**Verification Steps:**
1. Open Create Job drawer
2. Verify status dropdown shows: "Planned", "In Progress", "Completed"
3. Select each status option
4. Verify form accepts selection
5. Submit form with each status value
6. Verify no validation errors

**Expected Result:**
- Labels display correctly in UI
- Form accepts all status values
- Validation works correctly

### Task 5.3: Database Integration Testing

**Verification Steps:**
1. Create Job with status `'planned'`
2. Verify Job created successfully
3. Check database stores `'planned'` in `jobs.status` column
4. Repeat for `'in_progress'` and `'completed'`
5. Verify no database constraint errors

**Expected Result:**
- Job creation succeeds
- Database stores canonical values
- No constraint violation errors

### Task 5.4: Backward Compatibility Testing

**Verification Steps:**
1. Read existing Job from database
2. Verify transform utility handles status correctly
3. Verify UI can display existing Jobs (if they use legacy status values)

**Expected Result:**
- Existing Jobs read successfully
- No errors when displaying legacy status values
- Graceful handling of unexpected status values

---

## Verification Checklist

After completing all phases, verify:

- [ ] Zod schema uses DB-compatible values: `'planned'`, `'in_progress'`, `'completed'`
- [ ] Job interface uses DB-compatible status type
- [ ] CreateJobDrawer Select uses DB values with human-readable labels
- [ ] Form default value is `'planned'`
- [ ] Form reset uses `'planned'` as default
- [ ] Transform utility passes status through correctly
- [ ] Job creation succeeds without DB constraint errors
- [ ] Database stores canonical values: `'planned'`, `'in_progress'`, `'completed'`
- [ ] UI displays human-readable labels: "Planned", "In Progress", "Completed"
- [ ] TypeScript compilation succeeds
- [ ] No runtime errors
- [ ] Backward compatibility maintained (existing Jobs work)

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/jobs/schemas/job.schema.ts` | Update status enum to DB values | 1 line (line 9) |
| `src/modules/jobs/hooks/useJobs.ts` | Update Job interface status type | 1 line (line 12) |
| `src/modules/jobs/components/CreateJobDrawer.tsx` | Update Select options and default values | ~5 lines (lines 63, 83, 305, 313-315) |
| `src/modules/jobs/utils/jobTransform.ts` | Optional: Add legacy status handling | ~10 lines (if implemented) |

**Total Estimated Changes:** ~7-17 lines across 3-4 files

---

## Implementation Steps

1. **Phase 1:** Update Zod schema status enum
   - Change `'Planned'` → `'planned'`
   - Change `'In Progress'` → `'in_progress'`
   - Change `'Completed'` → `'completed'`
   - Update default to `'planned'`

2. **Phase 2:** Update Job interface status type
   - Change type union to use DB-compatible values
   - Verify TypeScript compilation

3. **Phase 3:** Update CreateJobDrawer component
   - Update SelectItem values to DB-compatible values
   - Keep human-readable labels in display text
   - Update default form values
   - Update form reset values

4. **Phase 4:** Verify transform utility
   - Check status is passed through correctly
   - Optionally add legacy status mapping

5. **Phase 5:** Verification and testing
   - Test TypeScript compilation
   - Test form validation
   - Test Job creation
   - Test backward compatibility

---

## Success Criteria

- ✅ Job creation succeeds without DB constraint errors
- ✅ `jobs.status` column stores:
  - `'planned'`
  - `'in_progress'`
  - `'completed'`
- ✅ UI displays:
  - `'Planned'` (label)
  - `'In Progress'` (label)
  - `'Completed'` (label)
- ✅ No runtime or TypeScript errors
- ✅ Form validation works correctly
- ✅ Backward compatibility maintained (existing Jobs work)
- ✅ No database schema changes
- ✅ No migrations created

---

## Rollback Plan

If issues occur:

1. Revert changes to `src/modules/jobs/schemas/job.schema.ts`
2. Revert changes to `src/modules/jobs/hooks/useJobs.ts`
3. Revert changes to `src/modules/jobs/components/CreateJobDrawer.tsx`
4. Revert changes to `src/modules/jobs/utils/jobTransform.ts` (if modified)
5. No database changes required (no migrations)

---

## Notes

1. **Status Mapping Utility:** 
   - Not required for this fix (Option 1 approach)
   - Can be added later if needed for more complex mapping logic

2. **Legacy Status Values:**
   - Existing Jobs may have legacy status values: `'scheduled'`, `'ready_for_installation'`, `'cancelled'`
   - Transform utility can optionally map these, or they can be displayed as-is
   - UI may need separate handling for displaying legacy values

3. **Edit Job Drawer:**
   - This fix focuses on Create Job drawer only
   - Edit Job drawer may need similar updates in a separate task

---

## References

- Specification: `specs/fix-job-status-ui-and-database-mismatch.md`
- Database migration: `supabase/migrations/20250608000003_create_jobs_table.sql`
- Current schema: `src/modules/jobs/schemas/job.schema.ts`
- Current component: `src/modules/jobs/components/CreateJobDrawer.tsx`
- Current hooks: `src/modules/jobs/hooks/useJobs.ts`
- Transform utility: `src/modules/jobs/utils/jobTransform.ts`

