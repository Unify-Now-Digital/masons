# Tasks: Invoicing - Derive person_id from Linked Order

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Add fetchOrderPersonId API function | Create | `src/modules/orders/api/orders.api.ts` | High | None | 1 |
| 1.2 | Add useOrderPersonId hook | Create | `src/modules/orders/hooks/useOrders.ts` | High | 1.1 | 1 |
| 1.3 | Update Orders API exports | Update | `src/modules/orders/api/orders.api.ts` | Medium | 1.1 | 1 |
| 2.1 | Add orderId prop to CustomerDetailsPopover | Update | `src/shared/components/customer/CustomerDetailsPopover.tsx` | High | None | 2 |
| 2.2 | Add order person ID fetch logic | Update | `src/shared/components/customer/CustomerDetailsPopover.tsx` | High | 1.2, 2.1 | 2 |
| 2.3 | Update person fetch to use resolved person ID | Update | `src/shared/components/customer/CustomerDetailsPopover.tsx` | High | 2.2 | 2 |
| 2.4 | Update loading state | Update | `src/shared/components/customer/CustomerDetailsPopover.tsx` | Medium | 2.2 | 2 |
| 2.5 | Update "Open Person" button condition | Update | `src/shared/components/customer/CustomerDetailsPopover.tsx` | Medium | 2.3 | 2 |
| 3.1 | Update Invoices list/table | Update | `src/modules/invoicing/pages/InvoicingPage.tsx` | High | 2.1 | 3 |
| 3.2 | Update Invoice detail sidebar | Update | `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` | High | 2.1 | 3 |
| 4.1 | Test Orders module regression | Verify | - | High | All | 4 |
| 4.2 | Test Invoicing with order_id | Verify | - | High | All | 4 |
| 4.3 | Test Invoicing with order_id but no person_id | Verify | - | High | All | 4 |
| 4.4 | Test Invoicing with no order_id | Verify | - | Medium | All | 4 |
| 4.5 | Test lazy loading | Verify | - | High | All | 4 |
| 4.6 | Test error handling | Verify | - | Medium | All | 4 |
| 4.7 | Build & lint validation | Verify | - | High | All | 4 |

---

## Phase 1: Order → Person ID API & Hook

### Task 1.1: Add fetchOrderPersonId API Function

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/orders/api/orders.api.ts`

**Description:**
Add lightweight API function to fetch only person_id from an order.

**Acceptance Criteria:**
- [ ] Function `fetchOrderPersonId(orderId: string)` added
- [ ] Selects only `person_id` field
- [ ] Handles errors gracefully (returns null if order not found)
- [ ] Returns `string | null`

**Validation:**
- Function added correctly
- Error handling works
- TypeScript compiles

---

### Task 1.2: Add useOrderPersonId Hook

**Type:** CREATE  
**Priority:** High  
**Dependencies:** 1.1  
**File:** `src/modules/orders/hooks/useOrders.ts`

**Description:**
Add React Query hook to fetch order person_id with conditional enabling.

**Acceptance Criteria:**
- [ ] Hook `useOrderPersonId(orderId, { enabled })` added
- [ ] Query key includes orderId: `['orders', 'personId', orderId]`
- [ ] Conditional enabling works: `enabled: (options?.enabled ?? true) && !!orderId`
- [ ] Caches by orderId

**Validation:**
- Hook added correctly
- Conditional enabling works
- Caching works
- TypeScript compiles

---

### Task 1.3: Update Orders API Exports

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** 1.1  
**File:** `src/modules/orders/api/orders.api.ts`

**Description:**
Ensure fetchOrderPersonId is exported (if not already).

**Acceptance Criteria:**
- [ ] Function is exported
- [ ] Importable from other modules

**Validation:**
- Export works correctly
- Importable

---

## Phase 2: Enhance CustomerDetailsPopover (Backward Compatible)

### Task 2.1: Add orderId Prop to CustomerDetailsPopover

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Add optional `orderId` prop to component interface.

**Acceptance Criteria:**
- [ ] `orderId?: string | null` added to interface
- [ ] Prop is optional (backward compatible)
- [ ] TypeScript compiles

**Validation:**
- Interface updated correctly
- Backward compatible
- TypeScript compiles

---

### Task 2.2: Add Order Person ID Fetch Logic

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.2, 2.1  
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Add internal order fetch logic when orderId is provided.

**Acceptance Criteria:**
- [ ] `useOrderPersonId` hook imported
- [ ] Hook called with orderId and enabled condition
- [ ] Enabled only when popover is open: `enabled: open && !!orderId`
- [ ] `orderPersonId` extracted from query result

**Validation:**
- Order fetch logic added
- Conditional enabling works
- TypeScript compiles

---

### Task 2.3: Update Person Fetch to Use Resolved Person ID

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.2  
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Update useCustomer hook to use resolvedPersonId instead of personId.

**Acceptance Criteria:**
- [ ] `resolvedPersonId` calculated: `personId ?? orderPersonId ?? null`
- [ ] `useCustomer` uses `resolvedPersonId` instead of `personId`
- [ ] Conditional enabling: `enabled: open && !!resolvedPersonId`
- [ ] Priority: personId prop > orderPersonId > null

**Validation:**
- Resolved person ID logic correct
- Person fetch uses resolved ID
- Priority order correct

---

### Task 2.4: Update Loading State

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** 2.2  
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Update loading state to include order resolution.

**Acceptance Criteria:**
- [ ] `isLoading` includes `isResolvingOrder`: `isResolvingOrder || isFetchingPerson`
- [ ] Loading skeleton shows during order fetch
- [ ] `isLinked` uses `resolvedPersonId`: `!!resolvedPersonId && !!person && !error`

**Validation:**
- Loading state includes order resolution
- isLinked uses resolvedPersonId
- Loading skeleton works

---

### Task 2.5: Update "Open Person" Button Condition

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** 2.3  
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Update button to show when resolvedPersonId exists.

**Acceptance Criteria:**
- [ ] Button condition uses `resolvedPersonId`
- [ ] Button shows for both direct personId and derived from orderId
- [ ] Button hidden when resolvedPersonId is null

**Validation:**
- Button condition correct
- Shows when personId available (direct or derived)
- Hidden when no personId

---

## Phase 3: Invoicing Integration

### Task 3.1: Update Invoices List/Table

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Description:**
Update CustomerDetailsPopover to pass orderId instead of personId={null}.

**Acceptance Criteria:**
- [ ] `orderId={invoice.orderId || null}` prop added
- [ ] `personId={null}` prop removed
- [ ] Other props unchanged (fallbackName, fallbackPhone, fallbackEmail)
- [ ] Component still works

**Validation:**
- orderId prop passed correctly
- personId prop removed
- Component works correctly

---

### Task 3.2: Update Invoice Detail Sidebar

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
Update CustomerDetailsPopover to pass orderId from invoice.order_id.

**Acceptance Criteria:**
- [ ] `orderId={invoice.order_id || null}` prop added
- [ ] `personId={null}` prop removed
- [ ] Uses `invoice.order_id` (from Invoice type, not UIInvoice)
- [ ] Component still works

**Validation:**
- orderId prop passed correctly
- Uses correct field (invoice.order_id)
- Component works correctly

---

## Phase 4: Testing & Validation

### Task 4.1: Test Orders Module Regression

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify Orders module still works with direct personId prop.

**Test Scenarios:**
- [ ] Orders popover still works using personId prop
- [ ] No order queries fired for Orders module
- [ ] "Linked" badge shows correctly
- [ ] All existing functionality preserved

**Validation:**
- All Orders scenarios pass
- No regressions
- Build passes

---

### Task 4.2: Test Invoicing with order_id

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify Invoicing popover shows full People info when invoice has order_id with person_id.

**Test Scenarios:**
- [ ] Invoice with order_id → popover shows full People info
- [ ] "Linked" badge displayed
- [ ] Phone/email/address shown
- [ ] "Open Person" button visible
- [ ] Order query fires only when popover opens
- [ ] Person query fires only after order.person_id resolved

**Validation:**
- Full People info displays correctly
- Badge shows "Linked"
- Lazy loading works

---

### Task 4.3: Test Invoicing with order_id but no person_id

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify fallback behavior when order exists but has no person_id.

**Test Scenarios:**
- [ ] Invoice with order_id but order.person_id is null → "Unlinked" badge
- [ ] Fallback to customer_name only
- [ ] Phone/email show "—"
- [ ] "Open Person" button NOT shown

**Validation:**
- Fallback behavior works correctly
- "Unlinked" badge shown
- No errors

---

### Task 4.4: Test Invoicing with no order_id

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

**Description:**
Verify current behavior preserved when invoice has no order_id.

**Test Scenarios:**
- [ ] Invoice without order_id → "Unlinked" badge
- [ ] Shows customer_name only
- [ ] Phone/email show "—"
- [ ] No order queries fired

**Validation:**
- Current behavior preserved
- No unnecessary queries
- No errors

---

### Task 4.5: Test Lazy Loading

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify lazy loading works correctly (no prefetching).

**Test Scenarios:**
- [ ] No order/person queries on Invoicing page load (verify Network tab)
- [ ] Order query fires only when popover opens
- [ ] Person query fires only after order.person_id resolved
- [ ] Re-opening same invoice uses cached results

**Validation:**
- Lazy loading verified in Network tab
- No prefetching
- Caching works correctly

---

### Task 4.6: Test Error Handling

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

**Description:**
Verify error handling works correctly.

**Test Scenarios:**
- [ ] Order fetch fails → fallback to "Unlinked" behavior
- [ ] Order not found → fallback to "Unlinked" behavior
- [ ] Person fetch fails → fallback to snapshot fields
- [ ] No crashes or console errors

**Validation:**
- Error handling works correctly
- Graceful degradation
- No crashes

---

### Task 4.7: Build & Lint Validation

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify build and lint pass.

**Acceptance Criteria:**
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] No TypeScript errors
- [ ] No console warnings

**Validation:**
- Build successful
- Lint passes
- No errors or warnings

---

## Progress Tracking

### Phase 1: Order → Person ID API & Hook
- [X] Task 1.1: Add fetchOrderPersonId API function
- [X] Task 1.2: Add useOrderPersonId hook
- [X] Task 1.3: Update Orders API exports

### Phase 2: Enhance CustomerDetailsPopover (Backward Compatible)
- [X] Task 2.1: Add orderId prop to CustomerDetailsPopover
- [X] Task 2.2: Add order person ID fetch logic
- [X] Task 2.3: Update person fetch to use resolved person ID
- [X] Task 2.4: Update loading state
- [X] Task 2.5: Update "Open Person" button condition

### Phase 3: Invoicing Integration
- [X] Task 3.1: Update Invoices list/table
- [X] Task 3.2: Update Invoice detail sidebar

### Phase 4: Testing & Validation
- [ ] Task 4.1: Test Orders module regression
- [ ] Task 4.2: Test Invoicing with order_id
- [ ] Task 4.3: Test Invoicing with order_id but no person_id
- [ ] Task 4.4: Test Invoicing with no order_id
- [ ] Task 4.5: Test lazy loading
- [ ] Task 4.6: Test error handling
- [X] Task 4.7: Build & lint validation

---

## Notes

- All changes are backward compatible
- No database or schema changes
- Lightweight queries (only person_id, not full order)
- Lazy loading for performance
- Two-step fetch: order → person
- React Query handles caching automatically

