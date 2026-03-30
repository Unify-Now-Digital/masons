# Orders Reference Invoices - Architectural Spine Change

## Overview

Establish Invoices as the architectural spine by adding a foreign key reference from Orders to Invoices, reversing the current relationship direction. This is an additive database change that does not modify UI or behavior yet.

**Context:**
- This is an existing Next.js project using both App Router and Pages Router with Supabase as the backend
- The `orders` and `invoices` tables already exist with separate schemas
- Currently: Invoices reference Orders (`invoices.order_id` → `orders.id`)
- Target: Orders should reference Invoices (`orders.invoice_id` → `invoices.id`)
- Invoices are designated as the architectural spine (primary entity)
- Orders are subsidiary entities that must reference an Invoice

**Goal:**
- Add `invoice_id` column to `orders` table with foreign key constraint to `invoices.id`
- Make the change additive and backward-compatible (nullable column initially)
- Update TypeScript type definitions to reflect the new relationship
- Preserve existing data and queries without breaking changes
- No UI or behavior modifications in this phase

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `id: uuid` (primary key)
- `customer_name: text` (not null)
- `customer_email: text` (nullable)
- `customer_phone: text` (nullable)
- `order_type: text` (not null)
- `sku: text` (nullable)
- `material: text` (nullable)
- `color: text` (nullable)
- `stone_status: text` (default 'NA', check constraint)
- `permit_status: text` (default 'pending', check constraint)
- `proof_status: text` (default 'Not_Received', check constraint)
- `deposit_date: date` (nullable)
- `second_payment_date: date` (nullable)
- `due_date: date` (nullable)
- `installation_date: date` (nullable)
- `location: text` (nullable)
- `value: decimal(10,2)` (nullable)
- `progress: integer` (default 0, check 0-100)
- `assigned_to: text` (nullable)
- `priority: text` (default 'medium', check constraint)
- `timeline_weeks: integer` (default 12)
- `notes: text` (nullable)
- `created_at: timestamptz` (default now())
- `updated_at: timestamptz` (default now())

**Foreign Keys:**
- None currently

**Indexes:**
- None explicitly created in migration (primary key index on `id` exists automatically)

**RLS Policies:**
- "Allow all access to orders" (for all operations, using true/with check true)

**Observations:**
- Orders table has no reference to invoices currently
- Orders are standalone entities without invoice relationship
- No `invoice_id` column exists

### Invoices Schema

**Table:** `public.invoices`

**Current Structure:**
- `id: uuid` (primary key)
- `order_id: uuid` (nullable, references `public.orders(id)` on delete set null)
- `invoice_number: text` (unique, not null)
- `customer_name: text` (not null)
- `amount: decimal(10,2)` (not null)
- `status: text` (default 'pending', check constraint)
- `due_date: date` (not null)
- `issue_date: date` (default current_date)
- `payment_method: text` (nullable)
- `payment_date: date` (nullable)
- `notes: text` (nullable)
- `created_at: timestamptz` (default now())
- `updated_at: timestamptz` (default now())

**Foreign Keys:**
- `order_id` → `public.orders(id)` (nullable, on delete set null) ✅ EXISTS

**Indexes:**
- Unique index on `invoice_number`
- Primary key index on `id` (automatic)

**RLS Policies:**
- "Allow all access to invoices" (for all operations, using true/with check true)

**Observations:**
- Invoices currently reference Orders via `order_id`
- Relationship is nullable (invoices can exist without orders)
- This is the reverse of the desired architectural direction

### Relationship Analysis

**Current Relationship:**
- One-way foreign key: `invoices.order_id` → `orders.id`
- Relationship is nullable (invoices can exist without orders)
- Relationship uses `on delete set null` (invoices persist if order is deleted)
- No reverse relationship: Orders do not reference Invoices

**Gaps/Issues:**
1. **Wrong Relationship Direction:**
   - Current: Invoice → Order (Invoice references Order)
   - Required: Order → Invoice (Order references Invoice)
   - Architectural goal: Invoices are the spine; Orders are subsidiary

2. **No Order → Invoice Reference:**
   - `orders` table lacks `invoice_id` column
   - Cannot query which invoice an order belongs to
   - Cannot enforce invoice-centric data model

3. **Dual Relationship Consideration:**
   - Current `invoices.order_id` may need to remain for backward compatibility or transition period
   - Decision needed: Remove `invoices.order_id` immediately, or maintain both relationships temporarily

### Data Access Patterns

**How Orders are Currently Accessed:**

**Location:** `src/modules/orders/api/orders.api.ts`, `src/modules/orders/hooks/useOrders.ts`

- `fetchOrders()` - Fetches all orders
- `fetchOrder(id)` - Fetches single order by ID
- `createOrder(order)` - Creates new order
- `updateOrder(id, updates)` - Updates order
- `deleteOrder(id)` - Deletes order

**Current Filters/Sorting:**
- No invoice-related queries
- Orders are queried independently of invoices

**How Invoices are Currently Accessed:**

**Location:** `src/modules/invoicing/api/invoicing.api.ts`, `src/modules/invoicing/hooks/useInvoices.ts`

- `fetchInvoices()` - Fetches all invoices
- `fetchInvoice(id)` - Fetches single invoice by ID
- `fetchInvoicesByOrder(orderId)` - Fetches invoices by order_id (reverse lookup)
- `createInvoice(invoice)` - Creates new invoice
- `updateInvoice(id, updates)` - Updates invoice
- `deleteInvoice(id)` - Deletes invoice

**Current Filters/Sorting:**
- Can query invoices by `order_id` (reverse relationship)
- No direct way to query orders by invoice

**How They Are Queried Together:**
- Invoices can be joined to orders via `invoices.order_id`
- No direct join from orders to invoices (would require `orders.invoice_id`)

**Display Logic:**
- Invoicing UI may show related orders via `invoice.order_id`
- Orders UI does not display invoice information (no relationship exists)

---

## Recommended Schema Adjustments

### Database Changes

**Migration Required: Add `invoice_id` to Orders Table**

**Rationale:**
- Architectural requirement: Invoices are the spine; Orders must reference Invoices
- Enables invoice-centric data model and queries
- Supports proper referential integrity

**Recommended Migration:**

```sql
-- Add invoice_id column to orders table
-- This makes Invoices the architectural spine
-- Column is nullable to allow for gradual migration of existing data
alter table public.orders
  add column invoice_id uuid references public.invoices(id) on delete set null;

-- Create index for query performance on invoice_id lookups
create index if not exists idx_orders_invoice_id on public.orders(invoice_id);

-- Add comment to document the column purpose
comment on column public.orders.invoice_id is 'References the invoice that this order belongs to. Invoices are the architectural spine. Nullable to allow for gradual migration.';
```

**Key Decisions:**
1. **Column Nullability:**
   - Initial: `invoice_id` is nullable to allow backward compatibility
   - Future: May be made NOT NULL after data migration if required

2. **Foreign Key Constraint:**
   - `on delete set null`: If invoice is deleted, order's `invoice_id` is set to null
   - Alternative considered: `on delete restrict` to prevent invoice deletion if orders exist
   - Decision: Use `set null` for flexibility; business logic can enforce restrictions

3. **Index Creation:**
   - Index on `invoice_id` for efficient lookups: "Which orders belong to this invoice?"
   - Essential for query performance on invoice-centric queries

4. **Existing `invoices.order_id`:**
   - **Decision:** Keep `invoices.order_id` for now (backward compatibility)
   - Both relationships can coexist temporarily
   - Future phase may deprecate `invoices.order_id` once all orders have `invoice_id` populated

**Non-Destructive Constraints:**
- ✅ Only additive changes (new column, new index)
- ✅ No table renames
- ✅ No column deletions
- ✅ No existing data modified
- ✅ Backward compatibility maintained (nullable column)
- ✅ Existing queries continue to work

### Query/Data-Access Alignment

**Recommended Query Patterns:**

1. **Fetch Orders by Invoice ID:**
   ```typescript
   // Add to src/modules/orders/api/orders.api.ts
   export async function fetchOrdersByInvoice(invoiceId: string) {
     const { data, error } = await supabase
       .from('orders')
       .select('*')
       .eq('invoice_id', invoiceId);
     
     if (error) throw error;
     return data as Order[];
   }
   ```

2. **Update Order to Reference Invoice:**
   ```typescript
   // Existing updateOrder function will automatically support invoice_id
   // No changes needed if using OrderUpdate type
   ```

3. **Join Orders with Invoices (New Direction):**
   ```sql
   -- Query orders with their invoice information
   select 
     o.*,
     i.invoice_number,
     i.amount,
     i.status as invoice_status
   from orders o
   left join invoices i on o.invoice_id = i.id;
   ```

**Recommended Display Patterns:**

1. **In Orders UI (Future Phase):**
   - Display invoice information for each order
   - Show invoice number, status, amount
   - Link to invoice detail page

2. **In Invoicing UI (Future Phase):**
   - Query orders by invoice_id instead of (or in addition to) invoice.order_id
   - Display list of orders for a selected invoice

---

## Implementation Approach

### Phase 1: Database Schema Change

**Step 1.1: Create Migration**
- Create migration: `YYYYMMDDHHmmss_add_invoice_id_to_orders.sql`
- Add nullable `invoice_id` column to `orders` table
- Add foreign key constraint to `invoices.id`
- Create index on `invoice_id`
- Add column comment documenting purpose

**Step 1.2: Update TypeScript Type Definitions**
- Update `src/modules/orders/types/orders.types.ts`:
  - Add `invoice_id: string | null` to `Order` interface
- TypeScript types will automatically reflect the new column in queries

**Step 1.3: Validate Migration**
- Run migration on development database
- Verify column exists and foreign key constraint is active
- Verify index is created
- Confirm no existing data is affected

### Phase 2: Data Access Layer (Optional Enhancement)

**Step 2.1: Add Order-by-Invoice Query Function**
- Add `fetchOrdersByInvoice(invoiceId)` to `src/modules/orders/api/orders.api.ts`
- Add `useOrdersByInvoice(invoiceId)` hook to `src/modules/orders/hooks/useOrders.ts`
- Add query key: `ordersKeys.byInvoice(invoiceId)`

**Note:** This step is optional for this phase if the goal is only schema change. Can be deferred to future phase when UI needs this functionality.

### Safety Considerations

**Data Migration:**
- New `invoice_id` column starts as nullable with all values `null`
- Existing orders are not affected
- No data backfill required in this phase
- If existing invoice-order relationships need to be migrated:
  - This would require business logic to determine which orders map to which invoices
  - Can be done in a separate migration or data script
  - Out of scope for this additive change

**Backward Compatibility:**
- All existing queries continue to work (new column is nullable)
- No breaking changes to API or type definitions (only addition)
- Existing `invoices.order_id` relationship remains functional

**Testing Strategy:**
1. Verify migration runs without errors
2. Confirm new column is nullable and accepts null values
3. Test foreign key constraint: Try to set invalid `invoice_id` (should fail)
4. Test foreign key cascade: Delete invoice with referenced order (should set order.invoice_id to null)
5. Verify existing queries return data as before
6. TypeScript compilation succeeds with updated types

**Rollback Strategy:**
- Migration can be rolled back by:
  ```sql
  drop index if exists public.idx_orders_invoice_id;
  alter table public.orders drop column if exists invoice_id;
  ```
- All changes are additive and reversible

---

## What NOT to Do

- ❌ Do NOT remove `invoices.order_id` (keep for backward compatibility)
- ❌ Do NOT make `invoice_id` NOT NULL (keep nullable for now)
- ❌ Do NOT populate existing data (out of scope for additive change)
- ❌ Do NOT modify UI components or display logic
- ❌ Do NOT change existing query functions (only add new ones if needed)
- ❌ Do NOT modify RLS policies (no access control changes)
- ❌ Do NOT add triggers or database functions for automatic population
- ❌ Do NOT refactor unrelated modules

---

## Open Questions / Considerations

1. **Data Migration Strategy:**
   - How should existing invoice-order relationships be migrated?
   - Should `invoices.order_id` be used to backfill `orders.invoice_id` for existing data?
   - Or should this be a separate, explicit data migration phase?

2. **Constraint Strategy:**
   - Should `invoice_id` eventually become NOT NULL (requiring all orders to have an invoice)?
   - Or should it remain nullable to support orders without invoices?

3. **Relationship Direction:**
   - Should `invoices.order_id` be deprecated/removed in a future phase?
   - Or should both relationships coexist (orders → invoices AND invoices → orders)?
   - This may depend on business requirements for bidirectional lookup

4. **Query Performance:**
   - Will the new index on `orders.invoice_id` be sufficient for invoice-centric queries?
   - Should composite indexes be considered for common query patterns?

5. **Business Logic:**
   - What happens when an order needs to be created without an invoice?
   - Can orders exist independently, or must they always belong to an invoice?
   - This affects whether `invoice_id` should eventually be NOT NULL

6. **UI Integration Timing:**
   - When should UI changes be made to display invoice information in Orders?
   - Should this be a separate phase after schema is established?

---

## Success Criteria

- ✅ `orders.invoice_id` column exists and is nullable
- ✅ Foreign key constraint `orders.invoice_id` → `invoices.id` is active
- ✅ Index `idx_orders_invoice_id` exists for query performance
- ✅ TypeScript `Order` interface includes `invoice_id: string | null`
- ✅ All existing queries and operations continue to work unchanged
- ✅ Migration is reversible without data loss
- ✅ No UI or behavior changes in this phase

