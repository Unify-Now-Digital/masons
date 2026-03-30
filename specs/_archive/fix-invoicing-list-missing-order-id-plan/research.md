# Research: Fix Invoicing List Missing order_id

## Problem Analysis

### Current State
- CustomerDetailsPopover logic is correct (verified in previous fix)
- DEV debug shows `orderId: null` for all invoices
- Invoice query uses `select('*')` which should include `order_id`
- Transform maps `orderId: invoice.order_id` (line 37)
- Issue: `order_id` is not present in data at runtime

### Root Cause Hypotheses

1. **Transform Not Handling Undefined:**
   - **Status:** MOST LIKELY
   - Transform assumes `invoice.order_id` exists
   - If field is missing, `invoice.order_id` is `undefined`
   - `undefined` is not handled, might become `undefined` in UIInvoice
   - **Fix:** Use nullish coalescing `?? null`

2. **Type Assertion Hiding Missing Fields:**
   - **Status:** POSSIBLE
   - Query uses `as Invoice[]` type assertion
   - If Supabase doesn't return `order_id`, TypeScript won't catch it
   - Runtime data might be missing `order_id` field
   - **Fix:** Add runtime validation

3. **Supabase Query Issue:**
   - **Status:** UNLIKELY
   - `select('*')` should include all fields
   - RLS policies might filter out `order_id` (unlikely)
   - View or RPC might strip `order_id` (not used)
   - **Fix:** Use explicit select if needed

4. **Null vs Undefined:**
   - **Status:** LIKELY
   - Database returns `null` for missing values
   - TypeScript might see `undefined` if field is missing
   - Transform needs to handle both
   - **Fix:** Use nullish coalescing `?? null`

---

## Technical Decisions

### 1. Nullish Coalescing in Transform

**Decision:** Use `invoice.order_id ?? null` in transform

**Rationale:**
- Handles both `null` and `undefined`
- Ensures `orderId` is always `string | null`
- Prevents `undefined` from propagating to UI
- Simple and defensive

**Implementation:**
```typescript
orderId: invoice.order_id ?? null,
```

**Alternatives Considered:**
- `orderId: invoice.order_id || null` (rejected: treats empty string as null)
- `orderId: invoice.order_id !== undefined ? invoice.order_id : null` (rejected: more verbose)
- Type guard (rejected: overkill for this case)

---

### 2. Explicit Select vs select('*')

**Decision:** Keep `select('*')` but add validation

**Rationale:**
- `select('*')` should work and is simpler
- Explicit select is more verbose and harder to maintain
- Add validation to catch if `select('*')` doesn't work
- Can switch to explicit select if validation shows issue

**Implementation:**
- Keep `select('*')`
- Add DEV-only validation to check if `order_id` is present
- Switch to explicit select only if validation fails

**Alternatives Considered:**
- Switch to explicit select immediately (rejected: unnecessary if `select('*')` works)
- Remove validation (rejected: helpful for debugging)

---

### 3. Runtime Validation

**Decision:** Add DEV-only validation to diagnose issues

**Rationale:**
- Helps identify if query or transform is the issue
- Only runs in DEV mode (no production overhead)
- Logs warnings for missing or undefined `order_id`
- Helps with future debugging

**Implementation:**
```typescript
if (import.meta.env.DEV && invoicesData && invoicesData.length > 0) {
  const firstInvoice = invoicesData[0];
  if (!('order_id' in firstInvoice)) {
    console.warn('[Invoicing] order_id missing from invoice data');
  }
  if (firstInvoice.order_id === undefined) {
    console.warn('[Invoicing] order_id is undefined');
  }
}
```

---

## Constraints

### Performance
- **No prefetching:** Must not fetch orders/persons on page load
- **Lazy loading:** Only fetch when popover opens
- **Validation overhead:** Only in DEV mode

### Development
- **Runtime validation:** Must be guarded (DEV only)
- **No breaking changes:** All existing functionality must work
- **Type safety:** Ensure TypeScript types are correct

### Data Model
- **No schema changes:** Must not modify database
- **Use existing relationships:** Invoice → Order → Person
- **Handle null/undefined:** Transform must handle both

---

## Open Questions Resolved

1. **Why is order_id missing?**
   - **Answer:** Most likely transform not handling `undefined`
   - **Action:** Use nullish coalescing in transform

2. **Should we use explicit select?**
   - **Answer:** Keep `select('*')` but add validation
   - **Action:** Add DEV-only validation, switch if needed

3. **How to handle undefined vs null?**
   - **Answer:** Use nullish coalescing `?? null`
   - **Action:** Update transform to use `?? null`

---

## References

- Invoice Transform: `src/modules/invoicing/utils/invoiceTransform.ts`
- Invoice API: `src/modules/invoicing/api/invoicing.api.ts`
- Invoice Types: `src/modules/invoicing/types/invoicing.types.ts`
- CustomerDetailsPopover: `src/shared/components/customer/CustomerDetailsPopover.tsx`
- Previous fix: `specs/fix-invoicing-popover-unlinked-implementation-plan.md`

