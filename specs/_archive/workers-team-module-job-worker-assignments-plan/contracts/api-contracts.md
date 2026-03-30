# API Contracts: Workers/Team Module

## Base URL
All API endpoints use Supabase PostgREST via the Supabase client.

---

## Workers API

### GET /workers

**Description:** Fetch list of workers with optional filtering.

**Query Parameters:**
- `search` (string, optional) - Search by name or phone
- `activeOnly` (boolean, optional) - Filter to active workers only

**Response:**
```typescript
Worker[]
```

**Example:**
```typescript
const workers = await fetchWorkers({ 
  search: 'john', 
  activeOnly: true 
});
```

**Error Cases:**
- Database connection error
- RLS policy violation

---

### GET /workers/:id

**Description:** Fetch single worker by ID.

**Path Parameters:**
- `id` (string, required) - Worker UUID

**Response:**
```typescript
Worker
```

**Error Cases:**
- Worker not found (404)
- Invalid UUID format

---

### GET /workers/:id/with-availability

**Description:** Fetch worker with availability information.

**Path Parameters:**
- `id` (string, required) - Worker UUID

**Response:**
```typescript
Worker & { worker_availability: WorkerAvailability | null }
```

**Error Cases:**
- Worker not found (404)

---

### POST /workers

**Description:** Create a new worker.

**Request Body:**
```typescript
WorkerInsert
```

**Response:**
```typescript
Worker
```

**Validation:**
- `full_name` required, non-empty
- `role` must be one of: 'installer', 'driver', 'stonecutter', 'other'
- `phone` optional, can be null
- `notes` optional, can be null
- `is_active` defaults to true

**Error Cases:**
- Validation error (400)
- Database constraint violation

---

### PATCH /workers/:id

**Description:** Update worker information.

**Path Parameters:**
- `id` (string, required) - Worker UUID

**Request Body:**
```typescript
WorkerUpdate (all fields optional)
```

**Response:**
```typescript
Worker
```

**Error Cases:**
- Worker not found (404)
- Validation error (400)
- Database constraint violation

---

### POST /worker_availability

**Description:** Create or update worker availability (upsert).

**Request Body:**
```typescript
WorkerAvailabilityInsert
```

**Response:**
```typescript
WorkerAvailability
```

**Behavior:**
- If availability exists for worker_id, updates it
- If not, creates new record
- Uses `worker_id` as conflict key

**Error Cases:**
- Worker not found (404)
- Validation error (400)

---

## Job-Worker Assignment API

### GET /job_workers?job_id=:jobId

**Description:** Fetch all workers assigned to a job.

**Query Parameters:**
- `job_id` (string, required) - Job UUID

**Response:**
```typescript
Worker[]
```

**Example:**
```typescript
const workers = await fetchWorkersByJob('job-uuid');
```

**Error Cases:**
- Job not found
- Database error

---

### POST /job_workers/set

**Description:** Replace all worker assignments for a job (delete existing, insert new).

**Request Body:**
```typescript
{
  jobId: string;
  workerIds: string[];
}
```

**Response:**
```typescript
{
  jobId: string;
  workerIds: string[];
}
```

**Behavior:**
1. Delete all existing `job_workers` records for the job
2. Insert new records for each workerId in the array
3. If workerIds is empty, only deletes (unassigns all)

**Error Cases:**
- Job not found (404)
- Worker not found (404) - one or more workerIds invalid
- Foreign key constraint violation
- Database transaction error

**Example:**
```typescript
await setWorkersForJob('job-uuid', [
  'worker-uuid-1',
  'worker-uuid-2',
]);
```

---

## Jobs API Extensions

### GET /jobs?worker_ids=:workerIds

**Description:** Fetch jobs filtered by assigned worker(s).

**Query Parameters:**
- `worker_ids` (string[], optional) - Array of worker UUIDs

**Response:**
```typescript
Job[]
```

**Behavior:**
- Returns jobs that have at least one of the specified workers assigned
- If worker_ids empty or not provided, returns all jobs (no filter)

**Example:**
```typescript
const jobs = await fetchJobs({ 
  workerIds: ['worker-uuid-1', 'worker-uuid-2'] 
});
```

---

## Type Definitions

### Worker
```typescript
interface Worker {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'installer' | 'driver' | 'stonecutter' | 'other';
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### WorkerAvailability
```typescript
interface WorkerAvailability {
  worker_id: string;
  mon_available: boolean;
  tue_available: boolean;
  wed_available: boolean;
  thu_available: boolean;
  fri_available: boolean;
  sat_available: boolean;
  sun_available: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  updated_at: string;
}
```

### WorkerInsert
```typescript
interface WorkerInsert {
  full_name: string;
  phone?: string | null;
  role: 'installer' | 'driver' | 'stonecutter' | 'other';
  notes?: string | null;
  is_active?: boolean;
}
```

### WorkerUpdate
```typescript
interface WorkerUpdate {
  full_name?: string;
  phone?: string | null;
  role?: 'installer' | 'driver' | 'stonecutter' | 'other';
  notes?: string | null;
  is_active?: boolean;
}
```

### WorkerAvailabilityInsert
```typescript
interface WorkerAvailabilityInsert {
  worker_id: string;
  mon_available?: boolean;
  tue_available?: boolean;
  wed_available?: boolean;
  thu_available?: boolean;
  fri_available?: boolean;
  sat_available?: boolean;
  sun_available?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
}
```

---

## Error Response Format

All errors follow Supabase error format:

```typescript
{
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}
```

**Common Error Codes:**
- `23503` - Foreign key constraint violation
- `23505` - Unique constraint violation
- `23514` - Check constraint violation
- `PGRST116` - Resource not found

---

## Authentication & Authorization

All endpoints require:
- Valid Supabase authentication token
- Authenticated user session

**RLS Policies:**
- All tables have RLS enabled
- Current policy: Allow all authenticated users
- Future: Role-based restrictions possible

---

## Rate Limiting

No explicit rate limiting configured. Supabase default limits apply.

---

## Versioning

No API versioning currently. All endpoints are v1.

---

## Testing

### Unit Test Examples

```typescript
describe('fetchWorkers', () => {
  it('should fetch all active workers', async () => {
    const workers = await fetchWorkers({ activeOnly: true });
    expect(workers.every(w => w.is_active)).toBe(true);
  });

  it('should filter by search term', async () => {
    const workers = await fetchWorkers({ search: 'john' });
    expect(workers.every(w => 
      w.full_name.toLowerCase().includes('john') ||
      w.phone?.includes('john')
    )).toBe(true);
  });
});

describe('setWorkersForJob', () => {
  it('should replace existing assignments', async () => {
    await setWorkersForJob('job-1', ['worker-1', 'worker-2']);
    const workers = await fetchWorkersByJob('job-1');
    expect(workers).toHaveLength(2);
    
    await setWorkersForJob('job-1', ['worker-3']);
    const updatedWorkers = await fetchWorkersByJob('job-1');
    expect(updatedWorkers).toHaveLength(1);
    expect(updatedWorkers[0].id).toBe('worker-3');
  });

  it('should unassign all workers when empty array', async () => {
    await setWorkersForJob('job-1', ['worker-1']);
    await setWorkersForJob('job-1', []);
    const workers = await fetchWorkersByJob('job-1');
    expect(workers).toHaveLength(0);
  });
});
```

