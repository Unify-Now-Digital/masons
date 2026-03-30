# Tasks: Invoicing Derive Person via Orders.invoice_id

## Phase 1: Add Invoice Person IDs API & Hook

### Task 1.1: Add `fetchInvoicePersonIds` API Function
**File:** `src/modules/orders/api/orders.api.ts`  
**Status:** ✅ Completed

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

**Acceptance Criteria:**
- Function queries orders table filtered by `invoice_id`
- Returns array of unique non-null person_ids
- Handles empty results gracefully (returns empty array)
- Error handling for Supabase errors

---

### Task 1.2: Add `useInvoicePersonIds` React Query Hook
**File:** `src/modules/orders/hooks/useOrders.ts`  
**Status:** ✅ Completed

**Implementation:**
1. Add to `ordersKeys`:
```typescript
export const ordersKeys = {
  // ... existing keys ...
  personIdsByInvoice: (invoiceId: string) => ['orders', 'personIdsByInvoice', invoiceId] as const,
};
```

2. Add hook:
```typescript
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

**Acceptance Criteria:**
- Hook supports conditional enabling
- Cache key includes invoiceId
- Returns React Query result with array of person_ids
- Disabled when invoiceId is null/undefined

**Dependencies:**
- Task 1.1 must be complete

---

## Phase 2: Enhance CustomerDetailsPopover

### Task 2.1: Add `invoiceId` Prop to CustomerDetailsPopover
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`  
**Status:** ✅ Completed

**Changes:**
1. Update interface:
```typescript
interface CustomerDetailsPopoverProps {
  personId?: string | null;
  invoiceId?: string | null;  // NEW
  orderId?: string | null;
  // ... other props
}
```

2. Add to component props destructuring:
```typescript
export const CustomerDetailsPopover: React.FC<CustomerDetailsPopoverProps> = ({
  personId,
  invoiceId,  // NEW
  orderId,
  // ... other props
}) => {
```

**Acceptance Criteria:**
- Component accepts optional `invoiceId` prop
- No breaking changes to existing usage
- TypeScript types updated

---

### Task 2.2: Add Invoice Person IDs Fetch Logic
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`  
**Status:** ✅ Completed

**Implementation:**
1. Import hook:
```typescript
import { useInvoicePersonIds } from '@/modules/orders/hooks/useOrders';
```

2. Add hook call:
```typescript
const { data: invoicePersonIds, isLoading: isResolvingInvoice } = useInvoicePersonIds(
  invoiceId || null,
  { enabled: open && !!invoiceId }
);
```

**Acceptance Criteria:**
- Hook is called when invoiceId is provided
- Query enabled only when popover is open
- Loading state tracked for invoice resolution

**Dependencies:**
- Task 1.2 must be complete

---

### Task 2.3: Implement Resolution Logic with Link State
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`  
**Status:** ✅ Completed

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

**Acceptance Criteria:**
- Resolution priority: personId > invoiceId > orderId > null
- Link state correctly identifies: linked, unlinked, multiple
- Multiple people case detected when invoicePersonIds.length > 1

**Dependencies:**
- Task 2.2 must be complete

---

### Task 2.4: Update Badge Display Logic
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`  
**Status:** ✅ Completed

**Implementation:**
```typescript
<Badge variant={linkState === 'linked' ? "default" : "secondary"}>
  {linkState === 'linked' ? "Linked" : 
   linkState === 'multiple' ? "Multiple people" : 
   "Unlinked"}
</Badge>
```

**Acceptance Criteria:**
- Badge shows "Linked" when linkState is 'linked'
- Badge shows "Multiple people" when linkState is 'multiple'
- Badge shows "Unlinked" when linkState is 'unlinked'

**Dependencies:**
- Task 2.3 must be complete

---

### Task 2.5: Handle Multiple People Case
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`  
**Status:** ✅ Completed

**Implementation:**
1. Update People fetch condition:
```typescript
// Only fetch People when linkState is 'linked'
const shouldFetch = open && linkState === 'linked' && !!resolvedPersonId;
const { data: person, isLoading: isFetchingPerson, error } = useCustomer(shouldFetch ? resolvedPersonId : '');
```

2. Add multiple people message in render:
```typescript
{linkState === 'multiple' && (
  <CardContent className="pt-0 border-t">
    <div className="text-sm text-muted-foreground p-2 bg-yellow-50 rounded">
      This invoice contains orders from multiple people.
    </div>
  </CardContent>
)}
```

**Acceptance Criteria:**
- People query only fires when linkState is 'linked'
- Multiple people case shows message instead of fetching People
- Snapshot fallback data still shown for multiple people case

**Dependencies:**
- Task 2.3 must be complete

---

### Task 2.6: Update Loading State
**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`  
**Status:** ✅ Completed

**Implementation:**
```typescript
const isLoading = isResolvingInvoice || isResolvingOrder || (isFetchingPerson && linkState === 'linked');
```

**Acceptance Criteria:**
- Loading state includes invoice resolution
- Loading state includes order resolution (legacy)
- Loading state includes person fetch (only when linked)

**Dependencies:**
- Task 2.2, 2.3, 2.5 must be complete

---

## Phase 3: Update Invoicing Integration

### Task 3.1: Update Invoices List/Table
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`  
**Status:** ✅ Completed

**Changes:**
Find CustomerDetailsPopover usage and update:
```typescript
// Before
<CustomerDetailsPopover
  orderId={invoice.orderId || null}
  fallbackName={invoice.customer}
  // ...
/>

// After
<CustomerDetailsPopover
  invoiceId={invoice.id}
  fallbackName={invoice.customer}
  // ...
/>
```

**Acceptance Criteria:**
- Invoices list passes `invoiceId` prop
- `orderId` prop removed
- No breaking changes to other props

**Dependencies:**
- Phase 2 must be complete

---

### Task 3.2: Update Invoice Detail Sidebar
**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`  
**Status:** ✅ Completed

**Changes:**
Find CustomerDetailsPopover usage and update:
```typescript
// Before
<CustomerDetailsPopover
  orderId={invoice.order_id || null}
  fallbackName={invoice.customer_name}
  // ...
/>

// After
<CustomerDetailsPopover
  invoiceId={invoice.id}
  fallbackName={invoice.customer_name}
  // ...
/>
```

**Acceptance Criteria:**
- Invoice detail sidebar passes `invoiceId` prop
- `orderId` prop removed
- No breaking changes to other props

**Dependencies:**
- Phase 2 must be complete

---

## Phase 4: Testing & Validation

### Task 4.1: Test Invoice with Single Person
**Status:** Pending

**Test Case:**
- Create or use invoice with orders that have single person_id
- Open customer popover
- Verify "Linked" badge appears
- Verify full People info displayed
- Verify Person query fires (check Network tab)

**Acceptance Criteria:**
- Popover shows "Linked" badge
- Full People info displayed (phone, email, address)
- "Open Person" button visible
- Person query fires only when popover opens

---

### Task 4.2: Test Invoice with Multiple People
**Status:** Pending

**Test Case:**
- Create or use invoice with orders that have multiple person_ids
- Open customer popover
- Verify "Multiple people" badge appears
- Verify message displayed: "This invoice contains orders from multiple people."
- Verify no People query fires (check Network tab)
- Verify snapshot fallback data shown

**Acceptance Criteria:**
- Popover shows "Multiple people" badge
- Message displayed correctly
- No People query fired
- Snapshot fallback data shown (customer name)

---

### Task 4.3: Test Invoice with No Orders
**Status:** Pending

**Test Case:**
- Create or use invoice with no linked orders
- Open customer popover
- Verify "Unlinked" badge appears
- Verify no order queries fired (check Network tab)
- Verify snapshot fallback data shown

**Acceptance Criteria:**
- Popover shows "Unlinked" badge
- No order queries fired
- Snapshot fallback data shown

---

### Task 4.4: Test Lazy Loading
**Status:** Pending

**Test Case:**
- Navigate to Invoicing page
- Verify no order/person queries on page load (check Network tab)
- Open customer popover
- Verify order person_ids query fires
- Verify person query fires (if linked)

**Acceptance Criteria:**
- No queries on page load
- Order person_ids query fires only when popover opens
- Person query fires only when linkState is 'linked'

---

### Task 4.5: Regression Check - Orders Module
**Status:** Pending

**Test Case:**
- Navigate to Orders page
- Click customer name in Orders table
- Verify popover still works (uses personId prop)
- Verify "Linked" badge appears when person_id exists
- Verify full People info displayed

**Acceptance Criteria:**
- Orders module popover still works
- No regressions in Orders module
- personId prop resolution still works

---

### Task 4.6: Build & Lint Validation
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
- No runtime crashes

**Dependencies:**
- All previous phases must be complete

---

## Summary

**Total Tasks:** 14  
**Completed:** 11  
**Pending:** 3 (Manual testing tasks: 4.1-4.5)

**Phases:**
- Phase 1: 2 tasks (API & Hook)
- Phase 2: 6 tasks (Component Enhancement)
- Phase 3: 2 tasks (Integration)
- Phase 4: 4 tasks (Testing)

**Estimated Time:**
- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 15 minutes
- Phase 4: 30 minutes
- **Total:** ~2 hours

