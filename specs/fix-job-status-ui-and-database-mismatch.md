# Fix Job status UI and database mismatch

## Overview

Job creation currently fails due to a mismatch between UI status values and the database CHECK constraint on `jobs.status`.

The UI uses human-readable labels (e.g., "Planned"), while the database enforces canonical lowercase values (e.g., "planned", "in_progress", "completed").

This must be fixed without modifying the database schema.

**Context:**
- Job creation form uses status values: `'Planned'`, `'In Progress'`, `'Completed'`
- Database CHECK constraint enforces: `'planned'`, `'in_progress'`, `'completed'`
- Job creation fails with database constraint violation errors
- Existing Jobs remain unchanged (backward compatible)

**Goal:**
- Ensure Job creation succeeds by using canonical database values
- Display human-readable labels in the UI
- Preserve existing database constraints (no schema changes)

---

## Current State Analysis

### Database Constraint

**File:** `supabase/migrations/20250608000003_create_jobs_table.sql`

The `jobs.status` column has a CHECK constraint:
```sql
status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled'))
```

**Note:** Per user specification, the actual database constraint enforces:
- `'planned'`
- `'in_progress'`
- `'completed'`

(If the migration shows different values, the database may have been updated separately. The fix must work with the actual constraint values.)

### Current UI Implementation

**File:** `src/modules/jobs/schemas/job.schema.ts`

Current Zod schema:
```typescript
status: z.enum(['Planned', 'In Progress', 'Completed']).default('Planned'),
```

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

Current UI Select options:
```typescript
<SelectItem value="Planned">Planned</SelectItem>
<SelectItem value="In Progress">In Progress</SelectItem>
<SelectItem value="Completed">Completed</SelectItem>
```

**File:** `src/modules/jobs/hooks/useJobs.ts`

Current TypeScript interface:
```typescript
status: 'Planned' | 'In Progress' | 'Completed';
```

### Problem

1. **Schema Mismatch:** Zod schema accepts `'Planned'`, `'In Progress'`, `'Completed'`
2. **UI Mismatch:** Select component sends `'Planned'`, `'In Progress'`, `'Completed'` to form
3. **Type Mismatch:** TypeScript interface uses human-readable labels
4. **Database Rejection:** Database CHECK constraint rejects these values
5. **Job Creation Failure:** Job creation fails with constraint violation error

---

## Requirements

### Functional Requirements

1. **Status Values**
   - Use DB-compatible values only:
     - `'planned'` (lowercase, no spaces)
     - `'in_progress'` (lowercase, underscore)
     - `'completed'` (lowercase)

2. **UI Label Mapping**
   - Display human-readable labels:
     - `'Planned'` → maps to `'planned'`
     - `'In Progress'` → maps to `'in_progress'`
     - `'Completed'` → maps to `'completed'`

3. **Validation**
   - Update Zod schema to accept only DB-compatible values
   - Ensure submitted payload matches DB constraint
   - Form validation must enforce canonical values

4. **Backward Compatibility**
   - Existing Jobs remain unchanged
   - No database schema changes
   - No migrations
   - Reading existing Jobs must handle any legacy status values

### Non-Functional Requirements

1. **UI/Validation Layer Only**
   - Changes limited to frontend code
   - No database schema changes
   - No migrations

2. **Type Safety**
   - TypeScript types must reflect DB values
   - No type errors or warnings
   - Proper type inference

3. **Error Handling**
   - Clear error messages for invalid status values
   - Graceful handling of legacy status values from DB

---

## In Scope

1. **Job status values**
   - Use DB-compatible values only:
     - `'planned'`
     - `'in_progress'`
     - `'completed'`

2. **UI label mapping**
   - Display human-readable labels in Select dropdown:
     - `'Planned'` (label)
     - `'In Progress'` (label)
     - `'Completed'` (label)
   - Map labels → values at the UI layer (in component or transform utility)

3. **Validation**
   - Update Job Zod schema to accept only DB values
   - Ensure submitted payload matches DB constraint
   - Form validation enforces canonical values

4. **Backward compatibility**
   - Existing Jobs remain unchanged
   - No database schema changes
   - No migrations
   - Transform utility handles legacy status values when reading from DB

---

## Out of Scope

- Changing database CHECK constraints
- Changing existing Job records
- Adding new Job statuses
- Refactoring Jobs list UI (unless required for label display)
- Edit Job drawer (separate task)
- Delete Job dialog (separate task)
- Jobs page table display (separate task, unless required for labels)

---

## Constraints

1. **UI/Validation Layer Only**
   - Changes limited to frontend code
   - Database schema must remain unchanged
   - No migrations allowed

2. **Canonical Values in DB**
   - Database must store: `'planned'`, `'in_progress'`, `'completed'`
   - Labels must not be stored in database

3. **Type Safety**
   - TypeScript must reflect DB values
   - No any types or type assertions without justification

---

## Technical Approach

### Status Value Mapping

Create a mapping utility to convert between UI labels and DB values:

```typescript
// UI label → DB value
export const JOB_STATUS_LABELS = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
} as const;

// DB value → UI label
export const JOB_STATUS_VALUES = {
  'Planned': 'planned',
  'In Progress': 'in_progress',
  'Completed': 'completed',
} as const;

export type JobStatus = keyof typeof JOB_STATUS_LABELS;
```

### Update Zod Schema

**File:** `src/modules/jobs/schemas/job.schema.ts`

Change from:
```typescript
status: z.enum(['Planned', 'In Progress', 'Completed']).default('Planned'),
```

To:
```typescript
status: z.enum(['planned', 'in_progress', 'completed']).default('planned'),
```

### Update TypeScript Interface

**File:** `src/modules/jobs/hooks/useJobs.ts`

Change from:
```typescript
status: 'Planned' | 'In Progress' | 'Completed';
```

To:
```typescript
status: 'planned' | 'in_progress' | 'completed';
```

### Update UI Component

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

Option 1: Use DB values in Select, display labels:
```typescript
<SelectItem value="planned">Planned</SelectItem>
<SelectItem value="in_progress">In Progress</SelectItem>
<SelectItem value="completed">Completed</SelectItem>
```

Option 2: Use a mapping utility to convert labels ↔ values (if form state uses labels).

**Recommendation:** Option 1 (simpler, fewer conversions)

### Update Transform Utility (if exists)

**File:** `src/modules/jobs/utils/jobTransform.ts`

If transform utility exists, ensure it:
1. Uses DB values when creating/updating
2. Handles legacy status values when reading from DB (for backward compatibility)

---

## Implementation Plan

### Phase 1: Create Status Mapping Utility

1. Create utility file for status labels/values mapping
2. Define TypeScript types for status values
3. Export mapping constants

### Phase 2: Update Zod Schema

1. Update `jobFormSchema` to use DB values
2. Update default value to `'planned'`
3. Verify validation works

### Phase 3: Update TypeScript Interface

1. Update `Job` interface to use DB values
2. Update `JobInsert` and `JobUpdate` types
3. Verify type inference

### Phase 4: Update UI Component

1. Update `CreateJobDrawer` Select options to use DB values
2. Update default form value
3. Update status display to show labels (if needed)

### Phase 5: Update Transform Utility

1. Ensure transform uses DB values for insert/update
2. Handle legacy values when reading (backward compatibility)

### Phase 6: Verification

1. Test Job creation with all status values
2. Verify database stores canonical values
3. Verify UI displays labels correctly
4. Test backward compatibility (read existing Jobs)

---

## Success Criteria

- ✅ Job creation succeeds without DB constraint errors
- ✅ `jobs.status` column stores:
  - `'planned'`
  - `'in_progress'`
  - `'completed'`
- ✅ UI displays:
  - `'Planned'`
  - `'In Progress'`
  - `'Completed'`
- ✅ No runtime or TypeScript errors
- ✅ Form validation works correctly
- ✅ Backward compatibility maintained (existing Jobs work)
- ✅ No database schema changes
- ✅ No migrations created

---

## Files to Modify

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/jobs/schemas/job.schema.ts` | Update status enum to DB values | ~1 line |
| `src/modules/jobs/hooks/useJobs.ts` | Update Job interface status type | ~1 line |
| `src/modules/jobs/components/CreateJobDrawer.tsx` | Update Select options to DB values, display labels | ~3 lines |
| `src/modules/jobs/utils/jobTransform.ts` | Ensure uses DB values (if exists) | ~1-5 lines |

**Total Estimated Changes:** ~6-10 lines across 3-4 files

---

## Testing

### Unit Tests

1. **Zod Schema Validation**
   - Test accepts: `'planned'`, `'in_progress'`, `'completed'`
   - Test rejects: `'Planned'`, `'In Progress'`, `'Completed'`, invalid values

2. **Status Mapping Utility** (if created)
   - Test label → value conversion
   - Test value → label conversion

### Integration Tests

1. **Job Creation**
   - Create Job with status `'planned'` → verify DB stores `'planned'`
   - Create Job with status `'in_progress'` → verify DB stores `'in_progress'`
   - Create Job with status `'completed'` → verify DB stores `'completed'`

2. **Backward Compatibility**
   - Read existing Job with legacy status → verify no errors
   - Display existing Job in UI → verify handles gracefully

### Manual Testing

1. Open Create Job drawer
2. Select each status option
3. Verify labels display correctly: "Planned", "In Progress", "Completed"
4. Submit form
5. Verify Job created successfully
6. Verify database stores canonical values

---

## Rollback Plan

If issues occur:

1. Revert changes to modified files
2. Restore previous status enum values
3. No database changes required (no migrations)

---

## Open Questions

1. **Legacy Status Values:** What should happen if an existing Job has status `'scheduled'`, `'ready_for_installation'`, or `'cancelled'`?
   - **Answer:** Transform utility should handle gracefully, map to closest equivalent or display as-is if needed

2. **Status Mapping Utility:** Should this be a shared utility or component-specific?
   - **Answer:** Create as shared utility in `src/modules/jobs/utils/` for reuse

---

## References

- Database migration: `supabase/migrations/20250608000003_create_jobs_table.sql`
- Current schema: `src/modules/jobs/schemas/job.schema.ts`
- Current component: `src/modules/jobs/components/CreateJobDrawer.tsx`
- Current hooks: `src/modules/jobs/hooks/useJobs.ts`

