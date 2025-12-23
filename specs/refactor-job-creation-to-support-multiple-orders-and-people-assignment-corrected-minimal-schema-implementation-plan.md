# Implementation Plan: Refactor Job creation to support multiple Orders and People assignment (corrected, minimal schema)

## Overview

This plan refactors Job creation to support multiple Orders and People assignment with minimal schema changes. The implementation includes a database migration to add `job_id` to Orders, updates to Job types and schemas, and a major refactor of the Job creation form.

**Goal:** Transform Job creation from single-Order to multi-Order support with People assignment, while maintaining backward compatibility.

**Constraints:**
- Minimal schema changes (add `job_id` to Orders only)
- UI-only fields for multi-select (`order_ids`, `assigned_people_ids`)
- Backward compatibility with existing Jobs
- No join tables or structured relationships for People

---

## Phase 1: Database Migration

### Task 1.1: Create Migration File

**File:** `supabase/migrations/YYYYMMDDHHmmss_add_job_id_to_orders.sql`

**Migration Naming:**
- Format: `YYYYMMDDHHmmss_add_job_id_to_orders.sql`
- Use current timestamp for YYYYMMDDHHmmss

**Migration SQL:**
```sql
-- Add job_id column to orders table
-- This allows Orders to be linked to Jobs (one Order can belong to one Job)
alter table public.orders
  add column job_id uuid references public.jobs(id) on delete set null;
```

**Rationale:**
- Adds foreign key relationship from Orders to Jobs
- ON DELETE SET NULL preserves Orders if Job is deleted
- Column is nullable (Orders can exist without Job)
- Allows multiple Orders to belong to same Job

**Validation:**
- Migration runs successfully
- Column exists and is nullable
- Foreign key constraint works
- Existing Orders have NULL `job_id`

---

## Phase 2: Update Order Types

### Task 2.1: Add `job_id` to Order Interface

**File:** `src/modules/orders/types/orders.types.ts`

**Current State:**
```typescript
export interface Order {
  id: string;
  invoice_id: string | null;
  customer_name: string;
  // ... other fields
}
```

**Change Required:**
Add `job_id` field after `invoice_id`:
```typescript
export interface Order {
  id: string;
  invoice_id: string | null;
  job_id: string | null;  // NEW
  customer_name: string;
  // ... rest of fields
}
```

**Validation:**
- TypeScript compiles without errors
- `OrderInsert` and `OrderUpdate` automatically include `job_id`

---

## Phase 3: Update Job Form Schema

### Task 3.1: Update Job Form Schema

**File:** `src/modules/jobs/schemas/job.schema.ts`

**Current State:**
```typescript
export const jobFormSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().trim().min(1, 'Customer name is required'),
  location_name: z.string().trim().min(1, 'Location name is required'),
  // ... other fields
  status: z.enum(['scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled']).default('scheduled'),
});
```

**Change Required:**
```typescript
export const jobFormSchema = z.object({
  // Removed: order_id, customer_name
  location_name: z.string().trim().min(1, 'Location name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: z.enum(['Planned', 'In Progress', 'Completed']).default('Planned'),
  scheduled_date: z.string().optional().nullable(),
  estimated_duration: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().optional().or(z.literal('')),
  // UI-only fields (not saved to database)
  order_ids: z.array(z.string().uuid()).min(1, 'At least one order is required'),
  assigned_people_ids: z.array(z.string().uuid()).optional(),
});
```

**Rationale:**
- `order_id` removed: Replaced with multi-select `order_ids` (UI-only)
- `customer_name` removed: Customer info comes from Orders
- Status simplified: 3 values instead of 5
- `order_ids` and `assigned_people_ids` are UI-only for form state

**Validation:**
- Schema compiles without errors
- Validation ensures at least one Order selected
- UI-only fields excluded from database payload

---

## Phase 4: Update Job Types

### Task 4.1: Update Job Interface

**File:** `src/modules/jobs/hooks/useJobs.ts`

**Current State:**
```typescript
export interface Job {
  id: string;
  order_id: string | null;
  customer_name: string;
  location_name: string;
  // ... other fields
  status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
}
```

**Change Required:**
```typescript
export interface Job {
  id: string;
  // Removed: order_id, customer_name
  location_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: 'Planned' | 'In Progress' | 'Completed';
  scheduled_date: string | null;
  estimated_duration: string | null;
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**Note:** If `order_id` and `customer_name` columns still exist in database (for backward compatibility), they can remain but won't be used by the new UI.

**Validation:**
- TypeScript compiles without errors
- `JobInsert` and `JobUpdate` types update correctly

---

## Phase 5: Update CreateJobDrawer Component

### Task 5.1: Update Imports and Dependencies

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Change Required:**
Add new imports:
```typescript
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useUpdateOrder } from '@/modules/orders/hooks/useOrders';
import { Checkbox } from '@/shared/components/ui/checkbox';
```

**Validation:**
- All imports resolve correctly
- No duplicate imports

### Task 5.2: Remove Customer Name Field

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Location:** Lines 175-187 (Customer Name field)

**Change Required:**
- Remove entire "Customer Name" FormField component
- Remove `customer_name` from form defaultValues
- Remove `customer_name` from form reset

**Validation:**
- Component compiles without errors
- No references to `customer_name`

### Task 5.3: Replace Single Order Selector with Multi-Select

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Location:** Replace lines 142-173 (Order selection)

**Change Required:**

1. **Update form state:**
```typescript
const form = useForm<JobFormData>({
  resolver: zodResolver(jobFormSchema),
  defaultValues: {
    order_ids: [],  // NEW: Array instead of single order_id
    location_name: '',
    address: '',
    // ... other fields
  },
});
```

2. **Filter Orders:**
```typescript
const { data: ordersData } = useOrdersList();
const availableOrders = useMemo(() => {
  return ordersData?.filter(order => !order.job_id) || [];
}, [ordersData]);
```

3. **Add multi-select UI:**
```typescript
<FormField
  control={form.control}
  name="order_ids"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Orders *</FormLabel>
      <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
        {availableOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No available orders</p>
        ) : (
          availableOrders.map((order) => (
            <div key={order.id} className="flex items-center space-x-2 py-2">
              <Checkbox
                id={order.id}
                checked={field.value?.includes(order.id)}
                onCheckedChange={(checked) => {
                  const currentValue = field.value || [];
                  if (checked) {
                    field.onChange([...currentValue, order.id]);
                  } else {
                    field.onChange(currentValue.filter(id => id !== order.id));
                  }
                }}
              />
              <label
                htmlFor={order.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
              >
                {order.customer_name} - {order.location || 'No location'} - {order.order_type}
              </label>
            </div>
          ))
        )}
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Validation:**
- Multi-select renders correctly
- Only shows Orders where `job_id IS NULL`
- Can select multiple Orders
- Validation requires at least one Order

### Task 5.4: Add People Multi-Select

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Location:** Add after Orders section, before Location fields

**Change Required:**

1. **Fetch People:**
```typescript
const { data: customers } = useCustomersList();
```

2. **Add People multi-select UI:**
```typescript
<FormField
  control={form.control}
  name="assigned_people_ids"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Assigned People (Optional)</FormLabel>
      <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
        {!customers || customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No people available</p>
        ) : (
          customers.map((person) => (
            <div key={person.id} className="flex items-center space-x-2 py-2">
              <Checkbox
                id={`person-${person.id}`}
                checked={field.value?.includes(person.id)}
                onCheckedChange={(checked) => {
                  const currentValue = field.value || [];
                  if (checked) {
                    field.onChange([...currentValue, person.id]);
                  } else {
                    field.onChange(currentValue.filter(id => id !== person.id));
                  }
                }}
              />
              <label
                htmlFor={`person-${person.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
              >
                {person.first_name} {person.last_name}
              </label>
            </div>
          ))
        )}
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Validation:**
- People multi-select renders correctly
- Can select multiple People
- Selected People tracked in form state

### Task 5.5: Add Location Auto-fill from Orders

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Location:** Add useEffect after form setup

**Change Required:**
```typescript
// Auto-fill location from first selected Order
const selectedOrderIds = form.watch('order_ids');
const firstSelectedOrder = useMemo(() => {
  if (!selectedOrderIds || selectedOrderIds.length === 0) return null;
  return ordersData?.find(order => order.id === selectedOrderIds[0]);
}, [selectedOrderIds, ordersData]);

useEffect(() => {
  if (firstSelectedOrder && open) {
    // Only auto-fill if fields are empty (don't override user edits)
    if (!form.getValues('location_name') && firstSelectedOrder.location) {
      form.setValue('location_name', firstSelectedOrder.location);
    }
    if (!form.getValues('latitude') && firstSelectedOrder.latitude !== null) {
      form.setValue('latitude', firstSelectedOrder.latitude);
    }
    if (!form.getValues('longitude') && firstSelectedOrder.longitude !== null) {
      form.setValue('longitude', firstSelectedOrder.longitude);
    }
  }
}, [firstSelectedOrder, open, form]);
```

**Validation:**
- Location auto-fills from first Order
- Location fields remain editable
- Doesn't override manual edits

### Task 5.6: Update Status Dropdown

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Location:** Status dropdown (around lines 234-243)

**Change Required:**
Replace status options:
```typescript
<SelectContent>
  <SelectItem value="Planned">Planned</SelectItem>
  <SelectItem value="In Progress">In Progress</SelectItem>
  <SelectItem value="Completed">Completed</SelectItem>
</SelectContent>
```

**Validation:**
- Status dropdown shows new values
- Default value is "Planned"

### Task 5.7: Update Form Submission

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Location:** `onSubmit` function (lines 103-130)

**Change Required:**
```typescript
const { mutateAsync: createJobAsync } = useCreateJob();
const { mutateAsync: updateOrderAsync } = useUpdateOrder();

const onSubmit = async (values: JobFormData) => {
  // Extract UI-only fields
  const { order_ids, assigned_people_ids, ...jobData } = values;
  
  // Build People snapshot text
  let assignedPeopleText = '';
  if (assigned_people_ids && assigned_people_ids.length > 0 && customers) {
    const assignedPeople = customers
      .filter(c => assigned_people_ids.includes(c.id))
      .map(c => `${c.first_name} ${c.last_name}`)
      .join(', ');
    assignedPeopleText = `Assigned People: ${assignedPeople}\n\n`;
  }
  
  // Build Job payload (without UI-only fields)
  const jobPayload = {
    ...jobData,
    notes: assignedPeopleText + (jobData.notes || ''),
  };
  
  try {
    // Create Job first
    const createdJob = await createJobAsync(jobPayload);
    
    // Update Orders with job_id
    await Promise.all(
      order_ids.map(orderId => 
        updateOrderAsync({ id: orderId, updates: { job_id: createdJob.id } })
      )
    );
    
    toast({
      title: 'Job created',
      description: `Job and ${order_ids.length} order(s) updated successfully.`,
    });
    form.reset();
    onOpenChange(false);
  } catch (error) {
    let errorMessage = 'Failed to create job.';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    toast({
      title: 'Error creating job',
      description: errorMessage,
      variant: 'destructive',
    });
  }
};
```

**Validation:**
- Job created successfully
- Orders updated with `job_id`
- People snapshot stored in `notes`
- Error handling works correctly

---

## Phase 6: Update Job Transform Utility

### Task 6.1: Update Job Transform

**File:** `src/modules/jobs/utils/jobTransform.ts`

**Check if file exists and update `toJobInsert` function:**

**Current State (if exists):**
May include `order_id` and `customer_name` in transform

**Change Required:**
Remove `order_id` and `customer_name` from transform:
```typescript
export function toJobInsert(data: JobFormData): JobInsert {
  const { order_ids, assigned_people_ids, ...rest } = data;
  return rest as JobInsert;
}
```

**Note:** If file doesn't exist, create it or update the component to not use transform utility.

**Validation:**
- Transform excludes UI-only fields
- TypeScript compiles without errors

---

## Phase 7: Verification and Testing

### Task 7.1: TypeScript Compilation

**Verification Steps:**
1. Run `npm run build` to check TypeScript compilation
2. Verify no type errors
3. Verify all imports resolve correctly

**Expected Result:**
- Build succeeds without errors
- No TypeScript errors

### Task 7.2: Form Validation

**Verification Steps:**
1. Test Job creation with 0 Orders (should fail validation)
2. Test Job creation with 1 Order
3. Test Job creation with multiple Orders
4. Test People selection
5. Test location auto-fill
6. Test location editing

**Expected Result:**
- Validation works correctly
- Error messages are clear
- Location auto-fills correctly
- Location remains editable

### Task 7.3: Integration Testing

**Verification Steps:**
1. Create Job with multiple Orders
2. Verify Job is created successfully
3. Verify all Orders have `job_id` set correctly
4. Verify People snapshot stored in `notes`
5. Verify Orders show only unassigned ones in selector
6. Test error handling (Job fails, Order update fails)

**Expected Result:**
- Job and Orders created/updated successfully
- All data stored correctly
- Error handling works

---

## Verification Checklist

After completing all phases, verify:

- [ ] Migration file created with correct naming
- [ ] Migration runs successfully
- [ ] Orders table has `job_id` column (nullable, foreign key)
- [ ] `Order` interface includes `job_id` field
- [ ] Job form schema updated (removed `order_id`, `customer_name`, simplified status, added UI-only fields)
- [ ] `Job` interface updated (removed `order_id`, `customer_name`, updated status enum)
- [ ] Customer Name field removed from form
- [ ] Single Order selector replaced with multi-select
- [ ] Orders selector shows only unassigned Orders (`job_id IS NULL`)
- [ ] People multi-select added
- [ ] Location auto-fills from first selected Order
- [ ] Location fields remain editable
- [ ] Status dropdown shows new values (Planned, In Progress, Completed)
- [ ] Form submission creates Job and updates Orders
- [ ] People snapshot stored in `notes`
- [ ] Error handling works correctly
- [ ] TypeScript compilation succeeds
- [ ] No runtime errors
- [ ] Existing Jobs continue to work

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `supabase/migrations/YYYYMMDDHHmmss_add_job_id_to_orders.sql` | Create migration file | ~3 lines (new file) |
| `src/modules/orders/types/orders.types.ts` | Add `job_id` field | ~1 line added |
| `src/modules/jobs/schemas/job.schema.ts` | Update schema: remove fields, add UI-only fields, simplify status | ~15 lines modified |
| `src/modules/jobs/hooks/useJobs.ts` | Update Job interface: remove `order_id`, `customer_name`, update status | ~3 lines modified |
| `src/modules/jobs/components/CreateJobDrawer.tsx` | Major refactor: multi-select Orders, People, auto-fill location | ~250 lines modified |
| `src/modules/jobs/utils/jobTransform.ts` | Update transform to exclude UI-only fields | ~5 lines modified (if exists) |

**Total Estimated Changes:** ~277 lines across 6 files (1 new file, 5 modified)

---

## Success Criteria

- ✅ `job_id` column added to `orders` table
- ✅ Foreign key constraint works correctly
- ✅ Job creation form supports multiple Orders
- ✅ Orders selector shows only unassigned Orders (`job_id IS NULL`)
- ✅ Job location auto-fills from first selected Order
- ✅ Location fields remain editable
- ✅ People multi-select works
- ✅ People assignment stored as snapshot text
- ✅ Status simplified to Planned, In Progress, Completed
- ✅ Customer Name field removed
- ✅ Orders linked to Job via `job_id`
- ✅ Each Order can belong to only one Job
- ✅ Existing Jobs continue to work
- ✅ No runtime, TypeScript, or Supabase errors
- ✅ Backward compatibility preserved

---

## Implementation Notes

1. **Multi-Select Pattern:**
   - Use Checkbox list for Orders and People
   - Clear visual indication of selected items
   - Scrollable list for many items

2. **Order Filtering:**
   - Filter client-side: `orders.filter(o => !o.job_id)`
   - Efficient and simple implementation

3. **People Snapshot Storage:**
   - Store in `notes` field with prefix: `"Assigned People: John Smith, Jane Doe\n\n[existing notes]"`
   - Easy to parse when displaying

4. **Location Auto-fill:**
   - Only auto-fill if fields are empty
   - Don't override user edits
   - Use `useMemo` for efficiency

5. **Submission Flow:**
   - Extract UI-only fields before creating Job
   - Create Job first to get ID
   - Update Orders with `job_id`
   - Handle partial failures gracefully

6. **Error Handling:**
   - If Job creation fails, don't update Orders
   - If Order update fails, show error but Job remains created
   - Provide clear error messages

---

## Conclusion

This implementation plan provides a step-by-step guide to refactor Job creation to support multiple Orders and People assignment. The implementation includes minimal schema changes (adding `job_id` to Orders) and maintains backward compatibility with existing Jobs.

