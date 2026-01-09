# Implementation Plan: Additional Options on Orders (GBP)

## Feature Overview

Add support for multiple "Additional Options" per Order (custom services like engraving, picture, color upgrades, etc.), each with a manually entered cost. Additional Options costs must be included in order totals and therefore invoice totals.

**Branch:** `feature/additional-options-on-orders-gbp`  
**Spec File:** `specs/additional-options-on-orders-gbp.md`

---

## Technical Context

### Current State
- Orders table has `value` field (decimal(10,2), nullable) representing base order value
- Orders table has `permit_cost` field (decimal(10,2), not null, default 0) representing permit cost
- Order total currently calculated as: `base value + permit_cost`
- Orders fetched via `fetchOrders()` using Supabase `.from('orders').select('*, customers(...)')`
- Order totals calculated using shared utilities (`getOrderTotal`, `getOrderTotalFormatted`)
- Invoice amounts are calculated by summing order totals in `CreateInvoiceDrawer`
- Orders displayed in `SortableOrdersTable` and `OrderDetailsSidebar`

### Key Files
- `supabase/migrations/20250608000001_create_orders_table.sql` - Orders table schema
- `src/modules/orders/api/orders.api.ts` - Order API functions (fetchOrders, fetchOrder, etc.)
- `src/modules/orders/types/orders.types.ts` - Order TypeScript types
- `src/modules/orders/utils/orderTransform.ts` - Order UI transformation
- `src/modules/orders/utils/orderCalculations.ts` - Order total calculation utilities
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Order creation UI
- `src/modules/orders/components/EditOrderDrawer.tsx` - Order editing UI
- `src/modules/orders/components/SortableOrdersTable.tsx` - Orders table display
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Order details view
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Invoice creation with order total calculation
- `src/modules/orders/schemas/order.schema.ts` - Order form validation schema

### Constraints
- **CRITICAL: No N+1 Queries** - Orders list/table must remain performant
- Additive-only migrations (new table only, no modifications to existing tables)
- Backward compatible (existing orders work without additional options, default to 0)
- No changes to invoices table (amounts are calculated, not stored)
- Maintain existing currency formatting (GBP, en-GB locale)
- Safe null handling (treat null/undefined as 0)
- Full order value everywhere = base value + permit_cost + additional_options_total

### Performance Requirement: Single-Query Approach

**Problem:** If we fetch orders and then fetch options for each order separately, we get N+1 queries (1 for orders + N for each order's options).

**Solution:** Use a single query with LEFT JOIN and aggregation to get options_total per order.

**Approach Options:**
1. **SQL VIEW with aggregated options_total** (Recommended)
   - Create a view that includes `additional_options_total` as a computed column
   - Query the view instead of the table
   - Pros: Clean, reusable, performant
   - Cons: Requires view creation

2. **Supabase RPC function**
   - Create a PostgreSQL function that returns orders with aggregated options_total
   - Call via Supabase `.rpc()`
   - Pros: Flexible, can include complex logic
   - Cons: Requires function creation, less standard

3. **Query with LEFT JOIN + GROUP BY**
   - Modify `fetchOrders()` to use LEFT JOIN with aggregation
   - Use Supabase's `.select()` with join syntax
   - Pros: Standard SQL, no additional objects
   - Cons: More complex query, may need to handle grouping

**Selected Approach:** Option 1 (SQL VIEW) - Cleanest and most performant for list queries.

---

## Implementation Phases

### Phase 1: Database Migration

**Goal:** Create `order_additional_options` table and SQL VIEW for efficient querying.

#### Task 1.1: Create Migration for `order_additional_options` Table
**File:** `supabase/migrations/YYYYMMDDHHmmss_create_order_additional_options_table.sql`

**Implementation:**
- Create `order_additional_options` table:
  ```sql
  create table if not exists public.order_additional_options (
    id uuid not null default gen_random_uuid() primary key,
    order_id uuid not null references public.orders(id) on delete cascade,
    name text not null,
    cost numeric(10,2) not null default 0,
    description text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  ```
- Enable RLS: `alter table public.order_additional_options enable row level security;`
- Create RLS policies (SELECT, INSERT, UPDATE, DELETE) following existing orders access patterns
- Create index: `create index idx_order_additional_options_order_id on public.order_additional_options(order_id);`
- Add updated_at trigger using existing `update_updated_at_column()` function

**Success Criteria:**
- Migration runs successfully
- Table created with correct structure and constraints
- RLS enabled with appropriate policies
- Index created for performance
- Trigger created for updated_at

#### Task 1.2: Create SQL VIEW for Orders with Options Total
**File:** `supabase/migrations/YYYYMMDDHHmmss_create_orders_with_options_total_view.sql`

**Implementation:**
- Create view that includes aggregated options_total:
  ```sql
  create or replace view public.orders_with_options_total as
  select 
    o.*,
    coalesce(sum(ao.cost), 0) as additional_options_total
  from public.orders o
  left join public.order_additional_options ao on o.id = ao.order_id
  group by o.id;
  ```
- Grant appropriate permissions to authenticated users
- Add comment: 'View of orders with pre-calculated additional_options_total to avoid N+1 queries'

**Success Criteria:**
- View created successfully
- View returns orders with `additional_options_total` column
- View handles orders with no options (returns 0)
- Permissions granted correctly

---

### Phase 2: Type Updates

**Goal:** Update TypeScript types to include additional options and options_total.

#### Task 2.1: Create OrderAdditionalOption Type
**File:** `src/modules/orders/types/orders.types.ts`

**Changes:**
- Add `OrderAdditionalOption` interface:
  ```typescript
  export interface OrderAdditionalOption {
    id: string;
    order_id: string;
    name: string;
    cost: number; // NOT NULL DEFAULT 0
    description: string | null;
    created_at: string;
    updated_at: string;
  }
  ```

**Success Criteria:**
- Type defined correctly
- Matches database schema
- No TypeScript errors

#### Task 2.2: Update Order Type to Include Options Total
**File:** `src/modules/orders/types/orders.types.ts`

**Changes:**
- Add `additional_options_total?: number` to `Order` interface (from view)
- Add `additional_options?: OrderAdditionalOption[]` to `Order` interface (optional, for detail views)
- Update `OrderInsert` and `OrderUpdate` types accordingly

**Success Criteria:**
- Order type includes `additional_options_total`
- Order type includes optional `additional_options` array
- Types are consistent with database schema and view
- No TypeScript errors

#### Task 2.3: Create Additional Option Form Schema
**File:** `src/modules/orders/schemas/order.schema.ts`

**Changes:**
- Add `additionalOptionSchema`:
  ```typescript
  export const additionalOptionSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    cost: z.number().min(0, 'Cost must be positive').optional().nullable(),
    description: z.string().optional().nullable(),
  });
  ```
- Add `additional_options` to `orderFormSchema`:
  ```typescript
  additional_options: z.array(additionalOptionSchema).optional().default([]),
  ```

**Success Criteria:**
- Schema includes additional option validation
- Validation prevents negative costs
- Default handles empty arrays safely

---

### Phase 3: API Updates (Single-Query Approach)

**Goal:** Update API to use the view for list queries, avoiding N+1 queries.

#### Task 3.1: Update fetchOrders() to Use View
**File:** `src/modules/orders/api/orders.api.ts`

**Changes:**
- Update `fetchOrders()` to query `orders_with_options_total` view instead of `orders` table:
  ```typescript
  export async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders_with_options_total')
      .select('*, customers(id, first_name, last_name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Order[];
  }
  ```
- Ensure `additional_options_total` is included in returned data

**Success Criteria:**
- `fetchOrders()` uses view instead of table
- Returns orders with `additional_options_total` field
- No N+1 queries (single query for all orders)
- Performance remains acceptable

#### Task 3.2: Update fetchOrdersByInvoice() to Use View
**File:** `src/modules/orders/api/orders.api.ts`

**Changes:**
- Update `fetchOrdersByInvoice()` to use view:
  ```typescript
  export async function fetchOrdersByInvoice(invoiceId: string) {
    const { data, error } = await supabase
      .from('orders_with_options_total')
      .select('*, customers(id, first_name, last_name)')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Order[];
  }
  ```

**Success Criteria:**
- Uses view for efficient querying
- Returns orders with `additional_options_total`
- No N+1 queries

#### Task 3.3: Keep fetchOrder() Using Table (Detail View Needs Options Array)
**File:** `src/modules/orders/api/orders.api.ts`

**Changes:**
- Keep `fetchOrder()` using `orders` table (not view)
- Add LEFT JOIN to fetch `additional_options` array for detail view:
  ```typescript
  export async function fetchOrder(id: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(id, first_name, last_name), order_additional_options(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Order;
  }
  ```
- This allows detail view to show individual options (not just total)

**Success Criteria:**
- Detail view fetches full options array
- List views use view with aggregated total (no N+1)
- Both patterns work correctly

#### Task 3.4: Create Additional Options CRUD Functions
**File:** `src/modules/orders/api/orders.api.ts` (or new file `additionalOptions.api.ts`)

**Changes:**
- Add functions for managing additional options:
  ```typescript
  export async function createAdditionalOption(option: {
    order_id: string;
    name: string;
    cost: number;
    description?: string | null;
  })
  
  export async function updateAdditionalOption(id: string, updates: {
    name?: string;
    cost?: number;
    description?: string | null;
  })
  
  export async function deleteAdditionalOption(id: string)
  
  export async function fetchAdditionalOptionsByOrder(orderId: string)
  ```

**Success Criteria:**
- CRUD functions work correctly
- Proper error handling
- RLS policies enforced

---

### Phase 4: Calculation Utility Updates

**Goal:** Extend calculation utilities to include additional options total.

#### Task 4.1: Update getOrderTotal() to Include Options
**File:** `src/modules/orders/utils/orderCalculations.ts`

**Changes:**
- Update `getOrderTotal()` to include `additional_options_total`:
  ```typescript
  export function getOrderTotal(order: Order): number {
    const baseValue = getOrderBaseValue(order);
    const permitCost = getOrderPermitCost(order);
    const optionsTotal = order.additional_options_total ?? 0;
    return baseValue + permitCost + optionsTotal;
  }
  ```
- Add helper function:
  ```typescript
  export function getOrderAdditionalOptionsTotal(order: Order): number {
    return order.additional_options_total ?? 0;
  }
  ```
- Ensure `getOrderTotalFormatted()` uses updated calculation

**Success Criteria:**
- `getOrderTotal()` includes additional options
- Helper function works correctly
- Defensive null handling (defaults to 0)
- `getOrderTotalFormatted()` reflects updated total

---

### Phase 5: Orders UI Updates

**Goal:** Add UI for managing additional options in create/edit drawers.

#### Task 5.1: Update CreateOrderDrawer
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
- Add "Additional Options" section to form
- Support adding/removing multiple options
- Each option has: name (text input), cost (number input), description (optional textarea)
- Cost input uses `toMoneyNumber` utility (blank => 0)
- Use `useFieldArray` from react-hook-form for dynamic options

**Success Criteria:**
- Section visible and functional
- Can add/remove multiple options
- Validation works correctly
- Form submission includes options array

#### Task 5.2: Update EditOrderDrawer
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
- Add "Additional Options" section to form
- Pre-populate with existing options (fetch via `fetchAdditionalOptionsByOrder`)
- Support adding/removing/editing options
- Save changes to options when order is updated

**Success Criteria:**
- Section visible and functional
- Pre-populates with existing options
- Can add/remove/edit options
- Changes saved correctly

#### Task 5.3: Update OrderDetailsSidebar
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Changes:**
- Display additional options list (if options exist)
- Show options subtotal
- Update total display to show breakdown:
  - Base Value
  - Permit Cost
  - Additional Options Total
  - **Total** (sum of all three)
- Use `getOrderAdditionalOptionsTotal()` helper

**Success Criteria:**
- Options list displayed when present
- Options subtotal shown
- Total breakdown is clear
- All values formatted as GBP

---

### Phase 6: Order Display Updates

**Goal:** Ensure Orders table shows correct totals including options.

#### Task 6.1: Verify Orders Table Display
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Changes:**
- No changes needed - table uses `orderTransform.ts` which uses `getOrderTotalFormatted()`
- Verify that `orderTransform.ts` uses updated calculation utility

**Success Criteria:**
- Orders table shows total including options
- No code changes needed (uses existing utilities)

#### Task 6.2: Update orderTransform.ts
**File:** `src/modules/orders/utils/orderTransform.ts`

**Changes:**
- Verify `transformOrderForUI` uses `getOrderTotalFormatted()` (already includes options)
- Ensure `total` field (for sorting) uses `getOrderTotal()` (already includes options)

**Success Criteria:**
- Transform uses updated calculation
- Display and sorting both include options

---

### Phase 7: Invoice Integration

**Goal:** Ensure invoice totals automatically include additional options.

#### Task 7.1: Verify Invoice Calculations
**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Changes:**
- No changes needed - uses `getOrderTotal()` which now includes options
- Verify that orders fetched via `fetchOrdersByInvoice()` include `additional_options_total`

**Success Criteria:**
- Invoice totals include additional options automatically
- No code changes needed (uses existing utilities)

#### Task 7.2: Verify Invoice Order List Display
**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

**Changes:**
- Verify uses `getOrderTotalFormatted()` (already includes options)
- No changes needed if using shared utility

**Success Criteria:**
- Invoice order list shows correct totals
- Totals include additional options

---

### Phase 8: Testing & Validation

**Goal:** Verify all functionality works correctly and no regressions.

#### Task 8.1: Test Order Creation/Editing
- Create new order with additional options
- Create new order without additional options (should default to 0)
- Edit existing order to add options
- Edit existing order to remove options
- Edit existing order to update option costs
- Verify options are saved correctly

**Success Criteria:**
- All order operations work correctly
- Options are saved and retrieved correctly
- Default value of 0 is applied correctly

#### Task 8.2: Test Order Display
- Verify Orders table shows total including options
- Verify Order details sidebar shows options list and subtotal
- Verify all values formatted as GBP currency
- Test with orders that have no options
- Test with orders that have multiple options

**Success Criteria:**
- Display is correct and clear
- Formatting is consistent
- Options breakdown is visible in details view

#### Task 8.3: Test Invoice Calculations
- Create invoice with orders that have additional options
- Create invoice with orders that have no additional options
- Verify invoice total includes additional options
- Test with mixed orders (some with options, some without)

**Success Criteria:**
- Invoice totals are calculated correctly
- Additional options are included in invoice amounts
- Calculations handle null/empty values safely

#### Task 8.4: Performance Testing
- Verify no N+1 queries in Orders list
- Test with large number of orders (100+)
- Verify view query performance is acceptable
- Check network tab for query count

**Success Criteria:**
- Single query for orders list (no N+1)
- Performance remains acceptable
- No performance regressions

#### Task 8.5: Build & Lint Validation
**Commands:**
```bash
npm run build
npm run lint
```

**Success Criteria:**
- Build passes without errors
- Lint passes without errors
- No TypeScript errors

---

## Progress Tracking

- [ ] Phase 1: Database Migration
  - [ ] Task 1.1: Create Migration for `order_additional_options` Table
  - [ ] Task 1.2: Create SQL VIEW for Orders with Options Total
- [ ] Phase 2: Type Updates
  - [ ] Task 2.1: Create OrderAdditionalOption Type
  - [ ] Task 2.2: Update Order Type to Include Options Total
  - [ ] Task 2.3: Create Additional Option Form Schema
- [ ] Phase 3: API Updates (Single-Query Approach)
  - [ ] Task 3.1: Update fetchOrders() to Use View
  - [ ] Task 3.2: Update fetchOrdersByInvoice() to Use View
  - [ ] Task 3.3: Keep fetchOrder() Using Table (Detail View Needs Options Array)
  - [ ] Task 3.4: Create Additional Options CRUD Functions
- [ ] Phase 4: Calculation Utility Updates
  - [ ] Task 4.1: Update getOrderTotal() to Include Options
- [ ] Phase 5: Orders UI Updates
  - [ ] Task 5.1: Update CreateOrderDrawer
  - [ ] Task 5.2: Update EditOrderDrawer
  - [ ] Task 5.3: Update OrderDetailsSidebar
- [ ] Phase 6: Order Display Updates
  - [ ] Task 6.1: Verify Orders Table Display
  - [ ] Task 6.2: Update orderTransform.ts
- [ ] Phase 7: Invoice Integration
  - [ ] Task 7.1: Verify Invoice Calculations
  - [ ] Task 7.2: Verify Invoice Order List Display
- [ ] Phase 8: Testing & Validation
  - [ ] Task 8.1: Test Order Creation/Editing
  - [ ] Task 8.2: Test Order Display
  - [ ] Task 8.3: Test Invoice Calculations
  - [ ] Task 8.4: Performance Testing
  - [ ] Task 8.5: Build & Lint Validation

---

## Deliverables

1. **Database Migration:** `order_additional_options` table and `orders_with_options_total` view
2. **Type Updates:** OrderAdditionalOption type and updated Order type
3. **API Updates:** Single-query approach using view for list queries
4. **Calculation Utilities:** Updated `getOrderTotal()` to include options
5. **UI Updates:** Create/Edit Order drawers with Additional Options section
6. **Display Updates:** Order details and table showing totals including options
7. **Invoice Updates:** Invoice calculations automatically including options

---

## Risk Mitigation

### Risk: N+1 Query Performance Issue
**Mitigation:** Use SQL VIEW with aggregated `additional_options_total` to fetch all data in single query for list views.

### Risk: Breaking Existing Orders
**Mitigation:** View handles orders with no options (returns 0). Existing orders work without changes.

### Risk: Null Value Handling
**Mitigation:** All calculations use nullish coalescing (`?? 0`) to treat null/undefined as 0.

### Risk: View Performance
**Mitigation:** Index on `order_additional_options.order_id` ensures efficient aggregation. View is materialized-friendly if needed.

---

## Notes

- Additional options must be manually entered (no automatic calculation)
- Default value of 0 ensures backward compatibility
- Order total = base value + permit cost + additional options total
- Invoice total = sum of all order totals (base + permit cost + options) from selected orders
- Display strategy: Show total in table, breakdown in details view
- Currency: GBP (en-GB locale) for all formatting
- **Performance:** Single-query approach via SQL VIEW prevents N+1 queries

