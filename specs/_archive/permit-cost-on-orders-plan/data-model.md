# Data Model: Permit Cost on Orders (GBP)

## Database Schema

### Table: `orders`

**Purpose:** Store order information including base value and permit cost.

**Current Structure:**
```sql
create table public.orders (
  id uuid primary key,
  value decimal(10,2),  -- Base order value (nullable)
  -- ... other columns ...
);
```

**Changes Required:**
```sql
alter table public.orders
  add column permit_cost decimal(10,2) not null default 0;

comment on column public.orders.permit_cost is 
  'Cost of cemetery permits in GBP. Manually entered and included in order total.';
```

**Updated Structure:**
```sql
create table public.orders (
  id uuid primary key,
  value decimal(10,2),  -- Base order value (nullable)
  permit_cost decimal(10,2) not null default 0,  -- Permit cost (non-null, default 0)
  -- ... other columns ...
);
```

**Column Details:**

### `permit_cost`

- **Type:** `decimal(10,2)`
- **Nullable:** No (NOT NULL)
- **Default:** `0`
- **Purpose:** Cost of cemetery permits in GBP, manually entered and included in order total
- **Constraints:** None (validation in UI prevents negative values)
- **Indexes:** None (not used in queries)

**Migration Impact:**
- All existing orders will have `permit_cost = 0` after migration
- New orders will default to `permit_cost = 0` if not specified
- Backward compatible (existing queries unaffected)

## TypeScript Type Model

### Database Type: `Order`

```typescript
export interface Order {
  id: string;
  value: number | null;  // Base order value (nullable)
  permit_cost: number | null;  // Permit cost (nullable in DB, but NOT NULL constraint with default)
  // ... other fields ...
}
```

**Note:** TypeScript type uses `number | null` to match database nullable type, but database constraint ensures it's never null (default applied).

### UI Type: `UIOrder`

```typescript
export interface UIOrder {
  id: string;
  value: string;  // Formatted currency string (base value)
  permitCost?: number | null;  // Permit cost (numeric, for display/calculation)
  // ... other fields ...
}
```

**Transform Logic:**
```typescript
function transformOrderForUI(order: Order): UIOrder {
  return {
    ...order,
    value: order.value 
      ? `£${order.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'N/A',
    permitCost: order.permit_cost ?? null,
  };
}
```

## Calculation Model

### Order Total Calculation

```typescript
function getOrderTotal(order: Order): number {
  const baseValue = order.value ?? 0;
  const permitCost = order.permit_cost ?? 0;
  return baseValue + permitCost;
}
```

**Logic:**
- Base value: `order.value ?? 0`
- Permit cost: `order.permit_cost ?? 0`
- Total: `baseValue + permitCost`

### Order Total Formatting

```typescript
function getOrderTotalFormatted(order: Order): string {
  const total = getOrderTotal(order);
  return `£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

**Format:** GBP currency with en-GB locale, 2 decimal places

### Invoice Total Calculation

```typescript
function calculateInvoiceTotal(orders: Order[]): number {
  return orders.reduce((sum, order) => {
    const baseValue = order.value ?? 0;
    const permitCost = order.permit_cost ?? 0;
    return sum + baseValue + permitCost;
  }, 0);
}
```

**Logic:**
- Sum of all order totals (base value + permit cost)
- Each order contributes: `(order.value ?? 0) + (order.permit_cost ?? 0)`

## Form Model

### Order Form Schema

```typescript
const orderFormSchema = z.object({
  // ... existing fields ...
  value: z.number().min(0, 'Value must be positive').optional().nullable(),
  permit_cost: z.number().min(0, 'Permit cost must be positive').optional().nullable(),
  // ... other fields ...
});
```

**Validation:**
- Permit cost must be >= 0 (prevents negative values)
- Optional (can be omitted, defaults to null in form, converted to 0 in DB)
- Nullable (form can have null, database default applies)

### Form Data Flow

1. **User Input:** User enters permit cost in form (number or empty)
2. **Form State:** `permit_cost` is `number | null` in form
3. **Validation:** Zod validates min 0 if provided
4. **Submission:** Form data sent to API
5. **API:** Converts null to 0 or uses provided value
6. **Database:** Stores as `decimal(10,2) NOT NULL DEFAULT 0`

## Display Model

### Orders Table Display

**Column:** "Value"
- **Displays:** Total (base value + permit cost)
- **Format:** GBP currency string
- **Example:** `£1,250.00` (if base=£1,000, permit=£250)

### Order Details Sidebar Display

**Sections:**
1. **Base Value:** `£1,000.00` (if present, else "N/A")
2. **Permit Cost:** `£250.00` (if > 0, else hidden or "£0.00")
3. **Total:** `£1,250.00` (calculated: base + permit)

**Format:** All values formatted as GBP currency (en-GB locale)

### Invoice Creation Display

**Order Selection:**
- Each order shows:
  - Base value: `£1,000.00`
  - Permit cost: `£250.00`
  - Total: `£1,250.00`
- Invoice total preview: `£2,500.00` (sum of all order totals)

## Data Relationships

### Orders → Invoice Calculation

**Relationship:**
- Orders are selected for invoice creation
- Invoice amount is calculated from order totals
- Invoice stores calculated amount (not recalculated later)

**Calculation:**
```
Invoice Amount = Σ(Order Total for each selected order)
                = Σ((order.value ?? 0) + (order.permit_cost ?? 0))
```

## Constraints and Validation

### Database Constraints
- `permit_cost NOT NULL` - Ensures all orders have a permit_cost value
- `DEFAULT 0` - Default value for new orders and existing orders after migration
- `decimal(10,2)` - Precision matches existing `value` field

### Application Validation
- Zod schema: `z.number().min(0)` - Prevents negative values
- UI validation: Numeric input with min 0
- Null handling: Treat null/undefined as 0 in calculations

## Edge Cases

### Missing Values
- **Case:** Order has null `value` and null `permit_cost`
- **Handling:** Both treated as 0, total = 0
- **Display:** Shows "N/A" or "£0.00" appropriately

### Existing Orders (After Migration)
- **Case:** Orders created before migration
- **Handling:** Default value of 0 applied automatically
- **Result:** All existing orders have `permit_cost = 0`

### New Orders (No Permit Cost Entered)
- **Case:** User creates order without entering permit cost
- **Handling:** Form sends null, database default applies (0)
- **Result:** Order has `permit_cost = 0`

## Query Patterns

### Fetch Orders with Permit Cost

```typescript
const { data: orders } = await supabase
  .from('orders')
  .select('*, permit_cost')  // Include permit_cost
  .order('created_at', { ascending: false });
```

### Calculate Order Total

```typescript
const orderTotal = (order.value ?? 0) + (order.permit_cost ?? 0);
```

### Calculate Invoice Total

```typescript
const invoiceTotal = orders.reduce((sum, order) => {
  return sum + (order.value ?? 0) + (order.permit_cost ?? 0);
}, 0);
```

## Migration Strategy

### Migration SQL

```sql
-- Add permit_cost column
alter table public.orders
  add column permit_cost decimal(10,2) not null default 0;

-- Add column comment
comment on column public.orders.permit_cost is 
  'Cost of cemetery permits in GBP. Manually entered and included in order total.';
```

**Impact:**
- Existing orders: All get `permit_cost = 0` (default applied)
- New orders: Default to `permit_cost = 0` if not specified
- No data loss or breaking changes

## Backward Compatibility

### Existing Queries
- All existing queries continue to work (column is additive)
- `SELECT *` includes new column automatically
- Explicit selects must include `permit_cost` if needed

### Existing Invoices
- Existing invoices remain unchanged (amounts are stored)
- Only new invoices include permit costs in calculation
- No retroactive recalculation of existing invoices

### Existing UI
- Existing value displays continue to work
- New UI shows totals (base + permit) instead of base only
- Breakdown visible in details view

