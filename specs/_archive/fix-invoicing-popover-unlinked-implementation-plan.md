# Implementation Plan: Fix Invoicing Customer Popover Still Showing Unlinked

**Branch:** `feature/fix-invoicing-popover-unlinked`  
**Specification:** `specs/fix-invoicing-popover-unlinked.md`

---

## Overview

This implementation plan fixes the issue where the Invoicing CustomerDetailsPopover still shows "Unlinked" badge and no customer details after implementing orderId → personId derivation. The build passes, indicating this is a runtime data/mapping issue that needs diagnosis and fixing.

**Goal:**
- Audit invoice query to ensure `order_id` is selected
- Add DEV-only debug visibility to diagnose runtime values
- Fix any field name inconsistencies or data mapping issues
- Ensure popover shows "Linked" and full customer details when invoice has order_id with person_id

**Constraints:**
- No database schema changes
- Keep lazy loading behavior (no prefetching)
- DEV debug must be guarded (not ship to production)
- No regressions in Orders module

---

## Phase 1 — Audit Data Plumbing (Invoice → UIInvoice → Popover props)

### Task 1.1: Verify Invoice Query Includes order_id

**File:** `src/modules/invoicing/api/invoicing.api.ts`

**Description:**
Verify that `fetchInvoices` query selects `order_id` field from the database.

**Current State:**
- Need to check if query uses `select('*')` or explicit field list
- If explicit, ensure `order_id` is included

**Changes:**
- If query doesn't select `order_id`, add it to the select
- Ensure query returns all necessary fields including `order_id`

**Validation:**
- Query includes `order_id` field
- Invoice type matches returned data structure

---

### Task 1.2: Verify Invoice Transform Mapping

**File:** `src/modules/invoicing/utils/invoiceTransform.ts`

**Description:**
Verify that transform correctly maps `order_id` → `orderId` in UIInvoice.

**Current State:**
- Transform function: `orderId: invoice.order_id` (line 37)
- Should be correct, but verify at runtime

**Changes:**
- Verify mapping is correct
- Ensure `orderId` is not undefined when `order_id` exists

**Validation:**
- Transform correctly maps `order_id` → `orderId`
- UIInvoice has `orderId` field when invoice has `order_id`

---

### Task 1.3: Verify Call Sites Pass Correct Props

**Files:**
- `src/modules/invoicing/pages/InvoicingPage.tsx`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
Verify both components pass the correct `orderId` prop to CustomerDetailsPopover.

**Current State:**
- InvoicingPage: `orderId={invoice.orderId || null}` (uses UIInvoice.orderId)
- InvoiceDetailSidebar: `orderId={invoice.order_id || null}` (uses Invoice.order_id)

**Changes:**
- Verify both are correct based on their invoice type
- Ensure consistent usage

**Validation:**
- InvoicingPage passes `invoice.orderId` (from UIInvoice)
- InvoiceDetailSidebar passes `invoice.order_id` (from Invoice)
- Both work correctly

---

## Phase 2 — Add DEV-only Debug Visibility (Fast Diagnosis)

### Task 2.1: Add DEV Debug Section to CustomerDetailsPopover

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Add DEV-only debug block that displays runtime values for diagnosis.

**Changes:**
```typescript
// Add after Messages section, before closing CardContent
{import.meta.env.DEV && (
  <CardContent className="pt-0 border-t">
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-muted-foreground">Debug (DEV only)</h4>
      <div className="text-xs font-mono space-y-0.5 text-muted-foreground">
        <div>orderId: {orderId ?? 'null'}</div>
        <div>orderPersonId: {orderPersonId ?? 'null'}</div>
        <div>resolvedPersonId: {resolvedPersonId ?? 'null'}</div>
        <div>personId prop: {personId ?? 'null'}</div>
        <div>open: {open ? 'true' : 'false'}</div>
        <div>isResolvingOrder: {isResolvingOrder ? 'true' : 'false'}</div>
        <div>isFetchingPerson: {isFetchingPerson ? 'true' : 'false'}</div>
      </div>
    </div>
  </CardContent>
)}
```

**Validation:**
- Debug section only visible in DEV mode
- Shows all relevant runtime values
- Styled subtly (muted colors, monospace font)
- Placed after Messages section

---

### Task 2.2: Add DEV Console Logging

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Add console.debug logging when popover opens (DEV only).

**Changes:**
```typescript
// Add useEffect to log when popover opens
useEffect(() => {
  if (import.meta.env.DEV && open) {
    console.debug('[CustomerDetailsPopover] Opened:', {
      orderId,
      personId,
      orderPersonId,
      resolvedPersonId,
      isResolvingOrder,
      isFetchingPerson,
    });
  }
}, [open, orderId, personId, orderPersonId, resolvedPersonId, isResolvingOrder, isFetchingPerson]);
```

**Validation:**
- Logging only in DEV mode
- Logs when popover opens
- Includes all relevant values
- Helps diagnose runtime issues

---

## Phase 3 — Fix Identified Root Cause

### Task 3.1: Fix Invoice Query (if order_id missing)

**File:** `src/modules/invoicing/api/invoicing.api.ts`

**Description:**
If invoice query doesn't select `order_id`, add it.

**Changes:**
- If query uses `select('*')`, it should include `order_id` automatically
- If query uses explicit field list, add `order_id` to the list
- Ensure query returns complete invoice data

**Validation:**
- Query includes `order_id` field
- Invoice type matches returned data

---

### Task 3.2: Fix Field Name Consistency (if needed)

**Files:**
- `src/modules/invoicing/utils/invoiceTransform.ts`
- `src/modules/invoicing/pages/InvoicingPage.tsx`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
If field name mismatch is identified, fix it consistently.

**Changes:**
- Ensure consistent usage of `orderId` (camelCase) in UIInvoice
- Ensure consistent usage of `order_id` (snake_case) in Invoice type
- Update any mismatches

**Validation:**
- Field names consistent across codebase
- Transform correctly maps between formats

---

### Task 3.3: Fix Query Enable Condition (if needed)

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
If query enable condition is wrong, fix it.

**Current State:**
```typescript
const { data: orderPersonId, isLoading: isResolvingOrder } = useOrderPersonId(
  orderId || null,
  { enabled: open && !!orderId }
);
```

**Changes:**
- Verify `enabled` condition is correct
- Ensure query fires when popover opens and orderId exists
- Ensure resolvedPersonId recomputes when orderPersonId arrives

**Validation:**
- Query enabled when popover opens and orderId exists
- Query disabled when popover closed or orderId is null
- ResolvedPersonId updates when orderPersonId changes

---

## Phase 4 — Testing & Validation

### Task 4.1: Test with Invoice That Has order_id

**Description:**
Test popover with invoice that has order_id linked to order with person_id.

**Test Scenarios:**
- [ ] Open invoice popover
- [ ] Verify DEV debug shows non-null orderId
- [ ] Verify order query fires (check Network tab)
- [ ] Verify orderPersonId becomes non-null after fetch
- [ ] Verify resolvedPersonId becomes non-null
- [ ] Verify person query fires
- [ ] Verify "Linked" badge shows
- [ ] Verify phone/email/address appear
- [ ] Verify "Open Person" button visible

**Validation:**
- All scenarios pass
- Popover shows full customer details
- Badge shows "Linked"

---

### Task 4.2: Test with Invoice Without order_id

**Description:**
Test popover with invoice that has no order_id.

**Test Scenarios:**
- [ ] Open invoice popover
- [ ] Verify DEV debug shows null orderId
- [ ] Verify no order query fires
- [ ] Verify "Unlinked" badge shows
- [ ] Verify only customer name appears (no phone/email)
- [ ] Verify "Open Person" button NOT visible

**Validation:**
- All scenarios pass
- Popover shows "Unlinked" correctly
- No unnecessary queries

---

### Task 4.3: Verify Lazy Loading

**Description:**
Verify lazy loading still works (no prefetching).

**Test Scenarios:**
- [ ] Open Invoicing page
- [ ] Verify no order/person queries on page load (check Network tab)
- [ ] Open invoice popover
- [ ] Verify order query fires only when popover opens
- [ ] Verify person query fires only after order.person_id resolved
- [ ] Close and reopen same popover
- [ ] Verify cached results used (no new queries)

**Validation:**
- Lazy loading works correctly
- No prefetching
- Caching works

---

### Task 4.4: Verify DEV Debug

**Description:**
Verify DEV debug is visible in development and hidden in production.

**Test Scenarios:**
- [ ] Open invoice popover in DEV mode
- [ ] Verify debug section visible
- [ ] Verify values are correct
- [ ] Build production bundle
- [ ] Verify debug section NOT visible in production

**Validation:**
- Debug visible in DEV
- Debug hidden in production
- Values are accurate

---

### Task 4.5: Regression Check - Orders Module

**Description:**
Verify Orders module popover still works correctly.

**Test Scenarios:**
- [ ] Open Orders page
- [ ] Click customer name in Orders table
- [ ] Verify popover shows "Linked" when person_id exists
- [ ] Verify full customer details appear
- [ ] Verify no order queries fired (Orders uses personId directly)

**Validation:**
- Orders module works correctly
- No regressions

---

### Task 4.6: Build & Lint Validation

**Description:**
Verify build and lint pass.

**Validation:**
- Build passes (`npm run build`)
- Lint passes (`npm run lint`)
- No TypeScript errors
- No console warnings (except DEV debug logs)

---

## Deliverables

- ✅ Invoice query includes `order_id` field
- ✅ Transform correctly maps `order_id` → `orderId`
- ✅ Both InvoicingPage and InvoiceDetailSidebar pass correct orderId prop
- ✅ DEV-only debug section in CustomerDetailsPopover
- ✅ DEV-only console logging
- ✅ Any identified root cause fixed
- ✅ Invoicing popover shows "Linked" when invoice has order_id with person_id
- ✅ Full customer details displayed
- ✅ Lazy loading preserved
- ✅ No regressions in Orders module
- ✅ Build + lint pass

---

## Success Criteria

- Invoicing popover shows "Linked" when invoice has order_id with person_id
- Full customer details displayed (phone, email, address)
- DEV debug helps identify any remaining issues
- Lazy loading still works (no prefetching)
- No regressions in Orders module
- All existing functionality preserved
- Build + lint pass
- No runtime crashes

