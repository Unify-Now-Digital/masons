# Implementation Plan: Invoicing - Derive person_id from Linked Order for CustomerDetailsPopover

**Branch:** `feature/invoicing-derive-person-id-from-order`  
**Specification:** `specs/invoicing-derive-person-id-from-order.md`

---

## Overview

This implementation plan enhances the Invoicing Customer details popover to display full customer (Person) details by deriving `person_id` from the linked Order when `invoice.order_id` exists. This enables the popover to show complete People information (phone, email, address) and display a "Linked" badge, matching the Orders module behavior.

**Goal:** 
- Add lightweight API and hook to fetch order.person_id
- Enhance CustomerDetailsPopover to accept optional `orderId` prop
- Update Invoicing integration to pass `orderId` instead of `personId={null}`
- Enable full People data display when invoice has linked order with person_id
- Maintain lazy loading (no prefetching on page load)

**Constraints:**
- No database changes or migrations
- No changes to Orders module behavior (backward compatible)
- Lightweight queries (only fetch person_id, not full order)
- Lazy loading only when popover opens
- Backward compatible (works with or without orderId)

---

## Phase 1 — Order → Person ID API & Hook

### Task 1.1: Add fetchOrderPersonId API Function

**File:** `src/modules/orders/api/orders.api.ts`

**Description:**
Add lightweight API function to fetch only person_id from an order.

**Changes:**
```typescript
/**
 * Fetch only person_id from an order (lightweight query)
 * @param orderId - UUID of the order
 * @returns person_id string or null
 */
export async function fetchOrderPersonId(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('person_id')
    .eq('id', orderId)
    .single();
  
  if (error) {
    // Handle gracefully - if order not found, return null
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  
  return data?.person_id as string | null;
}
```

**Validation:**
- Function added correctly
- Handles errors gracefully
- Returns null when order not found
- TypeScript compiles

---

### Task 1.2: Add useOrderPersonId Hook

**File:** `src/modules/orders/hooks/useOrders.ts`

**Description:**
Add React Query hook to fetch order person_id with conditional enabling.

**Changes:**
```typescript
// Add to ordersKeys
export const ordersKeys = {
  all: ['orders'] as const,
  detail: (id: string) => ['orders', id] as const,
  byInvoice: (invoiceId: string) => ['orders', 'byInvoice', invoiceId] as const,
  personId: (orderId: string) => ['orders', 'personId', orderId] as const, // NEW
};

// Add new hook
export function useOrderPersonId(
  orderId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: orderId ? ordersKeys.personId(orderId) : ['orders', 'personId', 'disabled'],
    queryFn: () => fetchOrderPersonId(orderId!),
    enabled: (options?.enabled ?? true) && !!orderId,
  });
}
```

**Validation:**
- Hook added correctly
- Conditional enabling works
- Caching by orderId works
- TypeScript compiles

---

### Task 1.3: Update Orders API Exports

**File:** `src/modules/orders/api/orders.api.ts`

**Description:**
Export the new fetchOrderPersonId function.

**Validation:**
- Function exported
- Importable from other modules

---

## Phase 2 — Enhance CustomerDetailsPopover (Backward Compatible)

### Task 2.1: Add orderId Prop to CustomerDetailsPopover

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Add optional `orderId` prop to component interface.

**Changes:**
```typescript
interface CustomerDetailsPopoverProps {
  personId?: string | null;
  orderId?: string | null; // NEW
  fallbackName?: string | null;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
  trigger: React.ReactNode;
}
```

**Validation:**
- Interface updated correctly
- TypeScript compiles
- Backward compatible (orderId is optional)

---

### Task 2.2: Add Order Person ID Fetch Logic

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Add internal order fetch logic when orderId is provided.

**Changes:**
```typescript
// Add import
import { useOrderPersonId } from '@/modules/orders/hooks/useOrders';

// Inside component, after open state:
// Fetch order person_id when orderId provided and popover is open
const { data: orderPersonId, isLoading: isResolvingOrder } = useOrderPersonId(
  orderId || null,
  { enabled: open && !!orderId }
);

// Resolve final personId: prefer explicit personId prop, else use orderPersonId
const resolvedPersonId = personId ?? orderPersonId ?? null;
```

**Validation:**
- Order fetch logic added
- Conditional enabling works (only when popover open)
- Resolved personId logic correct
- TypeScript compiles

---

### Task 2.3: Update Person Fetch to Use Resolved Person ID

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Update useCustomer hook to use resolvedPersonId instead of personId.

**Changes:**
```typescript
// Update shouldFetch and useCustomer call:
const shouldFetch = open && !!resolvedPersonId;
const { data: person, isLoading: isFetchingPerson, error } = useCustomer(shouldFetch ? resolvedPersonId : '');
```

**Validation:**
- Person fetch uses resolvedPersonId
- Lazy loading works correctly
- No regressions

---

### Task 2.4: Update Loading State

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Update loading state to show while resolving order → person.

**Changes:**
```typescript
// Update isLoading check:
const isLoading = isResolvingOrder || isFetchingPerson;

// Update isLinked calculation:
const isLinked = !!resolvedPersonId && !!person && !error;
```

**Validation:**
- Loading state includes order resolution
- isLinked uses resolvedPersonId
- Loading skeleton shows during order fetch

---

### Task 2.5: Update "Open Person" Button Condition

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Update button to show when resolvedPersonId exists.

**Changes:**
```typescript
// Update button condition:
{resolvedPersonId && (
  <CardContent className="pt-0">
    <Button ...>
      Open Person
    </Button>
  </CardContent>
)}
```

**Validation:**
- Button shows when resolvedPersonId exists
- Works for both direct personId and derived from orderId

---

## Phase 3 — Invoicing Integration

### Task 3.1: Update Invoices List/Table

**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Description:**
Update CustomerDetailsPopover to pass orderId instead of personId={null}.

**Changes:**
```typescript
// Update CustomerDetailsPopover props:
<CustomerDetailsPopover
  orderId={invoice.orderId || null} // NEW: pass orderId
  fallbackName={invoice.customer}
  fallbackPhone={null}
  fallbackEmail={null}
  trigger={...}
/>
// Remove: personId={null}
```

**Validation:**
- orderId prop passed correctly
- personId prop removed
- Component still works

---

### Task 3.2: Update Invoice Detail Sidebar

**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
Update CustomerDetailsPopover to pass orderId from invoice.order_id.

**Changes:**
```typescript
// Update CustomerDetailsPopover props:
<CustomerDetailsPopover
  orderId={invoice.order_id || null} // NEW: pass order_id
  fallbackName={invoice.customer_name}
  fallbackPhone={null}
  fallbackEmail={null}
  trigger={...}
/>
// Remove: personId={null}
```

**Validation:**
- orderId prop passed correctly
- Uses invoice.order_id (from Invoice type)
- Component still works

---

## Phase 4 — Testing & Validation

### Task 4.1: Test Orders Module Regression

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

**Description:**
Verify build and lint pass.

**Validation:**
- Build passes (`npm run build`)
- Lint passes (`npm run lint`)
- No TypeScript errors
- No console warnings

---

## Deliverables

- ✅ `fetchOrderPersonId` API function
- ✅ `useOrderPersonId` React Query hook
- ✅ CustomerDetailsPopover enhanced with `orderId` prop
- ✅ Invoicing list/table updated to pass orderId
- ✅ Invoice detail sidebar updated to pass orderId
- ✅ Lazy loading verified
- ✅ No regressions in Orders module
- ✅ All tests pass
- ✅ Build and lint pass

---

## Success Criteria

- Invoicing customer popover shows full People info when invoice has order_id with person_id
- Behavior matches Orders popover visually and functionally
- "Linked" badge shown when person_id available via order
- "Unlinked" badge shown when no order_id or order has no person_id
- No People or Orders queries fire until popover opens (lazy loading)
- Loading state shown while resolving order → person
- Error handling: fallback to "Unlinked" if order fetch fails
- No regressions in Orders module
- No regressions in Invoicing module (backward compatible)
- Build + lint pass
- No runtime crashes

