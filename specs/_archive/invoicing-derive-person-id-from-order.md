# Invoicing: Enhance CustomerDetailsPopover by Deriving person_id via Linked Order

## Overview

Enhance the Invoicing Customer details popover to display full customer (Person) details by deriving `person_id` from the linked Order when `invoice.order_id` exists. This enables the popover to show complete People information (phone, email, address) and display a "Linked" badge, matching the Orders module behavior.

**Context:**
- Invoicing module currently shows only customer name with "Unlinked" badge
- Invoices have `order_id` field linking to orders table
- Orders have `person_id` field linking to customers/people table
- CustomerDetailsPopover already supports person_id (used in Orders)
- Need to bridge invoice → order → person relationship

**Goal:**
- Derive `person_id` from linked Order when invoice has `order_id`
- Pass derived `person_id` to CustomerDetailsPopover
- Enable full People data display in Invoicing popover
- Show "Linked" badge when person_id is available
- Maintain lazy loading (no prefetching on page load)

---

## Current State Analysis

### Invoices Schema

**Table:** `public.invoices`

**Relevant Fields:**
- `id uuid pk`
- `order_id uuid null` - FK to orders table (optional)
- `customer_name text not null` - Customer name snapshot
- Other invoice fields...

**Observations:**
- `order_id` links to orders table
- No direct `person_id` field
- Currently popover receives `personId={null}`

### Orders Schema

**Table:** `public.orders`

**Relevant Fields:**
- `id uuid pk`
- `person_id uuid null` - FK to customers/people table
- `person_name text null` - Snapshot of person name
- `customer_name text not null` - Deceased name
- Other order fields...

**Observations:**
- Orders have `person_id` field
- Can be fetched via existing `useOrder(id)` hook
- `fetchOrder` already selects person_id

### Relationship Analysis

**Current Relationship:**
- Invoice → Order: `invoices.order_id` → `orders.id` (optional FK)
- Order → Person: `orders.person_id` → `customers.id` (optional FK)
- Indirect: Invoice → Order → Person

**Gaps/Issues:**
- Invoicing popover doesn't use order_id to derive person_id
- Missing lightweight hook to fetch only person_id from order
- No lazy loading of order.person_id when popover opens

### Data Access Patterns

**How Invoices are Currently Accessed:**
- `useInvoicesList()` - fetches all invoices
- Invoice has `order_id` field available in UIInvoice

**How Orders are Currently Accessed:**
- `useOrder(id)` - fetches full order (includes person_id)
- `fetchOrder(id)` - selects `*, customers(id, first_name, last_name)`
- Hook supports conditional enabling

**How They Are Queried Together (if at all):**
- Currently not queried together for popover
- Need lightweight query for just person_id

---

## Recommended Solution

### Lightweight Order Person ID Hook

**New Hook:** `useOrderPersonId(orderId, { enabled })`

**Purpose:**
- Fetch only `person_id` from order (minimal select)
- Enable only when popover is open and orderId exists
- Return person_id for passing to CustomerDetailsPopover

**Implementation:**
```typescript
// New API function
export async function fetchOrderPersonId(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('person_id')
    .eq('id', orderId)
    .single();
  
  if (error) throw error;
  return data.person_id as string | null;
}

// New hook
export function useOrderPersonId(orderId: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: orderId ? ['orders', 'personId', orderId] : ['orders', 'personId', 'disabled'],
    queryFn: () => fetchOrderPersonId(orderId!),
    enabled: (options?.enabled ?? true) && !!orderId,
  });
}
```

**Alternative (Reuse Existing):**
- Could reuse `useOrder(id)` but it fetches full order
- Lightweight hook is more efficient (only person_id)

### Popover Integration Strategy

**In Invoicing Components:**

1. **Invoices List/Table (`InvoicingPage.tsx`):**
   - Check if `invoice.orderId` exists
   - If yes, use `useOrderPersonId` hook (enabled when popover open)
   - Pass derived person_id to CustomerDetailsPopover
   - If no orderId, pass `personId={null}` (current behavior)

2. **Invoice Detail Sidebar (`InvoiceDetailSidebar.tsx`):**
   - Same pattern as list/table
   - Check `invoice.order_id` (from Invoice type, not UIInvoice)
   - Derive person_id and pass to popover

**Component Wrapper Pattern:**
```typescript
// In InvoicingPage or InvoiceDetailSidebar
const [popoverOpen, setPopoverOpen] = useState(false);
const { data: personId } = useOrderPersonId(invoice.orderId, { 
  enabled: popoverOpen && !!invoice.orderId 
});

<CustomerDetailsPopover
  personId={personId || null}
  fallbackName={invoice.customer}
  fallbackPhone={null}
  fallbackEmail={null}
  trigger={...}
/>
```

**Note:** CustomerDetailsPopover manages its own open state. We need to either:
- Option A: Expose open state from CustomerDetailsPopover (refactor)
- Option B: Create wrapper component that manages order fetch
- Option C: Modify CustomerDetailsPopover to accept orderId prop

**Decision:** Option C - Add optional `orderId` prop to CustomerDetailsPopover, handle order fetch internally.

---

## Implementation Approach

### Phase 1: Add Order Person ID API & Hook

1. **Create lightweight API function:**
   - `fetchOrderPersonId(orderId)` in `orders.api.ts`
   - Select only `person_id` field
   - Minimal query for performance

2. **Create React Query hook:**
   - `useOrderPersonId(orderId, { enabled })` in `orders.hooks.ts`
   - Support conditional enabling
   - Cache by orderId

### Phase 2: Enhance CustomerDetailsPopover

1. **Add orderId prop:**
   - Add optional `orderId?: string | null` to props
   - Handle order fetch internally when orderId provided

2. **Internal order fetch logic:**
   - Use `useOrderPersonId` when orderId exists
   - Enable only when popover is open
   - Use derived person_id for People fetch

3. **Fallback behavior:**
   - If orderId provided but order has no person_id → show "Unlinked"
   - If no orderId → use existing behavior (personId prop)

### Phase 3: Update Invoicing Integration

1. **Update Invoices List/Table:**
   - Pass `orderId={invoice.orderId}` to CustomerDetailsPopover
   - Remove `personId={null}` (let component derive it)

2. **Update Invoice Detail Sidebar:**
   - Pass `orderId={invoice.order_id}` to CustomerDetailsPopover
   - Same pattern as list/table

### Phase 4: Testing & Validation

1. **Test with order_id present:**
   - Invoice with order_id → popover shows full People info
   - "Linked" badge displayed
   - Phone/email/address shown

2. **Test with order_id but no person_id:**
   - Order exists but has no person_id → "Unlinked" badge
   - Fallback to customer_name only

3. **Test with no order_id:**
   - Invoice without order_id → current behavior (Unlinked, name only)

4. **Test lazy loading:**
   - No order fetch on page load
   - Order fetch only when popover opens
   - Person fetch only when order.person_id exists

---

## What NOT to Do

- **Do NOT change database schema** (no migrations)
- **Do NOT eager fetch orders for all invoices** (performance issue)
- **Do NOT change Orders module behavior** (no regressions)
- **Do NOT fetch full order** (only need person_id)
- **Do NOT break existing Invoicing popover** (backward compatible)

---

## Open Questions / Considerations

1. **CustomerDetailsPopover modification:**
   - Should we add orderId prop or create wrapper?
   - **Decision:** Add orderId prop to CustomerDetailsPopover for cleaner API

2. **Loading state:**
   - Should popover show loading while resolving order → person?
   - **Decision:** Yes, show loading skeleton while order fetch in progress

3. **Caching:**
   - Should order.person_id be cached separately?
   - **Decision:** React Query handles caching automatically by orderId

4. **Error handling:**
   - What if order fetch fails?
   - **Decision:** Fallback to "Unlinked" behavior, show customer_name only

5. **Multiple orders:**
   - Invoices can have multiple orders (via orders.invoice_id)
   - But invoice.order_id is single order reference
   - **Decision:** Use invoice.order_id (single order) for person_id derivation

---

## Acceptance Criteria

- ✅ Invoicing customer popover shows full People info when invoice has order_id with person_id
- ✅ Behavior matches Orders popover visually and functionally
- ✅ "Linked" badge shown when person_id available via order
- ✅ "Unlinked" badge shown when no order_id or order has no person_id
- ✅ No People or Orders queries fire until popover opens (lazy loading)
- ✅ Loading state shown while resolving order → person
- ✅ Error handling: fallback to "Unlinked" if order fetch fails
- ✅ No regressions in Orders module
- ✅ No regressions in Invoicing module (backward compatible)
- ✅ Build + lint pass
- ✅ No runtime crashes

---

## Success Metrics

- Invoicing popover displays full customer details when order linked
- Same UX as Orders popover (consistent experience)
- Lazy loading works correctly (verify in Network tab)
- Performance acceptable (no prefetching, minimal queries)
- All existing functionality preserved
- No regressions in either module

---

## Future Considerations

- **Direct person_id in invoices:**
   - Future migration could add `person_id` directly to invoices table
   - Would eliminate need for order lookup
   - Current solution is interim until schema enhancement

- **Multiple orders per invoice:**
   - Currently using `invoice.order_id` (single reference)
   - If invoices support multiple orders, may need different strategy
   - Current implementation handles single order case

