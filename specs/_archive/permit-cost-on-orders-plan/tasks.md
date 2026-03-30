# Tasks: Permit Cost on Orders (GBP)

## Phase 1: Database Migration

### Task 1.1: Create Migration for `permit_cost` Column
**File:** `supabase/migrations/20260109003012_add_permit_cost_to_orders.sql`  
**Status:** Completed ✅

**Implementation:**
```sql
-- Add permit_cost column to orders table
alter table public.orders
  add column permit_cost decimal(10,2) not null default 0;

-- Add column comment for clarity
comment on column public.orders.permit_cost is 
  'Cost of cemetery permits in GBP. Manually entered and included in order total.';
```

**Acceptance Criteria:**
- Migration runs successfully
- Column created with correct type and constraints
- All existing orders have `permit_cost = 0`
- No data loss or breaking changes

---

## Phase 2: Type Updates

### Task 2.1: Update Order TypeScript Types
**File:** `src/modules/orders/types/orders.types.ts`  
**Status:** Completed ✅

**Changes:**
- Add `permit_cost: number | null` to `Order` interface
- Update `OrderInsert` type (include permit_cost)
- Update `OrderUpdate` type (include permit_cost as optional)

**Acceptance Criteria:**
- Types include permit_cost field
- Types are consistent with database schema
- No TypeScript errors

---

### Task 2.2: Update Order Form Schema
**File:** `src/modules/orders/schemas/order.schema.ts`  
**Status:** Completed ✅

**Changes:**
- Add `permit_cost: z.number().min(0, 'Permit cost must be positive').optional().nullable()` to `orderFormSchema`

**Acceptance Criteria:**
- Schema includes permit_cost validation
- Validation prevents negative values
- Default handles null/undefined safely

**Dependencies:**
- Task 2.1 must be complete

---

### Task 2.3: Update UI Order Transform
**File:** `src/modules/orders/utils/orderTransform.ts`  
**Status:** Completed ✅

**Changes:**
- Add `permitCost?: number | null` to `UIOrder` interface
- Update `transformOrderForUI` function:
  ```typescript
  permitCost: order.permit_cost ?? null
  ```

**Acceptance Criteria:**
- UIOrder includes permitCost field
- Transform handles null values safely
- No breaking changes to existing code

**Dependencies:**
- Task 2.1 must be complete

---

## Phase 3: Order Total Calculation Utility

### Task 3.1: Create Order Calculations Utility
**File:** `src/modules/orders/utils/orderCalculations.ts` (new file)  
**Status:** Completed ✅

**Functions to Implement:**
- `getOrderTotal(order: Order): number`
- `getOrderTotalFormatted(order: Order): string`
- `getOrderBaseValue(order: Order): number`
- `getOrderPermitCost(order: Order): number`

**Acceptance Criteria:**
- Functions handle null/undefined values safely
- Total calculation is correct: `(order.value ?? 0) + (order.permit_cost ?? 0)`
- Formatting uses GBP locale (en-GB)
- Functions are exported and documented

**Dependencies:**
- Task 2.1 must be complete

---

## Phase 4: Orders UI Updates

### Task 4.1: Update CreateOrderDrawer
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`  
**Status:** Completed ✅

**Changes:**
- Add "Permit Cost (GBP)" input field to form
- Place after "Value" field (logical grouping)
- Default to null (user enters value)
- Validate numeric input (min 0)
- Include in form submission

**Acceptance Criteria:**
- Input field is visible and functional
- Defaults to empty/null (user enters value)
- Validation prevents invalid entries (negative values)
- Form submission includes permit_cost
- Input accepts decimal values (step="0.01")

**Dependencies:**
- Task 2.2 must be complete

---

### Task 4.2: Update EditOrderDrawer
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`  
**Status:** Completed ✅

**Changes:**
- Add "Permit Cost (GBP)" input field to form
- Place after "Value" field (logical grouping)
- Pre-populate with existing `order.permit_cost` value
- Validate numeric input (min 0)
- Include in form update

**Acceptance Criteria:**
- Input field is visible and functional
- Pre-populates with existing permit_cost value (or empty if 0/null)
- Validation prevents invalid entries
- Form update includes permit_cost
- Input accepts decimal values

**Dependencies:**
- Task 2.2, 4.1 must be complete

---

### Task 4.3: Update Order Details Sidebar
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`  
**Status:** Completed ✅

**Changes:**
- Display permit cost separately (if > 0 or if base value exists)
- Display calculated total (base value + permit cost)
- Format all values as GBP currency (en-GB locale)
- Use `getOrderTotalFormatted()` utility function
- Show breakdown: Base Value, Permit Cost, Total

**Acceptance Criteria:**
- Sidebar shows permit cost when present (> 0)
- Sidebar shows calculated total
- All values formatted as GBP currency
- Display is clear and understandable
- Breakdown is visible and easy to read

**Dependencies:**
- Task 2.3, 3.1 must be complete

---

## Phase 5: Invoice Calculation Updates

### Task 5.1: Update CreateInvoiceDrawer Calculation
**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`  
**Status:** Completed ✅

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

**Acceptance Criteria:**
- Invoice amount calculation includes permit costs
- Calculation handles null/undefined values safely
- Invoice total preview reflects correct calculation
- No regressions in existing invoice creation

**Dependencies:**
- Task 2.1, 3.1 must be complete

---

### Task 5.2: Update Order Display in Invoice Creation (Optional)
**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`  
**Status:** Pending

**Changes:**
- Show base value, permit cost, and total per order in order selection
- Update invoice total preview to show breakdown if needed
- Ensure transparency in calculation

**Acceptance Criteria:**
- Order breakdown is visible during invoice creation
- Invoice total reflects correct calculation
- Users understand what contributes to invoice total

**Dependencies:**
- Task 5.1 must be complete

---

## Phase 6: Orders Table Display Updates

### Task 6.1: Update SortableOrdersTable Value Column
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`  
**Status:** Pending

**Changes:**
- Update value column to display total (base + permit cost)
- Use `getOrderTotalFormatted()` utility function
- Or calculate inline: `(order.value ?? 0) + (order.permitCost ?? 0)`
- Maintain existing formatting style

**Acceptance Criteria:**
- Value column shows total (base + permit cost)
- Formatting is consistent with existing style
- Display is clear and accurate
- No regressions in table functionality

**Dependencies:**
- Task 2.3, 3.1 must be complete

---

### Task 6.2: Update Order Column Definitions (Optional)
**File:** `src/modules/orders/components/orderColumnDefinitions.tsx`  
**Status:** Pending

**Changes:**
- Update value column `renderCell` to use total calculation
- Optional: Add separate "Permit Cost" column if visibility needed
- Format as GBP currency

**Acceptance Criteria:**
- Value column displays total correctly
- Optional permit cost column is added if needed
- Formatting is consistent

**Dependencies:**
- Task 6.1 must be complete

---

## Phase 7: Testing & Validation

### Task 7.1: Test Order Creation/Editing
**Status:** Pending

**Test Cases:**
- Create new order with permit cost > 0
- Create new order without permit cost (should default to 0)
- Edit existing order to add permit cost
- Edit existing order to change permit cost
- Verify permit cost is saved correctly
- Test with negative values (should be prevented)

**Acceptance Criteria:**
- All order operations work correctly
- Permit cost is saved and retrieved correctly
- Default value of 0 is applied correctly
- Validation prevents negative values

---

### Task 7.2: Test Order Display
**Status:** Pending

**Test Cases:**
- Verify Orders table shows total (base + permit cost)
- Verify Order details sidebar shows breakdown
- Verify all values formatted as GBP currency
- Test with orders that have permit_cost = 0
- Test with orders that have permit_cost > 0
- Test with orders that have null value

**Acceptance Criteria:**
- Display is correct and clear
- Formatting is consistent
- Breakdown is visible in details view
- Null values handled gracefully

---

### Task 7.3: Test Invoice Calculations
**Status:** Pending

**Test Cases:**
- Create invoice with orders that have permit costs
- Create invoice with orders that have no permit costs
- Verify invoice total includes permit costs
- Test with mixed orders (some with permit costs, some without)
- Test with orders that have null values

**Acceptance Criteria:**
- Invoice totals are calculated correctly
- Permit costs are included in invoice amounts
- Calculations handle null values safely
- No regressions in invoice creation

---

### Task 7.4: Build & Lint Validation
**Status:** Pending

**Commands:**
```bash
npm run build
npm run lint
```

**Acceptance Criteria:**
- Build passes without errors
- Lint passes without errors
- No TypeScript errors

**Dependencies:**
- All previous phases must be complete

---

## Summary

**Total Tasks:** 14  
**Completed:** 0  
**Pending:** 14

**Phases:**
- Phase 1: 1 task (Database Migration)
- Phase 2: 3 tasks (Type Updates)
- Phase 3: 1 task (Order Total Calculation Utility)
- Phase 4: 3 tasks (Orders UI Updates)
- Phase 5: 2 tasks (Invoice Calculation Updates)
- Phase 6: 2 tasks (Orders Table Display Updates)
- Phase 7: 4 tasks (Testing & Validation)

**Estimated Time:**
- Phase 1: 0.5 hours
- Phase 2: 1 hour
- Phase 3: 0.5 hours
- Phase 4: 2 hours
- Phase 5: 1 hour
- Phase 6: 1 hour
- Phase 7: 1 hour
- **Total:** ~7 hours

