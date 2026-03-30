# Research: Invoicing - Derive person_id from Linked Order

## Problem Analysis

### Current State
- Invoicing CustomerDetailsPopover shows only customer_name with "Unlinked" badge
- Invoices have `order_id` field linking to orders table
- Orders have `person_id` field linking to customers/people table
- CustomerDetailsPopover already supports person_id (used in Orders)
- Missing bridge: invoice → order → person relationship

### Requirements
- Derive person_id from linked Order when invoice has order_id
- Enable full People data display in Invoicing popover
- Show "Linked" badge when person_id available
- Maintain lazy loading (no prefetching)
- Backward compatible (works with or without orderId)

---

## Technical Decisions

### 1. Lightweight Order Person ID Hook

**Decision:** Create `useOrderPersonId` hook that fetches only person_id

**Rationale:**
- More efficient than fetching full order
- Minimal query (select only person_id)
- Supports conditional enabling
- React Query handles caching automatically

**Implementation:**
```typescript
export async function fetchOrderPersonId(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('person_id')
    .eq('id', orderId)
    .single();
  
  return data?.person_id as string | null;
}
```

**Alternatives Considered:**
- Reuse `useOrder(id)` (rejected: fetches full order, over-fetching)
- Join in invoice query (rejected: eager loading, performance issue)

---

### 2. CustomerDetailsPopover Enhancement Strategy

**Decision:** Add optional `orderId` prop to CustomerDetailsPopover

**Rationale:**
- Cleaner API than wrapper component
- Component handles order fetch internally
- Backward compatible (orderId is optional)
- Single source of truth for person resolution

**Implementation:**
```typescript
interface CustomerDetailsPopoverProps {
  personId?: string | null;
  orderId?: string | null; // NEW
  // ... other props
}

// Internal resolution:
const resolvedPersonId = personId ?? orderPersonId ?? null;
```

**Alternatives Considered:**
- Wrapper component (rejected: more complexity, extra component)
- Expose open state (rejected: breaks encapsulation)

---

### 3. Person ID Resolution Priority

**Decision:** Prefer explicit personId prop, else use orderPersonId

**Rationale:**
- Explicit personId takes precedence (Orders module)
- orderPersonId is fallback (Invoicing module)
- Clear priority order
- Backward compatible

**Implementation:**
```typescript
const resolvedPersonId = personId ?? orderPersonId ?? null;
```

**Priority:**
1. Explicit `personId` prop (if provided)
2. Derived from `orderId` (if provided and order has person_id)
3. null (fallback)

---

### 4. Lazy Loading Strategy

**Decision:** Enable order fetch only when popover is open

**Rationale:**
- No prefetching on page load
- Order fetch only when needed
- Person fetch only after order.person_id resolved
- Performance optimized

**Implementation:**
```typescript
const { data: orderPersonId } = useOrderPersonId(orderId, {
  enabled: open && !!orderId, // Only when popover open
});

const { data: person } = useCustomer(resolvedPersonId, {
  enabled: open && !!resolvedPersonId, // Only when popover open and personId exists
});
```

---

### 5. Loading State Handling

**Decision:** Show loading skeleton while resolving order → person

**Rationale:**
- Better UX during two-step fetch
- Clear indication that data is loading
- Consistent with existing loading pattern

**Implementation:**
```typescript
const isLoading = isResolvingOrder || isFetchingPerson;
```

---

### 6. Error Handling

**Decision:** Fallback to "Unlinked" behavior on errors

**Rationale:**
- Graceful degradation
- No crashes or broken UI
- User still sees customer_name
- Consistent with existing error handling

**Implementation:**
```typescript
// In fetchOrderPersonId:
if (error.code === 'PGRST116') {
  return null; // Order not found
}

// In component:
const isLinked = !!resolvedPersonId && !!person && !error;
```

---

## Constraints

### Performance
- **No prefetching:** Must not fetch orders/persons on page load
- **Lazy loading:** Only fetch when popover opens
- **Minimal queries:** Only fetch person_id, not full order
- **Caching:** React Query handles caching automatically

### Backward Compatibility
- **Orders module:** Must continue working with personId prop
- **Invoicing module:** Must work with or without orderId
- **No breaking changes:** All existing usage must work

### Data Model
- **No schema changes:** Must not modify database
- **No migrations:** Additive API/hooks only
- **Use existing relationships:** Invoice → Order → Person

---

## Open Questions Resolved

1. **Component modification vs wrapper:**
   - Add orderId prop to CustomerDetailsPopover (chosen)
   - Cleaner API, backward compatible

2. **Loading state:**
   - Show loading while resolving order → person (chosen)
   - Better UX, consistent pattern

3. **Error handling:**
   - Fallback to "Unlinked" behavior (chosen)
   - Graceful degradation, no crashes

4. **Query optimization:**
   - Fetch only person_id, not full order (chosen)
   - Minimal query, better performance

5. **Caching:**
   - React Query handles automatically (chosen)
   - No manual cache management needed

---

## References

- Existing CustomerDetailsPopover: `src/shared/components/customer/CustomerDetailsPopover.tsx`
- Orders API: `src/modules/orders/api/orders.api.ts`
- Orders hooks: `src/modules/orders/hooks/useOrders.ts`
- Invoice schema: `src/modules/invoicing/types/invoicing.types.ts`
- Previous implementation: `specs/invoicing-customer-details-popover-implementation-plan.md`

