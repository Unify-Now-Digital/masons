# Implementation Plan: Map Job status UI labels to database-allowed values

## Overview

This plan fixes Job creation by aligning UI status values with the actual database CHECK constraint. The previous implementation incorrectly used `'planned'`, which doesn't exist in the database. The database requires: `'scheduled'`, `'in_progress'`, `'ready_for_installation'`, `'completed'`, `'cancelled'`.

**Goal:** Fix Job creation by using DB-allowed status values only, mapping human-readable UI labels to DB values, while preserving backward compatibility.

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
status: z.enum(['planned', 'in_progress', 'completed']).default('planned'),
```

**Change Required:**
Update the enum to use all DB-allowed values:
```typescript
status: z.enum(['scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled']).default('scheduled'),
```

**Rationale:**
- Database CHECK constraint requires: `'scheduled'`, `'in_progress'`, `'ready_for_installation'`, `'completed'`, `'cancelled'`
- Remove `'planned'` (not in database)
- Add `'ready_for_installation'` and `'cancelled'` (missing options)
- Change default to `'scheduled'` (matches database default)

**Validation:**
- Schema compiles without errors
- Validation accepts only DB-allowed values
- Default value is `'scheduled'`

---

## Phase 2: Verify TypeScript Interface

### Task 2.1: Verify Job Interface Status Type

**File:** `src/modules/jobs/hooks/useJobs.ts`

**Current State:**
```typescript
status: 'planned' | 'in_progress' | 'completed' | 'scheduled' | 'ready_for_installation' | 'cancelled';
```

**Change Required:**
Update to remove `'planned'` and ensure all DB values are present:
```typescript
status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
```

**Note:** The interface currently includes `'planned'` which is not a valid DB value. We should remove it and keep only the 5 DB-allowed values.

**Rationale:**
- TypeScript types must match database values exactly
- Remove `'planned'` (doesn't exist in database)
- Keep all 5 DB-allowed values

**Validation:**
- TypeScript compiles without errors
- Type inference works correctly
- No type errors in dependent files

---

## Phase 3: Update UI Component

### Task 3.1: Update CreateJobDrawer Select Options

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Location:** Lines 312-316 (Status Select options)

**Current State:**
```typescript
<SelectContent>
  <SelectItem value="planned">Planned</SelectItem>
  <SelectItem value="in_progress">In Progress</SelectItem>
  <SelectItem value="completed">Completed</SelectItem>
</SelectContent>
```

**Change Required:**
Update SelectItem values to use DB-allowed values, add missing options, and map "Planned" to `'scheduled'`:
```typescript
<SelectContent>
  <SelectItem value="scheduled">Planned</SelectItem>
  <SelectItem value="in_progress">In Progress</SelectItem>
  <SelectItem value="ready_for_installation">Ready for Installation</SelectItem>
  <SelectItem value="completed">Completed</SelectItem>
  <SelectItem value="cancelled">Cancelled</SelectItem>
</SelectContent>
```

**Also Update Default Value:**
```typescript
value={field.value || 'scheduled'}
```

**And Update Form Default Values:**
**Location:** Lines 72 and 90

Change from:
```typescript
status: 'planned',
```

To:
```typescript
status: 'scheduled',
```

**Rationale:**
- Select component `value` prop stores the actual database value
- Display text (between tags) shows human-readable label
- "Planned" maps to `'scheduled'` (the DB default)
- Add missing options: `'ready_for_installation'` and `'cancelled'`
- Default value matches database default

**Validation:**
- Select dropdown displays all 5 options with correct labels
- Form submission sends DB-compatible values
- Default value is `'scheduled'`

---

## Phase 4: Update Transform Utility

### Task 4.1: Remove Incorrect Legacy Mapping

**File:** `src/modules/jobs/utils/jobTransform.ts`

**Location:** Lines 32-41 (legacy status mapping)

**Current State:**
```typescript
// Map legacy status values to new values (for backward compatibility)
let statusValue = job.status;
const legacyStatusMap: Record<string, string> = {
  'scheduled': 'planned',
  'ready_for_installation': 'in_progress',
  'cancelled': 'completed',
};
if (legacyStatusMap[job.status]) {
  statusValue = legacyStatusMap[job.status];
}
```

**Change Required:**
Remove the incorrect mapping. Since we're now using the correct DB values, we should pass status through as-is:
```typescript
export function transformJobFromDb(job: Job): UIJob {
  // Status values from database are already correct - pass through as-is
  return {
    id: job.id,
    orderId: job.order_id || null, // Legacy field
    customerName: job.customer_name || '', // Legacy field
    locationName: job.location_name,
    address: job.address,
    latitude: job.latitude,
    longitude: job.longitude,
    status: job.status, // Pass through DB value as-is
    scheduledDate: job.scheduled_date || '',
    estimatedDuration: job.estimated_duration || '',
    priority: job.priority,
    notes: job.notes || '',
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}
```

**Rationale:**
- The previous mapping was incorrect (mapped `'scheduled'` to `'planned'`)
- All UI values now match DB values correctly
- No mapping needed - pass through DB values as-is
- Backward compatibility: existing Jobs already have correct DB values

**Validation:**
- Transform passes status through correctly
- No errors when reading existing Jobs
- All DB status values handled correctly

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
2. Verify status dropdown shows all 5 options with correct labels:
   - "Planned" (maps to `'scheduled'`)
   - "In Progress" (maps to `'in_progress'`)
   - "Ready for Installation" (maps to `'ready_for_installation'`)
   - "Completed" (maps to `'completed'`)
   - "Cancelled" (maps to `'cancelled'`)
3. Verify default selection is "Planned" (which is `'scheduled'`)
4. Select each status option
5. Verify form accepts selection
6. Submit form with each status value
7. Verify no validation errors

**Expected Result:**
- Labels display correctly in UI
- Form accepts all status values
- Validation works correctly
- Default value is correct

### Task 5.3: Database Integration Testing

**Verification Steps:**
1. Create Job with status `'scheduled'` → verify DB stores `'scheduled'`
2. Create Job with status `'in_progress'` → verify DB stores `'in_progress'`
3. Create Job with status `'ready_for_installation'` → verify DB stores `'ready_for_installation'`
4. Create Job with status `'completed'` → verify DB stores `'completed'`
5. Create Job with status `'cancelled'` → verify DB stores `'cancelled'`
6. Verify no database constraint errors

**Expected Result:**
- Job creation succeeds for all status values
- Database stores correct DB values
- No constraint violation errors

### Task 5.4: Backward Compatibility Testing

**Verification Steps:**
1. Read existing Job from database with status `'scheduled'` → verify displays correctly
2. Read existing Job with status `'in_progress'` → verify displays correctly
3. Read existing Job with status `'ready_for_installation'` → verify displays correctly
4. Read existing Job with status `'completed'` → verify displays correctly
5. Read existing Job with status `'cancelled'` → verify displays correctly

**Expected Result:**
- Existing Jobs read successfully
- All status values display correctly
- No errors when handling any status value

---

## Verification Checklist

After completing all phases, verify:

- [ ] Zod schema uses all DB-allowed values: `'scheduled'`, `'in_progress'`, `'ready_for_installation'`, `'completed'`, `'cancelled'`
- [ ] Zod schema default is `'scheduled'`
- [ ] Job interface includes only DB-allowed values (no `'planned'`)
- [ ] CreateJobDrawer Select uses DB values with human-readable labels
- [ ] "Planned" label maps to `'scheduled'` value
- [ ] All 5 status options are available in dropdown
- [ ] Form default value is `'scheduled'`
- [ ] Form reset uses `'scheduled'` as default
- [ ] Transform utility passes status through as-is (no incorrect mapping)
- [ ] Job creation succeeds without DB constraint errors
- [ ] Database stores correct DB values for all status options
- [ ] UI displays human-readable labels correctly
- [ ] TypeScript compilation succeeds
- [ ] No runtime errors
- [ ] Backward compatibility maintained (existing Jobs work)

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/jobs/schemas/job.schema.ts` | Update status enum to all DB-allowed values, change default to `'scheduled'`, remove `'planned'` | 1 line (line 9) |
| `src/modules/jobs/hooks/useJobs.ts` | Remove `'planned'` from status type, keep only DB-allowed values | 1 line (line 12) |
| `src/modules/jobs/components/CreateJobDrawer.tsx` | Update Select options (5 options), change "Planned" to map to `'scheduled'`, update defaults | ~8 lines (lines 72, 90, 305, 313-317) |
| `src/modules/jobs/utils/jobTransform.ts` | Remove incorrect legacy status mapping, pass status through as-is | ~10 lines (lines 31-41) |

**Total Estimated Changes:** ~20 lines across 4 files

---

## Implementation Steps

1. **Phase 1:** Update Zod schema status enum
   - Remove `'planned'`
   - Add `'ready_for_installation'` and `'cancelled'`
   - Change default to `'scheduled'`

2. **Phase 2:** Update Job interface
   - Remove `'planned'` from type union
   - Ensure all 5 DB values are present

3. **Phase 3:** Update CreateJobDrawer component
   - Change "Planned" to map to `'scheduled'` value
   - Add missing Select options
   - Update default form values
   - Update Select default value

4. **Phase 4:** Update transform utility
   - Remove incorrect legacy mapping
   - Pass status through as-is

5. **Phase 5:** Verification and testing
   - Test TypeScript compilation
   - Test form validation
   - Test Job creation with all status values
   - Test backward compatibility

---

## Success Criteria

- ✅ Job creation succeeds without DB constraint errors
- ✅ `jobs.status` column stores only allowed values:
  - `'scheduled'`
  - `'in_progress'`
  - `'ready_for_installation'`
  - `'completed'`
  - `'cancelled'`
- ✅ UI displays human-readable labels:
  - "Planned" (for `'scheduled'`)
  - "In Progress" (for `'in_progress'`)
  - "Ready for Installation" (for `'ready_for_installation'`)
  - "Completed" (for `'completed'`)
  - "Cancelled" (for `'cancelled'`)
- ✅ Default status is `'scheduled'`
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
4. Revert changes to `src/modules/jobs/utils/jobTransform.ts`
5. No database changes required (no migrations)

---

## Notes

1. **Status Mapping:**
   - "Planned" is a UI label that maps to `'scheduled'` (the DB default)
   - This aligns with the database's default value of `'scheduled'`
   - The UI label provides a more intuitive name for users

2. **Previous Implementation Error:**
   - The previous fix incorrectly used `'planned'` which doesn't exist in the database
   - This implementation corrects that by using the actual DB-allowed values
   - The incorrect mapping in transform utility must be removed

3. **Backward Compatibility:**
   - Existing Jobs already have correct DB values (`'scheduled'`, etc.)
   - No data migration needed
   - Transform utility should pass through DB values as-is

4. **Missing Status Options:**
   - Previous implementation was missing `'ready_for_installation'` and `'cancelled'`
   - These are now added to provide full functionality

---

## References

- Specification: `specs/map-job-status-ui-labels-to-database-allowed-values.md`
- Database migration: `supabase/migrations/20250608000003_create_jobs_table.sql`
- Current schema: `src/modules/jobs/schemas/job.schema.ts`
- Current component: `src/modules/jobs/components/CreateJobDrawer.tsx`
- Current hooks: `src/modules/jobs/hooks/useJobs.ts`
- Transform utility: `src/modules/jobs/utils/jobTransform.ts`
- Previous incorrect spec: `specs/fix-job-status-ui-and-database-mismatch.md`

