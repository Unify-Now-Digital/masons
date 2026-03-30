# Fix Invoicing List Data Missing order_id (Required for Customer Popover)

## Overview

CustomerDetailsPopover in Invoicing always shows "Unlinked" because `orderId` is null at runtime, even when invoices are linked to orders. DEV debug confirms that `orderId` prop is null, indicating the invoice data used in the Invoicing list/table does not include `order_id` at runtime.

**Context:**
- CustomerDetailsPopover logic is correct (verified in previous fix)
- DEV debug shows `orderId: null` for all invoices
- Invoice query uses `select('*')` which should include `order_id`
- Transform maps `orderId: invoice.order_id` (line 37)
- Issue is that `order_id` is not present in the data at runtime

**Goal:**
- Ensure `order_id` is selected from Supabase and preserved through the data flow
- Fix invoice transform to correctly map `order_id` → `orderId`
- Ensure `orderId` is available on each invoice row rendered in InvoicingPage
- So `orderId` passed to CustomerDetailsPopover is non-null when invoice is linked to an order

---

## Current State Analysis

### Invoice Schema

**Table:** `public.invoices`

**Relevant Fields:**
- `id uuid pk`
- `order_id uuid null` - FK to orders table (snake_case in DB)
- `customer_name text not null` - Customer name snapshot
- Other invoice fields...

**Observations:**
- Database has `order_id` field
- Field is nullable (can be null)
- Query uses `select('*')` which should include all fields

### Invoice Type Definition

**File:** `src/modules/invoicing/types/invoicing.types.ts`

**Current Structure:**
```typescript
export interface Invoice {
  id: string;
  order_id: string | null;  // Present in type definition
  invoice_number: string;
  customer_name: string;
  // ... other fields
}
```

**Observations:**
- Type includes `order_id: string | null`
- Type matches database schema

### Invoice Query

**File:** `src/modules/invoicing/api/invoicing.api.ts`

**Current Query:**
```typescript
export async function fetchInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')  // Should include order_id
    .order('created_at', { ascending: false});
  
  if (error) throw error;
  return data as Invoice[];
}
```

**Observations:**
- Query uses `select('*')` which should include `order_id`
- Returns `Invoice[]` type
- No explicit field filtering

### Invoice Transform

**File:** `src/modules/invoicing/utils/invoiceTransform.ts`

**Current Transform:**
```typescript
export function transformInvoiceForUI(invoice: Invoice): UIInvoice {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    orderId: invoice.order_id,  // Maps order_id → orderId
    // ... other fields
  };
}
```

**Observations:**
- Transform maps `orderId: invoice.order_id` (line 37)
- Should preserve `order_id` value
- Uses camelCase `orderId` in UIInvoice

### Relationship Analysis

**Current Relationship:**
- Invoice → Order: `invoices.order_id` → `orders.id` (optional FK)
- Data flow: DB → Invoice type → Transform → UIInvoice → Component props

**Gaps/Issues:**
- `order_id` might be missing from Supabase response even with `select('*')`
- Transform might receive `undefined` instead of `null` for `order_id`
- Type assertion `as Invoice[]` might hide missing fields
- Runtime data might not match type definition

### Data Access Patterns

**How Invoices are Currently Fetched:**
- `fetchInvoices()` uses `select('*')`
- Returns `Invoice[]` (type assertion)
- No explicit field validation

**How Invoices are Transformed:**
- `transformInvoicesForUI()` maps `Invoice[]` → `UIInvoice[]`
- Maps `orderId: invoice.order_id`
- No null/undefined handling

**How They Are Used in UI:**
- InvoicingPage uses `uiInvoices` from transform
- Passes `orderId={invoice.orderId || null}` to CustomerDetailsPopover
- If `orderId` is undefined, it becomes null

---

## Root Cause Analysis

### Suspected Issues

1. **Type Assertion Hiding Missing Fields:**
   - Query uses `as Invoice[]` type assertion
   - If Supabase doesn't return `order_id`, TypeScript won't catch it
   - Runtime data might be missing `order_id` field

2. **Transform Not Handling Undefined:**
   - Transform assumes `invoice.order_id` exists
   - If field is missing, `invoice.order_id` is `undefined`
   - `undefined` might not be handled correctly

3. **Supabase Query Issue:**
   - `select('*')` should include all fields, but might not
   - RLS policies might filter out `order_id`
   - View or RPC might strip `order_id`

4. **Null vs Undefined:**
   - Database returns `null` for missing values
   - TypeScript might see `undefined` if field is missing
   - Transform needs to handle both

---

## Recommended Solution

### 1. Explicitly Select order_id in Query

**Change:**
- Add explicit `order_id` to select (even if using `*`)
- Or verify `select('*')` actually includes `order_id`
- Add defensive check to ensure field is present

**Implementation:**
```typescript
export async function fetchInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, order_id')  // Explicitly include order_id
    .order('created_at', { ascending: false});
  
  if (error) throw error;
  return data as Invoice[];
}
```

**Alternative:**
- Keep `select('*')` but add validation
- Log warning if `order_id` is missing from response

### 2. Fix Transform to Handle Undefined

**Change:**
- Ensure transform handles `undefined` for `order_id`
- Use nullish coalescing: `invoice.order_id ?? null`
- Ensure `orderId` is always `string | null`, never `undefined`

**Implementation:**
```typescript
export function transformInvoiceForUI(invoice: Invoice): UIInvoice {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    orderId: invoice.order_id ?? null,  // Handle undefined
    // ... other fields
  };
}
```

### 3. Add Runtime Validation

**Change:**
- Add console warning in DEV mode if `order_id` is missing
- Log first invoice to verify data structure
- Help diagnose if query or transform is the issue

**Implementation:**
```typescript
// In transformInvoicesForUI or InvoicingPage
if (import.meta.env.DEV && invoicesData && invoicesData.length > 0) {
  const firstInvoice = invoicesData[0];
  if (!('order_id' in firstInvoice)) {
    console.warn('[Invoicing] order_id missing from invoice data:', firstInvoice);
  }
}
```

---

## Implementation Approach

### Phase 1: Fix Transform to Handle Undefined

1. **Update transformInvoiceForUI:**
   - Change `orderId: invoice.order_id` to `orderId: invoice.order_id ?? null`
   - Ensure `orderId` is never `undefined`
   - Add comment explaining nullish coalescing

2. **Verify UIInvoice type:**
   - Ensure `orderId: string | null` (not `string | null | undefined`)
   - Type should match transform output

### Phase 2: Verify Query Returns order_id

1. **Add explicit select (if needed):**
   - If `select('*')` doesn't work, use explicit field list
   - Include `order_id` explicitly

2. **Add runtime validation:**
   - Log invoice data structure in DEV mode
   - Verify `order_id` is present in response
   - Help diagnose if query is the issue

### Phase 3: Testing & Validation

1. **Test with invoice that has order_id:**
   - Verify `orderId` is non-null in UIInvoice
   - Verify popover receives non-null `orderId`
   - Verify "Linked" badge shows

2. **Test with invoice without order_id:**
   - Verify `orderId` is null (not undefined)
   - Verify popover handles null correctly
   - Verify "Unlinked" badge shows

---

## What NOT to Do

- **Do NOT change database schema** (no migrations)
- **Do NOT remove lazy loading** (queries should only fire when popover opens)
- **Do NOT change CustomerDetailsPopover** (logic is correct)
- **Do NOT break existing functionality** (backward compatible)

---

## Open Questions / Considerations

1. **Why is order_id missing?**
   - Is it a Supabase query issue?
   - Is it a type assertion issue?
   - Is it a transform issue?
   - **Action:** Add runtime validation to diagnose

2. **Should we use explicit select?**
   - `select('*')` should work, but might not
   - Explicit select is more reliable
   - **Action:** Try explicit select if `select('*')` doesn't work

3. **How to handle undefined vs null?**
   - Database returns `null`, TypeScript might see `undefined`
   - Transform should normalize to `null`
   - **Action:** Use nullish coalescing `?? null`

---

## Acceptance Criteria

- ✅ Invoice transform handles `undefined` for `order_id`
- ✅ `orderId` in UIInvoice is always `string | null` (never `undefined`)
- ✅ Invoice query explicitly includes `order_id` (or verified to include it)
- ✅ Runtime validation confirms `order_id` is present in data
- ✅ Invoicing popover shows "Linked" when invoice has `order_id` with person_id
- ✅ Full customer details displayed (phone, email, address)
- ✅ No regressions in existing functionality
- ✅ Build + lint pass
- ✅ No runtime crashes

---

## Success Metrics

- Invoicing popover shows "Linked" when invoice has order_id with person_id
- Full customer details displayed (phone, email, address)
- `orderId` is non-null in UIInvoice when invoice has `order_id`
- Transform correctly handles both `null` and `undefined`
- No regressions in existing functionality
- All existing functionality preserved

---

## Future Considerations

- **Remove runtime validation:**
  - After issue is resolved and verified
  - Or keep it guarded behind DEV flag for future troubleshooting

- **Add type guards:**
  - Validate invoice data structure at runtime
  - Catch missing fields early
  - Show user-friendly error messages

- **Add unit tests:**
  - Test transform with missing `order_id`
  - Test transform with `null` `order_id`
  - Test transform with `undefined` `order_id`

