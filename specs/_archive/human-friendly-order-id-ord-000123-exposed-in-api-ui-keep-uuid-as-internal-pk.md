# Human-friendly Order ID (ORD-000123) exposed in API + UI, keep UUID as internal PK

## Overview

Replace raw UUID order IDs displayed throughout the app with human-friendly formatted IDs (e.g., `ORD-000123`) for new orders, while maintaining UUID as the internal primary key. Existing orders continue to display UUIDs as fallback.

**Context:**
- Orders currently use UUID primary keys (`orders.id`), which are cumbersome for users to reference
- Need readable, sequential-looking IDs for better UX in tables, drawers, invoices, map panels, etc.
- Must remain backward compatible with existing orders and all existing functionality

**Goal:**
- Display `ORD-000123` format for new orders everywhere order IDs are shown
- Keep `orders.id` as UUID primary key (no breaking changes)
- Gracefully handle existing orders (UUID fallback display)
- No impact on routing, query params, or internal data relationships

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- Primary key: `id uuid primary key` (used everywhere for identification)
- All order references in UI currently display full UUID like `e0f4916d-c2d4-4962-87e9-c9ba05515e8d`
- Orders are referenced in:
  - Orders table/list view
  - Order detail drawers/sidebars
  - Invoice order selection dropdowns
  - Map order info panels
  - Inscriptions linked to orders
  - Toast messages
  - Internal comments/activity logs

**Observations:**
- UUID is appropriate for internal PK (globally unique, collision-resistant)
- Displaying UUID in UI is user-unfriendly (long, hard to read/communicate)
- No existing numeric or friendly ID field
- All foreign key relationships use UUID (`orders.id`)

### Data Access Patterns

**How Orders are Currently Accessed:**
- Queries use `select('*')` or views with `o.*` from `orders_with_options_total`
- Order detail queries filter by `id = :uuid`
- Order creation returns full order object with UUID `id`
- Routing/navigation uses UUID in URL params

**How Order IDs are Displayed:**
- Direct display of `order.id` in table columns
- Order references in dropdowns show `order.id`
- Map info panels show `order.id`
- No centralized formatting utility for order IDs

**Gaps/Issues:**
- No human-friendly identifier for new orders
- UUID display is inconsistent across different UI contexts
- No centralized utility for order ID formatting
- Hard to communicate order references to users ("please check order e0f4916d-c2d4-4962-87e9-c9ba05515e8d")

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
1. Create sequence: `public.orders_order_number_seq` for auto-incrementing numbers
2. Add nullable column: `order_number bigint null` to `public.orders`
3. Set default for new inserts: `alter column order_number set default nextval(...)`
4. Add unique index: `orders_order_number_uidx` on `order_number` (where not null)
5. Add column comment explaining purpose

**Non-Destructive Constraints:**
- ✅ Only additive changes (new column, new sequence)
- ✅ Existing rows remain `order_number = null`
- ✅ No impact on existing UUID-based foreign keys
- ✅ Backward compatible (all existing queries continue to work)
- ✅ Default only applies to new inserts (existing orders unaffected)

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Queries using `select('*')` or `o.*` will automatically include `order_number`
- Views like `orders_with_options_total` will include the new column
- Type-safe selects should include `order_number` in result types

**Recommended Display Patterns:**
- Centralized utility function `getOrderDisplayId(order)` that:
  - Returns `ORD-{padded_order_number}` if `order_number` exists
  - Returns UUID (or shortened) if `order_number` is null
- Use this utility everywhere order IDs are displayed (single source of truth)
- No changes to routing/URLs (still use UUID for navigation)

---

## Implementation Approach

### Phase 1: Database Migration
1. Create migration file: `YYYYMMDDHHmmss_add_order_number_to_orders.sql`
2. Create sequence `public.orders_order_number_seq`
3. Add `order_number bigint null` column with comment
4. Set default to `nextval('orders_order_number_seq')` for new rows
5. Create unique partial index `orders_order_number_uidx` on `order_number` where not null
6. Ensure migration is idempotent (IF NOT EXISTS patterns)
7. Test migration: new order insert should auto-assign `order_number`

### Phase 2: Type Updates & Normalization
1. Update `src/modules/orders/types/orders.types.ts`:
   - Add `order_number: number | null` to `Order` interface
2. Update `src/modules/orders/utils/numberParsing.ts` (or normalize function):
   - Ensure `order_number` is preserved in `normalizeOrder()` (coerce to number or null)

### Phase 3: Shared Display Utility
1. Create `src/modules/orders/utils/orderDisplayId.ts`:
   - `formatOrderNumber(orderNumber: number): string` → `ORD-000123`
   - `getOrderDisplayId(order: { id: string; order_number?: number | null }): string` → formatted or UUID fallback
   - `getOrderDisplayIdShort(...)` (optional) for tight table cells (shortened UUID)
2. Export from `src/modules/orders/utils/` index if exists

### Phase 4: UI Replacements (All Modules)
Replace raw `order.id` display with `getOrderDisplayId(order)` in:

**Orders Module:**
- Orders table columns (ID column)
- Order detail sidebar/header
- Toast messages referencing orders

**Invoicing Module:**
- Invoice order dropdown items
- Inline order form summaries
- Any order ID references in invoice context

**Map Module:**
- Order info panel headers/labels
- List items showing order IDs

**Inscriptions Module:**
- Wherever order is referenced by ID

**Other Modules:**
- Any other locations showing `order.id` directly

**Display Rules:**
- If `order_number` exists → show `ORD-xxxxxx` (padded to 6 digits)
- If `order_number` is null → show full UUID (or shortened UUID in constrained UI)
- Do NOT change routing/navigation (URLs still use UUID)

### Safety Considerations
- Migration is additive-only (no data loss risk)
- Existing orders continue to work (null `order_number` is valid)
- TypeScript will catch missing `order_number` in type updates
- Test with: new order creation, existing order display, invoice creation with orders
- Rollback: migration can be reverted (drop column/sequence) if needed

---

## What NOT to Do

- ❌ Change primary key from UUID to numeric
- ❌ Backfill `order_number` for existing orders
- ❌ Change route parameters from UUID to friendly ID
- ❌ Use `order_number` for foreign key relationships (keep UUID for FKs)
- ❌ Implement strict gapless sequencing (gaps are acceptable)
- ❌ Add accounting/legal-grade numbering requirements
- ❌ Modify any invoice calculation or reporting logic
- ❌ Change any database queries beyond adding `order_number` to selects

---

## Open Questions / Considerations

- **Sequence starting value**: Start at 1 or reserve numbers? (Recommend: start at 1)
- **Shortened UUID format**: For fallback, use `e0f4916d…` or full UUID? (Recommend: full UUID by default, shortened only in tight table cells)
- **Future backfill**: Not in scope, but could be added later if needed
- **Duplicate detection**: Unique index prevents duplicates; sequence handles race conditions
- **Performance**: Sequence is efficient; unique index is partial (only on non-null values)

---

## Acceptance Criteria

✅ New orders automatically have unique `order_number` assigned by database (no client-side logic)  
✅ UI displays `ORD-xxxxxx` for new orders in all visible locations  
✅ Existing orders display UUID fallback (no breaking changes)  
✅ No impact on totals, invoices, map pinning, additional options, or reporting  
✅ Build passes; no runtime errors  
✅ All order ID displays use centralized utility (single source of truth)

## Deliverables

- Migration file: `supabase/migrations/YYYYMMDDHHmmss_add_order_number_to_orders.sql`
- Type updates: `src/modules/orders/types/orders.types.ts`
- Normalization updates: `src/modules/orders/utils/numberParsing.ts` (or relevant file)
- Display utility: `src/modules/orders/utils/orderDisplayId.ts`
- UI updates across all modules (Orders, Invoicing, Map, Inscriptions, etc.)
- QA checklist covering new order creation, existing order display, invoice flows, map panels
