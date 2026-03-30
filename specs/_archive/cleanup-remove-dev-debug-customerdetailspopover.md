# Cleanup: Remove DEV-only Debug Section from CustomerDetailsPopover

## Overview

Remove temporary DEV-only debug UI and console logging from `CustomerDetailsPopover` now that the Invoicing customer linking issue is resolved and verified. This is a cleanup task to remove diagnostic code that was added during development and is no longer needed.

**Context:**
- Debug code was added during implementation of Invoice → Orders → Person resolution feature
- Feature is now working correctly and verified
- Debug code should not remain in production codebase
- Cleanup improves code maintainability and reduces noise

**Goal:**
- Remove visual "Debug (DEV only)" section from popover UI
- Remove DEV-only console.debug logging
- Keep all functional logic intact
- No behavior changes

---

## Current State Analysis

### CustomerDetailsPopover Component

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Current Debug Code:**

1. **Console Debug Logging (lines 80-96):**
   - `useEffect` hook that logs debug information when popover opens
   - Only runs in DEV mode (`import.meta.env.DEV`)
   - Logs: invoiceId, orderId, personId, invoicePersonIds, orderPersonId, resolvedPersonId, linkState, loading states

2. **Visual Debug Section (lines 180-200):**
   - Renders a "Debug (DEV only)" section in the popover UI
   - Only visible in DEV mode (`import.meta.env.DEV`)
   - Displays all internal state values in a monospace font
   - Includes: invoiceId, invoicePersonIds, orderId, orderPersonId, resolvedPersonId, personId prop, linkState, open state, loading states

**Observations:**
- Debug code is properly guarded with `import.meta.env.DEV` checks
- Debug code does not affect production builds
- Debug code was useful during development but is no longer needed
- Removing it will clean up the codebase without affecting functionality

---

## Recommended Solution

### Remove Debug Code

**Changes Required:**

1. **Remove console.debug useEffect:**
   - Delete the entire `useEffect` hook (lines 80-96)
   - Remove `useEffect` from imports if it's no longer used elsewhere
   - Note: `useEffect` is only used for debug logging, so it can be removed from imports

2. **Remove visual debug section:**
   - Delete the DEV-only debug CardContent section (lines 180-200)
   - This is the conditional render block that shows debug information

**Code to Remove:**

```typescript
// Remove this useEffect:
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

// Remove this visual debug section:
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

**Import Cleanup:**
- Check if `useEffect` is used elsewhere in the component
- If not, remove `useEffect` from React imports: `import React, { useState } from 'react';`

---

## Implementation Approach

### Phase 1: Remove Debug Code

1. **Remove console.debug useEffect:**
   - Delete the `useEffect` hook that logs debug information
   - Remove `useEffect` from React imports if unused

2. **Remove visual debug section:**
   - Delete the DEV-only debug CardContent block
   - Ensure no orphaned closing tags remain

3. **Verify imports:**
   - Check if `useEffect` is still needed
   - Update React import if `useEffect` is removed

### Phase 2: Validation

1. **Build validation:**
   - Run `npm run build` to ensure no TypeScript errors
   - Verify no broken imports

2. **Lint validation:**
   - Run `npm run lint` to ensure code style compliance

3. **Functional verification:**
   - Verify CustomerDetailsPopover still works correctly
   - Confirm Linked/Unlinked/Multiple people states display correctly
   - Verify lazy loading still works

---

## What NOT to Do

- **Do NOT remove functional logic:**
  - Keep all data fetching hooks (`useInvoicePersonIds`, `useOrderPersonId`, `useCustomer`)
  - Keep resolution logic (`resolvedPersonId`, `linkState`)
  - Keep badge display logic
  - Keep multiple people handling

- **Do NOT change component behavior:**
  - No changes to props interface
  - No changes to rendering logic (except removing debug section)
  - No changes to lazy loading behavior

- **Do NOT remove other DEV-only code:**
  - Only remove the specific debug section and console.debug
  - Do not remove other DEV-specific features if they exist

---

## Acceptance Criteria

- ✅ Debug section no longer renders in DEV or PROD
- ✅ No debug-related console output
- ✅ CustomerDetailsPopover still:
  - Shows correct Linked / Unlinked / Multiple people state
  - Lazy-loads data correctly
  - Displays customer information correctly
- ✅ Build passes without errors
- ✅ Lint passes without errors
- ✅ No unused imports remain

---

## Safety Considerations

- **No behavior changes:** This is a pure cleanup task
- **No schema changes:** No database or API changes
- **No breaking changes:** Component interface remains the same
- **Easy rollback:** Changes are isolated to debug code removal

---

## Open Questions / Considerations

None - this is a straightforward cleanup task with no dependencies or blockers.

---

## Success Metrics

- Code is cleaner and more maintainable
- No debug noise in console or UI
- All functionality remains intact
- Build and lint pass

