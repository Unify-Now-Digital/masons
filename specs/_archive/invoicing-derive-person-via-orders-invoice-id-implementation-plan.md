# Implementation Plan: Invoicing Derive Person via Orders.invoice_id

## Feature Overview

Fix the Invoicing CustomerDetailsPopover to derive person_id using the correct relationship: Invoice → Orders (via `orders.invoice_id`). The current approach uses `invoice.order_id` which is always NULL, so it will never work.

**Branch:** `feature/invoicing-derive-person-via-orders-invoice-id`  
**Spec File:** `specs/invoicing-derive-person-via-orders-invoice-id.md`

---

## Technical Context

### Current State
- Invoices have `order_id` column (always NULL, unused)
- Correct relationship: Invoice → Orders via `orders.invoice_id = invoice.id`
- Orders contain `person_id` field
- CustomerDetailsPopover currently uses `orderId` prop (derives from `invoice.order_id`, always null)
- Need to handle: 0 orders, 1 person, multiple people per invoice

### Key Files
- `src/modules/orders/api/orders.api.ts` - Add `fetchInvoicePersonIds` function
- `src/modules/orders/hooks/useOrders.ts` - Add `useInvoicePersonIds` hook
- `src/shared/components/customer/CustomerDetailsPopover.tsx` - Add `invoiceId` prop and resolution logic
- `src/modules/invoicing/pages/InvoicingPage.tsx` - Update to pass `invoiceId`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` - Update to pass `invoiceId`

### Constraints
- No database schema changes
- Keep lazy loading (queries only when popover opens)
- No regressions in Orders module
- Backward compatible with existing props

---

## Implementation Phases

### Phase 1: Add Invoice Person IDs API & Hook

**Goal:** Create lightweight API function and React Query hook to fetch person_ids from orders linked to an invoice.

#### Task 1.1: Add `fetchInvoicePersonIds` API Function
**File:** `src/modules/orders/api/orders.api.ts`

**Implementation:**
```typescript
/**
 * Fetch all person_id values from orders linked to an invoice
 * @param invoiceId - UUID of the invoice
 * @returns Array of unique non-null person_id strings
 */
export async function fetchInvoicePersonIds(invoiceId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('person_id')
    .eq('invoice_id', invoiceId);
  
  if (error) throw error;
  
  // Extract unique non-null person_ids
  const personIds = new Set<string>();
  data?.forEach(order => {
    if (order.person_id) {
      personIds.add(order.person_id);
    }
  });
  
  return Array.from(personIds);
}
```

**Success Criteria:**
- Function queries orders table filtered by `invoice_id`
- Returns array of unique non-null person_ids
- Handles empty results gracefully (returns empty array)
- Error handling for Supabase errors

#### Task 1.2: Add `useInvoicePersonIds` React Query Hook
**File:** `src/modules/orders/hooks/useOrders.ts`

**Implementation:**
```typescript
export const ordersKeys = {
  // ... existing keys ...
  personIdsByInvoice: (invoiceId: string) => ['orders', 'personIdsByInvoice', invoiceId] as const,
};

export function useInvoicePersonIds(
  invoiceId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: invoiceId ? ordersKeys.personIdsByInvoice(invoiceId) : ['orders', 'personIdsByInvoice', 'disabled'],
    queryFn: () => fetchInvoicePersonIds(invoiceId!),
    enabled: (options?.enabled ?? true) && !!invoiceId,
  });
}
```

**Success Criteria:**
- Hook supports conditional enabling
- Cache key includes invoiceId
- Returns React Query result with array of person_ids
- Disabled when invoiceId is null/undefined

**Dependencies:**
- Task 1.1 must be complete (fetchInvoicePersonIds function)

---

### Phase 2: Enhance CustomerDetailsPopover

**Goal:** Add `invoiceId` prop and implement invoice-based person_id resolution with support for multiple people.

#### Task 2.1: Add `invoiceId` Prop to CustomerDetailsPopover
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Changes:**
- Add `invoiceId?: string | null` to `CustomerDetailsPopoverProps` interface
- Add `invoiceId` to component props destructuring

**Success Criteria:**
- Component accepts optional `invoiceId` prop
- No breaking changes to existing usage

#### Task 2.2: Add Invoice Person IDs Fetch Logic
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Implementation:**
```typescript
import { useInvoicePersonIds } from '@/modules/orders/hooks/useOrders';

// Inside component:
const { data: invoicePersonIds, isLoading: isResolvingInvoice } = useInvoicePersonIds(
  invoiceId || null,
  { enabled: open && !!invoiceId }
);
```

**Success Criteria:**
- Hook is called when invoiceId is provided
- Query enabled only when popover is open
- Loading state tracked for invoice resolution

#### Task 2.3: Implement Resolution Logic with Link State
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Implementation:**
```typescript
// Resolution priority: personId > invoiceId (derive) > orderId (legacy) > null
const resolvedPersonId = personId ?? 
  (invoicePersonIds && invoicePersonIds.length === 1 ? invoicePersonIds[0] : null) ??
  orderPersonId ?? 
  null;

// Link state logic
const linkState: 'linked' | 'unlinked' | 'multiple' = 
  personId || (invoicePersonIds && invoicePersonIds.length === 1) || orderPersonId
    ? 'linked'
    : invoicePersonIds && invoicePersonIds.length > 1
    ? 'multiple'
    : 'unlinked';
```

**Success Criteria:**
- Resolution priority: personId > invoiceId > orderId > null
- Link state correctly identifies: linked, unlinked, multiple
- Multiple people case detected when invoicePersonIds.length > 1

#### Task 2.4: Update Badge Display Logic
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Implementation:**
```typescript
<Badge variant={linkState === 'linked' ? "default" : "secondary"}>
  {linkState === 'linked' ? "Linked" : 
   linkState === 'multiple' ? "Multiple people" : 
   "Unlinked"}
</Badge>
```

**Success Criteria:**
- Badge shows "Linked" when linkState is 'linked'
- Badge shows "Multiple people" when linkState is 'multiple'
- Badge shows "Unlinked" when linkState is 'unlinked'

#### Task 2.5: Handle Multiple People Case
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Implementation:**
```typescript
// Only fetch People when linkState is 'linked'
const shouldFetch = open && linkState === 'linked' && !!resolvedPersonId;
const { data: person, isLoading: isFetchingPerson, error } = useCustomer(shouldFetch ? resolvedPersonId : '');

// In render, show message for multiple people case
{linkState === 'multiple' && (
  <div className="text-sm text-muted-foreground p-2 bg-yellow-50 rounded">
    This invoice contains orders from multiple people.
  </div>
)}
```

**Success Criteria:**
- People query only fires when linkState is 'linked'
- Multiple people case shows message instead of fetching People
- Snapshot fallback data still shown for multiple people case

#### Task 2.6: Update Loading State
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Implementation:**
```typescript
const isLoading = isResolvingInvoice || isResolvingOrder || (isFetchingPerson && linkState === 'linked');
```

**Success Criteria:**
- Loading state includes invoice resolution
- Loading state includes order resolution (legacy)
- Loading state includes person fetch (only when linked)

**Dependencies:**
- Task 2.1, 2.2, 2.3, 2.4, 2.5 must be complete

---

### Phase 3: Update Invoicing Integration

**Goal:** Update Invoicing components to pass `invoiceId` prop instead of `orderId`.

#### Task 3.1: Update Invoices List/Table
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
- Replace `orderId={invoice.orderId || null}` with `invoiceId={invoice.id}`
- Remove `orderId` prop

**Before:**
```typescript
<CustomerDetailsPopover
  orderId={invoice.orderId || null}
  fallbackName={invoice.customer}
  // ...
/>
```

**After:**
```typescript
<CustomerDetailsPopover
  invoiceId={invoice.id}
  fallbackName={invoice.customer}
  // ...
/>
```

**Success Criteria:**
- Invoices list passes `invoiceId` prop
- `orderId` prop removed
- No breaking changes to other props

#### Task 3.2: Update Invoice Detail Sidebar
**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Changes:**
- Replace `orderId={invoice.order_id || null}` with `invoiceId={invoice.id}`
- Remove `orderId` prop

**Before:**
```typescript
<CustomerDetailsPopover
  orderId={invoice.order_id || null}
  fallbackName={invoice.customer_name}
  // ...
/>
```

**After:**
```typescript
<CustomerDetailsPopover
  invoiceId={invoice.id}
  fallbackName={invoice.customer_name}
  // ...
/>
```

**Success Criteria:**
- Invoice detail sidebar passes `invoiceId` prop
- `orderId` prop removed
- No breaking changes to other props

**Dependencies:**
- Phase 2 must be complete (CustomerDetailsPopover supports invoiceId)

---

### Phase 4: Testing & Validation

**Goal:** Verify all functionality works correctly and no regressions introduced.

#### Task 4.1: Test Invoice with Single Person
**Test Case:**
- Create or use invoice with orders that have single person_id
- Open customer popover
- Verify "Linked" badge appears
- Verify full People info displayed
- Verify Person query fires (check Network tab)

**Success Criteria:**
- Popover shows "Linked" badge
- Full People info displayed (phone, email, address)
- "Open Person" button visible
- Person query fires only when popover opens

#### Task 4.2: Test Invoice with Multiple People
**Test Case:**
- Create or use invoice with orders that have multiple person_ids
- Open customer popover
- Verify "Multiple people" badge appears
- Verify message displayed: "This invoice contains orders from multiple people."
- Verify no People query fires (check Network tab)
- Verify snapshot fallback data shown

**Success Criteria:**
- Popover shows "Multiple people" badge
- Message displayed correctly
- No People query fired
- Snapshot fallback data shown (customer name)

#### Task 4.3: Test Invoice with No Orders
**Test Case:**
- Create or use invoice with no linked orders
- Open customer popover
- Verify "Unlinked" badge appears
- Verify no order queries fired (check Network tab)
- Verify snapshot fallback data shown

**Success Criteria:**
- Popover shows "Unlinked" badge
- No order queries fired
- Snapshot fallback data shown

#### Task 4.4: Test Lazy Loading
**Test Case:**
- Navigate to Invoicing page
- Verify no order/person queries on page load (check Network tab)
- Open customer popover
- Verify order person_ids query fires
- Verify person query fires (if linked)

**Success Criteria:**
- No queries on page load
- Order person_ids query fires only when popover opens
- Person query fires only when linkState is 'linked'

#### Task 4.5: Regression Check - Orders Module
**Test Case:**
- Navigate to Orders page
- Click customer name in Orders table
- Verify popover still works (uses personId prop)
- Verify "Linked" badge appears when person_id exists
- Verify full People info displayed

**Success Criteria:**
- Orders module popover still works
- No regressions in Orders module
- personId prop resolution still works

#### Task 4.6: Build & Lint Validation
**Commands:**
```bash
npm run build
npm run lint
```

**Success Criteria:**
- Build passes without errors
- Lint passes without errors
- No TypeScript errors
- No runtime crashes

**Dependencies:**
- All previous phases must be complete

---

## Progress Tracking

- [ ] Phase 1: Add Invoice Person IDs API & Hook
  - [ ] Task 1.1: Add `fetchInvoicePersonIds` API Function
  - [ ] Task 1.2: Add `useInvoicePersonIds` React Query Hook
- [ ] Phase 2: Enhance CustomerDetailsPopover
  - [ ] Task 2.1: Add `invoiceId` Prop
  - [ ] Task 2.2: Add Invoice Person IDs Fetch Logic
  - [ ] Task 2.3: Implement Resolution Logic with Link State
  - [ ] Task 2.4: Update Badge Display Logic
  - [ ] Task 2.5: Handle Multiple People Case
  - [ ] Task 2.6: Update Loading State
- [ ] Phase 3: Update Invoicing Integration
  - [ ] Task 3.1: Update Invoices List/Table
  - [ ] Task 3.2: Update Invoice Detail Sidebar
- [ ] Phase 4: Testing & Validation
  - [ ] Task 4.1: Test Invoice with Single Person
  - [ ] Task 4.2: Test Invoice with Multiple People
  - [ ] Task 4.3: Test Invoice with No Orders
  - [ ] Task 4.4: Test Lazy Loading
  - [ ] Task 4.5: Regression Check - Orders Module
  - [ ] Task 4.6: Build & Lint Validation

---

## Deliverables

1. **API Function:** `fetchInvoicePersonIds(invoiceId)` in `orders.api.ts`
2. **React Query Hook:** `useInvoicePersonIds(invoiceId, { enabled })` in `useOrders.ts`
3. **Enhanced Component:** `CustomerDetailsPopover` with `invoiceId` prop and multiple people handling
4. **Updated Invoicing Components:** `InvoicingPage` and `InvoiceDetailSidebar` using `invoiceId`
5. **Verified Functionality:** All test cases passing, no regressions

---

## Risk Mitigation

### Risk: Breaking Orders Module
**Mitigation:** Maintain backward compatibility with `personId` and `orderId` props. Resolution priority ensures Orders module continues to work.

### Risk: Performance Impact
**Mitigation:** Lazy loading ensures queries only fire when popover opens. Minimal query (select only `person_id`) reduces data transfer.

### Risk: Multiple People UX Confusion
**Mitigation:** Clear "Multiple people" badge and message. Do not fetch People data to avoid showing incorrect person.

### Risk: TypeScript Errors
**Mitigation:** Proper type definitions for all new functions and props. Use existing patterns from codebase.

---

## Notes

- This implementation uses the correct relationship: `orders.invoice_id = invoice.id`
- No database schema changes required
- Backward compatible with existing `personId` and `orderId` props
- Multiple people case handled gracefully with clear messaging
- Lazy loading maintained for performance

