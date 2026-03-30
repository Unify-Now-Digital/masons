# Quick Start: Invoicing Derive Person via Orders.invoice_id

## Overview

This feature fixes the Invoicing CustomerDetailsPopover to derive person_id using the correct relationship: Invoice → Orders (via `orders.invoice_id`). The current approach uses `invoice.order_id` which is always NULL.

## Key Changes

1. **New API Function:** `fetchInvoicePersonIds(invoiceId)` - Fetches person_ids from orders linked to invoice
2. **New Hook:** `useInvoicePersonIds(invoiceId, { enabled })` - React Query hook for invoice person_ids
3. **Enhanced Component:** `CustomerDetailsPopover` - Adds `invoiceId` prop and multiple people handling
4. **Updated Integration:** Invoicing components pass `invoiceId` instead of `orderId`

## Implementation Steps

### Step 1: Add API Function

**File:** `src/modules/orders/api/orders.api.ts`

Add function:
```typescript
export async function fetchInvoicePersonIds(invoiceId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('person_id')
    .eq('invoice_id', invoiceId);
  
  if (error) throw error;
  
  const personIds = new Set<string>();
  data?.forEach(order => {
    if (order.person_id) {
      personIds.add(order.person_id);
    }
  });
  
  return Array.from(personIds);
}
```

### Step 2: Add React Query Hook

**File:** `src/modules/orders/hooks/useOrders.ts`

Add to `ordersKeys`:
```typescript
personIdsByInvoice: (invoiceId: string) => ['orders', 'personIdsByInvoice', invoiceId] as const,
```

Add hook:
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

### Step 3: Enhance CustomerDetailsPopover

**File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

1. Add `invoiceId` prop to interface
2. Add `useInvoicePersonIds` hook call
3. Implement resolution logic with link state
4. Update badge display
5. Handle multiple people case

### Step 4: Update Invoicing Integration

**Files:**
- `src/modules/invoicing/pages/InvoicingPage.tsx`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

Change:
```typescript
// Before
orderId={invoice.orderId || null}

// After
invoiceId={invoice.id}
```

## Testing Checklist

- [ ] Invoice with single person_id → Shows "Linked" badge
- [ ] Invoice with multiple person_ids → Shows "Multiple people" badge
- [ ] Invoice with no orders → Shows "Unlinked" badge
- [ ] Lazy loading works (no queries on page load)
- [ ] Orders module still works (no regressions)
- [ ] Build and lint pass

## Key Concepts

### Resolution Priority
1. `personId` prop (explicit)
2. `invoiceId` prop (derive from orders)
3. `orderId` prop (legacy)
4. `null` (fallback)

### Link State
- `'linked'` - Single person_id found, fetch People data
- `'multiple'` - Multiple person_ids found, show message
- `'unlinked'` - No person_ids found, show snapshot

### Lazy Loading
- Queries only fire when popover opens
- `enabled: open && !!invoiceId` ensures conditional fetching

## Common Issues

### Issue: Popover always shows "Unlinked"
**Solution:** Verify `invoiceId` prop is passed correctly (not `orderId`)

### Issue: Multiple people not detected
**Solution:** Check `invoicePersonIds.length > 1` logic

### Issue: People query fires for multiple people
**Solution:** Ensure `shouldFetch` only true when `linkState === 'linked'`

## Next Steps

After implementation:
1. Test all edge cases
2. Verify lazy loading
3. Check for regressions
4. Update documentation if needed

