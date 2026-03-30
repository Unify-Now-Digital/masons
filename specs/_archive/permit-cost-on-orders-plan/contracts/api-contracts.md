# API Contracts: Permit Cost on Orders

## Database Schema

### Column: `permit_cost`

**Table:** `public.orders`

**Schema:**
```sql
alter table public.orders
  add column permit_cost decimal(10,2) not null default 0;

comment on column public.orders.permit_cost is 
  'Cost of cemetery permits in GBP. Manually entered and included in order total.';
```

**Type:** `decimal(10,2)`
**Nullable:** No (NOT NULL)
**Default:** `0`
**Constraint:** None (validation in application layer)

---

## TypeScript Types

### Database Type: `Order`

```typescript
export interface Order {
  id: string;
  value: number | null;
  permit_cost: number | null;  // Added field
  // ... other fields ...
}
```

**Note:** TypeScript type uses `number | null` to match database type, but database constraint ensures it's never null (default applied).

### Form Data Type: `OrderFormData`

```typescript
export interface OrderFormData {
  // ... existing fields ...
  value?: number | null;
  permit_cost?: number | null;  // Added field
  // ... other fields ...
}
```

**Validation:** Zod schema enforces `z.number().min(0).optional().nullable()`

### UI Type: `UIOrder`

```typescript
export interface UIOrder {
  id: string;
  value: string;  // Formatted currency string
  permitCost?: number | null;  // Added field (numeric)
  // ... other fields ...
}
```

---

## API Functions

### No New API Functions Required

**Reasoning:**
- Existing order API functions already use `select('*')` or explicit field lists
- Adding `permit_cost` to existing queries is sufficient
- No new endpoints or functions needed

**Existing Functions:**
- `fetchOrders()` - Already selects all fields (includes `permit_cost` after migration)
- `fetchOrder(id)` - Already selects all fields
- `createOrder(order)` - Already accepts full order object
- `updateOrder(id, updates)` - Already accepts partial order updates

**Updates Required:**
- Ensure `permit_cost` is included in SELECT queries (if using explicit selects)
- Ensure `permit_cost` is included in INSERT/UPDATE operations
- No function signature changes needed

---

## Calculation Functions

### `getOrderTotal(order: Order): number`

**Purpose:** Calculate order total (base value + permit cost).

**Signature:**
```typescript
export function getOrderTotal(order: Order): number {
  const baseValue = order.value ?? 0;
  const permitCost = order.permit_cost ?? 0;
  return baseValue + permitCost;
}
```

**Parameters:**
- `order: Order` - Order object with `value` and `permit_cost` fields

**Returns:**
- `number` - Total order value (base + permit cost)

**Null Handling:**
- Treats null/undefined as 0
- Safe for null values in either field

**Example:**
```typescript
const order: Order = { id: '123', value: 1000, permit_cost: 250, ... };
const total = getOrderTotal(order);  // Returns 1250
```

---

### `getOrderTotalFormatted(order: Order): string`

**Purpose:** Format order total as GBP currency string.

**Signature:**
```typescript
export function getOrderTotalFormatted(order: Order): string {
  const total = getOrderTotal(order);
  return `£${total.toLocaleString('en-GB', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}
```

**Parameters:**
- `order: Order` - Order object with `value` and `permit_cost` fields

**Returns:**
- `string` - Formatted GBP currency string (e.g., "£1,250.00")

**Format:**
- Currency: GBP (£)
- Locale: en-GB
- Decimals: 2 (minimum and maximum)

**Example:**
```typescript
const order: Order = { id: '123', value: 1000, permit_cost: 250, ... };
const formatted = getOrderTotalFormatted(order);  // Returns "£1,250.00"
```

---

### `getOrderBaseValue(order: Order): number`

**Purpose:** Get base order value (null treated as 0).

**Signature:**
```typescript
export function getOrderBaseValue(order: Order): number {
  return order.value ?? 0;
}
```

**Parameters:**
- `order: Order` - Order object with `value` field

**Returns:**
- `number` - Base order value (0 if null)

---

### `getOrderPermitCost(order: Order): number`

**Purpose:** Get permit cost (null treated as 0).

**Signature:**
```typescript
export function getOrderPermitCost(order: Order): number {
  return order.permit_cost ?? 0;
}
```

**Parameters:**
- `order: Order` - Order object with `permit_cost` field

**Returns:**
- `number` - Permit cost (0 if null)

---

## Form Validation

### Order Form Schema

**File:** `src/modules/orders/schemas/order.schema.ts`

**Schema:**
```typescript
export const orderFormSchema = z.object({
  // ... existing fields ...
  value: z.number().min(0, 'Value must be positive').optional().nullable(),
  permit_cost: z.number().min(0, 'Permit cost must be positive').optional().nullable(),
  // ... other fields ...
});
```

**Validation Rules:**
- `permit_cost` must be >= 0 if provided
- `permit_cost` is optional (can be omitted)
- `permit_cost` is nullable (can be null)

**Error Messages:**
- "Permit cost must be positive" - If value < 0

---

## Invoice Calculation Contract

### Invoice Total Calculation

**Component:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Current Calculation:**
```typescript
const finalAmount = orders.reduce((sum, order) => sum + (order.data.value ?? 0), 0);
```

**Updated Calculation:**
```typescript
const finalAmount = orders.reduce((sum, order) => {
  const baseValue = order.data.value ?? 0;
  const permitCost = order.data.permit_cost ?? 0;
  return sum + baseValue + permitCost;
}, 0);
```

**Or using utility:**
```typescript
const finalAmount = orders.reduce((sum, order) => {
  return sum + getOrderTotal(order.data);
}, 0);
```

**Contract:**
- Input: Array of order objects with `value` and `permit_cost` fields
- Output: Total invoice amount (sum of all order totals)
- Null Handling: Treats null/undefined as 0
- Currency: GBP (calculated in numeric form, formatted for display)

---

## Display Contracts

### Order Value Display

**Component:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Contract:**
- Input: `UIOrder` with `value` (formatted string) and `permitCost` (number)
- Display: Total (base + permit cost) as formatted currency string
- Format: GBP currency with en-GB locale

**Implementation:**
```typescript
// Calculate total from base value and permit cost
const baseValue = parseFloat(order.value.replace('£', '').replace(/,/g, '')) || 0;
const permitCost = order.permitCost ?? 0;
const total = baseValue + permitCost;
const formatted = `£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
```

**Or use utility:**
```typescript
// If we update UIOrder to include raw numeric values
const total = getOrderTotalFormatted(order);
```

---

### Order Details Display

**Component:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Contract:**
- Base Value: Display `order.value` (formatted string) or "N/A" if null
- Permit Cost: Display `order.permitCost` (formatted) or "£0.00" if null/0
- Total: Display calculated total (base + permit) as formatted currency

**Format:**
- All values formatted as GBP currency (en-GB locale)
- Use `getOrderTotalFormatted()` for total

---

## Error Handling

### Validation Errors

**Form Validation:**
- Negative permit cost: "Permit cost must be positive"
- Invalid numeric input: Standard Zod validation error
- Missing required field: Not applicable (optional field)

### Calculation Errors

**Null/Undefined Handling:**
- All calculations use nullish coalescing (`?? 0`)
- No errors from null values
- Safe for missing data

### Database Errors

**Migration Errors:**
- Column already exists: Use `IF NOT EXISTS` or check first
- Default value constraint violation: Should not occur with default 0
- Permission errors: Ensure migration user has ALTER TABLE permissions

---

## Testing Contracts

### Unit Tests

**Calculate Order Total:**
- Order with base value and permit cost: Returns sum
- Order with null base value: Treats as 0, returns permit cost
- Order with null permit cost: Treats as 0, returns base value
- Order with both null: Returns 0

**Format Order Total:**
- Valid total: Returns formatted GBP string
- Zero total: Returns "£0.00"
- Large total: Returns formatted with thousands separator

### Integration Tests

**Order Creation:**
- Create order with permit cost: Saves correctly
- Create order without permit cost: Defaults to 0
- Update order permit cost: Updates correctly

**Invoice Calculation:**
- Invoice with orders having permit costs: Includes in total
- Invoice with orders without permit costs: Works correctly
- Invoice with mixed orders: Calculates correctly

