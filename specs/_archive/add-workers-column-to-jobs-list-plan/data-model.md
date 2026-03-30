# Data Model: Add Workers Column to Jobs List

## Current Schema Structure

### Job-Worker Relationship

**Tables:**
- `job_workers` (join table)
  - `job_id` (uuid, FK → jobs.id)
  - `worker_id` (uuid, FK → workers.id)
  - `created_at` (timestamptz)
  - Primary key: `(job_id, worker_id)`
  - Indexes: `idx_job_workers_job_id`, `idx_job_workers_worker_id`

- `workers` (worker table)
  - `id` (uuid, PK)
  - `full_name` (text)
  - `role` (text: installer/driver/stonecutter/other)
  - `is_active` (boolean)
  - `phone` (text, nullable)
  - `notes` (text, nullable)
  - `created_at`, `updated_at` (timestamptz)

**Relationship:**
- Many-to-many: Jobs ↔ Workers
- One job can have multiple workers
- One worker can be on multiple jobs

---

## Data Access Patterns

### Current Single-Job Fetch

**Function:** `fetchWorkersByJob(jobId: string)`

**Query:**
```sql
SELECT job_id, workers.*
FROM job_workers
JOIN workers ON job_workers.worker_id = workers.id
WHERE job_id = $1
```

**Returns:** `Worker[]`

**Usage:** EditJobDrawer, single job details

---

### New Batch Fetch

**Function:** `fetchWorkersByJobs(jobIds: string[])`

**Query:**
```sql
SELECT job_id, workers.*
FROM job_workers
JOIN workers ON job_workers.worker_id = workers.id
WHERE job_id IN ($1, $2, ..., $N)
```

**Returns:** `Record<string, Worker[]>` (mapping by job_id)

**Usage:** JobsPage table, multiple jobs at once

---

## Data Transformation

### Query Result Structure

**Supabase Query Result:**
```typescript
[
  { job_id: 'job1', workers: { id: 'w1', full_name: 'John Doe', ... } },
  { job_id: 'job1', workers: { id: 'w2', full_name: 'Jane Smith', ... } },
  { job_id: 'job2', workers: { id: 'w1', full_name: 'John Doe', ... } },
]
```

**Client-Side Grouping:**
```typescript
{
  'job1': [
    { id: 'w1', full_name: 'John Doe', ... },
    { id: 'w2', full_name: 'Jane Smith', ... },
  ],
  'job2': [
    { id: 'w1', full_name: 'John Doe', ... },
  ],
}
```

---

## Type Definitions

### API Return Type

```typescript
type WorkersByJobId = Record<string, Worker[]>;

// Example:
{
  'job-uuid-1': [worker1, worker2],
  'job-uuid-2': [worker3],
  'job-uuid-3': [], // No workers
}
```

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

---

## Edge Cases

### Empty jobIds Array

**Input:** `[]`

**Behavior:**
- Return `{}` immediately
- No database query
- Hook disabled

**Output:** `{}`

---

### Jobs with No Workers

**Input:** `['job-with-no-workers']`

**Behavior:**
- Query returns no rows for that job
- Grouping creates empty array

**Output:** `{ 'job-with-no-workers': [] }`

---

### Null Workers from Join

**Scenario:** Worker deleted but job_workers row still exists

**Behavior:**
- Filter out null workers in grouping
- Don't include in result array

**Output:** `{ 'job-id': [] }` (if all workers null)

---

### Large Job Lists

**Scenario:** 100+ jobs visible

**Behavior:**
- Single batch query (efficient)
- React Query caches result
- Monitor performance

**Consideration:** May need pagination if performance degrades

---

## Performance Characteristics

### Query Performance

**Single Query:**
- O(1) database round-trips
- Indexed on `job_id` (fast lookup)
- Join with `workers` (indexed on `id`)

**Client-Side Grouping:**
- O(n) where n = number of job_workers rows
- Efficient for typical sizes (10-50 jobs, 1-5 workers each)

### Caching Strategy

**React Query Cache:**
- Key: `['workers', 'byJobs', sortedJobIds]`
- Stable key (sorted jobIds)
- Automatic invalidation on worker updates
- Prevents unnecessary refetches

---

## Data Flow

### JobsPage Component

1. **Get visible jobs:** `filteredJobs` (from search/filter)
2. **Extract job IDs:** `jobIds = filteredJobs.map(j => j.id)`
3. **Fetch workers:** `useWorkersByJobs(jobIds)`
4. **Get workers for job:** `workersByJobId[job.id] ?? []`
5. **Render chips:** Map workers to Badge components

### React Query Flow

1. **Query triggered:** When `jobIds` changes
2. **API call:** `fetchWorkersByJobs(jobIds)`
3. **Database query:** Single query with join
4. **Client grouping:** Transform to `Record<string, Worker[]>`
5. **Cache result:** Store in React Query cache
6. **Return data:** Component receives workers mapping

---

## Validation Requirements

### Input Validation

**jobIds:**
- Must be array of strings (UUIDs)
- Can be empty array (handled gracefully)
- No need to validate UUID format (Supabase handles)

### Output Validation

**WorkersByJobId:**
- All keys are job IDs from input
- All values are arrays (never null/undefined)
- Worker objects are valid Worker type
- No null workers in arrays

---

## Migration Considerations

**No Migrations Needed:**
- All existing tables and relationships unchanged
- No schema modifications
- No data migrations
- Backward compatible

---

## Future Enhancements (Out of Scope)

**Potential Additions:**
- Worker availability status in chips
- Worker role icons/colors
- Click worker chip to filter jobs
- Sort by number of workers

**Not Included:**
- Worker assignment from table
- Worker editing from table
- Worker availability calendar

