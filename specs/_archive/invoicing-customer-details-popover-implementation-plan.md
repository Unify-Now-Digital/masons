# Implementation Plan: Invoicing Customer Details Popover (Reuse Orders Implementation)

**Branch:** `feature/invoicing-customer-details-popover`  
**Specification:** `specs/invoicing-customer-details-popover.md`

---

## Overview

This implementation plan adds a clickable customer name in the Invoicing module that opens a popover card showing customer (Person) details, reusing the existing CustomerDetailsPopover component from the Orders module. The popover displays information from the People module with fallback to snapshot fields, and includes a "Messages (Coming soon)" section.

**Goal:** 
- Refactor CustomerDetailsPopover to shared location
- Make customer name clickable in Invoicing module (list/table and detail pages)
- Open popover card on click showing customer details (same as Orders)
- Use snapshot fields only (Option A - MVP approach)
- Include "Messages (Coming soon)" placeholder section
- Lazy-load Person data only when popover opens (when personId available)

**Constraints:**
- No database changes or migrations
- No changes to invoice table structure (additive UI only)
- Reuse existing `useCustomer` hook from Customers module
- Must not break existing Orders module functionality
- Performance: no prefetching, proper lazy loading
- Start with Option A (simple approach using only customer_name)

---

## Phase 1 — Refactor CustomerDetailsPopover to Shared Location

### Task 1.1: Create Shared Component Directory

**File:** `src/shared/components/customer/` (new directory)

**Description:**
Create shared component directory for customer-related reusable components.

**Changes:**
- Create directory: `src/shared/components/customer/`
- Directory structure matches existing `src/shared/components/ui/` pattern

**Validation:**
- Directory created
- Structure matches existing patterns

---

### Task 1.2: Move CustomerDetailsPopover Component

**File:** 
- **From:** `src/modules/orders/components/CustomerDetailsPopover.tsx`
- **To:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Move CustomerDetailsPopover component from Orders module to shared location.

**Changes:**
1. Copy component file to new location
2. Verify all imports still work (should remain the same)
3. Component code unchanged

**Validation:**
- Component file moved successfully
- All imports resolve correctly
- No syntax errors

---

### Task 1.3: Update Orders Module Import

**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Description:**
Update Orders module to import CustomerDetailsPopover from shared location.

**Changes:**
```typescript
// Before:
import { CustomerDetailsPopover } from './CustomerDetailsPopover';

// After:
import { CustomerDetailsPopover } from '@/shared/components/customer/CustomerDetailsPopover';
```

**Validation:**
- Import updated correctly
- Orders module still compiles
- No TypeScript errors

---

### Task 1.4: Delete Old Component File

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Delete the old component file from Orders module after verifying shared component works.

**Validation:**
- Old file deleted
- Orders module still works
- No broken imports

---

### Task 1.5: Verify Orders Module Still Works

**Description:**
Test that Orders module popover still works after refactor.

**Test Scenarios:**
- Click customer name in Orders table → popover opens
- Person data loads correctly
- Fallback works when person_id null
- "Linked"/"Unlinked" badge displays correctly
- "Open Person" button works
- Messages section displays

**Validation:**
- All Orders scenarios pass
- No regressions
- Build passes

---

## Phase 2 — Invoicing: MVP Integration (Option A)

### Task 2.1: Identify Customer Display Locations

**Files to Check:**
- `src/modules/invoicing/pages/InvoicingPage.tsx` (list/table)
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` (detail view)

**Description:**
Identify where customer name is displayed in Invoicing module.

**Findings:**
- Invoices list/table: Customer column at line ~276 in InvoicingPage.tsx
- Invoice detail: Check InvoiceDetailSidebar for customer name display

**Validation:**
- All customer display locations identified
- Ready for integration

---

### Task 2.2: Update Invoices List/Table

**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Description:**
Add CustomerDetailsPopover to Customer column in invoices table.

**Changes:**
```typescript
// Add import
import { CustomerDetailsPopover } from '@/shared/components/customer/CustomerDetailsPopover';

// In the Customer column (around line 276):
<TableCell>
  {invoice.customer && invoice.customer !== '—' && invoice.customer !== 'No person assigned' ? (
    <CustomerDetailsPopover
      personId={null} // No person_id in invoices currently
      fallbackName={invoice.customer}
      fallbackPhone={null} // Not stored in invoices
      fallbackEmail={null} // Not stored in invoices
      trigger={
        <button className="text-left hover:underline text-sm font-medium">
          {invoice.customer}
        </button>
      }
    />
  ) : (
    <span className="text-sm text-muted-foreground">—</span>
  )}
</TableCell>
```

**Validation:**
- Import added correctly
- Customer column renders popover
- Clickable customer name works
- "—" shown when no customer name

---

### Task 2.3: Update Invoice Detail Sidebar (if applicable)

**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
Add CustomerDetailsPopover to customer name display in invoice detail sidebar (if customer name is shown).

**Changes:**
- Check if customer name is displayed in sidebar
- If yes, wrap with CustomerDetailsPopover (same pattern as list/table)
- If no customer name shown, skip this task

**Validation:**
- Customer name in detail view is clickable (if present)
- Popover works correctly
- Same behavior as list/table

---

## Phase 3 — Navigation & UX Polish

### Task 3.1: Verify Popover Behavior

**Description:**
Ensure popover opens on click, closes on outside click/ESC, and has consistent width.

**Validation:**
- Popover opens on trigger click
- Closes on outside click
- Closes on ESC key
- Width consistent with Orders popover (w-80 = 320px)
- No layout shift in table rows

---

### Task 3.2: Verify Styling Consistency

**Description:**
Ensure trigger styling matches Orders module (link-style button).

**Validation:**
- Trigger looks like clickable link/button
- Hover state works
- Consistent with Orders module styling
- No table layout shift

---

### Task 3.3: Verify Accessibility

**Description:**
Ensure keyboard navigation and focus management work correctly.

**Validation:**
- Keyboard focus works correctly
- Click target large enough (button element)
- Screen reader friendly
- Tab navigation works

---

## Phase 4 — Validation

### Task 4.1: Test Orders Module

**Description:**
Verify Orders module still works after refactor.

**Test Scenarios:**
- Click customer name → popover opens
- Person data loads correctly
- Fallback works
- All existing functionality preserved

**Validation:**
- All Orders scenarios pass
- No regressions
- Build passes

---

### Task 4.2: Test Invoicing List

**Description:**
Verify clicking customer name in Invoices list opens popover correctly.

**Test Scenarios:**
- Click customer name → popover opens
- Shows "Unlinked" badge (no person_id)
- Shows customer_name in header
- Phone/email show "—"
- Messages section displays
- "Open Person" button NOT shown (no personId)

**Validation:**
- Popover opens on click
- Content displays correctly
- Badge shows "Unlinked"
- No errors

---

### Task 4.3: Test Invoice Detail (if applicable)

**Description:**
Verify customer popover works in invoice detail view (if customer name is shown).

**Test Scenarios:**
- Same as list/table scenarios
- Popover works in detail context

**Validation:**
- Detail view popover works (if applicable)
- Consistent with list/table behavior

---

### Task 4.4: Test Performance

**Description:**
Verify no performance issues (no prefetching, proper lazy loading).

**Validation:**
- No People fetch on Invoices page load (verify Network tab)
- No extra queries triggered
- Lazy loading works correctly
- Caching works (if personId becomes available in future)

---

### Task 4.5: Test Edge Cases

**Description:**
Verify edge cases handled correctly.

**Test Scenarios:**
- Empty customer_name → shows "—" without popover
- Null customer_name → shows "—" without popover
- "No person assigned" → shows "—" without popover
- Very long customer names → popover displays correctly

**Validation:**
- All edge cases handled
- No crashes or errors
- Graceful degradation

---

### Task 4.6: Build & Lint Validation

**Description:**
Verify build and lint pass.

**Validation:**
- Build passes (`npm run build`)
- Lint passes (`npm run lint`)
- No TypeScript errors
- No console warnings

---

## Deliverables

- ✅ CustomerDetailsPopover moved to shared location
- ✅ Orders module updated to use shared component
- ✅ Invoices list/table updated with customer popover
- ✅ Invoice detail updated (if applicable)
- ✅ Consistent UX between Orders and Invoicing
- ✅ No regressions in Orders module
- ✅ All tests pass
- ✅ Build and lint pass

---

## Success Criteria

- CustomerDetailsPopover moved to shared location
- Orders module still works with refactored component
- Clicking customer name in Invoices list opens popover
- Clicking customer name in Invoice detail (if applicable) opens popover
- Popover shows customer details (name only, phone/email as "—")
- "Unlinked" badge shown (no person_id available)
- "Open Person" button NOT shown (no personId)
- "Messages (Coming soon)" section displayed
- No performance issues (no prefetching)
- Build + lint pass
- No runtime crashes
- No regressions in Orders module

---

## Out of Scope (Explicit)

- **No schema changes** (no migrations)
- **No joins to Orders for person_id** (Option B deferred to future)
- **No Inbox / Messages integration** (placeholder only)
- **No customer_phone or customer_email fields** (not stored in invoices)

