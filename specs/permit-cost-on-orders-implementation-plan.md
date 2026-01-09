# Implementation Plan: Permit Cost on Orders (GBP)

## Feature Overview

Add a Permit cost field to Orders that is manually entered and included in order and invoice total calculations. Permit cost represents the cost of cemetery permits required for memorial installations and must be factored into financial calculations.

**Branch:** `feature/permit-cost-on-orders`  
**Spec File:** `specs/permit-cost-on-orders.md`

---

## Technical Context

### Current State
- Orders table has `value` field (decimal(10,2), nullable) representing base order value
- Invoice amounts are calculated by summing order values in `CreateInvoiceDrawer`
- Orders create/edit UI exists in `CreateOrderDrawer` and `EditOrderDrawer`
- Order value is displayed in `SortableOrdersTable` and `OrderDetailsSidebar`
- Invoice totals are derived from order values when creating invoices

### Key Files
- `supabase/migrations/20250608000001_create_orders_table.sql` - Orders table schema
- `src/modules/orders/types/orders.types.ts` - Order TypeScript types
- `src/modules/orders/utils/orderTransform.ts` - Order UI transformation
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Order creation UI
- `src/modules/orders/components/EditOrderDrawer.tsx` - Order editing UI
- `src/modules/orders/components/SortableOrdersTable.tsx` - Orders table display
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Order details view
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Invoice creation with order total calculation
- `src/modules/orders/schemas/order.schema.ts` - Order form validation schema

### Constraints
- Additive-only migration (new column only)
- Backward compatible (default value ensures existing orders unaffected)
- No changes to invoices table (amounts are calculated, not stored)
- Maintain existing currency formatting (GBP, en-GB locale)
- Safe null handling (treat null/undefined as 0)

---

## Implementation Phases

### Phase 1: Database Migration

**Goal:** Add `permit_cost` column to Orders table with safe defaults.

#### Task 1.1: Create Migration for `permit_cost` Column
**File:** `supabase/migrations/YYYYMMDDHHmmss_add_permit_cost_to_orders.sql`

**Implementation:**
- Add `permit_cost decimal(10,2) NOT NULL DEFAULT 0` column
- Add column comment: 'Cost of cemetery permits in GBP. Manually entered and included in order total.'
- Ensure all existing orders get default value of 0

**Success Criteria:**
- Migration runs successfully
- Column created with correct type and constraints
- All existing orders have `permit_cost = 0`
- No data loss or breaking changes

---

### Phase 2: Type Updates

**Goal:** Update TypeScript types and UI transformations to include permit_cost.

#### Task 2.1: Update Order TypeScript Types
**File:** `src/modules/orders/types/orders.types.ts`

**Changes:**
- Add `permit_cost: number | null` to `Order` interface
- Update `OrderInsert` and `OrderUpdate` types accordingly

**Success Criteria:**
- Types include permit_cost field
- Types are consistent with database schema
- No TypeScript errors

#### Task 2.2: Update Order Form Schema
**File:** `src/modules/orders/schemas/order.schema.ts`

**Changes:**
- Add `permit_cost: z.number().min(0, 'Permit cost must be positive').optional().nullable()` to `orderFormSchema`
- Default to null (will be converted to 0 in database)

**Success Criteria:**
- Schema includes permit_cost validation
- Validation prevents negative values
- Default handles null/undefined safely

#### Task 2.3: Update UI Order Transform
**File:** `src/modules/orders/utils/orderTransform.ts`

**Changes:**
- Add `permitCost?: number | null` to `UIOrder` interface
- Transform `permit_cost` in `transformOrderForUI` function: `permitCost: order.permit_cost ?? null`
- Handle null values safely (default to null for display)

**Success Criteria:**
- UIOrder includes permitCost field
- Transform handles null values safely
- No breaking changes to existing code

---

### Phase 3: Order Total Calculation Utility

**Goal:** Create utility functions for calculating order totals including permit costs.

#### Task 3.1: Create Order Calculations Utility
**File:** `src/modules/orders/utils/orderCalculations.ts` (new file)

**Functions:**
- `getOrderTotal(order: Order): number` - Returns base value + permit cost (null values treated as 0)
- `getOrderTotalFormatted(order: Order): string` - Returns formatted GBP currency string
- `getOrderBaseValue(order: Order): number` - Returns base value (null treated as 0)
- `getOrderPermitCost(order: Order): number` - Returns permit cost (null treated as 0)

**Success Criteria:**
- Functions handle null/undefined values safely
- Total calculation is correct: `(order.value ?? 0) + (order.permit_cost ?? 0)`
- Formatting uses GBP locale (en-GB)
- Functions are tested and documented

---

### Phase 4: Orders UI Updates

**Goal:** Add Permit cost input to Orders create/edit UI and update display.

#### Task 4.1: Update CreateOrderDrawer
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
- Add "Permit Cost (GBP)" input field to form
- Default to null (converted to 0 on submit if not provided)
- Validate numeric input (min 0)
- Include in form submission

**Success Criteria:**
- Input field is visible and functional
- Defaults to empty/null (user enters value)
- Validation prevents invalid entries
- Form submission includes permit_cost

#### Task 4.2: Update EditOrderDrawer
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
- Add "Permit Cost (GBP)" input field to form
- Pre-populate with existing `order.permit_cost` value
- Validate numeric input (min 0)
- Include in form update

**Success Criteria:**
- Input field is visible and functional
- Pre-populates with existing permit_cost value
- Validation prevents invalid entries
- Form update includes permit_cost

#### Task 4.3: Update Order Details Sidebar
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Changes:**
- Display permit cost separately (if > 0 or if base value exists)
- Display calculated total (base value + permit cost)
- Format all values as GBP currency (en-GB locale)
- Use `getOrderTotalFormatted()` utility function

**Success Criteria:**
- Sidebar shows permit cost when present
- Sidebar shows calculated total
- All values formatted as GBP currency
- Display is clear and understandable

---

### Phase 5: Invoice Calculation Updates

**Goal:** Update invoice total calculation to include permit costs from orders.

#### Task 5.1: Update CreateInvoiceDrawer Calculation
**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Changes:**
- Update `calculatedAmount` useMemo to include permit costs:
  ```typescript
  const calculatedAmount = useMemo(() => {
    return orders.reduce((sum, order) => {
      const baseValue = order.data.value ?? 0;
      const permitCost = order.data.permit_cost ?? 0;
      return sum + baseValue + permitCost;
    }, 0);
  }, [orders]);
  ```
- Update `finalAmount` calculation in `onSubmit` to use same logic
- Or use utility function: `sum + getOrderTotal(order.data)`

**Success Criteria:**
- Invoice amount calculation includes permit costs
- Calculation handles null/undefined values safely
- Invoice total preview reflects correct calculation

#### Task 5.2: Update Order Display in Invoice Creation (Optional)
**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Changes:**
- Show base value, permit cost, and total per order in order selection
- Update invoice total preview to show breakdown if needed
- Ensure transparency in calculation

**Success Criteria:**
- Order breakdown is visible during invoice creation
- Invoice total reflects correct calculation
- Users understand what contributes to invoice total

---

### Phase 6: Orders Table Display Updates

**Goal:** Update Orders table to show total (base + permit cost) instead of base value only.

#### Task 6.1: Update SortableOrdersTable Value Column
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Changes:**
- Update value column to display total (base + permit cost)
- Use `getOrderTotalFormatted()` utility function
- Maintain existing formatting style

**Success Criteria:**
- Value column shows total (base + permit cost)
- Formatting is consistent with existing style
- Display is clear and accurate

#### Task 6.2: Update Order Column Definitions (Optional)
**File:** `src/modules/orders/components/orderColumnDefinitions.tsx`

**Changes:**
- Update value column renderCell to use total calculation
- Optional: Add separate "Permit Cost" column if visibility needed
- Format as GBP currency

**Success Criteria:**
- Value column displays total correctly
- Optional permit cost column is added if needed
- Formatting is consistent

---

### Phase 7: Testing & Validation

**Goal:** Verify all functionality works correctly and no regressions.

#### Task 7.1: Test Order Creation/Editing
- Create new order with permit cost > 0
- Create new order without permit cost (should default to 0)
- Edit existing order to add permit cost
- Edit existing order to change permit cost
- Verify permit cost is saved correctly

**Success Criteria:**
- All order operations work correctly
- Permit cost is saved and retrieved correctly
- Default value of 0 is applied correctly

#### Task 7.2: Test Order Display
- Verify Orders table shows total (base + permit cost)
- Verify Order details sidebar shows breakdown
- Verify all values formatted as GBP currency
- Test with orders that have permit_cost = 0
- Test with orders that have permit_cost > 0

**Success Criteria:**
- Display is correct and clear
- Formatting is consistent
- Breakdown is visible in details view

#### Task 7.3: Test Invoice Calculations
- Create invoice with orders that have permit costs
- Create invoice with orders that have no permit costs
- Verify invoice total includes permit costs
- Test with mixed orders (some with permit costs, some without)

**Success Criteria:**
- Invoice totals are calculated correctly
- Permit costs are included in invoice amounts
- Calculations handle null values safely

#### Task 7.4: Build & Lint Validation
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
  - [ ] Task 1.1: Create Migration
- [ ] Phase 2: Type Updates
  - [ ] Task 2.1: Update Order TypeScript Types
  - [ ] Task 2.2: Update Order Form Schema
  - [ ] Task 2.3: Update UI Order Transform
- [ ] Phase 3: Order Total Calculation Utility
  - [ ] Task 3.1: Create Order Calculations Utility
- [ ] Phase 4: Orders UI Updates
  - [ ] Task 4.1: Update CreateOrderDrawer
  - [ ] Task 4.2: Update EditOrderDrawer
  - [ ] Task 4.3: Update Order Details Sidebar
- [ ] Phase 5: Invoice Calculation Updates
  - [ ] Task 5.1: Update CreateInvoiceDrawer Calculation
  - [ ] Task 5.2: Update Order Display in Invoice Creation (Optional)
- [ ] Phase 6: Orders Table Display Updates
  - [ ] Task 6.1: Update SortableOrdersTable Value Column
  - [ ] Task 6.2: Update Order Column Definitions (Optional)
- [ ] Phase 7: Testing & Validation
  - [ ] Task 7.1: Test Order Creation/Editing
  - [ ] Task 7.2: Test Order Display
  - [ ] Task 7.3: Test Invoice Calculations
  - [ ] Task 7.4: Build & Lint Validation

---

## Deliverables

1. **Database Migration:** `permit_cost` column added to Orders table
2. **Type Updates:** Order types and schemas updated
3. **Calculation Utilities:** Order total calculation functions
4. **UI Updates:** Create/Edit Order drawers with Permit cost input
5. **Display Updates:** Order details and table showing totals
6. **Invoice Updates:** Invoice calculations including permit costs

---

## Risk Mitigation

### Risk: Breaking Existing Orders
**Mitigation:** Default value of 0 ensures all existing orders are unaffected. Migration is additive-only.

### Risk: Invoice Amount Mismatch
**Mitigation:** Existing invoices remain unchanged (amounts are stored). Only new invoices include permit costs.

### Risk: Null Value Handling
**Mitigation:** All calculations use nullish coalescing (`?? 0`) to treat null/undefined as 0.

### Risk: Currency Formatting
**Mitigation:** Use existing GBP formatting utilities and en-GB locale consistently.

---

## Notes

- Permit cost must be manually entered (no automatic calculation)
- Default value of 0 ensures backward compatibility
- Order total = base value + permit cost (both nullable, default to 0)
- Invoice total = sum of all order totals (base + permit cost) from selected orders
- Display strategy: Show total in table, breakdown in details view
- Currency: GBP (en-GB locale) for all formatting

