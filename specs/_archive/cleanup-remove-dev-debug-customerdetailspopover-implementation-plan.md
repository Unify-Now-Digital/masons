# Implementation Plan: Cleanup Remove DEV-only Debug Section from CustomerDetailsPopover

## Feature Overview

Remove temporary DEV-only debug UI and console logging from `CustomerDetailsPopover` component. This is a straightforward cleanup task to remove diagnostic code that was added during development and is no longer needed.

**Branch:** `feature/cleanup-remove-dev-debug-customerdetailspopover`  
**Spec File:** `specs/cleanup-remove-dev-debug-customerdetailspopover.md`

---

## Technical Context

### Current State
- `CustomerDetailsPopover` contains DEV-only debug code:
  - Console debug logging via `useEffect` (lines 80-96)
  - Visual debug UI section (lines 180-200)
- Both are guarded with `import.meta.env.DEV` checks
- Debug code was useful during development but is no longer needed

### Key Files
- `src/shared/components/customer/CustomerDetailsPopover.tsx` - Remove debug code

### Constraints
- No behavior changes
- No schema changes
- No breaking changes
- Pure cleanup task

---

## Implementation Phases

### Phase 1: Remove Debug Code

**Goal:** Remove all DEV-only debug code from the component.

#### Task 1.1: Remove console.debug useEffect
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Changes:**
- Delete the `useEffect` hook (lines 80-96)
- Remove `useEffect` from React imports (line 1)

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

**Success Criteria:**
- `useEffect` hook removed
- `useEffect` removed from React imports
- No console.debug output

#### Task 1.2: Remove Visual Debug Section
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

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

**Success Criteria:**
- Debug section removed from JSX
- No visual debug UI in DEV or PROD
- No orphaned closing tags

---

### Phase 2: Validation

**Goal:** Verify the cleanup didn't break anything.

#### Task 2.1: Build & Lint Validation
**Commands:**
```bash
npm run build
npm run lint
```

**Success Criteria:**
- Build passes without errors
- Lint passes without errors
- No TypeScript errors
- No unused imports

#### Task 2.2: Functional Verification
**Manual Testing:**
- Open CustomerDetailsPopover in Orders module
- Open CustomerDetailsPopover in Invoicing module
- Verify Linked/Unlinked/Multiple people states display correctly
- Verify lazy loading still works
- Verify no debug output in console

**Success Criteria:**
- Component works correctly
- All states display correctly
- No debug noise

---

## Progress Tracking

- [ ] Phase 1: Remove Debug Code
  - [ ] Task 1.1: Remove console.debug useEffect
  - [ ] Task 1.2: Remove Visual Debug Section
- [ ] Phase 2: Validation
  - [ ] Task 2.1: Build & Lint Validation
  - [ ] Task 2.2: Functional Verification

---

## Deliverables

1. **Cleaned Component:** `CustomerDetailsPopover.tsx` without debug code
2. **Verified Functionality:** Component still works correctly
3. **Clean Build:** No errors or warnings

---

## Risk Mitigation

### Risk: Breaking Component
**Mitigation:** Only removing debug code, no functional changes. Easy to verify and rollback if needed.

### Risk: Unused Imports
**Mitigation:** Explicitly check and remove `useEffect` from imports.

---

## Notes

- This is a pure cleanup task
- No dependencies on other features
- Easy to verify and rollback
- Improves code maintainability

