# Implementation Plan: Fix Orders Module - Customer/Person Assignment + Correct Customer Column

**Branch:** `feature/fix-orders-customer-person-assignment`  
**Specification:** `specs/fix-orders-customer-person-assignment.md`

---

## Overview

This implementation plan fixes the Orders module to properly handle Customer/Person assignment and corrects the confusing "Customer" column that currently displays Deceased name instead of the actual Customer/Person name.

**Goal:** 
- Add ability to assign a Person (Customer) when creating/editing Orders in Orders module
- Fix Orders list so "Customer" column shows Person name (if assigned), not Deceased name
- Keep Deceased name visible as its own field/column
- Maintain backward compatibility (no destructive migrations)

**Constraints:**
- Additive-only database changes (no destructive migrations)
- All new fields must be nullable for backward compatibility
- Follow existing app patterns (React Query, shadcn/ui, Zod validation)
- Maintain backward compatibility with existing Orders functionality
- No changes to existing `customer_name` column meaning in database

---

## Phase 1 — Database (Additive Migration)

### Task 1.1: Create Migration for `person_id` and `person_name` Fields

**File:** `supabase/migrations/YYYYMMDDHHmmss_add_person_fields_to_orders.sql`

**Description:**
Add `person_id` (nullable FK to customers) and `person_name` (nullable snapshot) fields to orders table, along with index and comments.

**Migration Content:**
```sql
-- Add person_id field to orders table
alter table public.orders
  add column person_id uuid null
  references public.customers(id) on delete set null;

-- Add person_name snapshot field
alter table public.orders
  add column person_name text null;

-- Add index for performance
create index if not exists idx_orders_person_id on public.orders(person_id);

-- Add column comments for clarity
comment on column public.orders.person_id is 'Foreign key to customers/people table. The actual customer/person who placed the order.';
comment on column public.orders.person_name is 'Snapshot of person name at time of order creation for resilience.';
comment on column public.orders.customer_name is 'Deceased name (legacy field name, but used for deceased person in UI).';
```

**Validation:**
- Migration runs without errors
- Existing orders still accessible (person_id will be null)
- FK constraint works correctly
- Index created successfully
- Comments added

---

## Phase 2 — Types & Schemas

### Task 2.1: Update Order TypeScript Types

**File:** `src/modules/orders/types/orders.types.ts`

**Description:**
Add `person_id` and `person_name` fields to Order interface and related types.

**Changes:**
```typescript
export interface Order {
  id: string;
  invoice_id: string | null;
  job_id: string | null;
  person_id: string | null; // NEW
  person_name: string | null; // NEW
  customer_name: string; // Existing - used for Deceased Name
  // ... rest of fields
}
```

**Validation:**
- Types compile without errors
- OrderInsert and OrderUpdate types updated correctly

---

### Task 2.2: Update Order Form Schema

**File:** `src/modules/orders/schemas/order.schema.ts`

**Description:**
Add `person_id` field to order form schema as optional nullable UUID.

**Changes:**
```typescript
export const orderFormSchema = z.object({
  person_id: z.string().uuid().optional().nullable(), // NEW
  customer_name: z.string().min(1, 'Deceased name is required'), // Existing
  // ... rest of fields
});
```

**Validation:**
- Schema validates correctly
- person_id is optional (can be null)
- Existing validation still works

---

## Phase 3 — Orders API & Queries

### Task 3.1: Update Orders Fetch Queries

**File:** `src/modules/orders/api/orders.api.ts`

**Description:**
Update orders queries to include person_id, person_name, and join with customers table for display.

**Changes:**
```typescript
async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(id, first_name, last_name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Order[];
}
```

**Validation:**
- Queries return person_id and person_name
- Join with customers works correctly
- Null person_id handled gracefully

---

### Task 3.2: Update Order Transform Function

**File:** `src/modules/orders/utils/orderTransform.ts`

**Description:**
Update transform function to map person name to customer field and keep customer_name as deceasedName.

**Changes:**
```typescript
export function transformOrderForUI(order: Order): UIOrder {
  // Resolve customer name: prefer person_name, else derive from joined customer, else "—"
  const customerName = order.person_name 
    || (order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : null)
    || '—';

  return {
    id: order.id,
    customer: customerName, // Now shows Person name, not Deceased
    deceasedName: order.customer_name, // NEW: Separate field for deceased
    // ... rest of fields
  };
}
```

**Validation:**
- Customer field shows Person name
- Deceased name available separately
- Null person_id handled correctly

---

## Phase 4 — Orders Create/Edit UI (Orders Module)

### Task 4.1: Add Person Selector to CreateOrderDrawer

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Add Person selector field (optional) that allows selecting from People module.

**Changes:**
- Import `useCustomersList` hook
- Add Person selector field in form
- On select: set `person_id` and `person_name = first_name + ' ' + last_name`
- Keep Deceased Name field unchanged

**Validation:**
- Person selector appears in form
- Selection sets person_id and person_name correctly
- Deceased Name field still works

---

### Task 4.2: Add Person Selector to EditOrderDrawer

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Add Person selector field (optional) that pre-populates with existing person_id and allows changing.

**Changes:**
- Import `useCustomersList` hook
- Add Person selector field in form
- Pre-populate with existing `person_id`
- Allow changing Person assignment
- Keep Deceased Name field unchanged

**Validation:**
- Person selector appears in form
- Pre-populates correctly
- Can change Person assignment
- Deceased Name field still works

---

## Phase 5 — Orders List (Fix Customer Column)

### Task 5.1: Update SortableOrdersTable

**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Description:**
Update table to show Person name in "Customer" column and add/confirm "Deceased" column.

**Changes:**
- Update column headers: "Customer" shows Person name
- Add/confirm "Deceased" column shows customer_name
- Update cell rendering to use transformed data

**Validation:**
- Customer column shows Person name
- Deceased column shows deceased name
- Sorting/searching still works

---

### Task 5.2: Update OrdersPage Search/Filter

**File:** `src/modules/orders/pages/OrdersPage.tsx`

**Description:**
Ensure search works with Person names and filtering remains functional.

**Changes:**
- Update search to include Person names
- Ensure filtering works with new customer field

**Validation:**
- Search finds orders by Person name
- Filtering works correctly

---

## Phase 6 — Invoicing Module Integration

### Task 6.1: Update CreateInvoiceDrawer for Inline Orders

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Description:**
When creating inline orders, if invoice has Person selected (via customer_name), look up person_id and set it on orders.

**Changes:**
- When creating inline orders, check if invoice has customer_name
- If customer_name matches a customer, look up person_id
- Set person_id and person_name on order creation
- If no match, leave person_id as null

**Validation:**
- Inline orders inherit Person from invoice correctly
- Orders without invoice Person remain with null person_id
- Existing invoice flows unchanged

---

## Phase 7 — Testing & Validation

### Task 7.1: Test Orders Module

**Scenarios:**
- Create order with Person assigned → appears correctly
- Create order without Person → shows "—"
- Edit order to add/change Person → works correctly
- Orders list shows correct Person name in Customer column
- Deceased name no longer appears as Customer

**Validation:**
- All scenarios pass
- No console errors
- UI renders correctly

---

### Task 7.2: Test Invoicing Integration

**Scenarios:**
- Create invoice with Person → inline orders inherit Person
- Create invoice without Person → inline orders have null person_id
- Existing invoice flows unchanged

**Validation:**
- All scenarios pass
- No regressions

---

### Task 7.3: Regression Testing

**Modules to Test:**
- Map module (orders display)
- Jobs module (order references)
- Worker assignments
- Other order-dependent features

**Validation:**
- No regressions in any module
- Build passes
- Lint passes

---

## Deliverables

- ✅ Database migration with person_id and person_name fields
- ✅ Updated TypeScript types and Zod schemas
- ✅ Updated Orders API with customer join
- ✅ Person selector in CreateOrderDrawer and EditOrderDrawer
- ✅ Fixed Customer column in Orders list
- ✅ Invoicing module integration for inline orders
- ✅ All tests passing
- ✅ No regressions

---

## Success Criteria

- Creating an Order from Orders module allows selecting a Person
- Editing an Order allows changing Person assignment
- Orders list shows correct Customer name (Person) in Customer column
- Deceased name is not shown as Customer anymore
- Deceased name is visible in separate field/column
- Inline Orders created from Invoice correctly inherit invoice Person (when selected)
- Existing orders (with null person_id) still render correctly
- No regressions in Map, Jobs, Invoicing flows
- Build + lint pass
- No destructive migrations
- Backward compatibility maintained

