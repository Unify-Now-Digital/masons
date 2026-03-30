# Implementation Plan: Fix Invoicing List Missing order_id

**Branch:** `feature/fix-invoicing-list-missing-order-id`  
**Specification:** `specs/fix-invoicing-list-missing-order-id.md`

---

## Overview

This implementation plan fixes the issue where `order_id` is missing from invoice data at runtime, causing CustomerDetailsPopover to always show "Unlinked" even when invoices are linked to orders. The root cause is likely in the transform function not handling `undefined` values correctly.

**Goal:**
- Fix invoice transform to defensively handle `undefined` for `order_id`
- Ensure `orderId` in UIInvoice is always `string | null` (never `undefined`)
- Verify invoice query returns `order_id` (add explicit select if needed)
- Add runtime validation to diagnose any remaining issues

**Constraints:**
- No database schema changes
- Backward compatible (no breaking changes)
- Keep lazy loading behavior
- No regressions in existing functionality

---

## Phase 1 — Fix Invoice Transform (Primary Fix)

### Task 1.1: Update transformInvoiceForUI to Handle Undefined

**File:** `src/modules/invoicing/utils/invoiceTransform.ts`

**Description:**
Update the transform function to defensively handle `undefined` for `order_id` using nullish coalescing.

**Current State:**
```typescript
orderId: invoice.order_id,  // Might be undefined if field is missing
```

**Changes:**
```typescript
orderId: invoice.order_id ?? null,  // Always string | null, never undefined
```

**Validation:**
- Transform handles `undefined` correctly
- `orderId` is always `string | null`
- Type matches UIInvoice interface

---

### Task 1.2: Verify UIInvoice Type

**File:** `src/modules/invoicing/utils/invoiceTransform.ts`

**Description:**
Verify UIInvoice type ensures `orderId` is `string | null` (not `string | null | undefined`).

**Current State:**
```typescript
export interface UIInvoice {
  orderId: string | null;  // Should be correct
  // ... other fields
}
```

**Changes:**
- Verify type is `string | null` (not including `undefined`)
- Add comment if needed to clarify nullish coalescing

**Validation:**
- Type is correct
- No `undefined` in type definition

---

## Phase 2 — Verify Invoice List Query (Safety Net)

### Task 2.1: Verify Query Returns order_id

**File:** `src/modules/invoicing/api/invoicing.api.ts`

**Description:**
Verify that `fetchInvoices` query actually returns `order_id` field.

**Current State:**
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

**Changes:**
- If `select('*')` doesn't work, switch to explicit select
- Add explicit `order_id` to select list
- Or verify `select('*')` actually includes `order_id`

**Option A (Keep select('*')):**
- Verify no view/RPC strips `order_id`
- Add comment confirming `order_id` is included

**Option B (Explicit select):**
```typescript
.select('id, order_id, invoice_number, customer_name, amount, status, due_date, issue_date, payment_method, payment_date, notes, created_at, updated_at')
```

**Validation:**
- Query includes `order_id` field
- Response contains `order_id` for invoices that have it

---

### Task 2.2: Add Runtime Validation (DEV only)

**File:** `src/modules/invoicing/utils/invoiceTransform.ts` or `src/modules/invoicing/pages/InvoicingPage.tsx`

**Description:**
Add DEV-only runtime validation to log if `order_id` is missing from invoice data.

**Changes:**
```typescript
// In transformInvoicesForUI or InvoicingPage
if (import.meta.env.DEV && invoicesData && invoicesData.length > 0) {
  const firstInvoice = invoicesData[0];
  if (!('order_id' in firstInvoice)) {
    console.warn('[Invoicing] order_id missing from invoice data:', firstInvoice);
  }
  if (firstInvoice.order_id === undefined) {
    console.warn('[Invoicing] order_id is undefined (should be null or string):', firstInvoice);
  }
}
```

**Validation:**
- Validation only runs in DEV mode
- Logs warning if `order_id` is missing
- Helps diagnose query vs transform issues

---

## Phase 3 — Testing & Validation

### Task 3.1: Test Transform with Various Inputs

**Description:**
Test transform function with different `order_id` values.

**Test Scenarios:**
- [ ] Invoice with `order_id: string` → `orderId` should be string
- [ ] Invoice with `order_id: null` → `orderId` should be null
- [ ] Invoice with `order_id: undefined` → `orderId` should be null (not undefined)
- [ ] Invoice without `order_id` property → `orderId` should be null

**Validation:**
- All scenarios handled correctly
- `orderId` is never `undefined`

---

### Task 3.2: Test with Invoice That Has order_id

**Description:**
Test Invoicing popover with invoice that has `order_id` linked to order with person_id.

**Test Scenarios:**
- [ ] Open invoice popover
- [ ] Verify DEV debug shows non-null orderId
- [ ] Verify order query fires (check Network tab)
- [ ] Verify "Linked" badge shows
- [ ] Verify full customer details appear

**Validation:**
- Popover shows "Linked" when invoice has order_id with person_id
- Full customer details displayed

---

### Task 3.3: Test with Invoice Without order_id

**Description:**
Test Invoicing popover with invoice that has no `order_id`.

**Test Scenarios:**
- [ ] Open invoice popover
- [ ] Verify DEV debug shows null orderId (not undefined)
- [ ] Verify "Unlinked" badge shows
- [ ] Verify no unnecessary queries

**Validation:**
- Popover shows "Unlinked" correctly
- No errors or crashes

---

### Task 3.4: Build & Lint Validation

**Description:**
Verify build and lint pass.

**Validation:**
- Build passes (`npm run build`)
- Lint passes (`npm run lint`)
- No TypeScript errors
- No console warnings (except DEV validation logs)

---

## Deliverables

- ✅ Invoice transform handles `undefined` for `order_id`
- ✅ `orderId` in UIInvoice is always `string | null` (never `undefined`)
- ✅ Invoice query verified to include `order_id` (or fixed to include it)
- ✅ Runtime validation added (DEV only)
- ✅ Invoicing popover shows "Linked" when invoice has `order_id` with person_id
- ✅ Full customer details displayed
- ✅ No regressions in existing functionality
- ✅ Build + lint pass

---

## Success Criteria

- Invoice transform correctly handles `undefined` → `null` for `order_id`
- `orderId` is always `string | null` (never `undefined`)
- Invoice query includes `order_id` field
- Invoicing popover shows "Linked" when invoice has order_id with person_id
- Full customer details displayed (phone, email, address)
- No regressions in existing functionality
- Build + lint pass
- No runtime crashes

