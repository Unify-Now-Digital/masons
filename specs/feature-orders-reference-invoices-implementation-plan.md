# Implementation Plan: Orders Reference Invoices

**Branch:** `feature/feature-orders-reference-invoices`  
**Specification:** `specs/feature-orders-reference-invoices.md`

---

## Overview

This implementation plan focuses on adding a foreign key reference from Orders to Invoices to establish Invoices as the architectural spine. This is a **pure database schema change** with no UI or behavior modifications.

**Scope (STRICT):**
- Database: Add `orders.invoice_id` column (nullable) with foreign key and index
- Type definitions: Update TypeScript `Order` interface to include `invoice_id`
- Validation: Ensure migration is reversible and backward-compatible

**Out of Scope:**
- UI components (Orders or Invoicing pages)
- Data access layer enhancements (optional query functions)
- Data migration/population
- Business logic changes
- Removal of `invoices.order_id` (kept for backward compatibility)

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create migration: Add invoice_id to orders | Create | `supabase/migrations/YYYYMMDDHHmmss_add_invoice_id_to_orders.sql` | High | None |
| 2 | Update Order type definition | Update | `src/modules/orders/types/orders.types.ts` | High | Task 1 |
| 3 | Validate migration and build | Verify | - | High | Tasks 1-2 |

---

## Task 1: Create Migration - Add invoice_id to Orders

**File:** `supabase/migrations/YYYYMMDDHHmmss_add_invoice_id_to_orders.sql`  
**Action:** CREATE  
**Priority:** High  
**Dependencies:** None

**Migration Content:**

```sql
-- Migration: Add invoice_id column to orders table
-- Purpose: Establish Invoices as the architectural spine; Orders reference Invoices
-- Date: [Current Date]

-- Add invoice_id column to orders table
-- Column is nullable to allow for gradual migration and backward compatibility
alter table public.orders
  add column invoice_id uuid references public.invoices(id) on delete set null;

-- Create index for query performance on invoice_id lookups
-- This enables efficient queries: "Which orders belong to this invoice?"
create index if not exists idx_orders_invoice_id on public.orders(invoice_id);

-- Add comment to document the column purpose
comment on column public.orders.invoice_id is 'References the invoice that this order belongs to. Invoices are the architectural spine. Nullable to allow for gradual migration.';
```

**Migration Naming:**
- Format: `YYYYMMDDHHmmss_add_invoice_id_to_orders.sql`
- Example: `20250118000000_add_invoice_id_to_orders.sql` (use current UTC timestamp)

**Key Points:**
- Column is **nullable** (no NOT NULL constraint) for backward compatibility
- Foreign key uses `on delete set null` (flexible cascade behavior)
- Index created for query performance
- `invoices.order_id` is **NOT** modified (kept for backward compatibility)
- No data backfill required (all values start as `null`)

**Rollback Safety:**
The migration can be rolled back safely with:
```sql
-- Rollback migration (if needed)
drop index if exists public.idx_orders_invoice_id;
alter table public.orders drop column if exists invoice_id;
```

**Rollback Notes:**
- ✅ No data loss: Column deletion only removes the new column
- ✅ Reversible: All changes are additive
- ✅ No dependencies: No other migrations depend on this column
- ⚠️ Rollback timing: Rollback should occur before any data is populated in `invoice_id`

---

## Task 2: Update Order Type Definition

**File:** `src/modules/orders/types/orders.types.ts`  
**Action:** UPDATE  
**Priority:** High  
**Dependencies:** Task 1

**Current Interface:**

```typescript
export interface Order {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  order_type: string;
  sku: string | null;
  material: string | null;
  color: string | null;
  stone_status: 'NA' | 'Ordered' | 'In Stock';
  permit_status: 'form_sent' | 'customer_completed' | 'pending' | 'approved';
  proof_status: 'NA' | 'Not_Received' | 'Received' | 'In_Progress' | 'Lettered';
  deposit_date: string | null;
  second_payment_date: string | null;
  due_date: string | null;
  installation_date: string | null;
  location: string | null;
  value: number | null;
  progress: number;
  assigned_to: string | null;
  priority: 'low' | 'medium' | 'high';
  timeline_weeks: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**Updated Interface:**

```typescript
export interface Order {
  id: string;
  invoice_id: string | null;  // ADD THIS LINE
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  order_type: string;
  sku: string | null;
  material: string | null;
  color: string | null;
  stone_status: 'NA' | 'Ordered' | 'In Stock';
  permit_status: 'form_sent' | 'customer_completed' | 'pending' | 'approved';
  proof_status: 'NA' | 'Not_Received' | 'Received' | 'In_Progress' | 'Lettered';
  deposit_date: string | null;
  second_payment_date: string | null;
  due_date: string | null;
  installation_date: string | null;
  location: string | null;
  value: number | null;
  progress: number;
  assigned_to: string | null;
  priority: 'low' | 'medium' | 'high';
  timeline_weeks: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**Purpose:** TypeScript type alignment with database schema

**Note:** `OrderInsert` and `OrderUpdate` types will automatically include `invoice_id` since they're derived from `Order`:
- `OrderInsert` will have `invoice_id: string | null` (optional in inserts)
- `OrderUpdate` will have `invoice_id?: string | null` (optional in updates)

---

## Task 3: Validate Migration and Build

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** Tasks 1-2

**Validation Steps:**

1. **TypeScript Compilation:**
   ```bash
   npm run build
   ```
   - Verify no TypeScript errors
   - Verify all imports resolve correctly
   - Verify type definitions match database schema

2. **Linting:**
   ```bash
   npm run lint
   ```
   - Verify no linting errors introduced

3. **Manual Type Checks:**
   - Verify `Order` interface includes `invoice_id: string | null`
   - Verify `OrderInsert` and `OrderUpdate` types include `invoice_id` (auto-derived)
   - Verify existing Order-related code still compiles

4. **Database Schema Verification:**
   - Verify migration was applied successfully (check Supabase dashboard or query)
   - Verify `invoice_id` column exists in `orders` table
   - Verify foreign key constraint exists: `orders.invoice_id` → `invoices.id`
   - Verify index `idx_orders_invoice_id` exists
   - Verify column is nullable (allows NULL values)
   - Verify `invoices.order_id` still exists (backward compatibility check)

5. **Backward Compatibility Check:**
   - Verify existing queries still work (they should, since column is nullable)
   - Verify no existing code breaks due to type changes (nullable addition is safe)
   - Test that orders can be created/updated without `invoice_id` (should work)

6. **Foreign Key Constraint Test:**
   - Attempt to set invalid `invoice_id` (should fail with foreign key error)
   - Verify valid `invoice_id` can be set (should succeed)
   - Test cascade behavior: Delete invoice with referenced order (should set `order.invoice_id` to null)

**Expected Outcome:**
- ✅ Build succeeds without errors
- ✅ No linting errors
- ✅ All types are correctly defined
- ✅ Database schema matches type definitions
- ✅ Existing functionality continues to work
- ✅ Migration is reversible

---

## File Summary

### Files to Create:
1. `supabase/migrations/YYYYMMDDHHmmss_add_invoice_id_to_orders.sql`

### Files to Modify:
1. `src/modules/orders/types/orders.types.ts` - Add `invoice_id` to `Order` interface

### Files NOT Modified (Confirmation):
- ❌ No UI components touched
- ❌ No API functions modified (existing functions will automatically work with new column)
- ❌ No hooks modified
- ❌ No invoicing module files modified
- ❌ No migrations for `invoices` table (keeping `invoices.order_id` as-is)

---

## Safety Considerations

### Data Safety
- **No data modification:** All existing order records will have `invoice_id = null` after migration
- **No data loss:** Rollback simply removes the column; no existing data is touched
- **No breaking changes:** Nullable column addition is backward-compatible

### Backward Compatibility
- Existing queries continue to work (new column is nullable, ignored if not selected)
- Existing API functions continue to work (Supabase client automatically includes new columns)
- Existing UI components continue to work (they don't reference `invoice_id` yet)
- `invoices.order_id` relationship remains intact (both directions can coexist)

### Rollback Safety
- **Immediate rollback (before data population):** Safe, no side effects
- **Rollback after data population:** Safe, but any populated `invoice_id` values will be lost
- **No cascade effects:** Dropping the column does not affect other tables or relationships

### Testing Recommendations
1. Test on development/staging database first
2. Verify migration runs successfully
3. Verify rollback works if needed
4. Test existing Order CRUD operations still work
5. Test TypeScript compilation and type checking
6. Verify no runtime errors in existing UI

---

## What NOT to Do

- ❌ Do NOT remove `invoices.order_id` column (keep for backward compatibility)
- ❌ Do NOT make `invoice_id` NOT NULL (keep nullable for now)
- ❌ Do NOT populate existing orders with `invoice_id` values (out of scope)
- ❌ Do NOT modify UI components or add invoice displays
- ❌ Do NOT add new query functions (optional, defer to future phase)
- ❌ Do NOT modify RLS policies
- ❌ Do NOT add triggers or database functions
- ❌ Do NOT change existing API function signatures
- ❌ Do NOT modify invoicing module

---

## Success Criteria

- ✅ Migration file created and follows naming convention
- ✅ Migration adds nullable `invoice_id` column to `orders` table
- ✅ Foreign key constraint `orders.invoice_id` → `invoices.id` is active
- ✅ Index `idx_orders_invoice_id` exists on `orders.invoice_id`
- ✅ TypeScript `Order` interface includes `invoice_id: string | null`
- ✅ `npm run build` succeeds without errors
- ✅ `npm run lint` passes without errors
- ✅ All existing queries and operations continue to work
- ✅ `invoices.order_id` column still exists (backward compatibility)
- ✅ Migration is reversible via rollback SQL
- ✅ No UI or behavior changes

---

## Implementation Notes

### Migration Timestamp Format
Use UTC timestamp format: `YYYYMMDDHHmmss`
Example: `20250118120000` for January 18, 2025, 12:00:00 UTC

### Column Placement
The `invoice_id` field can be added anywhere in the interface, but for clarity, place it near the top after `id`:
```typescript
export interface Order {
  id: string;
  invoice_id: string | null;  // New field
  customer_name: string;
  // ... rest of fields
}
```

### Testing Foreign Key Constraint
After migration, you can test the constraint:
```sql
-- This should fail (invalid invoice_id):
update orders set invoice_id = '00000000-0000-0000-0000-000000000000' where id = '<some-order-id>';

-- This should succeed (valid invoice_id):
update orders set invoice_id = '<valid-invoice-id>' where id = '<some-order-id>';

-- Test cascade: Delete invoice, verify order.invoice_id becomes null
delete from invoices where id = '<invoice-id>';
select invoice_id from orders where id = '<order-id>';  -- Should be null
```

---

## Rollback Procedure

If the migration needs to be rolled back:

1. **Stop any running applications** that might be using the new column

2. **Execute rollback SQL:**
   ```sql
   -- Drop the index first
   drop index if exists public.idx_orders_invoice_id;
   
   -- Drop the column (this will also drop the foreign key constraint)
   alter table public.orders drop column if exists invoice_id;
   ```

3. **Revert TypeScript changes:**
   - Remove `invoice_id: string | null;` from `Order` interface in `src/modules/orders/types/orders.types.ts`

4. **Verify rollback:**
   - Run `npm run build` to ensure TypeScript compiles
   - Verify no references to `invoice_id` remain in codebase
   - Verify database schema no longer has the column

5. **Test existing functionality:**
   - Verify orders can still be created, read, updated, deleted
   - Verify existing queries still work

**Rollback Safety:** This rollback is safe and will not cause data loss, as the column is additive only and contains no critical data at this stage.

