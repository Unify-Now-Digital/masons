# Permit Cost on Orders (GBP)

## Overview

Add a Permit cost field to Orders that is manually entered and included in order and invoice total calculations. Permit cost represents the cost of cemetery permits required for memorial installations and must be factored into financial calculations.

**Context:**
- Orders table currently has a `value` field (numeric) representing the base order value
- Invoice amounts are calculated from order values in `CreateInvoiceDrawer`
- Orders create/edit UI exists in `CreateOrderDrawer` and `EditOrderDrawer`
- Order value is displayed in `SortableOrdersTable` and `OrderDetailsSidebar`
- Invoice totals are derived from order values when creating invoices

**Goal:**
- Add `permit_cost` field to Orders table (numeric, default 0, non-null)
- Include Permit cost input in Orders create/edit UI
- Display Permit cost in Order details view
- Include Permit cost in order total calculation
- Include Permit cost in invoice total calculations (derived from orders)
- Ensure safe, additive, backward-compatible implementation

---

## Current State Analysis

### Orders Table Schema

**Table:** `public.orders`

**Current Structure:**
- `id` uuid primary key
- `value` decimal(10,2) - Base order value (nullable)
- `invoice_id` uuid - Foreign key to invoices (nullable)
- `job_id` uuid - Foreign key to jobs (nullable)
- `person_id` uuid - Foreign key to customers/people (nullable)
- `person_name` text - Snapshot of person name (nullable)
- `customer_name` text - Deceased name (not null)
- `customer_email` text (nullable)
- `customer_phone` text (nullable)
- `order_type` text (not null)
- Various status fields (stone_status, permit_status, proof_status)
- Date fields (deposit_date, due_date, installation_date, etc.)
- Other operational fields (progress, priority, notes, etc.)

**Observations:**
- Order `value` field represents the base product/service cost
- No separate field for permit costs
- Permit costs are not currently tracked or included in totals
- Order value is used directly in invoice calculations

### Invoice Calculation Logic

**Component:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Current Structure:**
- Invoice amount is calculated by summing order values:
  ```typescript
  const finalAmount = orders.reduce((sum, order) => sum + (order.data.value ?? 0), 0);
  ```
- Each order's `value` field is added directly to the invoice total
- No separate permit cost field is considered

**Observations:**
- Invoice totals use order `value` directly
- No distinction between base order cost and permit costs
- Permit costs would need to be added to this calculation

### Order Value Display

**Components:**
- `src/modules/orders/components/SortableOrdersTable.tsx` - Displays formatted order value in table
- `src/modules/orders/utils/orderTransform.ts` - Transforms `order.value` (number) to formatted string (`£X.XX`)
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Displays order details including value

**Current Format:**
- Order value is formatted as: `£${order.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
- Uses GBP formatting (`en-GB` locale)
- Displays "N/A" if value is null

**Observations:**
- Value formatting uses GBP locale (correct)
- Null values are handled gracefully
- No separate display for permit costs

### Relationship Analysis

**Current Relationship:**
- Orders → Invoices: One-to-many via `orders.invoice_id`
- Invoice amounts are calculated from order values
- Order value is stored as `decimal(10,2)` in database
- Order value is transformed to formatted string for display

**Gaps/Issues:**
- Permit costs are not tracked separately from base order value
- Permit costs are not included in financial calculations
- No field to distinguish between base cost and permit cost in orders

### Data Access Patterns

**How Order Value is Currently Accessed:**
- Database: `orders.value` (decimal(10,2))
- TypeScript: `Order.value` (number | null)
- UI Transform: `transformOrderForUI` converts to formatted string
- Display: Formatted as GBP currency string

**How Invoice Totals are Calculated:**
- In `CreateInvoiceDrawer`: Sums `order.data.value` from selected orders
- Direct addition: `sum + (order.data.value ?? 0)`
- No additional calculations or adjustments

**How Order Value is Used in UI:**
- Orders table: Displays formatted value string
- Order details sidebar: Shows value in details view
- Invoice creation: Sums values to calculate invoice amount
- Invoice display: Shows invoice `amount` field (not recalculated from orders)

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**

Add `permit_cost` column to `orders` table:

```sql
-- Add permit_cost column to orders table
alter table public.orders
  add column permit_cost decimal(10,2) not null default 0;

-- Add column comment for clarity
comment on column public.orders.permit_cost is 'Cost of cemetery permits in GBP. Manually entered and included in order total.';
```

**Non-Destructive Constraints:**
- Only additive change (new column)
- Default value of 0 ensures backward compatibility
- Non-null constraint with default ensures all existing orders have a value
- No modifications to existing columns or relationships
- No changes to invoices table (amounts are calculated, not stored)

### Calculation Adjustments

**Order Total Calculation:**
- Current: `order.value` (base cost only)
- New: `order.value + order.permit_cost` (base cost + permit cost)
- Null handling: Treat null values as 0

**Invoice Total Calculation:**
- Current: `sum(order.value ?? 0)` for all orders in invoice
- New: `sum((order.value ?? 0) + (order.permit_cost ?? 0))` for all orders in invoice
- Ensure safe null handling

### Display Patterns

**Order Details Display:**
- Show base value and permit cost separately
- Show calculated total (base value + permit cost)
- Format both as GBP currency

**Orders Table Display:**
- Current "Value" column should show total (base + permit cost)
- Optional: Add separate "Permit Cost" column if needed
- Format as GBP currency

---

## Implementation Approach

### Phase 1: Database Migration

1. **Create migration file:**
   - File: `supabase/migrations/YYYYMMDDHHmmss_add_permit_cost_to_orders.sql`
   - Add `permit_cost` column with default 0
   - Add column comment
   - Ensure non-null constraint

2. **Validate migration:**
   - Run migration against local database
   - Verify all existing orders have `permit_cost = 0`
   - Confirm no data loss

### Phase 2: Type Updates

1. **Update Order TypeScript types:**
   - File: `src/modules/orders/types/orders.types.ts`
   - Add `permit_cost: number | null` to `Order` interface
   - Update `OrderInsert` and `OrderUpdate` types accordingly

2. **Update UI Order transform:**
   - File: `src/modules/orders/utils/orderTransform.ts`
   - Add `permitCost` to `UIOrder` interface
   - Transform `permit_cost` in `transformOrderForUI` function
   - Handle null values safely (default to 0)

### Phase 3: Order Total Calculation Utility

1. **Create utility function:**
   - File: `src/modules/orders/utils/orderCalculations.ts` (new file)
   - Function: `getOrderTotal(order: Order): number`
   - Calculation: `(order.value ?? 0) + (order.permit_cost ?? 0)`
   - Function: `getOrderTotalFormatted(order: Order): string`
   - Format total as GBP currency string

2. **Update existing value displays:**
   - Update `orderTransform.ts` to use new utility for total calculation
   - Update Orders table to display total instead of base value
   - Update Order details sidebar to show base value, permit cost, and total separately

### Phase 4: Orders UI Updates

1. **Update CreateOrderDrawer:**
   - File: `src/modules/orders/components/CreateOrderDrawer.tsx`
   - Add "Permit Cost (GBP)" input field
   - Default to 0
   - Validate numeric input
   - Include in form submission

2. **Update EditOrderDrawer:**
   - File: `src/modules/orders/components/EditOrderDrawer.tsx`
   - Add "Permit Cost (GBP)" input field
   - Pre-populate with existing `permit_cost` value
   - Include in form update

3. **Update Order Details Sidebar:**
   - File: `src/modules/orders/components/OrderDetailsSidebar.tsx`
   - Display permit cost separately
   - Display calculated total (base value + permit cost)
   - Format all values as GBP currency

### Phase 5: Invoice Calculation Updates

1. **Update CreateInvoiceDrawer:**
   - File: `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`
   - Update invoice amount calculation to include permit costs:
     ```typescript
     const finalAmount = orders.reduce((sum, order) => {
       const baseValue = order.data.value ?? 0;
       const permitCost = order.data.permit_cost ?? 0;
       return sum + baseValue + permitCost;
     }, 0);
     ```
   - Or use utility function: `sum + getOrderTotal(order.data)`

2. **Update Order display in Invoice creation:**
   - Show base value, permit cost, and total per order
   - Update invoice total preview to reflect correct calculation

3. **Validate invoice calculations:**
   - Ensure invoice amounts include permit costs
   - Test with orders that have permit costs > 0
   - Test with orders that have permit_cost = null (should treat as 0)

### Phase 6: Orders Table Display (Optional Enhancement)

1. **Update SortableOrdersTable:**
   - File: `src/modules/orders/components/SortableOrdersTable.tsx`
   - "Value" column should show total (base + permit cost)
   - Optional: Add separate "Permit Cost" column if visibility needed
   - Format as GBP currency

2. **Update column definitions:**
   - File: `src/modules/orders/components/orderColumnDefinitions.tsx`
   - Update value column to display total
   - Optional: Add permit cost column definition

### Safety Considerations

- **Backward Compatibility:**
  - Default value of 0 ensures existing orders are unaffected
  - Null handling treats missing values as 0
  - Existing invoices remain unchanged (amounts are stored, not recalculated)

- **Data Integrity:**
  - Non-null constraint ensures all orders have a permit_cost value
  - Default value prevents null-related calculation errors
  - Numeric validation in UI prevents invalid entries

- **Testing:**
  - Test with existing orders (should default to permit_cost = 0)
  - Test creating new orders with permit costs
  - Test invoice calculations with mixed order values
  - Test null handling (should default to 0)

- **Rollback Strategy:**
  - Migration can be reversed by dropping the column
  - Existing data is not modified (default applied on read, not write)
  - UI changes are additive and can be reverted

---

## What NOT to Do

- **Do NOT modify existing `value` column** (keep base order value separate)
- **Do NOT recalculate existing invoice amounts** (invoices store amounts, don't recalculate)
- **Do NOT automatically calculate permit costs** (must be manually entered)
- **Do NOT add permit cost to invoices table** (derived from orders, not stored separately)
- **Do NOT change currency formatting** (continue using GBP/en-GB)
- **Do NOT modify existing order value displays without showing breakdown** (users need to see base vs permit cost)

---

## Open Questions / Considerations

1. **Display Strategy:**
   - Should Orders table show total (base + permit) or both separately?
   - Should Order details show breakdown (base, permit, total) or just total?
   - Recommendation: Show total in table, breakdown in details view

2. **Validation:**
   - Should permit cost be allowed to be negative? (No, minimum 0)
   - Should there be a maximum permit cost? (No hard limit, but reasonable validation)
   - Should permit cost be required or optional? (Optional, defaults to 0)

3. **Currency:**
   - Should permit cost use same currency as order value? (Yes, GBP)
   - Should formatting be consistent with existing value formatting? (Yes, en-GB locale)

4. **Invoice Totals:**
   - Should invoice amounts be recalculated when orders are edited? (No, invoices are snapshots)
   - Should invoice creation show permit cost breakdown? (Yes, for transparency)

5. **Backward Compatibility:**
   - How should existing orders without permit_cost be handled? (Default to 0)
   - Should existing invoices be affected? (No, amounts are stored)

---

## Acceptance Criteria

### Database
- ✅ `orders` table has `permit_cost` column
- ✅ Column type: `decimal(10,2)`
- ✅ Column default: `0`
- ✅ Column constraint: `NOT NULL`
- ✅ All existing orders have `permit_cost = 0` after migration

### UI - Orders Create/Edit
- ✅ CreateOrderDrawer has "Permit Cost (GBP)" input field
- ✅ Input field defaults to 0
- ✅ Input field accepts numeric values only
- ✅ EditOrderDrawer has "Permit Cost (GBP)" input field
- ✅ EditOrderDrawer pre-populates with existing permit_cost value
- ✅ Form validation prevents invalid numeric values

### UI - Order Display
- ✅ Order details sidebar shows permit cost separately
- ✅ Order details sidebar shows calculated total (base value + permit cost)
- ✅ All values formatted as GBP currency (`en-GB` locale)
- ✅ Orders table "Value" column shows total (base + permit cost)

### Calculations
- ✅ Order total = base value + permit cost (null values treated as 0)
- ✅ Invoice total includes permit costs from all orders
- ✅ Calculations handle null/undefined values safely
- ✅ Utility function `getOrderTotal()` returns correct total

### Invoice Creation
- ✅ CreateInvoiceDrawer calculates invoice amount including permit costs
- ✅ Order selection shows permit cost breakdown (optional but recommended)
- ✅ Invoice total preview reflects correct calculation

### Safety & Compatibility
- ✅ No existing orders are modified (default applied)
- ✅ Existing invoices remain unchanged
- ✅ Null values are handled safely (default to 0)
- ✅ Build passes without errors
- ✅ Lint passes without errors

---

## Success Metrics

- Users can enter permit costs when creating/editing orders
- Order totals correctly include permit costs
- Invoice totals correctly include permit costs from orders
- All financial calculations are accurate
- No data loss or breaking changes
- UI clearly distinguishes between base value and permit cost

