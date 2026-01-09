# Quick Start: Permit Cost on Orders (GBP)

## Overview

Add a Permit cost field to Orders that is manually entered and included in order and invoice total calculations. Permit cost represents the cost of cemetery permits required for memorial installations.

## Key Concepts

### Permit Cost
- Manually entered field for cemetery permit costs
- Stored in `orders.permit_cost` column (decimal(10,2), default 0)
- Included in order total calculation: `base value + permit cost`
- Included in invoice total calculations

### Order Total
- Current: `order.value` (base cost only)
- New: `order.value + order.permit_cost` (base cost + permit cost)
- Both values nullable, default to 0 in calculations

### Invoice Total
- Current: `sum(order.value ?? 0)` for all orders
- New: `sum((order.value ?? 0) + (order.permit_cost ?? 0))` for all orders

## Implementation Steps

### Step 1: Database Migration
1. Create migration file: `supabase/migrations/YYYYMMDDHHmmss_add_permit_cost_to_orders.sql`
2. Add `permit_cost decimal(10,2) NOT NULL DEFAULT 0` column
3. Add column comment
4. Run migration

### Step 2: Update Types
1. Add `permit_cost: number | null` to `Order` interface
2. Add `permit_cost` to `orderFormSchema` (Zod validation)
3. Add `permitCost?: number | null` to `UIOrder` interface
4. Update `transformOrderForUI` to include `permitCost`

### Step 3: Create Calculation Utilities
1. Create `src/modules/orders/utils/orderCalculations.ts`
2. Implement `getOrderTotal(order)` function
3. Implement `getOrderTotalFormatted(order)` function
4. Export utility functions

### Step 4: Update Orders UI
1. Add "Permit Cost (GBP)" input to `CreateOrderDrawer`
2. Add "Permit Cost (GBP)" input to `EditOrderDrawer`
3. Update `OrderDetailsSidebar` to show permit cost breakdown
4. Update `SortableOrdersTable` to show total (base + permit)

### Step 5: Update Invoice Calculations
1. Update `CreateInvoiceDrawer` calculation to include permit costs
2. Update invoice total preview
3. Show order breakdown during invoice creation (optional)

### Step 6: Testing
1. Test creating order with permit cost
2. Test editing order permit cost
3. Test invoice creation with orders having permit costs
4. Verify calculations are correct
5. Build & lint validation

## Code Examples

### Order Total Calculation

```typescript
// Utility function
export function getOrderTotal(order: Order): number {
  const baseValue = order.value ?? 0;
  const permitCost = order.permit_cost ?? 0;
  return baseValue + permitCost;
}

// Usage
const total = getOrderTotal(order);  // Returns 1250 if value=1000, permit_cost=250
```

### Invoice Total Calculation

```typescript
// In CreateInvoiceDrawer
const finalAmount = orders.reduce((sum, order) => {
  const baseValue = order.data.value ?? 0;
  const permitCost = order.data.permit_cost ?? 0;
  return sum + baseValue + permitCost;
}, 0);

// Or using utility
const finalAmount = orders.reduce((sum, order) => {
  return sum + getOrderTotal(order.data);
}, 0);
```

### Form Input

```typescript
// In CreateOrderDrawer / EditOrderDrawer
<FormField
  control={form.control}
  name="permit_cost"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Permit Cost (GBP)</FormLabel>
      <FormControl>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          {...field}
          value={field.value ?? ''}
          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Display Order Total

```typescript
// In OrderDetailsSidebar
const baseValue = order.value ?? 0;
const permitCost = order.permitCost ?? 0;
const total = baseValue + permitCost;

<div>
  <div>Base Value: {baseValue ? `£${baseValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : 'N/A'}</div>
  <div>Permit Cost: {permitCost ? `£${permitCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '£0.00'}</div>
  <div>Total: £{total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
</div>
```

## Testing Checklist

- [ ] Migration runs successfully
- [ ] All existing orders have `permit_cost = 0`
- [ ] Create order with permit cost > 0
- [ ] Create order without permit cost (defaults to 0)
- [ ] Edit order to add permit cost
- [ ] Edit order to change permit cost
- [ ] Order details sidebar shows breakdown
- [ ] Orders table shows total (base + permit)
- [ ] Invoice creation includes permit costs in total
- [ ] Calculations handle null values correctly
- [ ] Formatting uses GBP currency (en-GB locale)
- [ ] Build passes without errors
- [ ] Lint passes without errors

## Common Patterns

### Null Handling

```typescript
// Always use nullish coalescing
const value = order.value ?? 0;
const permitCost = order.permit_cost ?? 0;
const total = value + permitCost;
```

### Currency Formatting

```typescript
// Use en-GB locale for GBP formatting
const formatted = `£${value.toLocaleString('en-GB', { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
})}`;
```

### Form Value Handling

```typescript
// Form field value handling
value={field.value ?? ''}
onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
```

## Troubleshooting

### Permit Cost Not Saving
- Check form submission includes `permit_cost` field
- Verify API includes `permit_cost` in INSERT/UPDATE
- Check database migration ran successfully

### Invoice Total Incorrect
- Verify calculation includes permit costs
- Check null handling (should default to 0)
- Verify all orders in invoice are included

### Display Showing Wrong Values
- Check UI transform includes `permitCost`
- Verify calculation uses utility function
- Check formatting uses correct locale

