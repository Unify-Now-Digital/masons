# Refactor Job creation to support multiple Orders and People assignment (corrected, minimal schema)

## Overview

Jobs represent physical work executed for one or more Orders. Currently, Jobs are loosely defined and support only a single Order and no proper assignment model.

This feature refactors Job creation so that:
- A Job can include multiple Orders
- Each Order can belong to only one Job
- Jobs can be assigned to multiple People
- Job location is derived from Orders but editable
- Backward compatibility is preserved

**Context:**
- Jobs represent physical work executed for Orders
- Current state: Jobs support only single Order, no People assignment
- Problem: Cannot group multiple Orders into one Job, cannot assign multiple People
- Solution: Multi-Order support, multi-People assignment (snapshot-based)

**Goal:**
- Refactor Job creation workflow to support multiple Orders
- Add People assignment (snapshot-based)
- Auto-fill location from Orders but allow editing
- Maintain backward compatibility

---

## Current State Analysis

### Jobs Table Schema

**Current Structure:**
- `id`: UUID (primary key)
- `order_id`: UUID | null (single Order reference)
- `customer_name`: TEXT (required)
- `location_name`: TEXT (required)
- `address`: TEXT (required)
- `latitude`: NUMERIC | null
- `longitude`: NUMERIC | null
- `status`: TEXT (enum: scheduled, in_progress, ready_for_installation, completed, cancelled)
- `scheduled_date`: DATE | null
- `estimated_duration`: TEXT | null
- `priority`: TEXT (enum: low, medium, high)
- `notes`: TEXT | null
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Current Problems:**
- Single Order only (`order_id`)
- No People assignment
- Manual location entry (not derived from Orders)

### Orders Table Schema

**Current Structure:**
- `id`: UUID (primary key)
- `invoice_id`: UUID | null (foreign key to invoices)
- `location`: TEXT | null
- `latitude`: NUMERIC | null
- `longitude`: NUMERIC | null
- ... (other fields)

**Missing:**
- `job_id`: UUID | null (foreign key to jobs) - **TO BE ADDED**

### Job Creation Form

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Current Structure:**
- Order Selection: Single Order dropdown (optional)
- Customer Name: Free-text input (required)
- Location Name: Free-text input (required)
- Address: Free-text input (required)
- Status: Dropdown (scheduled, in_progress, ready_for_installation, completed, cancelled)
- Priority: Dropdown (low, medium, high)
- Scheduled Date: Date picker
- Estimated Duration: Text input
- Coordinates: Latitude, Longitude (optional)
- Notes: Textarea

**Current Flow:**
1. User selects single Order (optional)
2. User enters Customer Name manually
3. User enters Location manually
4. If Order selected, auto-fills customer and location
5. Job is created with `order_id`

**Problems:**
- Can only select one Order
- Customer Name is separate field (should be derived from Orders)
- Location must be entered manually
- No People assignment

---

## Requirements

### Functional Requirements

1. **Multiple Orders Support**
   - Replace single Order selector with multi-select
   - Show only Orders where `job_id IS NULL`
   - Validate at least one Order selected
   - Each Order can belong to only one Job

2. **People Assignment (Snapshot-based)**
   - Multi-select People from People module
   - Store assigned People as snapshot text (e.g., in `assigned_to` or `notes`)
   - Format: Comma-separated names or structured text in `notes`
   - No relational storage (UI-only)

3. **Location Auto-fill**
   - Auto-fill Job location from first selected Order's `location`
   - Auto-fill coordinates from first selected Order's `latitude`/`longitude`
   - Location fields remain editable
   - User can override auto-filled values

4. **Customer Name Removal**
   - Remove "Customer Name" field from Job creation
   - Customer information comes from Orders
   - No need for separate Customer Name field

5. **Status Simplification**
   - Simplify status enum to: `Planned`, `In Progress`, `Completed`
   - Remove: `scheduled`, `ready_for_installation`, `cancelled`
   - Keep `priority` field unchanged

6. **Submission Flow**
   - Create Job (without `order_ids` / `assigned_people_ids` - UI-only fields)
   - Update selected Orders with `job_id`
   - Store People assignment as snapshot text
   - UI-only orchestration (no transactions)

### Technical Requirements

1. **Schema Changes (Minimal)**
   - Add `job_id` column to `orders` table (nullable, foreign key)
   - Foreign key: `orders.job_id → jobs.id`
   - ON DELETE SET NULL (preserve Orders if Job deleted)
   - No other schema changes

2. **UI-Only Fields**
   - `order_ids`: Array of Order IDs (UI-only, not in database)
   - `assigned_people_ids`: Array of People IDs (UI-only, not in database)
   - These fields MUST NOT be included in Job insert/update payloads
   - Used only for form state and submission orchestration

3. **Backward Compatibility**
   - Existing Jobs remain unchanged
   - Existing `order_id` field in Jobs table can remain (for backward compatibility)
   - Orders without Job remain valid (`job_id` is nullable)
   - New fields are optional

---

## Implementation Plan

### Phase 1: Database Migration

**Task 1.1: Add `job_id` Column to Orders Table**

**File:** `supabase/migrations/YYYYMMDDHHmmss_add_job_id_to_orders.sql`

**Migration SQL:**
```sql
-- Add job_id column to orders table
alter table public.orders
  add column job_id uuid references public.jobs(id) on delete set null;
```

**Rationale:**
- Adds foreign key relationship from Orders to Jobs
- ON DELETE SET NULL preserves Orders if Job is deleted
- Column is nullable (Orders can exist without Job)

**Validation:**
- Migration runs successfully
- Column exists and is nullable
- Foreign key constraint works
- Existing Orders have NULL `job_id`

### Phase 2: Update Order Types

**File:** `src/modules/orders/types/orders.types.ts`

**Change Required:**
Add `job_id` field to `Order` interface:
```typescript
export interface Order {
  // ... existing fields
  invoice_id: string | null;
  job_id: string | null;  // NEW
  // ... rest of fields
}
```

**Validation:**
- TypeScript compiles without errors
- `OrderInsert` and `OrderUpdate` automatically include `job_id`

### Phase 3: Update Job Form Schema

**File:** `src/modules/jobs/schemas/job.schema.ts`

**Changes:**
1. Remove `customer_name` field
2. Remove `order_id` field (replaced with UI-only `order_ids`)
3. Update status enum: `['Planned', 'In Progress', 'Completed']`
4. Add UI-only fields: `order_ids` (array) and `assigned_people_ids` (array)

**Schema:**
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
- `order_ids` and `assigned_people_ids` are UI-only for form state
- Validation ensures at least one Order selected
- Status simplified to 3 values

### Phase 4: Update Job Types

**File:** `src/modules/jobs/hooks/useJobs.ts`

**Changes:**
1. Remove `order_id` and `customer_name` from `Job` interface
2. Keep other fields unchanged

**Updated Interface:**
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

### Phase 5: Update CreateJobDrawer Component

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`

**Changes:**

1. **Remove Fields:**
   - Remove "Customer Name" field
   - Remove single "Order (Optional)" dropdown

2. **Add Multi-Select Orders:**
   - Import `useOrdersList` and filter Orders where `job_id IS NULL`
   - Add multi-select component for Orders
   - Display format: `{customer_name} - {location} - {order_type}`

3. **Add People Multi-Select:**
   - Import `useCustomersList` from People module
   - Add multi-select component for People
   - Display format: `{first_name} {last_name}`
   - Store as snapshot text (comma-separated or in `notes`)

4. **Auto-fill Location:**
   - Watch `order_ids` field
   - When first Order selected, auto-fill:
     - `location_name` from Order's `location`
     - `latitude` from Order's `latitude`
     - `longitude` from Order's `longitude`
   - Location fields remain editable

5. **Update Form Submission:**
   - Extract `order_ids` and `assigned_people_ids` (UI-only)
   - Build People snapshot text
   - Create Job without UI-only fields
   - Update selected Orders with `job_id`
   - Handle errors appropriately

6. **Update Status Dropdown:**
   - Change options to: "Planned", "In Progress", "Completed"

### Phase 6: Update Order Update API

**File:** `src/modules/orders/api/orders.api.ts`

**Verify:**
- `updateOrder` function exists and works
- Can update `job_id` field on Orders

**If needed:**
- Ensure `updateOrder` accepts `job_id` in updates
- TypeScript types should already support this (via `OrderUpdate`)

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

## Out of Scope

- Job type enum
- Editing existing Jobs
- Map UI changes
- Notifications
- Reporting
- Payments
- Server-side orchestration
- Database transactions
- Join tables for People ↔ Jobs
- Structured People assignment (relational)
- Removing `order_id` from Jobs table (backward compatibility)

---

## Technical Notes

1. **Order Filtering:**
   - When fetching Orders for multi-select, filter: `.is('job_id', null)`
   - Only show Orders not yet assigned to a Job

2. **People Snapshot Storage:**
   - Option 1: Store in `assigned_to` field (comma-separated names)
   - Option 2: Store in `notes` field (structured text)
   - Option 3: Create new `assigned_people` TEXT field (if allowed)
   - **Recommendation:** Use `notes` field with structured format, or create `assigned_people` TEXT field

3. **Location Auto-fill:**
   - Watch `order_ids` array
   - When array changes and first Order exists, fetch Order details
   - Auto-fill `location_name`, `latitude`, `longitude`
   - User can still edit these values

4. **Submission Flow:**
   ```typescript
   // 1. Extract UI-only fields
   const { order_ids, assigned_people_ids, ...jobData } = formData;
   
   // 2. Build People snapshot
   const assignedPeople = customers?.filter(c => assigned_people_ids?.includes(c.id))
     .map(c => `${c.first_name} ${c.last_name}`)
     .join(', ');
   
   // 3. Create Job
   const job = await createJob({
     ...jobData,
     notes: assignedPeople ? `${assignedPeople}\n\n${jobData.notes || ''}` : jobData.notes,
   });
   
   // 4. Update Orders
   await Promise.all(order_ids.map(orderId => 
     updateOrder(orderId, { job_id: job.id })
   ));
   ```

5. **Error Handling:**
   - If Job creation fails, don't update Orders
   - If Order update fails, show error but Job remains created
   - Provide clear error messages

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `supabase/migrations/YYYYMMDDHHmmss_add_job_id_to_orders.sql` | Create migration file | ~3 lines (new file) |
| `src/modules/orders/types/orders.types.ts` | Add `job_id` field | ~1 line added |
| `src/modules/jobs/schemas/job.schema.ts` | Update schema: remove fields, add UI-only fields, simplify status | ~15 lines modified |
| `src/modules/jobs/hooks/useJobs.ts` | Update Job interface: remove `order_id`, `customer_name` | ~2 lines removed |
| `src/modules/jobs/components/CreateJobDrawer.tsx` | Major refactor: multi-select Orders, People, auto-fill location | ~200 lines modified |

**Total Estimated Changes:** ~221 lines across 5 files (1 new file, 4 modified)

---

## Testing Considerations

1. **Unit Tests:**
   - Migration runs successfully
   - Foreign key constraint works
   - Order filtering works correctly

2. **Integration Tests:**
   - Job creation with multiple Orders
   - Order assignment works
   - People snapshot storage works
   - Location auto-fill works

3. **Manual Testing:**
   - Create Job with 0 Orders (should fail validation)
   - Create Job with 1 Order
   - Create Job with multiple Orders
   - Verify Orders show only unassigned ones
   - Verify location auto-fills from first Order
   - Verify location remains editable
   - Verify People assignment works
   - Verify People snapshot stored correctly
   - Verify existing Jobs still work

---

## Backward Compatibility

- Existing Jobs remain unchanged
- Existing `order_id` column in Jobs table can remain (unused by new UI)
- Orders without Job remain valid (`job_id` is nullable)
- Migration is additive (no data loss)
- No destructive changes

---

## Related Features

- **Orders CRUD Integration:** Existing Order creation and management
- **People Module:** Customer/Person management
- **Invoice-Centric Order Creation:** Orders linked to Invoices
- **Job Creation:** Current single-Order Job creation

---

## Implementation Notes

1. **Multi-Select Component:**
   - Use shadcn/ui Select with multi-select pattern
   - Or use Checkbox list pattern
   - Display selected items clearly

2. **Order Filtering:**
   - Fetch all Orders, filter client-side: `orders.filter(o => !o.job_id)`
   - Or use Supabase filter: `.is('job_id', null)`

3. **People Snapshot:**
   - Store format: `"John Smith, Jane Doe"` or structured text
   - Parse when displaying (split by comma or parse structured format)

4. **Location Auto-fill:**
   - Use `useEffect` to watch `order_ids`
   - Fetch first Order details when selected
   - Auto-fill location fields
   - Don't override if user manually edited

5. **Submission:**
   - Extract UI-only fields before creating Job
   - Create Job first
   - Update Orders with `job_id`
   - Handle partial failures gracefully

---

## Questions and Clarifications

1. **People Snapshot Storage:**
   - Where should assigned People be stored?
   - **Answer:** In `notes` field with structured format, or create `assigned_people` TEXT field if needed

2. **Job Status Values:**
   - Should we remove old status values from database?
   - **Answer:** No, keep them for backward compatibility, but UI only shows new values

3. **Order Filtering:**
   - Should we filter on backend or client-side?
   - **Answer:** Client-side filtering is simpler, but backend filtering is more efficient

4. **Multiple Location Values:**
   - What if selected Orders have different locations?
   - **Answer:** Use first Order's location, user can edit if needed

5. **Job Deletion:**
   - What happens to Orders when Job is deleted?
   - **Answer:** Orders' `job_id` set to NULL (ON DELETE SET NULL)

---

## Conclusion

This feature refactors Job creation to support multiple Orders and People assignment while maintaining backward compatibility. The implementation includes minimal schema changes (adding `job_id` to Orders) and UI-only orchestration for multi-Order and multi-People assignment.

