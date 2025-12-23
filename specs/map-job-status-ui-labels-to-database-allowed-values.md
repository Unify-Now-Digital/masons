# Map Job status UI labels to database-allowed values

## Overview

Job creation currently fails because the UI uses a status value (`'planned'`) that is not allowed by the existing database CHECK constraint.

The database allows only the following status values:
- `'scheduled'`
- `'in_progress'`
- `'ready_for_installation'`
- `'completed'`
- `'cancelled'`

We must align the UI and validation layer to these values without changing the database schema.

**Context:**
- Current implementation uses `'planned'`, `'in_progress'`, `'completed'`
- Database CHECK constraint requires: `'scheduled'`, `'in_progress'`, `'ready_for_installation'`, `'completed'`, `'cancelled'`
- Job creation fails because `'planned'` is not in the allowed list
- Need to map UI labels to correct DB values

**Goal:**
- Fix Job creation by using DB-allowed status values only
- Map human-readable UI labels to DB values
- Preserve backward compatibility
- Avoid any database or migration changes

---

## Current State Analysis

### Database Constraint

**File:** `supabase/migrations/20250608000003_create_jobs_table.sql`

The `jobs.status` column has a CHECK constraint:
```sql
status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled'))
```

**Allowed Values:**
1. `'scheduled'` (default)
2. `'in_progress'`
3. `'ready_for_installation'`
4. `'completed'`
5. `'cancelled'`

### Current Implementation

**File:** `src/modules/jobs/schemas/job.schema.ts`

Current Zod schema:
```typescript
status: z.enum(['planned', 'in_progress', 'completed']).default('planned'),
```

**Problems:**
- Uses `'planned'` which is not in database allowed values
- Missing `'ready_for_installation'` and `'cancelled'` options
- Default is `'planned'` instead of `'scheduled'`

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

Current UI Select options:
```typescript
<SelectItem value="planned">Planned</SelectItem>
<SelectItem value="in_progress">In Progress</SelectItem>
<SelectItem value="completed">Completed</SelectItem>
```

**Problems:**
- Uses `'planned'` value which will fail database constraint
- Missing `'ready_for_installation'` and `'cancelled'` options
- Default value is `'planned'` instead of `'scheduled'`

**File:** `src/modules/jobs/hooks/useJobs.ts`

Current TypeScript interface:
```typescript
status: 'planned' | 'in_progress' | 'completed' | 'scheduled' | 'ready_for_installation' | 'cancelled';
```

**Note:** Interface already includes all DB values, but form schema and UI don't match.

---

## Requirements

### Functional Requirements

1. **Status Values**
   - Use only DB-allowed values:
     - `'scheduled'` (default)
     - `'in_progress'`
     - `'ready_for_installation'`
     - `'completed'`
     - `'cancelled'`

2. **UI Label Mapping**
   - Display user-friendly labels:
     - "Planned" → maps to `'scheduled'`
     - "In Progress" → maps to `'in_progress'`
     - "Ready for Installation" → maps to `'ready_for_installation'`
     - "Completed" → maps to `'completed'`
     - "Cancelled" → maps to `'cancelled'`

3. **Validation**
   - Update Job Zod schema to accept only DB-allowed values
   - Update default status to `'scheduled'`
   - Ensure submitted payload matches DB constraint

4. **Backward Compatibility**
   - Existing Jobs remain unchanged
   - No database schema changes
   - No migrations
   - Reading existing Jobs must handle all status values correctly

### Non-Functional Requirements

1. **UI/Validation Layer Only**
   - Changes limited to frontend code
   - No database schema changes
   - No migrations

2. **Type Safety**
   - TypeScript types must match DB values
   - No type errors or warnings
   - Proper type inference

---

## In Scope

1. **Job status values**
   - Use only DB-allowed values:
     - `'scheduled'`
     - `'in_progress'`
     - `'ready_for_installation'`
     - `'completed'`
     - `'cancelled'`

2. **UI mapping**
   - Display user-friendly labels:
     - Planned → `'scheduled'`
     - In Progress → `'in_progress'`
     - Ready for Installation → `'ready_for_installation'`
     - Completed → `'completed'`
     - Cancelled → `'cancelled'`

3. **Validation**
   - Update Job Zod schema to accept only DB-allowed values
   - Update default status to `'scheduled'`

---

## Out of Scope

- Database schema changes
- CHECK constraint modifications
- Data migrations
- Status renaming in database
- Job history updates
- Edit Job drawer (separate task)
- Jobs list page UI updates (unless required for display)

---

## Constraints

1. **UI and Validation Changes Only**
   - Changes limited to frontend code
   - Database remains unchanged
   - No migrations allowed

2. **Backward Compatibility**
   - Existing Jobs must continue to work
   - No breaking changes to existing data
   - Transform utility must handle all existing status values

3. **Type Safety**
   - TypeScript must reflect DB values
   - No any types or type assertions without justification

---

## Technical Approach

### Update Zod Schema

**File:** `src/modules/jobs/schemas/job.schema.ts`

Change from:
```typescript
status: z.enum(['planned', 'in_progress', 'completed']).default('planned'),
```

To:
```typescript
status: z.enum(['scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled']).default('scheduled'),
```

### Update TypeScript Interface

**File:** `src/modules/jobs/hooks/useJobs.ts`

The interface already includes all DB values, but we should verify it's correct:
```typescript
status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
```

### Update UI Component

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

Update Select options:
```typescript
<SelectContent>
  <SelectItem value="scheduled">Planned</SelectItem>
  <SelectItem value="in_progress">In Progress</SelectItem>
  <SelectItem value="ready_for_installation">Ready for Installation</SelectItem>
  <SelectItem value="completed">Completed</SelectItem>
  <SelectItem value="cancelled">Cancelled</SelectItem>
</SelectContent>
```

Update default value:
```typescript
value={field.value || 'scheduled'}
```

Update form default values:
```typescript
defaultValues: {
  // ... other fields
  status: 'scheduled', // Changed from 'planned'
  // ... other fields
},
```

### Update Transform Utility

**File:** `src/modules/jobs/utils/jobTransform.ts`

Remove or update the legacy status mapping since we're now using the correct DB values:
- No mapping needed for `'scheduled'` (it's already a valid DB value)
- Keep any existing mapping if needed for backward compatibility

---

## Implementation Plan

### Phase 1: Update Zod Schema

1. Update `jobFormSchema` to use all DB-allowed values
2. Update default value to `'scheduled'`
3. Verify validation works

### Phase 2: Verify TypeScript Interface

1. Verify `Job` interface includes all DB-allowed values
2. Ensure type inference works correctly

### Phase 3: Update UI Component

1. Update `CreateJobDrawer` Select options to use DB values
2. Add missing options: `'ready_for_installation'` and `'cancelled'`
3. Update default form value to `'scheduled'`
4. Update form reset value to `'scheduled'`
5. Update Select default value to `'scheduled'`

### Phase 4: Update Transform Utility

1. Remove incorrect legacy mapping (if `'planned'` was mapped)
2. Ensure transform handles all DB values correctly

### Phase 5: Verification

1. Test Job creation with all status values
2. Verify database stores correct values
3. Verify UI displays labels correctly
4. Test backward compatibility

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

## Files to Modify

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/jobs/schemas/job.schema.ts` | Update status enum to all DB-allowed values, change default to `'scheduled'` | 1 line |
| `src/modules/jobs/hooks/useJobs.ts` | Verify interface includes all DB values | 1 line (verify) |
| `src/modules/jobs/components/CreateJobDrawer.tsx` | Update Select options, add missing options, update defaults | ~8 lines |
| `src/modules/jobs/utils/jobTransform.ts` | Remove incorrect mapping for `'planned'` (if exists) | ~5 lines (if needed) |

**Total Estimated Changes:** ~10-15 lines across 3-4 files

---

## Testing

### Unit Tests

1. **Zod Schema Validation**
   - Test accepts: `'scheduled'`, `'in_progress'`, `'ready_for_installation'`, `'completed'`, `'cancelled'`
   - Test rejects: `'planned'`, invalid values
   - Test default value is `'scheduled'`

### Integration Tests

1. **Job Creation**
   - Create Job with status `'scheduled'` → verify DB stores `'scheduled'`
   - Create Job with status `'in_progress'` → verify DB stores `'in_progress'`
   - Create Job with status `'ready_for_installation'` → verify DB stores `'ready_for_installation'`
   - Create Job with status `'completed'` → verify DB stores `'completed'`
   - Create Job with status `'cancelled'` → verify DB stores `'cancelled'`

2. **Backward Compatibility**
   - Read existing Job with any status → verify no errors
   - Display existing Job in UI → verify handles gracefully

### Manual Testing

1. Open Create Job drawer
2. Verify status dropdown shows all 5 options with correct labels
3. Select each status option
4. Verify form accepts selection
5. Submit form
6. Verify Job created successfully
7. Verify database stores correct DB value

---

## Rollback Plan

If issues occur:

1. Revert changes to `src/modules/jobs/schemas/job.schema.ts`
2. Revert changes to `src/modules/jobs/components/CreateJobDrawer.tsx`
3. Revert changes to `src/modules/jobs/utils/jobTransform.ts` (if modified)
4. No database changes required (no migrations)

---

## Notes

1. **Status Mapping:**
   - "Planned" is a UI label that maps to `'scheduled'` (the DB default)
   - This aligns with the database's default value of `'scheduled'`

2. **Backward Compatibility:**
   - Existing Jobs may have any of the 5 allowed status values
   - Transform utility should pass through all DB values as-is
   - No mapping needed since all UI values now match DB values

3. **Previous Implementation:**
   - The previous fix attempted to use `'planned'` which doesn't exist in the database
   - This specification corrects that by using the actual DB-allowed values

---

## References

- Database migration: `supabase/migrations/20250608000003_create_jobs_table.sql`
- Current schema: `src/modules/jobs/schemas/job.schema.ts`
- Current component: `src/modules/jobs/components/CreateJobDrawer.tsx`
- Current hooks: `src/modules/jobs/hooks/useJobs.ts`
- Transform utility: `src/modules/jobs/utils/jobTransform.ts`
- Previous spec: `specs/fix-job-status-ui-and-database-mismatch.md` (incorrect DB values)

