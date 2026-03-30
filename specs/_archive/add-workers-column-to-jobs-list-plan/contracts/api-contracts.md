# API Contracts: Add Workers Column to Jobs List

## New API Function

### `fetchWorkersByJobs(jobIds: string[]): Promise<Record<string, Worker[]>>`

**Description:** Batch fetch workers for multiple jobs in a single query.

**File:** `src/modules/workers/api/workers.api.ts`

**Parameters:**
- `jobIds: string[]` - Array of job UUIDs to fetch workers for

**Returns:**
- `Promise<Record<string, Worker[]>>` - Mapping of job_id to array of workers

**Behavior:**
- If `jobIds.length === 0`, returns `{}` immediately (no query)
- Queries `job_workers` table with `.in('job_id', jobIds)`
- Joins `workers` table to get full worker data
- Groups results by `job_id` in client
- Filters out null workers from join
- Returns empty array `[]` for jobs with no workers

**Example:**
```typescript
const result = await fetchWorkersByJobs(['job1', 'job2', 'job3']);
// Returns:
{
  'job1': [
    { id: 'w1', full_name: 'John Doe', role: 'installer', ... },
    { id: 'w2', full_name: 'Jane Smith', role: 'driver', ... },
  ],
  'job2': [
    { id: 'w3', full_name: 'Bob Johnson', role: 'stonecutter', ... },
  ],
  'job3': [], // No workers assigned
}
```

**Error Handling:**
- Throws Supabase error if query fails
- Handles null workers gracefully (filters out)
- Returns empty object for empty input

---

## New React Query Hook

### `useWorkersByJobs(jobIds: string[]): UseQueryResult<Record<string, Worker[]>>`

**Description:** React Query hook for batch fetching workers by jobs.

**File:** `src/modules/workers/hooks/useWorkers.ts`

**Parameters:**
- `jobIds: string[]` - Array of job UUIDs

**Returns:**
- `UseQueryResult<Record<string, Worker[]>>` with:
  - `data: Record<string, Worker[]> | undefined`
  - `isLoading: boolean`
  - `error: Error | null`
  - Standard React Query properties

**Query Key:**
- `['workers', 'byJobs', sortedJobIds]`
- JobIds are sorted for stable cache key

**Enabled:**
- Only runs when `jobIds.length > 0`
- Disabled for empty arrays

**Caching:**
- Cached by React Query
- Invalidated when workers are updated (via existing invalidation)
- Stable cache key prevents unnecessary refetches

**Example:**
```typescript
const jobIds = ['job1', 'job2'];
const { data: workersByJobId, isLoading } = useWorkersByJobs(jobIds);

// Access workers for a job:
const workers = workersByJobId?.['job1'] ?? [];
```

---

## Existing APIs (Unchanged)

### `fetchWorkersByJob(jobId: string): Promise<Worker[]>`

**Status:** Unchanged, still used by EditJobDrawer

**Behavior:** Fetches workers for a single job

**Usage:** Single job details, EditJobDrawer

---

## Data Types

### Worker Type

```typescript
interface Worker {
  id: string;
  full_name: string;
  role: 'installer' | 'driver' | 'stonecutter' | 'other';
  is_active: boolean;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### WorkersByJobId Type

```typescript
type WorkersByJobId = Record<string, Worker[]>;

// Structure:
{
  [jobId: string]: Worker[];
}
```

---

## Query Patterns

### Supabase Query

**Table:** `job_workers`

**Join:** `workers` (via foreign key)

**Filter:** `job_id IN (jobIds)`

**Select:** `job_id, workers(*)`

**SQL Equivalent:**
```sql
SELECT 
  job_workers.job_id,
  workers.*
FROM job_workers
INNER JOIN workers ON job_workers.worker_id = workers.id
WHERE job_workers.job_id IN ($1, $2, ..., $N)
```

---

## Performance Characteristics

### Query Efficiency

**Single Query:**
- One database round-trip for all jobs
- Indexed on `job_id` (fast lookup)
- Join with `workers` (indexed on `id`)

**Client-Side Grouping:**
- O(n) where n = number of job_workers rows
- Efficient for typical sizes

### Caching

**React Query Cache:**
- Key includes sorted jobIds (stable)
- Automatic invalidation on updates
- Prevents unnecessary refetches

---

## Error Handling

### API Errors

**Supabase Errors:**
- Thrown as exceptions
- Caught by React Query error handling
- Displayed via error state

**Null Workers:**
- Filtered out in grouping
- Not included in result arrays
- Prevents null reference errors

**Empty Input:**
- Returns `{}` immediately
- No query executed
- Hook disabled

---

## Testing Requirements

### Unit Tests

```typescript
describe('fetchWorkersByJobs', () => {
  it('returns empty object for empty jobIds', async () => {
    const result = await fetchWorkersByJobs([]);
    expect(result).toEqual({});
  });

  it('groups workers by job_id', async () => {
    const result = await fetchWorkersByJobs(['job1', 'job2']);
    expect(result).toHaveProperty('job1');
    expect(result).toHaveProperty('job2');
  });

  it('returns empty array for jobs with no workers', async () => {
    const result = await fetchWorkersByJobs(['job-with-no-workers']);
    expect(result['job-with-no-workers']).toEqual([]);
  });

  it('filters out null workers', async () => {
    // Mock Supabase to return null worker
    const result = await fetchWorkersByJobs(['job1']);
    expect(result['job1']).not.toContain(null);
  });
});
```

### Integration Tests

- Test hook with empty jobIds (disabled)
- Test hook with valid jobIds (fetches data)
- Test cache key stability (sorted jobIds)
- Test error handling

---

## Backward Compatibility

**No Breaking Changes:**
- Existing `fetchWorkersByJob` unchanged
- Existing `useWorkersByJob` unchanged
- New functions are additive only
- No schema changes

---

## Security Considerations

**RLS Policies:**
- Uses existing RLS policies on `job_workers` and `workers`
- No new permissions needed
- Read-only operation

**Data Access:**
- Only fetches data user has permission to see
- Respects existing RLS rules

---

## Future Enhancements (Out of Scope)

**Potential Additions:**
- Filter by worker role
- Include worker availability status
- Pagination for large job lists
- Worker assignment from batch fetch

**Not Included:**
- Worker editing
- Worker creation
- Worker deletion

