# Data Model: Fix Blank Jobs Page

## Current Schema Structure

### Job Form Schema

**File:** `src/modules/jobs/schemas/job.schema.ts`

**Schema Definition:**
```typescript
export const jobFormSchema = z.object({
  // Database fields
  location_name: z.string().trim().min(1, 'Location name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: z.enum([...]).default('scheduled'),
  scheduled_date: z.string().optional().nullable(),
  estimated_duration: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().optional().or(z.literal('')),
  
  // UI-only fields (not saved to database)
  order_ids: z.array(z.string().uuid()).min(1, 'At least one order is required'),
  assigned_people_ids: z.array(z.string().uuid()).optional(),
  worker_ids: z.array(z.string().uuid()).optional(),
});
```

**Issues:**
- `order_ids` is required with `.min(1)` - causes issues in EditJobDrawer
- `worker_ids` is optional but no default - may be undefined
- `assigned_people_ids` is optional but no default - may be undefined

### Job Database Schema

**Table:** `public.jobs`

**Fields:**
- `id` (uuid, PK)
- `order_id` (uuid, nullable, legacy field)
- `customer_name` (text, legacy field)
- `location_name` (text)
- `address` (text)
- ... other fields

**Observations:**
- Database has `order_id` (singular, nullable)
- Form schema expects `order_ids` (plural, array, required)
- Mismatch causes validation failure

### Job-Worker Relationship

**Table:** `public.job_workers`

**Fields:**
- `job_id` (uuid, FK → jobs.id)
- `worker_id` (uuid, FK → workers.id)
- `created_at` (timestamptz)

**Observations:**
- Workers stored in join table, not on job directly
- Must query separately to get assigned workers
- Form needs to populate `worker_ids` from this query

---

## Data Flow Issues

### EditJobDrawer Form Initialization

**Current Flow:**
1. Component receives `job` prop
2. Form initializes with `defaultValues` from `job`
3. `job` has `order_id` (scalar) but schema expects `order_ids` (array)
4. Zod validation fails → crash

**Fixed Flow:**
1. Component receives `job` prop
2. Fetch assigned workers via `useWorkersByJob(job.id)`
3. Form initializes with:
   - `order_ids: job.order_id ? [job.order_id] : []`
   - `worker_ids: assignedWorkers?.map(w => w.id) || []`
   - `assigned_people_ids: []`
4. Zod validation passes → form renders

### JobsPage Data Loading

**Current Flow:**
1. `useJobsList({ workerIds })` called
2. If `workerIds` undefined, query runs normally
3. If `workerIds` provided, filter applied
4. Component receives `jobsData` (may be undefined during loading)
5. Component accesses `jobsData.length` → crash if undefined

**Fixed Flow:**
1. `useJobsList({ workerIds })` called
2. Query always returns array (never undefined)
3. Component uses `const jobs = jobsData || []`
4. Safe access to array methods

---

## Type Mappings

### JobFormData Type

```typescript
type JobFormData = {
  location_name: string;
  address: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  status: 'scheduled' | 'in_progress' | ...;
  scheduled_date: string | null | undefined;
  estimated_duration: string;
  priority: 'low' | 'medium' | 'high';
  notes: string;
  order_ids: string[]; // Required, min 1
  assigned_people_ids?: string[]; // Optional
  worker_ids?: string[]; // Optional
}
```

### Job Database Type

```typescript
interface Job {
  id: string;
  order_id: string | null; // Legacy, singular
  customer_name: string; // Legacy
  location_name: string;
  address: string;
  // ... other fields
}
```

### Conversion Required

**Job → JobFormData:**
- `order_id: string | null` → `order_ids: string[]`
- Workers from `job_workers` → `worker_ids: string[]`
- People from notes or separate query → `assigned_people_ids: string[]`

---

## Validation Rules

### Schema Validation

1. **order_ids:**
   - Required: Yes
   - Min length: 1
   - Type: `string[]`
   - Default: `[]` (but validation requires min 1)

2. **worker_ids:**
   - Required: No
   - Type: `string[] | undefined`
   - Default: `[]` (should be explicit)

3. **assigned_people_ids:**
   - Required: No
   - Type: `string[] | undefined`
   - Default: `[]` (should be explicit)

### Form Validation

- Zod validates on form initialization
- React Hook Form resolver catches errors
- Errors cause component crash if not handled

---

## Edge Cases

### Case 1: Job with No Order
- `job.order_id = null`
- Form needs: `order_ids: []`
- But schema requires `.min(1)`
- **Solution:** Provide `order_ids: []` but validation will fail if user tries to submit
- **Better:** Make `order_ids` optional for EditJobDrawer, or always provide at least one

### Case 2: Job with No Workers
- No entries in `job_workers` table
- Form needs: `worker_ids: []`
- **Solution:** Default to `[]`, safe

### Case 3: Worker Deleted but Still Assigned
- Worker in `job_workers` but `workers.is_active = false`
- Form should still show worker (or filter them out)
- **Solution:** Fetch all workers, filter active/inactive in UI if needed

### Case 4: JobsPage with No Jobs
- `useJobsList` returns `[]`
- Component should show empty state
- **Solution:** Guard against undefined, handle empty array

---

## Fix Requirements

1. **EditJobDrawer:**
   - Map `order_id` → `order_ids`
   - Fetch and populate `worker_ids`
   - Provide all required schema fields

2. **JobsPage:**
   - Guard `jobsData` access
   - Guard worker filter rendering
   - Handle empty states

3. **fetchJobs:**
   - Always return array
   - Guard worker filtering
   - Handle edge cases

