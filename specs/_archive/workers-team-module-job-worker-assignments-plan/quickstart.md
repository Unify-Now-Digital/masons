# Quickstart: Workers/Team Module + Job Worker Assignments

## Overview

This guide provides quick integration scenarios for the Workers module and Job-Worker assignments feature.

---

## Scenario 1: Create a Worker

**Goal:** Create a new worker with basic information and availability.

**Steps:**

1. **Navigate to Workers page**
   ```
   /workers
   ```

2. **Click "New Worker" button**

3. **Fill in form:**
   - Full Name: "John Smith"
   - Phone: "+44 20 1234 5678"
   - Role: "Installer"
   - Notes: "Experienced installer, specializes in headstones"
   - Is Active: ✓ (checked)

4. **Save worker**

5. **Set availability (optional):**
   - Click "Edit" on the worker
   - Go to "Availability" tab
   - Toggle weekdays (default: Mon-Fri available)
   - Optionally set start/end times
   - Save

**Code Example:**
```typescript
import { useCreateWorker, useUpsertWorkerAvailability } from '@/modules/workers/hooks/useWorkers';

function CreateWorkerExample() {
  const createWorker = useCreateWorker();
  const upsertAvailability = useUpsertWorkerAvailability();

  const handleCreate = async () => {
    // Create worker
    const worker = await createWorker.mutateAsync({
      full_name: 'John Smith',
      phone: '+44 20 1234 5678',
      role: 'installer',
      notes: 'Experienced installer',
      is_active: true,
    });

    // Set availability (optional)
    await upsertAvailability.mutateAsync({
      worker_id: worker.id,
      mon_available: true,
      tue_available: true,
      wed_available: true,
      thu_available: true,
      fri_available: true,
      sat_available: false,
      sun_available: false,
      start_time: '08:00',
      end_time: '17:00',
    });
  };
}
```

---

## Scenario 2: Assign Workers to a Job During Creation

**Goal:** Create a new job and assign workers at the same time.

**Steps:**

1. **Navigate to Jobs page or Map page**

2. **Click "Create Job"**

3. **Fill in job details:**
   - Location, address, etc.

4. **In "Workers" section:**
   - Select workers from multi-select dropdown
   - Only active workers shown by default
   - Can toggle "Include inactive" if needed

5. **Save job**

**Code Example:**
```typescript
import { useCreateJob } from '@/modules/jobs/hooks/useJobs';
import { useSetWorkersForJob } from '@/modules/workers/hooks/useWorkers';

function CreateJobWithWorkers() {
  const createJob = useCreateJob();
  const setWorkers = useSetWorkersForJob();

  const handleCreate = async () => {
    // Create job
    const job = await createJob.mutateAsync({
      location_name: 'St. Mary Cemetery',
      address: '123 Cemetery Road',
      // ... other job fields
      order_ids: ['order-uuid-1', 'order-uuid-2'],
    });

    // Assign workers
    await setWorkers.mutateAsync({
      jobId: job.id,
      workerIds: ['worker-uuid-1', 'worker-uuid-2'],
    });
  };
}
```

---

## Scenario 3: Assign Workers to Existing Job

**Goal:** Add or update worker assignments for an existing job.

**Steps:**

1. **Navigate to Jobs page**

2. **Click on a job to view details**

3. **In "Workers" card:**
   - See currently assigned workers (as chips)
   - Click "Assign Workers" button

4. **In Assign Workers dialog:**
   - Select/deselect workers
   - See availability warnings (optional)
   - Click "Save"

**Code Example:**
```typescript
import { useWorkersByJob, useSetWorkersForJob } from '@/modules/workers/hooks/useWorkers';

function AssignWorkersToJob({ jobId }: { jobId: string }) {
  const { data: assignedWorkers } = useWorkersByJob(jobId);
  const setWorkers = useSetWorkersForJob();

  const handleAssign = async (workerIds: string[]) => {
    await setWorkers.mutateAsync({
      jobId,
      workerIds,
    });
  };

  return (
    <div>
      <h3>Assigned Workers</h3>
      {assignedWorkers?.map(worker => (
        <Chip key={worker.id}>{worker.full_name}</Chip>
      ))}
      <AssignWorkersDialog
        currentWorkerIds={assignedWorkers?.map(w => w.id) || []}
        onSave={handleAssign}
      />
    </div>
  );
}
```

---

## Scenario 4: Filter Jobs by Worker

**Goal:** View only jobs assigned to specific worker(s).

**Steps:**

1. **Navigate to Jobs page**

2. **In filter section:**
   - Find "Worker" filter dropdown
   - Select one or more workers
   - Jobs list updates automatically

3. **Clear filter:**
   - Click "Clear" or deselect all workers

**Code Example:**
```typescript
import { useJobsList } from '@/modules/jobs/hooks/useJobs';

function FilterJobsByWorker() {
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  
  const { data: jobs } = useJobsList({
    workerIds: selectedWorkerIds.length > 0 ? selectedWorkerIds : undefined,
  });

  return (
    <div>
      <WorkerFilter
        selectedIds={selectedWorkerIds}
        onChange={setSelectedWorkerIds}
      />
      <JobsList jobs={jobs} />
    </div>
  );
}
```

---

## Scenario 5: List Workers with Search and Filtering

**Goal:** Find workers by name, phone, or role.

**Steps:**

1. **Navigate to Workers page**

2. **Use search input:**
   - Type name or phone number
   - Results filter automatically

3. **Toggle "Active only":**
   - Shows only active workers when enabled
   - Shows all workers (including inactive) when disabled

**Code Example:**
```typescript
import { useWorkers } from '@/modules/workers/hooks/useWorkers';

function WorkersList() {
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const { data: workers } = useWorkers({
    search: search || undefined,
    activeOnly,
  });

  return (
    <div>
      <Input
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Checkbox
        checked={activeOnly}
        onCheckedChange={setActiveOnly}
      >
        Active only
      </Checkbox>
      <WorkersTable workers={workers} />
    </div>
  );
}
```

---

## Scenario 6: Deactivate a Worker (Soft Delete)

**Goal:** Remove a worker from active use without deleting their data.

**Steps:**

1. **Navigate to Workers page**

2. **Find worker in list**

3. **Click "Delete" button**

4. **Confirm in dialog:**
   - Dialog explains this is a soft delete
   - Worker will be hidden from active lists
   - Historical assignments preserved

5. **Worker is deactivated**

**Code Example:**
```typescript
import { useUpdateWorker } from '@/modules/workers/hooks/useWorkers';

function DeactivateWorker({ workerId }: { workerId: string }) {
  const updateWorker = useUpdateWorker();

  const handleDeactivate = async () => {
    await updateWorker.mutateAsync({
      id: workerId,
      updates: { is_active: false },
    });
  };

  return <Button onClick={handleDeactivate}>Deactivate</Button>;
}
```

---

## Common Integration Patterns

### Pattern 1: Display Worker Chips in Job Card

```typescript
import { useWorkersByJob } from '@/modules/workers/hooks/useWorkers';

function JobCard({ jobId }: { jobId: string }) {
  const { data: workers } = useWorkersByJob(jobId);

  return (
    <div>
      <h3>{job.customer_name}</h3>
      <div className="flex gap-2">
        {workers?.map(worker => (
          <Badge key={worker.id} variant="secondary">
            {getInitials(worker.full_name)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
```

### Pattern 2: Check Worker Availability Before Assignment

```typescript
import { useWorkerWithAvailability } from '@/modules/workers/hooks/useWorkers';

function AssignWorkersWithAvailabilityCheck({ jobId }: { jobId: string }) {
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  
  // Check availability for each selected worker
  const workers = selectedWorkerIds.map(id => {
    const { data } = useWorkerWithAvailability(id);
    return data;
  });

  const isUnavailable = (worker: WorkerWithAvailability) => {
    if (!worker.availability) return false;
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = `${dayMap[today]}_available` as keyof WorkerAvailability;
    return !worker.availability[dayKey];
  };

  return (
    <div>
      {workers.map(worker => (
        <div key={worker.id}>
          <Checkbox
            checked={selectedWorkerIds.includes(worker.id)}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedWorkerIds([...selectedWorkerIds, worker.id]);
              } else {
                setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== worker.id));
              }
            }}
          />
          <span>{worker.full_name}</span>
          {isUnavailable(worker) && (
            <Badge variant="warning">Unavailable today</Badge>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Pattern 3: Worker Multi-Select Component

```typescript
import { useWorkers } from '@/modules/workers/hooks/useWorkers';
import { Checkbox } from '@/shared/components/ui/checkbox';

function WorkerMultiSelect({
  selectedIds,
  onChange,
  includeInactive = false,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  includeInactive?: boolean;
}) {
  const { data: workers } = useWorkers({
    activeOnly: !includeInactive,
  });

  const toggleWorker = (workerId: string) => {
    if (selectedIds.includes(workerId)) {
      onChange(selectedIds.filter(id => id !== workerId));
    } else {
      onChange([...selectedIds, workerId]);
    }
  };

  return (
    <div className="space-y-2">
      {workers?.map(worker => (
        <div key={worker.id} className="flex items-center space-x-2">
          <Checkbox
            checked={selectedIds.includes(worker.id)}
            onCheckedChange={() => toggleWorker(worker.id)}
          />
          <span>{worker.full_name}</span>
          <Badge variant="outline">{worker.role}</Badge>
        </div>
      ))}
    </div>
  );
}
```

---

## Error Handling

### Common Errors and Solutions

1. **Worker cannot be deleted (assigned to jobs)**
   - Error: Foreign key constraint violation
   - Solution: Unassign worker from all jobs first, then deactivate

2. **Duplicate assignment**
   - Error: Primary key violation
   - Solution: Composite primary key prevents this, but handle gracefully in UI

3. **Worker not found**
   - Error: 404 or null result
   - Solution: Check worker exists before operations, show user-friendly message

---

## Testing Checklist

- [ ] Create worker with all fields
- [ ] Create worker with minimal fields
- [ ] Update worker information
- [ ] Deactivate worker (soft delete)
- [ ] Set worker availability
- [ ] Assign workers to job during creation
- [ ] Assign workers to existing job
- [ ] Unassign all workers from job
- [ ] Filter jobs by worker
- [ ] Search workers by name/phone
- [ ] Toggle active-only filter
- [ ] Handle errors gracefully

