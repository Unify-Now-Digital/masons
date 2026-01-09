# Research: Permit Cost on Orders (GBP)

## Problem Statement

Orders currently track only the base order value (`value` field). Permit costs for cemetery permits required for memorial installations are not tracked separately, leading to incomplete financial calculations. When creating invoices, permit costs are not included in the total, resulting in inaccurate invoice amounts.

## Current State Analysis

### Orders Table Schema

**Table:** `public.orders`

**Current Structure:**
- `value decimal(10,2)` - Base order value (nullable)
- No separate field for permit costs
- Permit costs are not tracked

**Observations:**
- Order `value` represents base product/service cost
- Permit costs must currently be manually added to base value or tracked elsewhere
- No separation between base cost and permit cost

### Invoice Calculation Logic

**Component:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Current Calculation:**
```typescript
const finalAmount = orders.reduce((sum, order) => sum + (order.data.value ?? 0), 0);
```

**Observations:**
- Invoice amounts are calculated by summing order values
- Only base order value is included
- Permit costs are not factored into invoice totals
- This leads to incomplete financial tracking

### Order Value Display

**Current Display:**
- Orders table shows formatted `value` field: `£${order.value.toLocaleString('en-GB', ...)}`
- Order details sidebar shows `value` field
- No distinction between base value and permit cost

**Observations:**
- Display only shows base order value
- Users cannot see permit costs separately
- Total cost (base + permit) is not clearly visible

## Technical Decisions

### Database Schema
- **Decision:** Add `permit_cost decimal(10,2) NOT NULL DEFAULT 0` to Orders table
- **Rationale:** Separate field allows tracking permit costs independently while maintaining backward compatibility
- **Default Value:** 0 ensures existing orders are unaffected
- **Non-Null:** Ensures all orders have a permit_cost value (default applied)

### Calculation Logic
- **Decision:** Order total = `base value + permit cost` (both nullable, default to 0)
- **Rationale:** Simple addition ensures accurate totals while handling null values safely
- **Null Handling:** Treat null/undefined as 0 to prevent calculation errors

### Currency Formatting
- **Decision:** Use GBP (en-GB locale) for all formatting
- **Rationale:** Consistent with existing order value formatting
- **Format:** `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

### Display Strategy
- **Decision:** Show total (base + permit) in Orders table, breakdown in details view
- **Rationale:** Table space is limited, details view can show full breakdown
- **Implementation:** Table shows total, sidebar shows base, permit cost, and total separately

### Invoice Totals
- **Decision:** Include permit costs in new invoice calculations only (existing invoices unchanged)
- **Rationale:** Existing invoices store amounts (snapshots), new invoices calculate from orders
- **Calculation:** `sum((order.value ?? 0) + (order.permit_cost ?? 0))` for all orders in invoice

## Implementation Approach

### Migration Strategy
- Additive-only migration (no destructive changes)
- Default value ensures backward compatibility
- Non-null constraint with default ensures all orders have a value
- Column comment explains purpose

### Type Updates
- Update `Order` interface to include `permit_cost: number | null`
- Update form schema to include `permit_cost` validation (min 0)
- Update UI transform to include `permitCost` in `UIOrder` interface

### Utility Functions
- Create `getOrderTotal(order)` function for consistent calculation
- Create `getOrderTotalFormatted(order)` function for consistent formatting
- Centralize calculation logic to avoid duplication

### UI Updates
- Add "Permit Cost (GBP)" input to Create/Edit Order drawers
- Default to null (user enters value, converted to 0 if not provided)
- Validate numeric input (min 0)
- Display in Order details sidebar with breakdown

### Invoice Updates
- Update `CreateInvoiceDrawer` calculation to include permit costs
- Show order breakdown during invoice creation (optional but recommended)
- Ensure invoice total reflects correct calculation

## Edge Cases

### Null/Undefined Values
- **Case:** Order has null `value` or null `permit_cost`
- **Handling:** Treat null/undefined as 0 in all calculations
- **Implementation:** Use nullish coalescing (`?? 0`) consistently

### Existing Orders
- **Case:** Orders created before migration have no `permit_cost`
- **Handling:** Default value of 0 ensures all existing orders have permit_cost = 0
- **Migration:** Default applied automatically during migration

### Existing Invoices
- **Case:** Invoices created before permit cost feature exist
- **Handling:** Existing invoices remain unchanged (amounts are stored, not recalculated)
- **Rationale:** Invoices are financial snapshots and should not be recalculated retroactively

### Negative Values
- **Case:** User enters negative permit cost
- **Handling:** Form validation prevents negative values (min 0)
- **Implementation:** Zod schema enforces `z.number().min(0)`

## Performance Considerations

### Calculation Performance
- Order total calculation is simple addition (O(1))
- Invoice total calculation is O(n) where n = number of orders (acceptable for typical invoice sizes)
- No database queries required for calculation (uses in-memory data)

### Migration Performance
- Adding column with default value is fast (default applied on read, not write)
- No table rewrite required (PostgreSQL handles defaults efficiently)
- Minimal impact on existing data

## Dependencies

### Existing Dependencies
- React Hook Form (already in use)
- Zod validation (already in use)
- Supabase client (already in use)
- shadcn/ui components (already in use)

### No New Dependencies
- All functionality uses existing libraries
- No additional packages required

## Success Criteria

- Users can enter permit costs when creating/editing orders
- Order totals correctly include permit costs
- Invoice totals correctly include permit costs from orders
- All financial calculations are accurate
- No data loss or breaking changes
- UI clearly distinguishes between base value and permit cost

