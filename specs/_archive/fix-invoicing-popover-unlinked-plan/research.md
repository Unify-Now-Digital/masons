# Research: Fix Invoicing Customer Popover Still Showing Unlinked

## Problem Analysis

### Current State
- Feature implemented: `fetchOrderPersonId` API, `useOrderPersonId` hook, `orderId` prop in CustomerDetailsPopover
- InvoicingPage and InvoiceDetailSidebar updated to pass `orderId` prop
- Build and lint pass, but runtime shows "Unlinked" for all invoices
- Need to diagnose data flow: invoice → order → person

### Root Cause Hypotheses

1. **Invoice Query Missing order_id:**
   - **Status:** VERIFIED - `fetchInvoices` uses `select('*')` which includes `order_id`
   - **Risk:** Low - query should include all fields

2. **Transform Mapping Issue:**
   - **Status:** VERIFIED - Transform correctly maps `order_id` → `orderId` (line 37)
   - **Risk:** Low - mapping looks correct

3. **Field Name Mismatch:**
   - **Status:** VERIFIED - InvoicingPage uses `invoice.orderId` (UIInvoice), InvoiceDetailSidebar uses `invoice.order_id` (Invoice)
   - **Risk:** Low - both should work based on their types

4. **Query Not Enabled:**
   - **Status:** NEEDS VERIFICATION - `useOrderPersonId` enabled condition: `open && !!orderId`
   - **Risk:** Medium - need to verify at runtime

5. **Order Has No person_id:**
   - **Status:** NEEDS VERIFICATION - Test data might have null person_id
   - **Risk:** Medium - could be correct behavior if order has no person_id

6. **Runtime Value Issue:**
   - **Status:** UNKNOWN - Need DEV debug to see actual runtime values
   - **Risk:** High - most likely cause

---

## Technical Decisions

### 1. DEV-Only Debug Visibility

**Decision:** Add debug section in CustomerDetailsPopover showing runtime values

**Rationale:**
- Fast diagnosis without guessing
- Shows actual values at runtime
- Helps identify where data flow breaks
- Guarded behind DEV flag (won't ship to production)

**Implementation:**
- Display: orderId, orderPersonId, resolvedPersonId, personId prop, open state, loading states
- Place: After Messages section in popover footer
- Style: Subtle, monospace font, muted colors
- Guard: `import.meta.env.DEV === true`

---

### 2. Console Logging

**Decision:** Add console.debug logging when popover opens (DEV only)

**Rationale:**
- Complements visual debug section
- Helps track state changes over time
- Useful for debugging query enabling/disabling

**Implementation:**
- Log when popover opens
- Include all relevant values
- Guard: `import.meta.env.DEV === true`

---

### 3. Audit Strategy

**Decision:** Verify each step of data flow systematically

**Rationale:**
- Invoice query → Transform → Component props → Query enabling → Person fetch
- Each step must be verified to find the break point

**Implementation:**
1. Verify invoice query includes `order_id` ✓
2. Verify transform maps correctly ✓
3. Verify component props pass correctly ✓
4. Add DEV debug to see runtime values
5. Fix identified issue

---

## Constraints

### Performance
- **No prefetching:** Must not fetch orders/persons on page load
- **Lazy loading:** Only fetch when popover opens
- **Caching:** React Query handles caching automatically

### Development
- **DEV debug:** Must be guarded (not ship to production)
- **Console logging:** DEV only, use console.debug
- **No breaking changes:** All existing functionality must work

### Data Model
- **No schema changes:** Must not modify database
- **Use existing relationships:** Invoice → Order → Person
- **Field names:** Support both snake_case (DB) and camelCase (UI)

---

## Open Questions Resolved

1. **Invoice query includes order_id?**
   - **Answer:** Yes, `select('*')` includes all fields including `order_id`
   - **Action:** No change needed

2. **Transform mapping correct?**
   - **Answer:** Yes, `orderId: invoice.order_id` is correct
   - **Action:** No change needed

3. **Component props correct?**
   - **Answer:** Yes, both components pass correct props based on their types
   - **Action:** No change needed

4. **What are runtime values?**
   - **Answer:** Unknown - need DEV debug to see
   - **Action:** Add DEV debug section

5. **Query enabling correct?**
   - **Answer:** Unknown - need DEV debug to verify
   - **Action:** Add DEV debug to see enabled state

---

## References

- Invoice API: `src/modules/invoicing/api/invoicing.api.ts`
- Invoice Transform: `src/modules/invoicing/utils/invoiceTransform.ts`
- CustomerDetailsPopover: `src/shared/components/customer/CustomerDetailsPopover.tsx`
- InvoicingPage: `src/modules/invoicing/pages/InvoicingPage.tsx`
- InvoiceDetailSidebar: `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`
- Previous implementation: `specs/invoicing-derive-person-id-from-order-implementation-plan.md`

