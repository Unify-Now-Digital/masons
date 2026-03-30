# Data Model: Workers/Team Module + Job Worker Assignments

## Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────────┐         ┌─────────────┐
│   workers   │         │   worker_availability │         │    jobs     │
├─────────────┤         ├──────────────────────┤         ├─────────────┤
│ id (PK)     │◄────────│ worker_id (PK, FK)   │         │ id (PK)     │
│ full_name   │         │ mon_available        │         │ order_id    │
│ phone       │         │ tue_available        │         │ customer_   │
│ role        │         │ wed_available        │         │   name      │
│ notes       │         │ thu_available        │         │ location_   │
│ is_active   │         │ fri_available        │         │   name      │
│ created_at  │         │ sat_available        │         │ address     │
│ updated_at  │         │ sun_available        │         │ status      │
└─────────────┘         │ start_time           │         │ ...         │
                        │ end_time             │         └─────────────┘
                        │ notes                │              │
                        │ updated_at           │              │
                        └──────────────────────┘              │
                                                               │
                                                               │
                        ┌──────────────────────┐              │
                        │     job_workers      │◄─────────────┘
                        ├──────────────────────┤
                        │ job_id (PK, FK)      │
                        │ worker_id (PK, FK)   │
                        │ created_at           │
                        └──────────────────────┘
```

## Table Definitions

### `workers`

**Purpose:** Core worker/team member information

**Columns:**
- `id` (uuid, PK) - Primary key
- `full_name` (text, NOT NULL) - Worker's full name
- `phone` (text, NULL) - Contact phone number
- `role` (text, NOT NULL) - Worker role (CHECK: 'installer', 'driver', 'stonecutter', 'other')
- `notes` (text, NULL) - Additional notes about worker
- `is_active` (boolean, NOT NULL, DEFAULT true) - Soft delete flag
- `created_at` (timestamptz, NOT NULL, DEFAULT now()) - Creation timestamp
- `updated_at` (timestamptz, NOT NULL, DEFAULT now()) - Last update timestamp

**Constraints:**
- CHECK constraint on `role` field
- Default `is_active = true`

**Indexes:**
- Primary key on `id`
- Index on `is_active` for filtering
- Index on `role` for role-based queries

**RLS:**
- Enabled
- Policy: Allow all authenticated users

---

### `worker_availability`

**Purpose:** Weekly availability template per worker (informational only)

**Columns:**
- `worker_id` (uuid, PK, FK → workers.id) - References worker
- `mon_available` (boolean, NOT NULL, DEFAULT true) - Monday availability
- `tue_available` (boolean, NOT NULL, DEFAULT true) - Tuesday availability
- `wed_available` (boolean, NOT NULL, DEFAULT true) - Wednesday availability
- `thu_available` (boolean, NOT NULL, DEFAULT true) - Thursday availability
- `fri_available` (boolean, NOT NULL, DEFAULT true) - Friday availability
- `sat_available` (boolean, NOT NULL, DEFAULT false) - Saturday availability
- `sun_available` (boolean, NOT NULL, DEFAULT false) - Sunday availability
- `start_time` (time, NULL) - Optional start time for availability window
- `end_time` (time, NULL) - Optional end time for availability window
- `notes` (text, NULL) - Additional availability notes
- `updated_at` (timestamptz, NOT NULL, DEFAULT now()) - Last update timestamp

**Constraints:**
- Primary key on `worker_id` (one-to-one with workers)
- Foreign key to `workers.id` with CASCADE delete

**Indexes:**
- Primary key on `worker_id`

**RLS:**
- Enabled
- Policy: Allow all authenticated users

**Default Values:**
- Mon-Fri: `true` (available)
- Sat-Sun: `false` (not available)

---

### `job_workers`

**Purpose:** Many-to-many join table linking jobs and workers

**Columns:**
- `job_id` (uuid, NOT NULL, FK → jobs.id) - References job
- `worker_id` (uuid, NOT NULL, FK → workers.id) - References worker
- `created_at` (timestamptz, NOT NULL, DEFAULT now()) - Assignment timestamp

**Constraints:**
- Composite primary key on `(job_id, worker_id)` - Prevents duplicate assignments
- Foreign key to `jobs.id` with CASCADE delete (clean up when job deleted)
- Foreign key to `workers.id` with RESTRICT delete (prevent deletion if assigned)

**Indexes:**
- Composite primary key on `(job_id, worker_id)`
- Index on `job_id` for job → workers lookups
- Index on `worker_id` for worker → jobs lookups

**RLS:**
- Enabled
- Policy: Allow all authenticated users

---

## Relationships

### Workers ↔ Worker Availability
- **Type:** One-to-one
- **Cardinality:** 1:1
- **Foreign Key:** `worker_availability.worker_id` → `workers.id`
- **Delete Behavior:** CASCADE (delete availability when worker deleted)
- **Notes:** Optional relationship (availability may not exist for all workers)

### Jobs ↔ Workers (via job_workers)
- **Type:** Many-to-many
- **Cardinality:** N:M
- **Join Table:** `job_workers`
- **Foreign Keys:**
  - `job_workers.job_id` → `jobs.id` (CASCADE)
  - `job_workers.worker_id` → `workers.id` (RESTRICT)
- **Notes:** 
  - A job can have multiple workers
  - A worker can be assigned to multiple jobs
  - Composite primary key prevents duplicate assignments

---

## Data Access Patterns

### Fetching Workers

**List all active workers:**
```sql
SELECT * FROM workers 
WHERE is_active = true 
ORDER BY full_name;
```

**Search workers:**
```sql
SELECT * FROM workers 
WHERE (full_name ILIKE '%search%' OR phone ILIKE '%search%')
  AND is_active = true;
```

**Fetch worker with availability:**
```sql
SELECT w.*, wa.* 
FROM workers w
LEFT JOIN worker_availability wa ON w.id = wa.worker_id
WHERE w.id = $1;
```

### Fetching Job-Worker Assignments

**Get workers assigned to a job:**
```sql
SELECT w.* 
FROM workers w
INNER JOIN job_workers jw ON w.id = jw.worker_id
WHERE jw.job_id = $1;
```

**Get jobs assigned to a worker:**
```sql
SELECT j.* 
FROM jobs j
INNER JOIN job_workers jw ON j.id = jw.job_id
WHERE jw.worker_id = $1;
```

**Filter jobs by worker(s):**
```sql
SELECT DISTINCT j.* 
FROM jobs j
INNER JOIN job_workers jw ON j.id = jw.job_id
WHERE jw.worker_id = ANY($1::uuid[]);
```

### Setting Job-Worker Assignments

**Replace all assignments (delete + insert):**
```sql
-- Delete existing
DELETE FROM job_workers WHERE job_id = $1;

-- Insert new
INSERT INTO job_workers (job_id, worker_id)
VALUES ($1, $2), ($1, $3), ...;
```

---

## TypeScript Type Mappings

### Worker
```typescript
interface Worker {
  id: string;                    // uuid
  full_name: string;             // text
  phone: string | null;           // text nullable
  role: 'installer' | 'driver' | 'stonecutter' | 'other';  // text with CHECK
  notes: string | null;           // text nullable
  is_active: boolean;             // boolean
  created_at: string;             // timestamptz (ISO string)
  updated_at: string;             // timestamptz (ISO string)
}
```

### WorkerAvailability
```typescript
interface WorkerAvailability {
  worker_id: string;             // uuid (PK, FK)
  mon_available: boolean;        // boolean
  tue_available: boolean;        // boolean
  wed_available: boolean;        // boolean
  thu_available: boolean;        // boolean
  fri_available: boolean;        // boolean
  sat_available: boolean;        // boolean
  sun_available: boolean;        // boolean
  start_time: string | null;     // time nullable (HH:MM:SS)
  end_time: string | null;       // time nullable (HH:MM:SS)
  notes: string | null;          // text nullable
  updated_at: string;            // timestamptz (ISO string)
}
```

### JobWorker
```typescript
interface JobWorker {
  job_id: string;                // uuid (PK, FK)
  worker_id: string;              // uuid (PK, FK)
  created_at: string;             // timestamptz (ISO string)
}
```

---

## Constraints & Business Rules

1. **Worker Role**
   - Must be one of: 'installer', 'driver', 'stonecutter', 'other'
   - Enforced by CHECK constraint

2. **Worker Availability**
   - Defaults: Mon-Fri available, Sat-Sun not available
   - Optional time window (start_time, end_time)
   - One availability record per worker (primary key on worker_id)

3. **Job-Worker Assignment**
   - No duplicate assignments (composite primary key)
   - Worker cannot be deleted if assigned to jobs (RESTRICT)
   - Job deletion removes all assignments (CASCADE)

4. **Soft Delete**
   - Workers use `is_active` flag, no hard delete
   - UI should filter by `is_active = true` by default
   - Historical assignments preserved even if worker deactivated

---

## Migration Strategy

All migrations are **additive only**:
- No modifications to existing tables
- No column deletions
- No table renames
- Backward compatible

**Migration Order:**
1. `workers` table
2. `worker_availability` table (depends on workers)
3. `job_workers` table (depends on workers and jobs)

