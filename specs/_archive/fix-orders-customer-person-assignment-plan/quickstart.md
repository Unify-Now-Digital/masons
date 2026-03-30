# Quickstart: Fix Orders Customer/Person Assignment

## Overview

This feature adds Customer/Person assignment to Orders and fixes the confusing "Customer" column that currently shows Deceased name instead of the actual Customer/Person name.

## What Changes

### Database
- Adds `person_id` (FK to customers) and `person_name` (snapshot) to orders table
- All fields nullable for backward compatibility

### UI
- Adds Person selector to CreateOrderDrawer and EditOrderDrawer
- Fixes "Customer" column in Orders list to show Person name
- Keeps Deceased Name field/column separate

### Integration
- Invoicing module: inline orders inherit Person from invoice

---

## Quick Implementation Steps

### 1. Database Migration

```bash
# Create migration file
supabase migration new add_person_fields_to_orders

# Add migration content (see Phase 1 in implementation plan)
# Run migration
supabase db push
```

### 2. Update Types

```typescript
// src/modules/orders/types/orders.types.ts
export interface Order {
  // ... existing fields
  person_id: string | null; // NEW
  person_name: string | null; // NEW
}
```

### 3. Update Schema

```typescript
// src/modules/orders/schemas/order.schema.ts
export const orderFormSchema = z.object({
  person_id: z.string().uuid().optional().nullable(), // NEW
  // ... existing fields
});
```

### 4. Update API

```typescript
// src/modules/orders/api/orders.api.ts
async function fetchOrders() {
  const { data } = await supabase
    .from('orders')
    .select('*, customers(id, first_name, last_name)')
    .order('created_at', { ascending: false });
  return data;
}
```

### 5. Update Transform

```typescript
// src/modules/orders/utils/orderTransform.ts
export function transformOrderForUI(order: Order): UIOrder {
  const customerName = order.person_name 
    || (order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : null)
    || '—';
  
  return {
    customer: customerName, // Person name
    deceasedName: order.customer_name, // Deceased name
    // ... rest
  };
}
```

### 6. Add Person Selector to Forms

```typescript
// src/modules/orders/components/CreateOrderDrawer.tsx
const { data: customers } = useCustomersList();

<FormField
  control={form.control}
  name="person_id"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Person (Optional)</FormLabel>
      <Select
        value={field.value || ''}
        onValueChange={(value) => {
          const customer = customers?.find(c => c.id === value);
          field.onChange(value || null);
          form.setValue('person_name', customer ? `${customer.first_name} ${customer.last_name}` : null);
        }}
      >
        {/* Options */}
      </Select>
    </FormItem>
  )}
/>
```

### 7. Update Orders List

```typescript
// src/modules/orders/components/SortableOrdersTable.tsx
<TableHead>Customer</TableHead> // Shows Person name
<TableHead>Deceased</TableHead> // Shows customer_name

<TableCell>{order.customer}</TableCell> // Person name
<TableCell>{order.deceasedName}</TableCell> // Deceased name
```

---

## Testing Checklist

- [ ] Create order with Person → appears correctly
- [ ] Create order without Person → shows "—"
- [ ] Edit order to add/change Person → works
- [ ] Orders list shows Person name in Customer column
- [ ] Deceased name shown separately
- [ ] Invoicing: inline orders inherit Person
- [ ] Existing orders (null person_id) render correctly
- [ ] No regressions in Map, Jobs, Invoicing

---

## Key Files

### Database
- `supabase/migrations/YYYYMMDDHHmmss_add_person_fields_to_orders.sql`

### Types & Schemas
- `src/modules/orders/types/orders.types.ts`
- `src/modules/orders/schemas/order.schema.ts`

### API & Queries
- `src/modules/orders/api/orders.api.ts`
- `src/modules/orders/utils/orderTransform.ts`

### UI Components
- `src/modules/orders/components/CreateOrderDrawer.tsx`
- `src/modules/orders/components/EditOrderDrawer.tsx`
- `src/modules/orders/components/SortableOrdersTable.tsx`
- `src/modules/orders/pages/OrdersPage.tsx`

### Integration
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

---

## Common Issues

### Person ID Not Saving
- Check form validation
- Ensure person_name is set when person_id is set
- Verify API mutation includes both fields

### Customer Column Shows "—"
- Check transform function logic
- Verify person_id and person_name are set
- Check customers join in query

### Deceased Name Missing
- Verify customer_name field is still mapped
- Check transform function includes deceasedName

---

## Next Steps

1. Review implementation plan: `specs/fix-orders-customer-person-assignment-implementation-plan.md`
2. Review data model: `specs/fix-orders-customer-person-assignment-plan/data-model.md`
3. Review API contracts: `specs/fix-orders-customer-person-assignment-plan/contracts/api-contracts.md`
4. Start with Phase 1 (Database Migration)

