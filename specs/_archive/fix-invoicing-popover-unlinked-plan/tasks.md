# Tasks: Fix Invoicing Customer Popover Still Showing Unlinked

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Verify invoice query includes order_id | Verify | `src/modules/invoicing/api/invoicing.api.ts` | High | None | 1 |
| 1.2 | Verify invoice transform mapping | Verify | `src/modules/invoicing/utils/invoiceTransform.ts` | High | None | 1 |
| 1.3 | Verify call sites pass correct props | Verify | `src/modules/invoicing/pages/InvoicingPage.tsx`, `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` | High | None | 1 |
| 2.1 | Add DEV debug section to CustomerDetailsPopover | Create | `src/shared/components/customer/CustomerDetailsPopover.tsx` | High | None | 2 |
| 2.2 | Add DEV console logging | Create | `src/shared/components/customer/CustomerDetailsPopover.tsx` | Medium | 2.1 | 2 |
| 3.1 | Fix invoice query (if order_id missing) | Update | `src/modules/invoicing/api/invoicing.api.ts` | High | 1.1 | 3 |
| 3.2 | Fix field name consistency (if needed) | Update | Multiple files | High | 1.2, 1.3 | 3 |
| 3.3 | Fix query enable condition (if needed) | Update | `src/shared/components/customer/CustomerDetailsPopover.tsx` | High | 2.1 | 3 |
| 4.1 | Test with invoice that has order_id | Verify | - | High | All | 4 |
| 4.2 | Test with invoice without order_id | Verify | - | Medium | All | 4 |
| 4.3 | Verify lazy loading | Verify | - | High | All | 4 |
| 4.4 | Verify DEV debug | Verify | - | Medium | All | 4 |
| 4.5 | Regression check - Orders module | Verify | - | High | All | 4 |
| 4.6 | Build & lint validation | Verify | - | High | All | 4 |

---

## Phase 1: Audit Data Plumbing (Invoice → UIInvoice → Popover props)

### Task 1.1: Verify Invoice Query Includes order_id

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/invoicing/api/invoicing.api.ts`

**Description:**
Verify that `fetchInvoices` query selects `order_id` field from the database.

**Current State:**
- Query uses `select('*')` which should include `order_id`
- Need to verify this is correct

**Acceptance Criteria:**
- [ ] Query uses `select('*')` or explicitly includes `order_id`
- [ ] Invoice type includes `order_id` field
- [ ] Query returns invoices with `order_id` field

**Validation:**
- Query includes `order_id` field
- Invoice type matches returned data structure

---

### Task 1.2: Verify Invoice Transform Mapping

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/invoicing/utils/invoiceTransform.ts`

**Description:**
Verify that transform correctly maps `order_id` → `orderId` in UIInvoice.

**Current State:**
- Transform function: `orderId: invoice.order_id` (line 37)
- Should be correct, but verify

**Acceptance Criteria:**
- [ ] Transform correctly maps `order_id` → `orderId`
- [ ] UIInvoice has `orderId` field when invoice has `order_id`
- [ ] Mapping is consistent

**Validation:**
- Transform correctly maps `order_id` → `orderId`
- UIInvoice has `orderId` field when invoice has `order_id`

---

### Task 1.3: Verify Call Sites Pass Correct Props

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** None  
**Files:** `src/modules/invoicing/pages/InvoicingPage.tsx`, `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
Verify both components pass the correct `orderId` prop to CustomerDetailsPopover.

**Current State:**
- InvoicingPage: `orderId={invoice.orderId || null}` (uses UIInvoice.orderId)
- InvoiceDetailSidebar: `orderId={invoice.order_id || null}` (uses Invoice.order_id)

**Acceptance Criteria:**
- [ ] InvoicingPage passes `invoice.orderId` (from UIInvoice)
- [ ] InvoiceDetailSidebar passes `invoice.order_id` (from Invoice)
- [ ] Both work correctly

**Validation:**
- InvoicingPage passes `invoice.orderId` (from UIInvoice)
- InvoiceDetailSidebar passes `invoice.order_id` (from Invoice)
- Both work correctly

---

## Phase 2: Add DEV-only Debug Visibility (Fast Diagnosis)

### Task 2.1: Add DEV Debug Section to CustomerDetailsPopover

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Add DEV-only debug block that displays runtime values for diagnosis.

**Acceptance Criteria:**
- [ ] Debug section only visible when `import.meta.env.DEV === true`
- [ ] Shows: orderId, orderPersonId, resolvedPersonId, personId prop, open state, loading states
- [ ] Placed after Messages section
- [ ] Styled subtly (muted colors, monospace font)

**Validation:**
- Debug section only visible in DEV mode
- Shows all relevant runtime values
- Styled appropriately
- Placed correctly

---

### Task 2.2: Add DEV Console Logging

**Type:** CREATE  
**Priority:** Medium  
**Dependencies:** 2.1  
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Add console.debug logging when popover opens (DEV only).

**Acceptance Criteria:**
- [ ] Logging only in DEV mode
- [ ] Logs when popover opens
- [ ] Includes all relevant values
- [ ] Uses console.debug (not console.log)

**Validation:**
- Logging only in DEV mode
- Logs when popover opens
- Includes all relevant values

---

## Phase 3: Fix Identified Root Cause

### Task 3.1: Fix Invoice Query (if order_id missing)

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.1  
**File:** `src/modules/invoicing/api/invoicing.api.ts`

**Description:**
If invoice query doesn't select `order_id`, add it.

**Acceptance Criteria:**
- [ ] Query includes `order_id` field
- [ ] Invoice type matches returned data
- [ ] No breaking changes

**Validation:**
- Query includes `order_id` field
- Invoice type matches returned data

---

### Task 3.2: Fix Field Name Consistency (if needed)

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.2, 1.3  
**Files:** Multiple files

**Description:**
If field name mismatch is identified, fix it consistently.

**Acceptance Criteria:**
- [ ] Field names consistent across codebase
- [ ] Transform correctly maps between formats
- [ ] Components use correct field names

**Validation:**
- Field names consistent
- Transform correctly maps
- Components use correct fields

---

### Task 3.3: Fix Query Enable Condition (if needed)

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
If query enable condition is wrong, fix it.

**Acceptance Criteria:**
- [ ] Query enabled when popover opens and orderId exists
- [ ] Query disabled when popover closed or orderId is null
- [ ] ResolvedPersonId updates when orderPersonId changes

**Validation:**
- Query enabled correctly
- Query disabled correctly
- ResolvedPersonId updates correctly

---

## Phase 4: Testing & Validation

### Task 4.1: Test with Invoice That Has order_id

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

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

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

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

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

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

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

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

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

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

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify build and lint pass.

**Acceptance Criteria:**
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] No TypeScript errors
- [ ] No console warnings (except DEV debug logs)

**Validation:**
- Build successful
- Lint passes
- No errors or warnings

---

## Progress Tracking

### Phase 1: Audit Data Plumbing
- [X] Task 1.1: Verify invoice query includes order_id
- [X] Task 1.2: Verify invoice transform mapping
- [X] Task 1.3: Verify call sites pass correct props

### Phase 2: Add DEV-only Debug Visibility
- [X] Task 2.1: Add DEV debug section to CustomerDetailsPopover
- [X] Task 2.2: Add DEV console logging

### Phase 3: Fix Identified Root Cause
- [ ] Task 3.1: Fix invoice query (if order_id missing) - Not needed (uses select('*'))
- [ ] Task 3.2: Fix field name consistency (if needed) - Not needed (already consistent)
- [ ] Task 3.3: Fix query enable condition (if needed) - Not needed (condition is correct)

### Phase 4: Testing & Validation
- [ ] Task 4.1: Test with invoice that has order_id
- [ ] Task 4.2: Test with invoice without order_id
- [ ] Task 4.3: Verify lazy loading
- [ ] Task 4.4: Verify DEV debug
- [ ] Task 4.5: Regression check - Orders module
- [X] Task 4.6: Build & lint validation

---

## Notes

- All changes are backward compatible
- No database or schema changes
- DEV debug must be guarded (not ship to production)
- Lazy loading must be preserved
- No regressions in Orders module
- Focus on diagnosis first, then fix

