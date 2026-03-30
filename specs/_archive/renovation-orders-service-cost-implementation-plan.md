# Implementation Plan: Renovation Orders use Service + Cost instead of Product

## Feature Overview

Enable Renovation orders to use manual service description and service cost instead of product selection, while keeping New Memorial orders unchanged with product-driven logic. Base value calculation will differ by order type: Renovation uses `renovation_service_cost`, New Memorial uses existing `order.value` from product selection.

**Branch:** `feature/renovation-orders-service-cost`  
**Spec File:** `specs/renovation-orders-service-cost.md`

---

## Technical Context

### Current State
- Orders table has `order_type` field (values: "New Memorial", "Renovation")
- Orders table has `value` field (decimal(10,2), nullable) representing base order value
- Orders table has `permit_cost` field (decimal(10,2), not null, default 0)
- Orders table has `material` and `color` fields (from product selection)
- Order total calculated as: `base value + permit_cost + additional_options_total`
- Base value calculation uses `order.value ?? 0` regardless of order type
- CreateOrderDrawer/EditOrderDrawer show product selector for all orders
- OrderDetailsSidebar displays product info (material, color) for all orders
- Shared calculation utilities in `orderCalculations.ts` are order-type agnostic

### Key Files
- `supabase/migrations/YYYYMMDDHHmmss_*.sql` - Database migrations
- `src/modules/orders/types/orders.types.ts` - Order TypeScript types
- `src/modules/orders/schemas/order.schema.ts` - Order form validation schema
- `src/modules/orders/utils/orderCalculations.ts` - Order total calculation utilities
- `src/modules/orders/utils/orderTransform.ts` - Order UI transformation
- `src/modules/orders/utils/numberParsing.ts` - Number parsing utilities (`toMoneyNumber`)
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Order creation UI
- `src/modules/orders/components/EditOrderDrawer.tsx` - Order editing UI
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Order details view
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Invoice creation with order total calculation
- `src/modules/invoicing/components/EditInvoiceDrawer.tsx` - Invoice editing with order display

### Constraints
- Additive-only migration (new columns only, no modifications to existing columns)
- Backward compatible (existing Renovation orders default to 0 cost, empty description)
- No changes to invoices table (amounts are calculated, not stored)
- Maintain existing currency formatting (GBP, en-GB locale)
- Safe null handling (treat null/undefined/"" as 0 for numeric fields)
- New Memorial orders remain completely unchanged
- Total calculation remains: `base value + permit_cost + additional_options_total`
- Base value source differs by order type (handled in calculation utility)

---

## Implementation Phases

### Phase 1: Database Migration

**Goal:** Add renovation service fields to Orders table with safe defaults.

#### Task 1.1: Create Migration for Renovation Fields
**File:** `supabase/migrations/YYYYMMDDHHmmss_add_renovation_fields_to_orders.sql`

**Implementation:**
- Add `renovation_service_description text null` column
- Add `renovation_service_cost numeric(10,2) not null default 0` column
- Add column comments:
  ```sql
  comment on column public.orders.renovation_service_description is 
    'Free-text description of the renovation service (e.g., "Headstone cleaning and relettering"). Only used for Renovation order types.';
  
  comment on column public.orders.renovation_service_cost is 
    'Cost of the renovation service in GBP. Only used for Renovation order types. Defaults to 0.';
  ```
- Ensure all existing orders get default values (NULL for description, 0 for cost)

**Success Criteria:**
- Migration runs successfully
- Columns created with correct types and constraints
- All existing orders have `renovation_service_cost = 0` and `renovation_service_description = NULL`
- No data loss or breaking changes
- Comments added for documentation

---

### Phase 2: Type Updates

**Goal:** Update TypeScript types and Zod schemas to include renovation fields with defensive defaults.

#### Task 2.1: Update Order TypeScript Types
**File:** `src/modules/orders/types/orders.types.ts`

**Changes:**
- Add `renovation_service_description?: string | null` to `Order` interface
- Add `renovation_service_cost?: number | null` to `Order` interface
- Keep existing fields unchanged (`order_type`, `value`, `material`, `color`, etc.)
- Update `OrderInsert` and `OrderUpdate` types to include new fields (optional)

**Success Criteria:**
- Types include renovation fields
- Types are optional for backward compatibility
- Types are consistent with database schema
- No TypeScript errors
- Existing code compiles without changes

#### Task 2.2: Update Order Form Schema
**File:** `src/modules/orders/schemas/order.schema.ts`

**Changes:**
- Add to `orderFormSchema`:
  ```typescript
  renovation_service_description: z.string().optional().nullable(),
  renovation_service_cost: z.number().min(0, 'Service cost must be positive').optional().nullable(),
  ```
- Ensure fields are optional and nullable (defensive for existing orders)

**Success Criteria:**
- Schema includes renovation field validation
- Validation prevents negative service cost values
- Default handles null/undefined/"" safely
- Existing form validations continue to work

---

### Phase 3: Calculation Utility Updates

**Goal:** Update base value calculation to check order_type and use appropriate source.

#### Task 3.1: Update getOrderBaseValue Function
**File:** `src/modules/orders/utils/orderCalculations.ts`

**Changes:**
- Update `getOrderBaseValue(order)`:
  ```typescript
  export function getOrderBaseValue(order: Order): number {
    // Renovation orders use renovation_service_cost as base value
    if (order.order_type === 'Renovation') {
      return order.renovation_service_cost ?? 0;
    }
    // New Memorial orders use existing value field (product-driven)
    return order.value ?? 0;
  }
  ```
- Add defensive null handling (treat null/undefined as 0)
- Update function comment to document the order_type logic

**Success Criteria:**
- Function correctly returns renovation_service_cost for Renovation orders
- Function correctly returns value for New Memorial orders
- Function handles null/undefined defensively (returns 0)
- `getOrderTotal()` continues to work correctly (it uses `getOrderBaseValue`)
- No changes needed to `getOrderTotal()` or `getOrderTotalFormatted()`

---

### Phase 4: UI Updates - CreateOrderDrawer

**Goal:** Add conditional rendering based on order_type to show/hide product vs service fields.

#### Task 4.1: Add Conditional Product Selection
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
- Add state to track order_type: `const orderType = form.watch('order_type')`
- Wrap Product Selection section in conditional:
  ```typescript
  {orderType === 'New Memorial' && (
    // Existing product selection UI
  )}
  ```

#### Task 4.2: Add Renovation Service Fields
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
- Add new section for Renovation orders:
  ```typescript
  {orderType === 'Renovation' && (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Service Details</h3>
      <FormField
        control={form.control}
        name="renovation_service_description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Service / Service Type</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Headstone cleaning and relettering" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="renovation_service_cost"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Service Cost (GBP)</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )}
  ```
- Place after Order Type selection, before Product Details section

#### Task 4.3: Update Form Submission
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
- Update `onSubmit` to include renovation fields:
  ```typescript
  const orderData = {
    // ... existing fields
    renovation_service_description: data.renovation_service_description?.trim() || null,
    renovation_service_cost: toMoneyNumber(data.renovation_service_cost), // Blank => 0
    // ... other fields
  };
  ```
- Use `toMoneyNumber` utility for cost parsing (ensures blank => 0)

**Success Criteria:**
- Product selector hidden when order_type = "Renovation"
- Service fields shown when order_type = "Renovation"
- Product selector visible when order_type = "New Memorial"
- Service fields hidden when order_type = "New Memorial"
- Form submission includes renovation fields for Renovation orders
- Blank service cost defaults to 0 (no validation errors)
- Existing New Memorial flow unchanged

---

### Phase 5: UI Updates - EditOrderDrawer

**Goal:** Same conditional rendering as CreateOrderDrawer, plus pre-population of existing renovation fields.

#### Task 5.1: Add Conditional Product Selection
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
- Same conditional rendering as CreateOrderDrawer (wrap Product Selection in `orderType === 'New Memorial'` check)
- Use `form.watch('order_type')` to track current order type

#### Task 5.2: Add Renovation Service Fields
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
- Same service fields UI as CreateOrderDrawer
- Wrap in `orderType === 'Renovation'` conditional

#### Task 5.3: Pre-populate Renovation Fields
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
- Update form `defaultValues` to include renovation fields:
  ```typescript
  defaultValues: {
    // ... existing fields
    renovation_service_description: order.renovation_service_description || null,
    renovation_service_cost: order.renovation_service_cost || null,
    // ... other fields
  }
  ```
- Update `useEffect` form reset to include renovation fields when order changes

#### Task 5.4: Update Form Submission
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
- Update `onSubmit` to include renovation fields in orderData:
  ```typescript
  renovation_service_description: data.renovation_service_description?.trim() || null,
  renovation_service_cost: toMoneyNumber(data.renovation_service_cost),
  ```

**Success Criteria:**
- Product selector hidden for existing Renovation orders
- Service fields pre-populated for existing Renovation orders
- Product selector visible for existing New Memorial orders
- Service fields hidden for existing New Memorial orders
- Editing and saving works for both order types
- Existing New Memorial editing flow unchanged

---

### Phase 6: UI Updates - OrderDetailsSidebar

**Goal:** Conditional display of service info vs product info based on order_type.

#### Task 6.1: Conditional Product/Service Display
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Changes:**
- Replace static product info display with conditional:
  ```typescript
  {currentOrder.order_type === 'Renovation' ? (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Service:</span>
        <span className="font-medium">
          {currentOrder.renovation_service_description || 'No service description'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Service Cost:</span>
        <span className="font-medium">
          £{(currentOrder.renovation_service_cost ?? 0).toLocaleString('en-GB', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}
        </span>
      </div>
    </div>
  ) : (
    // Existing product info display (material, color)
    <div className="space-y-2">
      {currentOrder.material && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Material:</span>
          <span className="font-medium">{currentOrder.material}</span>
        </div>
      )}
      {currentOrder.color && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Color:</span>
          <span className="font-medium">{currentOrder.color}</span>
        </div>
      )}
    </div>
  )}
  ```

#### Task 6.2: Update Base Value Display
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Changes:**
- Ensure base value display uses `getOrderBaseValue(currentOrder)` which now handles order_type
- Update any direct `order.value` references to use the utility function

**Success Criteria:**
- Renovation orders show service description and service cost
- New Memorial orders show material and color (existing behavior)
- Base value display uses shared utility (handles both types automatically)
- No regression in New Memorial display
- Proper GBP formatting for service cost

---

### Phase 7: Testing & Validation

**Goal:** Verify all functionality works correctly for both order types and ensure no regressions.

#### Task 7.1: Functional Testing - New Memorial Orders
**Test Cases:**
1. Create New Memorial order:
   - Product selector visible
   - Service fields hidden
   - Product selection populates material, color, value
   - Order saves successfully
   - Base value = product price
   - Total = product price + permit_cost + additional_options

2. Edit New Memorial order:
   - Product selector visible and pre-selected
   - Service fields hidden
   - Can change product selection
   - Changes save correctly
   - Totals update correctly

3. View New Memorial order:
   - Shows material and color
   - Base value displays correctly
   - Total includes all components

**Success Criteria:**
- All New Memorial flows work as before (no regression)
- Product selection functional
- Totals calculate correctly

#### Task 7.2: Functional Testing - Renovation Orders
**Test Cases:**
1. Create Renovation order:
   - Product selector hidden
   - Service fields visible
   - Can enter service description and cost
   - Blank service cost defaults to 0 (no validation error)
   - Order saves successfully
   - Base value = service cost (or 0 if blank)
   - Total = service cost + permit_cost + additional_options

2. Edit Renovation order:
   - Product selector hidden
   - Service fields visible and pre-populated
   - Can update service description and cost
   - Changes save correctly
   - Totals update correctly

3. View Renovation order:
   - Shows service description and service cost
   - Does NOT show material/color
   - Base value displays correctly (from service cost)
   - Total includes all components

**Success Criteria:**
- Renovation orders work correctly
- No product selection required or shown
- Service fields functional
- Totals calculate correctly

#### Task 7.3: Testing - Order Type Switching
**Test Cases:**
1. Create order, switch order_type:
   - Start with "New Memorial", select product → switch to "Renovation"
   - Product fields should hide, service fields should show
   - Start with "Renovation", enter service → switch to "New Memorial"
   - Service fields should hide, product fields should show

2. Edit existing order, change order_type:
   - Existing Renovation order → change to New Memorial
   - Service fields hide, product fields show (empty, ready for selection)
   - Existing New Memorial order → change to Renovation
   - Product fields hide, service fields show (empty, ready for entry)

**Success Criteria:**
- Order type switching works smoothly
- Fields show/hide correctly
- Form state handles transitions

#### Task 7.4: Testing - Invoice Integration
**Test Cases:**
1. Create invoice with New Memorial order:
   - Invoice total includes order base value (product price)
   - Invoice total = order total = product price + permit_cost + additional_options

2. Create invoice with Renovation order:
   - Invoice total includes order base value (service cost)
   - Invoice total = order total = service cost + permit_cost + additional_options

3. Create invoice with mixed orders:
   - Invoice with both New Memorial and Renovation orders
   - Each order's base value calculated correctly by type
   - Invoice total = sum of all order totals

4. Edit invoice with linked orders:
   - EditInvoiceDrawer shows correct totals for both order types
   - Order cards display correct base values
   - Invoice amount calculates correctly

**Success Criteria:**
- Invoice totals work correctly for both order types
- No special casing needed (uses shared utilities)
- Mixed invoices calculate correctly

#### Task 7.5: Testing - Backward Compatibility
**Test Cases:**
1. Existing Renovation orders (without service fields):
   - Load existing Renovation order in EditOrderDrawer
   - Service fields show with empty/default values (cost = 0, description = empty)
   - Order displays safely in OrderDetailsSidebar
   - Base value = 0 (from default renovation_service_cost)
   - Can edit and add service details

2. Existing New Memorial orders:
   - No changes to existing behavior
   - Product info displays correctly
   - Totals calculate correctly

**Success Criteria:**
- Existing orders render safely
- No crashes or validation errors
- Can update existing orders to use new fields

#### Task 7.6: Build & Lint Checks
**Commands:**
- `npx tsc --noEmit` - TypeScript compilation
- `npm run lint` - ESLint checks
- `npm run build` - Production build

**Success Criteria:**
- No TypeScript errors
- No new lint errors introduced
- Production build succeeds
- All existing tests pass (if any)

---

## Testing Checklist

### New Memorial Orders
- [ ] Create New Memorial order with product selection → saves correctly
- [ ] Edit New Memorial order → product selector pre-populated
- [ ] View New Memorial order → shows material, color, base value
- [ ] New Memorial order in invoice → total includes product price
- [ ] No regression in New Memorial functionality

### Renovation Orders
- [ ] Create Renovation order with service fields → saves correctly
- [ ] Create Renovation order with blank service cost → saves with 0
- [ ] Edit Renovation order → service fields pre-populated
- [ ] View Renovation order → shows service description, service cost
- [ ] Renovation order in invoice → total includes service cost
- [ ] Product selector hidden for Renovation orders

### Order Type Switching
- [ ] Switch New Memorial → Renovation → fields show/hide correctly
- [ ] Switch Renovation → New Memorial → fields show/hide correctly
- [ ] Edit existing order and change type → transitions work

### Invoice Integration
- [ ] Invoice with New Memorial order → totals correct
- [ ] Invoice with Renovation order → totals correct
- [ ] Invoice with mixed orders → totals correct
- [ ] EditInvoiceDrawer shows correct order totals

### Backward Compatibility
- [ ] Existing Renovation orders load safely (defaults to 0 cost)
- [ ] Existing New Memorial orders unchanged
- [ ] Can update existing Renovation orders with service details

### Code Quality
- [ ] TypeScript compiles without errors
- [ ] No new lint errors
- [ ] Production build succeeds
- [ ] All calculations use shared utilities
- [ ] Proper null/undefined handling throughout

---

## Safety Considerations

- **Migration Safety:**
  - Migration is additive only (no data loss)
  - Default value of 0 for cost ensures no null constraint violations
  - NULL description is acceptable (optional field)

- **Backward Compatibility:**
  - Existing orders continue to work (default to 0 cost, empty description)
  - New Memorial orders completely unaffected
  - Existing Renovation orders can be updated gradually

- **Calculation Safety:**
  - Defensive null handling in all calculations
  - Uses shared utilities for consistency
  - No NaN values (toMoneyNumber utility handles this)

- **UI Safety:**
  - Conditional rendering prevents showing wrong fields
  - Form validation ensures valid data
  - Empty fields default to safe values (0 for cost, null for description)

---

## What NOT to Do

- Do not remove or modify existing `order.value` field
- Do not change product selection logic for New Memorial orders
- Do not create separate order tables or types
- Do not modify invoice total calculation (it already uses shared utilities)
- Do not add product validation for Renovation orders
- Do not persist derived totals to database
- Do not break existing New Memorial order functionality
- Out of scope: Inscriptions relationship, Photos URL, Map geocoding

---

## Open Questions / Considerations

**Resolved:**
- Should Renovation orders show material/color fields? → **Hide product-related fields for Renovation**
- Should service description have character limit? → **Free text, no limit initially**
- Should service cost be required? → **Optional (defaults to 0 if blank)**
- How to handle existing Renovation orders? → **Default to 0 cost, empty description (backward compatible)**

**Remaining Considerations:**
- Future: Should Renovation orders have service type presets/dropdown? (Out of scope for now)
- Future: Should service description be searchable/filterable? (Out of scope for now)

---

