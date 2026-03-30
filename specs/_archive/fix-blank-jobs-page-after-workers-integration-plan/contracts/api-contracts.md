# API Contracts: Fix Blank Jobs Page

## No API Changes Required

This fix is **UI-only** and does not require any API contract changes. All fixes are in:
- Form schema defaults
- Component rendering guards
- Query safety checks

## Existing Contracts (Unchanged)

### GET /jobs

**Description:** Fetch list of jobs with optional worker filtering.

**Query Parameters:**
- `workerIds` (string[], optional) - Filter jobs by assigned worker(s)

**Response:**
```typescript
Job[]
```

**Behavior:**
- If `workerIds` not provided: Returns all jobs
- If `workerIds` provided: Returns jobs with at least one matching worker
- If no matching jobs: Returns empty array `[]`
- Always returns array (never undefined)

**Error Cases:**
- Database connection error
- RLS policy violation

---

### GET /job_workers?job_id=:jobId

**Description:** Fetch workers assigned to a job.

**Query Parameters:**
- `job_id` (string, required) - Job UUID

**Response:**
```typescript
Worker[]
```

**Behavior:**
- Returns array of workers assigned to job
- Returns empty array if no workers assigned
- Never returns undefined

---

## Validation Requirements

### Form Schema Validation

**Schema:** `jobFormSchema` from `src/modules/jobs/schemas/job.schema.ts`

**Required Fields:**
- `order_ids: string[]` - Must have at least 1 item (`.min(1)`)
- `location_name: string` - Required, non-empty
- `address: string` - Required, non-empty

**Optional Fields:**
- `worker_ids?: string[]` - Optional, defaults to `[]`
- `assigned_people_ids?: string[]` - Optional, defaults to `[]`

**Validation Rules:**
- All required fields must be provided
- Arrays must be arrays (not null/undefined)
- UUIDs must be valid UUID format

---

## Error Handling

### Form Validation Errors

**Scenario:** EditJobDrawer form initialization fails

**Cause:** Schema mismatch (order_id vs order_ids)

**Fix:** Provide correct defaultValues matching schema

**Prevention:** Always ensure defaultValues match schema structure

---

### Query Errors

**Scenario:** fetchJobs returns undefined

**Cause:** Query error or edge case

**Fix:** Always return array: `return (data || []) as Job[]`

**Prevention:** Guard return values, never return undefined

---

### Rendering Errors

**Scenario:** Component crashes on undefined data

**Cause:** Accessing properties on undefined

**Fix:** Guard all data access: `const items = data || []`

**Prevention:** Always initialize arrays, use optional chaining

---

## Testing Requirements

### Unit Tests (Recommended)

```typescript
describe('EditJobDrawer', () => {
  it('should initialize form with correct defaultValues', () => {
    const job = { id: '1', order_id: 'order-1', ... };
    const { result } = renderHook(() => useForm({...}));
    expect(result.current.formState.defaultValues.order_ids).toEqual(['order-1']);
    expect(result.current.formState.defaultValues.worker_ids).toEqual([]);
  });
});

describe('fetchJobs', () => {
  it('should return array even when query fails', async () => {
    const result = await fetchJobs({ workerIds: ['invalid'] });
    expect(Array.isArray(result)).toBe(true);
  });
});
```

### Integration Tests

- Test JobsPage renders with undefined jobsData
- Test EditJobDrawer opens without errors
- Test worker filtering with no matches
- Test worker filter badge rendering with missing workers

---

## Backward Compatibility

### No Breaking Changes

- All changes are additive or defensive
- No API contract changes
- No database schema changes
- Existing functionality preserved

### Migration Path

- No migration needed
- Changes are immediate
- Existing jobs continue to work
- Worker assignments preserved

