# Implementation Plan: Human-friendly Order ID (ORD-000123) exposed in API + UI, keep UUID as internal PK

## Feature Overview

Replace raw UUID order IDs displayed throughout the app with human-friendly formatted IDs (e.g., `ORD-000123`) for new orders, while maintaining UUID as the internal primary key. Existing orders continue to display UUIDs as fallback.

**Branch:** `feature/human-friendly-order-id-ord-000123-exposed-in-api-ui-keep-uuid-as-internal-pk`  
**Spec File:** `specs/human-friendly-order-id-ord-000123-exposed-in-api-ui-keep-uuid-as-internal-pk.md`

---

## Technical Context

### Current State
- Orders table uses `id uuid primary key` as the primary identifier
- All UI displays show full UUID like `e0f4916d-c2d4-4962-87e9-c9ba05515e8d`
- Order IDs are shown in: Orders table, detail sidebars, invoice dropdowns, map panels, inscriptions, toast messages
- No `order_number` field exists
- No centralized formatting utility for order IDs
- All foreign key relationships use UUID (`orders.id`)

### Key Files
- `supabase/migrations/20250608000001_create_orders_table.sql` - Orders table schema
- `src/modules/orders/types/orders.types.ts` - Order TypeScript interface (needs `order_number` field)
- `src/modules/orders/utils/numberParsing.ts` - Order normalization function (needs to preserve `order_number`)
- `src/modules/orders/components/orderColumnDefinitions.tsx` - Orders table column definitions (displays `order.id`)
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Order detail sidebar (may show `order.id`)
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Order creation (returns order with UUID)
- `src/modules/orders/components/EditOrderDrawer.tsx` - Order editing
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Invoice creation with order selection
- `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx` - Invoice order display
- `src/modules/map/components/OrderInfoPanel.tsx` - Map order info panel
- `src/modules/inscriptions/components/*` - Inscription components that reference orders

### Constraints
- **UUID remains primary key** - No changes to `orders.id` or foreign key relationships
- **Additive-only migrations** - New `order_number` column is nullable; existing rows unaffected
- **No backfill** - Existing orders keep `order_number = null` (display UUID fallback)
- **No route/API changes** - URLs and query params still use UUID internally
- **Gaps acceptable** - Sequence may have gaps (no strict gapless requirement)
- **Single source of truth** - All ID formatting via centralized utility

---

## Implementation Phases

### Phase 1: Database Migration (Additive)

**Goal:** Add `order_number` column with auto-incrementing sequence for new orders.

#### Task 1.1: Create Migration for Order Number Sequence and Column
**File:** `supabase/migrations/YYYYMMDDHHmmss_add_order_number_to_orders.sql`

**Implementation:**
```sql
-- Create sequence for auto-incrementing order numbers
create sequence if not exists public.orders_order_number_seq;

-- Add nullable order_number column to orders table
alter table public.orders 
  add column if not exists order_number bigint null;

-- Set default for new inserts (existing rows remain null)
alter table public.orders 
  alter column order_number set default nextval('public.orders_order_number_seq');

-- Add unique index on order_number (partial index, only for non-null values)
create unique index if not exists orders_order_number_uidx 
  on public.orders(order_number) 
  where order_number is not null;

-- Add column comment explaining purpose
comment on column public.orders.order_number is 'Human-friendly numeric order identifier (ORD-xxxxxx format). Auto-assigned for new orders via sequence. Existing orders remain null and display UUID fallback.';
```

**Validation:**
- Ensure sequence is created successfully
- Verify column is nullable (existing rows have null)
- Test new insert: `order_number` should auto-populate
- Verify unique index prevents duplicate `order_number` values
- Confirm existing queries continue to work (column is nullable)

**Success Criteria:**
- ✅ Migration runs successfully without errors
- ✅ New orders automatically get `order_number` assigned
- ✅ Existing orders have `order_number = null`
- ✅ Unique constraint prevents duplicate numbers
- ✅ Sequence handles concurrent inserts safely

---

### Phase 2: Type Updates & Normalization

**Goal:** Update TypeScript types and normalization utilities to include `order_number`.

#### Task 2.1: Update Order TypeScript Interface
**File:** `src/modules/orders/types/orders.types.ts`

**Implementation:**
- Add `order_number: number | null;` to the `Order` interface (after `id: string;`)
- Ensure `OrderInsert` and `OrderUpdate` types handle `order_number` correctly (read-only, auto-assigned)

**Validation:**
- TypeScript compiles without errors
- Type checking catches missing `order_number` in type definitions

**Success Criteria:**
- ✅ `Order` interface includes `order_number: number | null`
- ✅ TypeScript build passes
- ✅ Types are backward compatible (nullable field)

#### Task 2.2: Update Order Normalization Function
**File:** `src/modules/orders/utils/numberParsing.ts`

**Implementation:**
- Update `RawOrder` type to include `order_number?: number | string | null;`
- Update `normalizeOrder()` to preserve `order_number`:
  ```typescript
  order_number: typeof order.order_number === 'string' 
    ? parseInt(order.order_number, 10) 
    : (order.order_number ?? null),
  ```
- Ensure `null` is preserved (not converted to 0)

**Validation:**
- Normalization preserves `order_number` as number or null
- String values are parsed correctly
- Null values remain null (no coercion to 0)

**Success Criteria:**
- ✅ `normalizeOrder()` preserves `order_number` field
- ✅ Handles string-to-number conversion (from Supabase)
- ✅ Preserves null values correctly
- ✅ No breaking changes to existing normalization logic

---

### Phase 3: Shared Display Utility

**Goal:** Create centralized utility for formatting order IDs (single source of truth).

#### Task 3.1: Create Order Display ID Utility
**File:** `src/modules/orders/utils/orderDisplayId.ts` (new file)

**Implementation:**
```typescript
/**
 * Format order number as human-friendly ID (e.g., ORD-000123)
 * @param orderNumber - Numeric order number
 * @returns Formatted string (ORD-xxxxxx, padded to 6 digits)
 */
export function formatOrderNumber(orderNumber: number): string {
  return `ORD-${String(orderNumber).padStart(6, '0')}`;
}

/**
 * Get display ID for an order (friendly format or UUID fallback)
 * @param order - Order object with id and optional order_number
 * @returns Formatted order ID (ORD-xxxxxx if order_number exists, else UUID)
 */
export function getOrderDisplayId(order: { id: string; order_number?: number | null }): string {
  if (order.order_number != null && typeof order.order_number === 'number') {
    return formatOrderNumber(order.order_number);
  }
  return order.id; // UUID fallback
}

/**
 * Get shortened display ID for tight UI spaces (e.g., table cells)
 * @param order - Order object with id and optional order_number
 * @returns Short formatted ID (ORD-xxxxxx or shortened UUID like "e0f4916d…")
 */
export function getOrderDisplayIdShort(order: { id: string; order_number?: number | null }): string {
  if (order.order_number != null && typeof order.order_number === 'number') {
    return formatOrderNumber(order.order_number);
  }
  // Shorten UUID: first 8 chars + ellipsis
  return `${order.id.substring(0, 8)}…`;
}
```

**Validation:**
- Utility functions format correctly (ORD-000001, ORD-000123, ORD-012345)
- UUID fallback works when `order_number` is null
- Shortened UUID works correctly
- Functions handle edge cases (negative numbers, very large numbers)

**Success Criteria:**
- ✅ `formatOrderNumber()` pads to 6 digits correctly
- ✅ `getOrderDisplayId()` returns formatted ID or UUID
- ✅ `getOrderDisplayIdShort()` returns short format for constrained UI
- ✅ Functions are exported and importable
- ✅ No runtime errors with valid inputs

---

### Phase 4: UI Replacements (All Modules)

**Goal:** Replace all visible `order.id` displays with `getOrderDisplayId(order)` utility.

#### Task 4.1: Orders Module - Table Columns
**File:** `src/modules/orders/components/orderColumnDefinitions.tsx`

**Implementation:**
- Import `getOrderDisplayId` from `../utils/orderDisplayId`
- Find column definition that displays `order.id` (likely `accessorKey: 'id'` or `cell: ({ row }) => row.original.id`)
- Replace with `cell: ({ row }) => getOrderDisplayId(row.original)`
- If table uses `accessorKey` only, wrap with `cell` renderer

**Files to check:**
- `src/modules/orders/components/orderColumnDefinitions.tsx`
- `src/modules/orders/components/SortableOrdersTable.tsx` (if uses different column definitions)

**Success Criteria:**
- ✅ Orders table shows `ORD-xxxxxx` for new orders
- ✅ Existing orders show UUID fallback
- ✅ Column is sortable/filterable (if needed)

#### Task 4.2: Orders Module - Detail Sidebar
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Implementation:**
- Import `getOrderDisplayId`
- Find any display of `order.id` (header, summary, labels)
- Replace with `getOrderDisplayId(order)`
- Check all render locations (header title, ID label, etc.)

**Success Criteria:**
- ✅ Order sidebar shows `ORD-xxxxxx` for new orders
- ✅ UUID fallback for existing orders
- ✅ No visual regressions

#### Task 4.3: Orders Module - Drawers & Toasts
**Files:**
- `src/modules/orders/components/CreateOrderDrawer.tsx`
- `src/modules/orders/components/EditOrderDrawer.tsx`
- `src/modules/orders/components/DeleteOrderDialog.tsx`

**Implementation:**
- Import `getOrderDisplayId`
- Replace any `order.id` display in drawer headers, labels, or toast messages
- Check success messages: "Order {id} created" → "Order {displayId} created"

**Success Criteria:**
- ✅ Order drawers show friendly IDs
- ✅ Toast messages use friendly format
- ✅ Delete confirmations show friendly format

#### Task 4.4: Invoicing Module - Order Dropdowns & Lists
**Files:**
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`
- `src/modules/invoicing/components/EditInvoiceDrawer.tsx`
- `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Implementation:**
- Import `getOrderDisplayId` in each file
- Find order selection dropdowns (likely `<Select>` with order options)
- Replace `order.id` in dropdown option labels with `getOrderDisplayId(order)`
- Check inline order summaries/forms (`OrderFormInline` if exists)
- Check invoice detail views showing associated orders

**Success Criteria:**
- ✅ Invoice order dropdowns show `ORD-xxxxxx`
- ✅ Invoice detail pages show friendly order IDs
- ✅ Inline order forms show friendly IDs

#### Task 4.5: Map Module - Order Info Panel
**File:** `src/modules/map/components/OrderInfoPanel.tsx`

**Implementation:**
- Import `getOrderDisplayId`
- Find display of `order.id` in panel header or content
- Replace with `getOrderDisplayId(order)`

**Success Criteria:**
- ✅ Map order info panels show `ORD-xxxxxx`
- ✅ UUID fallback for existing orders

#### Task 4.6: Inscriptions Module - Order References
**Files:**
- `src/modules/inscriptions/components/CreateInscriptionDrawer.tsx`
- `src/modules/inscriptions/components/EditInscriptionDrawer.tsx`
- `src/modules/inscriptions/pages/InscriptionsPage.tsx` (if shows order IDs)

**Implementation:**
- Import `getOrderDisplayId`
- Check if inscriptions show linked order IDs (may be in table columns or detail views)
- Replace any `order.id` or `inscription.order_id` display with friendly format
- Note: `order_id` is still UUID in database (FK unchanged); only display formatting changes

**Success Criteria:**
- ✅ Inscriptions show friendly order IDs when displayed
- ✅ No impact on inscription-order relationships

#### Task 4.7: Other Modules - Audit & Replace
**Files to check:**
- `src/modules/notifications/pages/NotificationsPage.tsx` (if shows order IDs)
- `src/modules/reporting/**` (if reports show order IDs)
- `src/modules/jobs/**` (if job views show order IDs)

**Implementation:**
- Search codebase for `order.id` usage (grep/IDE search)
- Replace any visible displays (not internal logic) with `getOrderDisplayId(order)`
- Ensure routing/query params still use UUID (no changes to URL construction)

**Success Criteria:**
- ✅ All visible order IDs use friendly format
- ✅ Routing still uses UUID (URLs unchanged)
- ✅ No regressions in any module

---

### Phase 5: QA & Validation

**Goal:** Verify feature works end-to-end with no regressions.

#### Task 5.1: New Order Creation Tests
**Test Cases:**
1. Create new order via Orders module (`CreateOrderDrawer`)
   - ✅ Order is created with `order_number` auto-assigned
   - ✅ Orders table shows `ORD-xxxxxx` (not UUID)
   - ✅ Order detail sidebar shows `ORD-xxxxxx`
   - ✅ Toast message shows friendly ID

2. Create new order inline via Invoice (`CreateInvoiceDrawer` with `OrderFormInline`)
   - ✅ Order is created with `order_number` auto-assigned
   - ✅ Invoice order dropdown shows `ORD-xxxxxx`
   - ✅ Invoice detail shows friendly order ID

**Success Criteria:**
- ✅ New orders have `order_number` set (not null)
- ✅ UI displays `ORD-xxxxxx` everywhere
- ✅ No UUIDs shown for new orders

#### Task 5.2: Existing Order Display Tests
**Test Cases:**
1. View existing order (created before migration)
   - ✅ Orders table shows UUID (fallback)
   - ✅ Order detail sidebar shows UUID
   - ✅ Map info panel shows UUID

2. Edit existing order
   - ✅ Order editing works normally
   - ✅ No errors with null `order_number`
   - ✅ Display still shows UUID (expected)

**Success Criteria:**
- ✅ Existing orders display UUID correctly
- ✅ No runtime errors with null `order_number`
- ✅ All existing functionality preserved

#### Task 5.3: Integration Tests
**Test Cases:**
1. Invoice with new order
   - ✅ Invoice totals unchanged (no impact on calculations)
   - ✅ Order shows friendly ID in invoice context

2. Map with new order
   - ✅ Map pins work normally (uses `latitude`/`longitude`, not ID)
   - ✅ Order info panel shows friendly ID

3. Additional options
   - ✅ Order additional options unchanged (linked via UUID FK)
   - ✅ Totals calculations unaffected

**Success Criteria:**
- ✅ No impact on totals, invoices, map pins, additional options
- ✅ All integrations work correctly
- ✅ No breaking changes

#### Task 5.4: Build & Type Safety
**Validation:**
- Run `npm run build` or `npx tsc --noEmit`
- Verify no TypeScript errors
- Verify no linting errors
- Check runtime console for errors

**Success Criteria:**
- ✅ TypeScript build passes
- ✅ No linting errors
- ✅ No runtime console errors

---

## File Change Summary

### New Files
- `src/modules/orders/utils/orderDisplayId.ts` - Display ID formatting utility

### Modified Files
- `supabase/migrations/YYYYMMDDHHmmss_add_order_number_to_orders.sql` - Database migration (new)
- `src/modules/orders/types/orders.types.ts` - Add `order_number` field
- `src/modules/orders/utils/numberParsing.ts` - Preserve `order_number` in normalization
- `src/modules/orders/components/orderColumnDefinitions.tsx` - Use display ID in table
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Use display ID in sidebar
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Use display ID in toasts/headers
- `src/modules/orders/components/EditOrderDrawer.tsx` - Use display ID in headers
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Use display ID in dropdowns
- `src/modules/invoicing/components/EditInvoiceDrawer.tsx` - Use display ID in dropdowns
- `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx` - Use display ID in lists
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` - Use display ID in details
- `src/modules/map/components/OrderInfoPanel.tsx` - Use display ID in panel
- `src/modules/inscriptions/components/*.tsx` - Use display ID if order IDs shown

---

## Acceptance Criteria Summary

✅ **Phase 1: Database Migration**
- Migration creates sequence and `order_number` column
- New orders auto-assign `order_number`
- Existing orders remain `null`
- Unique constraint prevents duplicates

✅ **Phase 2: Types & Normalization**
- `Order` interface includes `order_number: number | null`
- Normalization preserves `order_number` correctly
- TypeScript build passes

✅ **Phase 3: Display Utility**
- Centralized utility functions created
- Formats `ORD-xxxxxx` correctly
- UUID fallback works

✅ **Phase 4: UI Replacements**
- All visible order IDs use `getOrderDisplayId()`
- New orders show `ORD-xxxxxx`
- Existing orders show UUID fallback
- Routing still uses UUID (unchanged)

✅ **Phase 5: QA & Validation**
- New order creation works (both paths)
- Existing orders display correctly
- No impact on totals/invoices/map
- Build passes, no runtime errors

---

## Out of Scope (Do Not Implement)

- ❌ Change primary key from UUID to numeric
- ❌ Backfill `order_number` for existing orders
- ❌ Change route parameters to use `order_number`
- ❌ Modify foreign key relationships
- ❌ Implement gapless sequencing
- ❌ Add accounting/legal numbering requirements
- ❌ Change invoice calculation logic
- ❌ Modify map rendering logic (uses lat/lng, not ID)

---

## Notes

- **Sequence Safety**: Postgres sequences handle concurrent inserts safely (no race conditions)
- **Performance**: Partial unique index only indexes non-null values (efficient)
- **Backward Compatibility**: All changes are additive; existing functionality preserved
- **Testing Priority**: Focus on new order creation and existing order display (most common paths)
- **Future Enhancement**: Backfill script could be added later if needed (not in scope)
