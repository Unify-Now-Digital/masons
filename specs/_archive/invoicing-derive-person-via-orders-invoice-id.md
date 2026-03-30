# Invoicing: Derive Person for CustomerDetailsPopover via Orders.invoice_id (Correct Relationship)

## Overview

Fix the Invoicing CustomerDetailsPopover to derive person_id using the correct relationship: Invoice → Orders (via `orders.invoice_id`). The current approach uses `invoice.order_id` which is always NULL, so it will never work. The correct relationship is one Invoice has many Orders via `orders.invoice_id = invoice.id`, and Orders contain `person_id`.

**Context:**
- Current approach: Uses `invoice.order_id` (always NULL, confirmed by SQL)
- Correct relationship: Invoice → Orders via `orders.invoice_id = invoice.id`
- Orders contain `person_id` field
- Need to handle: 0 orders, 1 person, multiple people per invoice

**Goal:**
- Derive person_id from invoice's related orders (via `orders.invoice_id`)
- Show "Linked" when invoice has orders with single person_id
- Show "Multiple people" when invoice has orders with multiple person_ids
- Show "Unlinked" when invoice has no orders or orders have no person_id
- Maintain lazy loading (no queries until popover opens)

---

## Current State Analysis

### Invoices Schema

**Table:** `public.invoices`

**Relevant Fields:**
- `id uuid pk` - Primary key
- `order_id uuid null` - FK to orders table (always NULL, unused)
- `customer_name text not null` - Customer name snapshot
- Other invoice fields...

**Observations:**
- `order_id` column exists but is always NULL (confirmed by SQL)
- Cannot use `invoice.order_id` to derive person_id
- Need to use reverse relationship: `orders.invoice_id`

---

### Orders Schema

**Table:** `public.orders`

**Relevant Fields:**
- `id uuid pk` - Primary key
- `invoice_id uuid null` - FK to invoices table
- `person_id uuid null` - FK to customers/people table
- Other order fields...

**Observations:**
- `invoice_id` links orders to invoices (one invoice → many orders)
- `person_id` exists on orders (can be null)
- Multiple orders can belong to one invoice
- Multiple orders can have different person_ids

### Relationship Analysis

**Current Relationship (Incorrect):**
- Invoice → Order: `invoices.order_id` → `orders.id` (always NULL, unused)

**Correct Relationship:**
- Invoice → Orders: `invoices.id` ← `orders.invoice_id` (one-to-many)
- Order → Person: `orders.person_id` → `customers.id` (optional FK)

**Data Flow:**
- Invoice → fetch orders where `invoice_id = invoice.id`
- Collect all non-null `person_id`s from those orders
- Resolve to single person_id or handle multiple people

**Gaps/Issues:**
- Current implementation uses `invoice.order_id` (always NULL)
- Need to query orders by `invoice_id` instead
- Need to handle multiple person_ids per invoice
- Need to handle 0 orders or orders with null person_id

### Data Access Patterns

**How Invoices are Currently Accessed:**
- `useInvoicesList()` - fetches all invoices
- Invoice has `order_id` field (always NULL)

**How Orders are Currently Accessed:**
- `fetchOrdersByInvoice(invoiceId)` - fetches orders by invoice_id
- Returns full Order objects with `person_id` field
- Used in InvoiceDetailSidebar to show orders

**How They Are Queried Together:**
- Currently queried separately
- Need lightweight query for just person_ids

---

## Recommended Solution

### 1. Add Lightweight API to Fetch Person IDs by Invoice

**New Function:** `fetchInvoicePersonIds(invoiceId)`

**Purpose:**
- Fetch only `person_id` values from orders linked to invoice
- Minimal query (select only person_id)
- Return array of non-null person_ids

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
    .eq('invoice_id', invoiceId)
    .not('person_id', 'is', null);
  
  if (error) throw error;
  
  // Extract unique person_ids
  const personIds = new Set<string>();
  data?.forEach(order => {
    if (order.person_id) {
      personIds.add(order.person_id);
    }
  });
  
  return Array.from(personIds);
}
```

**Alternative (Simpler):**
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

### 2. Add React Query Hook

**New Hook:** `useInvoicePersonIds(invoiceId, { enabled })`

**Purpose:**
- Fetch person_ids for invoice with conditional enabling
- Cache by invoiceId
- Return array of person_ids

**Implementation:**
```typescript
export function useInvoicePersonIds(
  invoiceId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: invoiceId ? ['orders', 'personIdsByInvoice', invoiceId] : ['orders', 'personIdsByInvoice', 'disabled'],
    queryFn: () => fetchInvoicePersonIds(invoiceId!),
    enabled: (options?.enabled ?? true) && !!invoiceId,
  });
}
```

### 3. Enhance CustomerDetailsPopover

**Add invoiceId Prop:**
- Add optional `invoiceId?: string | null` prop
- Resolution priority:
  1. `personId` prop (explicit, used by Orders module)
  2. `invoiceId` prop (derive from invoice's orders)
  3. `orderId` prop (legacy, for backward compatibility)
  4. null (fallback)

**Derived State:**
- `resolvedPersonId: string | null`
- `linkState: 'linked' | 'unlinked' | 'multiple'`

**Link State Logic:**
- If `personIds.length === 0` → 'unlinked'
- If `personIds.length === 1` → 'linked' (use that person_id)
- If `personIds.length > 1` → 'multiple' (don't fetch People, show message)

**Badge Rules:**
- 'linked' → "Linked" badge
- 'unlinked' → "Unlinked" badge
- 'multiple' → "Multiple people" badge

**Multiple People Handling:**
- Show message: "This invoice contains orders from multiple people."
- Do NOT fetch People data (no useCustomer call)
- Show snapshot fallback data only

### 4. Update Invoicing Integration

**In InvoicingPage:**
- Pass `invoiceId={invoice.id}` to CustomerDetailsPopover
- Remove `orderId` prop (since it's unused/null)

**In InvoiceDetailSidebar:**
- Pass `invoiceId={invoice.id}` to CustomerDetailsPopover
- Remove `orderId` prop (since it's unused/null)

---

## Implementation Approach

### Phase 1: Add Invoice Person IDs API & Hook

1. **Create lightweight API function:**
   - `fetchInvoicePersonIds(invoiceId)` in `orders.api.ts`
   - Select only `person_id` from orders where `invoice_id = invoiceId`
   - Return array of unique non-null person_ids

2. **Create React Query hook:**
   - `useInvoicePersonIds(invoiceId, { enabled })` in `orders.hooks.ts`
   - Support conditional enabling
   - Cache by invoiceId

### Phase 2: Enhance CustomerDetailsPopover

1. **Add invoiceId prop:**
   - Add optional `invoiceId?: string | null` to props
   - Handle invoice-based resolution internally

2. **Add invoice person IDs fetch logic:**
   - Use `useInvoicePersonIds` when invoiceId provided
   - Enable only when popover is open
   - Derive link state from personIds array

3. **Update resolution logic:**
   - Priority: personId prop > invoiceId (derive) > orderId (legacy) > null
   - Handle multiple person_ids case
   - Show "Multiple people" badge and message

4. **Update badge and display:**
   - Show "Linked" when linkState is 'linked'
   - Show "Unlinked" when linkState is 'unlinked'
   - Show "Multiple people" when linkState is 'multiple'
   - Only fetch People when linkState is 'linked'

### Phase 3: Update Invoicing Integration

1. **Update Invoices List/Table:**
   - Pass `invoiceId={invoice.id}` to CustomerDetailsPopover
   - Remove `orderId` prop

2. **Update Invoice Detail Sidebar:**
   - Pass `invoiceId={invoice.id}` to CustomerDetailsPopover
   - Remove `orderId` prop

### Phase 4: Testing & Validation

1. **Test with invoice that has orders with single person_id:**
   - Popover shows "Linked" badge
   - Full People info displayed
   - Person query fires

2. **Test with invoice that has orders with multiple person_ids:**
   - Popover shows "Multiple people" badge
   - Message displayed: "This invoice contains orders from multiple people."
   - No People query fired
   - Snapshot fallback data shown

3. **Test with invoice that has no orders:**
   - Popover shows "Unlinked" badge
   - No order queries fired
   - Snapshot fallback data shown

4. **Test lazy loading:**
   - No queries on page load
   - Order person_ids query fires only when popover opens
   - Person query fires only when linkState is 'linked'

5. **Regression check:**
   - Orders module popover still works (uses personId prop)
   - No regressions in existing functionality

---

## What NOT to Do

- **Do NOT use `invoice.order_id`** (always NULL, won't work)
- **Do NOT change database schema** (no migrations)
- **Do NOT remove lazy loading** (queries only when popover opens)
- **Do NOT break Orders module** (no regressions)
- **Do NOT fetch People for multiple people case** (show message instead)

---

## Open Questions / Considerations

1. **Multiple people UX:**
   - Show "Multiple people" badge and message (chosen)
   - Do NOT fetch People data
   - Show snapshot fallback only
   - **Rationale:** Safest UX, avoids confusion about which person to show

2. **Resolution priority:**
   - personId prop > invoiceId > orderId > null (chosen)
   - Ensures Orders module still works
   - Backward compatible with orderId prop

3. **Query optimization:**
   - Fetch only `person_id` (minimal query)
   - Filter out nulls in query or client-side
   - **Decision:** Filter client-side for simplicity

4. **Caching:**
   - React Query handles caching automatically
   - Cache by invoiceId
   - Multiple invoices with same orders share cache

---

## Acceptance Criteria

- ✅ Invoicing popover shows "Linked" when invoice has orders with single person_id
- ✅ Invoicing popover shows "Multiple people" when invoice has orders with multiple person_ids
- ✅ Invoicing popover shows "Unlinked" when invoice has no orders or orders have no person_id
- ✅ No reliance on `invoices.order_id` (always NULL)
- ✅ Uses correct relationship: `orders.invoice_id = invoice.id`
- ✅ Lazy loading: no queries until popover opens
- ✅ No regressions in Orders module
- ✅ Build + lint pass
- ✅ No runtime crashes

---

## Success Metrics

- Invoicing popover displays full customer details when invoice has orders with single person_id
- "Multiple people" case handled gracefully (badge + message, no People fetch)
- "Unlinked" case handled correctly (badge + snapshot fallback)
- Lazy loading works correctly (verify in Network tab)
- No regressions in Orders module
- All existing functionality preserved

---

## Future Considerations

- **Direct person_id in invoices:**
   - Future migration could add `person_id` directly to invoices table
   - Would eliminate need for order lookup
   - Current solution is interim until schema enhancement

- **Multiple people resolution:**
   - Future enhancement: allow user to select which person to show
   - Or show all people in a list
   - Current implementation shows message (safest UX)

