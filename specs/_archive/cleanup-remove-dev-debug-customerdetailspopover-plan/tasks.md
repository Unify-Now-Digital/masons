# Tasks: Cleanup Remove DEV-only Debug Section from CustomerDetailsPopover

## Phase 1: Remove Debug Code

### Task 1.1: Remove console.debug useEffect
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`  
**Status:** ✅ Completed

**Changes:**
1. Delete the `useEffect` hook (lines 80-96)
2. Remove `useEffect` from React imports (line 1)

**Before:**
```typescript
import React, { useState, useEffect } from 'react';

// ... component code ...

// DEV-only console logging when popover opens
useEffect(() => {
  if (import.meta.env.DEV && open) {
    console.debug('[CustomerDetailsPopover] Opened:', {
      invoiceId,
      orderId,
      personId,
      invoicePersonIds,
      orderPersonId,
      resolvedPersonId,
      linkState,
      isResolvingInvoice,
      isResolvingOrder,
      isFetchingPerson,
    });
  }
}, [open, invoiceId, orderId, personId, invoicePersonIds, orderPersonId, resolvedPersonId, linkState, isResolvingInvoice, isResolvingOrder, isFetchingPerson]);
```

**After:**
```typescript
import React, { useState } from 'react';

// ... component code ...
// (useEffect removed)
```

**Acceptance Criteria:**
- `useEffect` hook removed
- `useEffect` removed from React imports
- No console.debug output
- No TypeScript errors

---

### Task 1.2: Remove Visual Debug Section
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`  
**Status:** ✅ Completed

**Changes:**
- Delete the DEV-only debug CardContent section (lines 180-200)

**Before:**
```typescript
{/* DEV-only debug section */}
{import.meta.env.DEV && (
  <CardContent className="pt-0 border-t">
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-muted-foreground">Debug (DEV only)</h4>
      <div className="text-xs font-mono space-y-0.5 text-muted-foreground">
        <div>invoiceId: {invoiceId ?? 'null'}</div>
        <div>invoicePersonIds: {invoicePersonIds ? JSON.stringify(invoicePersonIds) : 'null'}</div>
        <div>orderId: {orderId ?? 'null'}</div>
        <div>orderPersonId: {orderPersonId ?? 'null'}</div>
        <div>resolvedPersonId: {resolvedPersonId ?? 'null'}</div>
        <div>personId prop: {personId ?? 'null'}</div>
        <div>linkState: {linkState}</div>
        <div>open: {open ? 'true' : 'false'}</div>
        <div>isResolvingInvoice: {isResolvingInvoice ? 'true' : 'false'}</div>
        <div>isResolvingOrder: {isResolvingOrder ? 'true' : 'false'}</div>
        <div>isFetchingPerson: {isFetchingPerson ? 'true' : 'false'}</div>
      </div>
    </div>
  </CardContent>
)}
```

**After:**
```typescript
// (debug section removed)
```

**Acceptance Criteria:**
- Debug section removed from JSX
- No visual debug UI in DEV or PROD
- No orphaned closing tags
- Component still renders correctly

---

## Phase 2: Validation

### Task 2.1: Build & Lint Validation
**Status:** ✅ Completed

**Commands:**
```bash
npm run build
npm run lint
```

**Acceptance Criteria:**
- Build passes without errors
- Lint passes without errors
- No TypeScript errors
- No unused imports

---

### Task 2.2: Functional Verification
**Status:** Pending

**Manual Testing:**
1. Open CustomerDetailsPopover in Orders module
   - Click customer name in Orders table
   - Verify popover opens and displays correctly
   - Verify Linked/Unlinked badge shows correctly
2. Open CustomerDetailsPopover in Invoicing module
   - Click customer name in Invoices table
   - Verify popover opens and displays correctly
   - Verify Linked/Unlinked/Multiple people badge shows correctly
3. Verify lazy loading
   - Check Network tab - no queries on page load
   - Open popover - queries fire only when opened
4. Verify no debug output
   - Check console - no debug logs
   - Check UI - no debug section visible

**Acceptance Criteria:**
- Component works correctly in both modules
- All states (Linked/Unlinked/Multiple) display correctly
- Lazy loading still works
- No debug output in console or UI

---

## Summary

**Total Tasks:** 4  
**Completed:** 3  
**Pending:** 1 (Manual testing: Task 2.2)

**Phases:**
- Phase 1: 2 tasks (Remove debug code)
- Phase 2: 2 tasks (Validation)

**Estimated Time:**
- Phase 1: 10 minutes
- Phase 2: 10 minutes
- **Total:** ~20 minutes

