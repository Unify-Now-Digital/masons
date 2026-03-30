# Research: Fix Blank Jobs Page After Workers Integration

## Technical Decisions

### Schema Mismatch Resolution

1. **Order ID Handling**
   - **Decision:** Map `order_id` (legacy scalar) to `order_ids` (array) in EditJobDrawer
   - **Rationale:** Schema requires array, but existing jobs have scalar `order_id`. Convert on form init.
   - **Implementation:** `order_ids: job.order_id ? [job.order_id] : []`

2. **Worker IDs Population**
   - **Decision:** Fetch assigned workers via `useWorkersByJob()` and populate `worker_ids` in form
   - **Rationale:** Workers are stored in join table, not on job directly. Must fetch separately.
   - **Implementation:** Use existing hook, map to IDs array

3. **Schema Defaults**
   - **Decision:** Keep `order_ids` required (`.min(1)`) for CreateJobDrawer, ensure EditJobDrawer always provides it
   - **Rationale:** CreateJobDrawer needs validation, EditJobDrawer can provide empty array initially
   - **Alternative Considered:** Make `order_ids` optional (rejected - breaks CreateJobDrawer validation)

### Defensive Programming Patterns

1. **Array Initialization**
   - **Decision:** Always initialize arrays as `[]` not `undefined`
   - **Rationale:** Prevents `.map()` and `.length` errors
   - **Pattern:** `const items = data || []`

2. **Optional Chaining**
   - **Decision:** Use `?.` for nested property access
   - **Rationale:** Prevents crashes on undefined/null
   - **Pattern:** `workers?.find(...) || null`

3. **Query Guards**
   - **Decision:** Explicit length checks before array operations
   - **Rationale:** Prevents Supabase `.in()` with empty arrays
   - **Pattern:** `if (array && array.length > 0) { ... }`

## Root Cause Analysis

### Primary Cause: Zod Schema Validation Failure

**Problem:**
- `jobFormSchema` expects `order_ids: z.array(...).min(1)`
- `EditJobDrawer` provides `order_id: null` (scalar, not array)
- Zod throws validation error on form initialization
- React Hook Form resolver catches error, component crashes

**Evidence:**
- Schema requires array, form provides scalar
- Missing required fields in defaultValues
- Form validation runs on mount

### Secondary Causes

1. **Missing DefaultValues**
   - `worker_ids` not provided (optional but should be explicit)
   - `assigned_people_ids` not provided (optional but should be explicit)
   - Causes undefined values in form state

2. **Unsafe Array Access**
   - Worker filter badges may access undefined workers
   - No guards on `.map()` operations

3. **Query Edge Cases**
   - Worker filter with no matches returns empty array (safe)
   - But if query itself fails, may return undefined

## Error Scenarios

### Scenario 1: EditJobDrawer Opens
- Form initializes with `order_id: null`
- Zod expects `order_ids: string[]`
- Validation fails → crash

### Scenario 2: JobsPage with Worker Filter
- Worker filter selected but worker deleted
- Badge tries to render undefined worker
- `.map()` or property access fails → crash

### Scenario 3: JobsPage with No Data
- `useJobsList` returns `undefined` during loading
- Component tries to access `jobsData.length`
- Undefined access → crash

## Fix Strategy

### Immediate Fix (Phase 2)
- Fix EditJobDrawer defaultValues to match schema
- Populate worker_ids from job assignments
- Ensure all array fields have defaults

### Defensive Fixes (Phase 3)
- Add guards in JobsPage for undefined data
- Add guards in worker filter badge rendering
- Ensure query always returns array

### Validation (Phase 4)
- Test all scenarios
- Verify no crashes
- Ensure functionality preserved

## Testing Strategy

1. **Unit Testing:**
   - Test EditJobDrawer form initialization
   - Test defaultValues structure
   - Test schema validation

2. **Integration Testing:**
   - Test JobsPage with various data states
   - Test worker filtering edge cases
   - Test EditJobDrawer opening/closing

3. **Manual Testing:**
   - Navigate to Jobs page
   - Open EditJobDrawer
   - Test worker filtering
   - Verify no console errors

## Performance Considerations

- Worker assignments fetch is separate query (acceptable)
- Form initialization happens once per drawer open
- No performance impact expected

## Security Considerations

- No security implications
- All changes are UI-only
- No data access changes

