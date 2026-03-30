# Fix Orders Module: Add Customer/Person Assignment + Correct Customer Column

## Overview

Fix the Orders module to properly handle Customer/Person assignment and correct the confusing "Customer" column that currently displays Deceased name instead of the actual Customer/Person name.

**Context:**
- Orders can be created from Orders module (standalone) or Invoicing module (inline)
- UI renamed Customers → People
- Currently, `orders.customer_name` is repurposed and displayed as Deceased Name in UI
- Orders list "Customer" column shows Deceased name, causing confusion
- No way to assign a Person/Customer when creating/editing Orders in Orders module

**Goal:**
- Add ability to assign a Person (Customer) when creating/editing Orders in Orders module
- Fix Orders list so "Customer" column shows Person name (if assigned), not Deceased name
- Keep Deceased name visible as its own field/column
- Maintain backward compatibility (no destructive migrations)

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `id uuid pk`
- `invoice_id uuid null` (FK to invoices)
- `job_id uuid null` (FK to jobs)
- `customer_name text not null` - **Currently used for Deceased Name in UI**
- `customer_email text null`
- `customer_phone text null`
- `order_type text not null`
- `sku text null`
- `material text null`
- `color text null`
- `stone_status text` (NA, Ordered, In Stock)
- `permit_status text` (form_sent, customer_completed, pending, approved)
- `proof_status text` (NA, Not_Received, Received, In_Progress, Lettered)
- `deposit_date date null`
- `second_payment_date date null`
- `due_date date null`
- `installation_date date null`
- `location text null`
- `latitude numeric null`
- `longitude numeric null`
- `value decimal(10,2) null`
- `progress integer default 0`
- `assigned_to text null`
- `priority text default 'medium'` (low, medium, high)
- `timeline_weeks integer default 12`
- `notes text null`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

**Observations:**
- No `person_id` or `customer_id` field exists
- `customer_name` is used for Deceased Name in UI (confusing)
- No relationship to People/Customers table

### Customers/People Schema

**Table:** `public.customers`

**Current Structure:**
- `id uuid pk`
- `first_name text`
- `last_name text`
- `email text null`
- `phone text null`
- `address text null`
- `city text null`
- `country text null`
- `created_at timestamptz`
- `updated_at timestamptz`

**Observations:**
- Customers table exists (confirmed in codebase)
- Person name is stored as `first_name + last_name`
- No current relationship to Orders table
- Used in Invoicing module for Person selection

### Relationship Analysis

**Current Relationship:**
- **None** - Orders and Customers/People are not linked
- Orders have `customer_name` (text) but no FK to customers table
- No way to assign a Person when creating an Order

**Gaps/Issues:**
- Missing `person_id` FK in orders table
- Missing `person_name` snapshot field (for resilience)
- Orders list shows Deceased name in "Customer" column (confusing)
- No Person assignment field in CreateOrderDrawer/EditOrderDrawer

### Data Access Patterns

**How Orders are Currently Accessed:**
- `useOrdersList()` - fetches all orders
- `transformOrdersForUI()` - maps `customer_name` to `customer` field in UI
- Orders list displays `order.customer` (which is actually deceased name)

**How Customers/People are Currently Accessed:**
- `useCustomersList()` - fetches all customers/people
- Used in Invoicing module for Person selection
- Not used in Orders module

**How They Are Queried Together (if at all):**
- **Not queried together** - no join exists
- Orders list doesn't show Person information

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**

1. **Add `person_id` field to orders table:**
   ```sql
   alter table public.orders
     add column person_id uuid null
     references public.customers(id) on delete set null;
   ```

2. **Add `person_name` snapshot field:**
   ```sql
   alter table public.orders
     add column person_name text null;
   ```

3. **Add index for performance:**
   ```sql
   create index idx_orders_person_id on public.orders(person_id);
   ```

4. **Add comment for clarity:**
   ```sql
   comment on column public.orders.person_id is 'Foreign key to customers/people table. The actual customer/person who placed the order.';
   comment on column public.orders.person_name is 'Snapshot of person name at time of order creation for resilience.';
   comment on column public.orders.customer_name is 'Deceased name (legacy field name, but used for deceased person in UI).';
   ```

**Non-Destructive Constraints:**
- All new fields are nullable (backward compatible)
- No existing columns modified or deleted
- Existing orders continue to work (person_id will be null)
- No table renames
- No column deletions

### Query/Data-Access Alignment

**Recommended Query Patterns:**

**For Orders List:**
```typescript
// Join with customers table to get person name
const { data } = await supabase
  .from('orders')
  .select('*, customers(id, first_name, last_name)')
  .order('created_at', { ascending: false });
```

**Display Logic:**
- Customer column: `person_name || customers.first_name + ' ' + customers.last_name || '—'`
- Deceased column: `customer_name` (existing field)

**Recommended Display Patterns:**
- Orders list: Show Person name in "Customer" column
- Orders list: Show Deceased name in separate "Deceased" column (or keep in existing location)
- Create/Edit forms: Add Person selector field
- Create/Edit forms: Keep Deceased Name field as-is

---

## Implementation Approach

### Phase 1: Database Migration

1. **Create migration file:**
   - Add `person_id` (nullable FK to customers)
   - Add `person_name` (nullable text snapshot)
   - Add index on `person_id`
   - Add table comments

2. **Verify migration:**
   - Test on local Supabase
   - Ensure existing orders still work
   - Verify FK constraint works

### Phase 2: Update Types & Schemas

1. **Update Order types:**
   - Add `person_id: string | null`
   - Add `person_name: string | null`
   - Update `OrderInsert` and `OrderUpdate` types

2. **Update Order form schema:**
   - Add `person_id: z.string().uuid().optional().nullable()`
   - Keep `customer_name` as-is (Deceased Name)
   - Add validation if needed

### Phase 3: Update Orders API & Queries

1. **Update orders queries:**
   - Join with `customers` table when fetching orders
   - Include `customers(id, first_name, last_name)` in select
   - Handle null person_id gracefully

2. **Update order transform:**
   - Map `person_name` or derived name to `customer` field in UI
   - Keep `customer_name` mapped to `deceasedName` or similar

### Phase 4: Update Orders UI (Create/Edit)

1. **Update CreateOrderDrawer:**
   - Add Person selector field (optional)
   - Use `useCustomersList()` to fetch people
   - Store `person_id` and `person_name` on save
   - Keep Deceased Name field as-is

2. **Update EditOrderDrawer:**
   - Add Person selector field (optional)
   - Pre-populate with existing `person_id`
   - Allow changing Person assignment
   - Keep Deceased Name field as-is

### Phase 5: Update Orders List

1. **Update SortableOrdersTable:**
   - Change "Customer" column to show Person name
   - Add/confirm "Deceased" column for deceased name
   - Update `transformOrdersForUI()` to map correctly

2. **Update OrdersPage:**
   - Ensure search works with Person names
   - Update filtering if needed

### Phase 6: Update Invoicing Module Integration

1. **Update CreateInvoiceDrawer:**
   - When creating inline orders, check if invoice has Person selected (via `customer_name` field)
   - If invoice has `customer_name` that matches a customer, look up `person_id` from customers table
   - Set `person_id` and `person_name` snapshot when order is created
   - If no match found or no person selected, leave `person_id` as null
   - Ensure backward compatibility (null person_id if no invoice person)
   - Note: Invoices currently use `customer_name` (text) storing full name, so we match by name to find person_id

### Phase 7: Testing & Validation

1. **Test scenarios:**
   - Create order with Person assigned
   - Create order without Person (null person_id)
   - Edit order to add/change Person
   - Orders list shows correct Person name in Customer column
   - Deceased name still visible separately
   - Inline orders from Invoice inherit Person correctly

2. **Verify backward compatibility:**
   - Existing orders (with null person_id) still render
   - No regressions in Map, Jobs, Invoicing flows

---

## What NOT to Do

- **Do NOT rename `customer_name` column** (keep for deceased name)
- **Do NOT change meaning of `customer_name` in database** (UI mapping only)
- **Do NOT delete existing columns**
- **Do NOT make `person_id` required** (keep nullable for backward compatibility)
- **Do NOT modify existing RLS policies** (additive only)

---

## Open Questions / Considerations

1. **Customers table name:**
   - Is it `customers` or `people`?
   - Need to verify exact table name and structure
   - **Decision:** Check codebase, use existing table name

2. **Person name format:**
   - How is person name stored? `first_name + last_name` or single `name` field?
   - **Decision:** Check customers table structure, use appropriate format

3. **Deceased column in list:**
   - Should we add a separate "Deceased" column or keep in existing location?
   - **Decision:** Add separate column for clarity, or rename existing if it exists

4. **Snapshot strategy:**
   - Should we always store `person_name` snapshot or derive from join?
   - **Decision:** Store snapshot for resilience (person may be deleted)

5. **Invoice integration:**
   - How does invoice store person? `person_id` or `customer_id`?
   - **Current:** Invoices use `customer_name` (text field, not FK)
   - **Decision:** For inline orders, if invoice has a Person selected (via customer_name matching a customer), we can look up the person_id and set it on the order. For now, we'll add person_id to orders and handle invoice integration separately if needed.

---

## Acceptance Criteria

- ✅ Creating an Order from Orders module allows selecting a Person
- ✅ Editing an Order allows changing Person assignment
- ✅ Orders list shows correct Customer name (Person) in Customer column
- ✅ Deceased name is not shown as Customer anymore
- ✅ Deceased name is visible in separate field/column
- ✅ Inline Orders created from Invoice correctly inherit invoice Person (when selected)
- ✅ Existing orders (with null person_id) still render correctly
- ✅ No regressions in Map, Jobs, Invoicing flows
- ✅ Build + lint pass
- ✅ No destructive migrations
- ✅ Backward compatibility maintained

---

## Success Metrics

- Orders can be linked to People/Customers
- Customer column shows actual Person name
- Deceased name clearly separated from Customer
- No data loss or breaking changes
- All existing functionality preserved

