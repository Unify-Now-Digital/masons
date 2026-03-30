# Additional Options on Orders (GBP)

## Overview

Add support for multiple "Additional Options" per Order (custom services like engraving, picture, color upgrades, etc.), each with a manually entered cost. Additional Options costs must be included in order totals and therefore invoice totals.

**Context:**
- Orders already support base value (product price) and permit_cost
- Order totals are calculated using shared utilities (`getOrderTotal`, `getOrderTotalFormatted`)
- Invoice totals are derived from order totals
- All monetary values use GBP currency with en-GB locale formatting

**Goal:**
- Allow adding multiple Additional Options to an Order
- Each option has: name (free-text), cost (manual, GBP), optional description
- Additional Options costs are included in:
  - Order total value display
  - Invoice totals (derived from orders)
- Keep changes additive, reversible, and consistent with existing calculation utilities

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `id` (uuid, primary key)
- `value` (decimal(10,2), nullable) - Base order value (product price)
- `permit_cost` (decimal(10,2), not null, default 0) - Cemetery permit cost
- Other fields: customer info, statuses, dates, location, etc.

**Observations:**
- Order total currently calculated as: `base value + permit_cost`
- Calculation utilities in `src/modules/orders/utils/orderCalculations.ts`:
  - `getOrderBaseValue(order)` - Returns base value (null → 0)
  - `getOrderPermitCost(order)` - Returns permit cost (null → 0)
  - `getOrderTotal(order)` - Returns base + permit cost
  - `getOrderTotalFormatted(order)` - Returns formatted GBP string
- Order display uses `UIOrder` interface with `value` (formatted string) and `total` (numeric for sorting)

### Relationship Analysis

**Current Relationship:**
- Orders are linked to Invoices via `orders.invoice_id`
- Orders are linked to Jobs via `orders.job_id`
- Orders are linked to People via `orders.person_id`
- No existing relationship for additional options

**Gaps/Issues:**
- No table or mechanism for storing multiple additional options per order
- Order total calculation does not include additional options
- UI does not support adding/managing additional options

### Data Access Patterns

**How Orders are Currently Accessed:**
- Orders fetched via `fetchOrders()` in `src/modules/orders/api/orders.api.ts`
- Orders displayed in `SortableOrdersTable` component
- Order details shown in `OrderDetailsSidebar` component
- Order create/edit via `CreateOrderDrawer` and `EditOrderDrawer`

**How Order Totals are Calculated:**
- Shared utility: `getOrderTotal(order)` in `orderCalculations.ts`
- Used in: Orders table display, Order details sidebar, Invoice calculations
- Formatting: `getOrderTotalFormatted(order)` for display

**How Invoice Totals are Calculated:**
- `CreateInvoiceDrawer` uses `getOrderTotal(orderLike)` to sum order totals
- Invoice amount = sum of all linked order totals
- No stored totals (calculated on-the-fly)

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**

1. **Create `order_additional_options` table:**
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

2. **Enable RLS:**
   ```sql
   alter table public.order_additional_options enable row level security;
   ```

3. **Create RLS policies:**
   - SELECT: Users can view options for orders they can access (same as orders access pattern)
   - INSERT: Users can create options for orders they can access
   - UPDATE: Users can update options for orders they can access
   - DELETE: Users can delete options for orders they can access

4. **Create indexes:**
   ```sql
   create index idx_order_additional_options_order_id 
     on public.order_additional_options(order_id);
   ```

5. **Add updated_at trigger:**
   ```sql
   create trigger update_order_additional_options_updated_at
     before update on public.order_additional_options
     for each row
     execute function public.update_updated_at_column();
   ```

**Non-Destructive Constraints:**
- Only additive changes (new table, no modifications to existing tables)
- No breaking changes to existing Orders/Invoices behavior when no options exist
- Backward compatible (existing orders work without additional options)

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Fetch options with orders: Use LEFT JOIN or separate query
- Calculate options total: Sum `cost` for all options linked to an order
- Display options: Show as list in Order details sidebar

**Recommended Display Patterns:**
- Order details sidebar: Show options list with subtotal
- Orders table: Total includes options (via updated calculation)
- Invoice totals: Automatically include options via shared order total logic

---

## Implementation Approach

### Phase 1: Database Migration
- Create `order_additional_options` table
- Enable RLS with appropriate policies
- Create indexes for performance
- Add updated_at trigger

### Phase 2: Type Updates
- Add TypeScript types for `OrderAdditionalOption`
- Update Order types to include optional `additional_options` array
- Create form schema for additional options

### Phase 3: Calculation Utility Updates
- Extend `getOrderTotal(order)` to include additional options total
- Add helper: `getOrderAdditionalOptionsTotal(order)` 
- Update `getOrderTotalFormatted` to use updated calculation
- Ensure defensive null handling

### Phase 4: Orders UI Updates
- Add "Additional Options" section to `CreateOrderDrawer`
- Add "Additional Options" section to `EditOrderDrawer`
- Support add/remove multiple options
- Cost input supports blank => 0 (use `toMoneyNumber` utility)
- Display options list in `OrderDetailsSidebar` with subtotal

### Phase 5: Order Display Updates
- Orders table total column automatically includes options (via updated `getOrderTotal`)
- Order details sidebar shows options breakdown
- All displays use updated calculation utilities

### Phase 6: Invoice Integration
- Invoice totals automatically include additional options (via updated `getOrderTotal`)
- No changes needed to invoice creation logic (uses shared utility)
- Invoice order list displays correct totals

### Phase 7: Testing & Validation
- Test order creation with/without additional options
- Test order editing (add/remove/update options)
- Test order total calculations
- Test invoice totals with orders containing options
- Build & lint validation

### Safety Considerations
- All changes are additive (new table, no schema modifications)
- Existing orders work without additional options (default to 0)
- Calculation utilities handle null/empty arrays safely
- No breaking changes to existing functionality
- RLS policies follow existing app patterns

---

## What NOT to Do

- Do not create preset/option templates (free-text for now; presets can be added later)
- Do not store derived totals in database (calculate on-the-fly)
- Do not modify existing orders table schema (use separate table)
- Do not change existing calculation logic without updating all usages
- Do not add automation or business logic for option pricing
- Do not create separate invoice line items for options (include in order total)

---

## Open Questions / Considerations

- **Option ordering:** Should options be displayed in creation order, or allow reordering? (Start with creation order)
- **Option validation:** Any constraints on option names? (Start with free-text, no constraints)
- **Bulk operations:** Should we support bulk add/remove? (Not in initial implementation)
- **Option categories:** Should we support grouping/categorizing options? (Not in initial implementation)
- **Historical tracking:** Should we track option changes over time? (Not in initial implementation)

---

## Technical Details

### Calculation Formula

**Order Total = Base Value + Permit Cost + Additional Options Total**

Where:
- Base Value = `order.value ?? 0`
- Permit Cost = `order.permit_cost ?? 0`
- Additional Options Total = `sum(option.cost) for all options where option.order_id = order.id`

### TypeScript Types

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

export interface Order {
  // ... existing fields
  additional_options?: OrderAdditionalOption[]; // Optional, populated via join
}
```

### Form Schema

```typescript
export const additionalOptionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cost: z.number().min(0, 'Cost must be positive').optional().nullable(),
  description: z.string().optional().nullable(),
});

export const orderFormSchema = z.object({
  // ... existing fields
  additional_options: z.array(additionalOptionSchema).optional().default([]),
});
```

### RLS Policy Pattern

Follow existing app patterns for orders access:
- Users can access orders they have permission to view
- Policies should check order access, not direct user_id (since orders may be shared/team-accessible)

---

## Success Criteria

- ✅ New `order_additional_options` table created with RLS enabled
- ✅ Orders can have multiple additional options
- ✅ Order total calculation includes additional options
- ✅ Order create/edit UI supports adding/removing options
- ✅ Order details sidebar shows options list and subtotal
- ✅ Orders table displays correct total (includes options)
- ✅ Invoice totals automatically include additional options
- ✅ All calculations use shared utilities
- ✅ No breaking changes to existing functionality
- ✅ All monetary values formatted as GBP currency

