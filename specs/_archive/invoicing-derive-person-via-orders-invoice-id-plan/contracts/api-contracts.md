# API Contracts: Invoicing Derive Person via Orders.invoice_id

## New API Functions

### `fetchInvoicePersonIds(invoiceId: string): Promise<string[]>`

**Purpose:** Fetch all unique non-null person_id values from orders linked to an invoice.

**Location:** `src/modules/orders/api/orders.api.ts`

**Signature:**
```typescript
export async function fetchInvoicePersonIds(invoiceId: string): Promise<string[]>
```

**Parameters:**
- `invoiceId: string` - UUID of the invoice

**Returns:**
- `Promise<string[]>` - Array of unique non-null person_id strings (empty array if none found)

**Implementation:**
```typescript
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

**Error Handling:**
- Throws Supabase errors
- Returns empty array if no orders found (not an error)

**Performance:**
- Uses index on `orders.invoice_id`
- Minimal data transfer (only person_id column)
- Client-side deduplication

---

## New React Query Hooks

### `useInvoicePersonIds(invoiceId, options?): UseQueryResult<string[], Error>`

**Purpose:** React Query hook to fetch person_ids for an invoice with conditional enabling.

**Location:** `src/modules/orders/hooks/useOrders.ts`

**Signature:**
```typescript
export function useInvoicePersonIds(
  invoiceId: string | null | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<string[], Error>
```

**Parameters:**
- `invoiceId: string | null | undefined` - UUID of the invoice (hook disabled if null/undefined)
- `options?: { enabled?: boolean }` - Optional configuration

**Returns:**
- `UseQueryResult<string[], Error>` - React Query result with array of person_ids

**Query Key:**
```typescript
invoiceId ? ['orders', 'personIdsByInvoice', invoiceId] : ['orders', 'personIdsByInvoice', 'disabled']
```

**Implementation:**
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

**Behavior:**
- Disabled when `invoiceId` is null/undefined
- Respects `options.enabled` flag
- Caches results by invoiceId
- Automatically refetches on cache invalidation

---

## Component Props

### `CustomerDetailsPopover` Props (Enhanced)

**Location:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Updated Interface:**
```typescript
interface CustomerDetailsPopoverProps {
  personId?: string | null;      // Explicit person_id (highest priority)
  invoiceId?: string | null;     // NEW: Invoice ID to derive person_id
  orderId?: string | null;        // Legacy: Order ID to derive person_id
  fallbackName?: string | null;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
  trigger: React.ReactNode;
}
```

**Resolution Priority:**
1. `personId` prop (explicit, used by Orders module)
2. `invoiceId` prop (derive from invoice's orders)
3. `orderId` prop (legacy, for backward compatibility)
4. `null` (fallback)

**Internal State:**
```typescript
// Derived from invoiceId
const { data: invoicePersonIds, isLoading: isResolvingInvoice } = useInvoicePersonIds(
  invoiceId || null,
  { enabled: open && !!invoiceId }
);

// Resolution logic
const resolvedPersonId = personId ?? 
  (invoicePersonIds && invoicePersonIds.length === 1 ? invoicePersonIds[0] : null) ??
  orderPersonId ?? 
  null;

// Link state
const linkState: 'linked' | 'unlinked' | 'multiple' = 
  personId || (invoicePersonIds && invoicePersonIds.length === 1) || orderPersonId
    ? 'linked'
    : invoicePersonIds && invoicePersonIds.length > 1
    ? 'multiple'
    : 'unlinked';
```

**Badge Display:**
- `linkState === 'linked'` → "Linked" badge (default variant)
- `linkState === 'multiple'` → "Multiple people" badge (secondary variant)
- `linkState === 'unlinked'` → "Unlinked" badge (secondary variant)

**People Fetch:**
- Only when `linkState === 'linked'` and `resolvedPersonId` exists
- Uses existing `useCustomer(resolvedPersonId)` hook

---

## Integration Points

### InvoicingPage

**Location:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Change:**
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

### InvoiceDetailSidebar

**Location:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Change:**
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

---

## Backward Compatibility

### Existing Usage (Orders Module)

**No Changes Required:**
```typescript
<CustomerDetailsPopover
  personId={order.person_id}
  fallbackName={order.customer_name}
  // ...
/>
```

**Behavior:**
- `personId` prop takes highest priority
- Invoice-based resolution skipped when `personId` provided
- No regressions

### Legacy Usage (orderId prop)

**Still Supported:**
```typescript
<CustomerDetailsPopover
  orderId={order.id}
  fallbackName={order.customer_name}
  // ...
/>
```

**Behavior:**
- `orderId` prop works as before
- Lower priority than `personId` and `invoiceId`
- Maintained for backward compatibility

---

## Error Handling

### API Errors

**Supabase Errors:**
- Network errors → React Query retry logic
- Permission errors → Error boundary catches
- Invalid invoiceId → Returns empty array (not an error)

### Component Errors

**Missing Data:**
- `invoiceId` null/undefined → Hook disabled, no query
- No orders found → Returns empty array, shows "Unlinked"
- No person_ids found → Returns empty array, shows "Unlinked"

**Multiple People:**
- Detected when `invoicePersonIds.length > 1`
- Shows "Multiple people" badge and message
- Does NOT fetch People data (avoids confusion)

---

## Performance Considerations

### Query Optimization
- Minimal query: select only `person_id` column
- Uses index on `orders.invoice_id`
- Client-side deduplication (Set)

### Lazy Loading
- Queries only when popover opens (`enabled: open && !!invoiceId`)
- No queries on page load
- React Query caching reduces redundant queries

### Caching
- Cache key includes invoiceId
- Multiple invoices with same orders share cache
- Automatic invalidation on order updates

