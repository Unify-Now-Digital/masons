# Research: Orders Customer Details Popover

## Problem Analysis

### Current State
- Orders table displays customer name in "Customer" column
- Customer name is plain text, not interactive
- No quick way to view customer details without navigating away
- Orders have `person_id` linking to People module (customers table)
- Orders also have snapshot fields: `customer_name`, `customer_phone`, `customer_email`

### Requirements
- Make customer name clickable
- Open popover card showing customer details
- Prefer People data via `person_id`, fallback to snapshot fields
- Include "Messages (Coming soon)" placeholder
- Lazy-load Person data only when popover opens

---

## Technical Decisions

### 1. Component Architecture

**Decision:** Create reusable `CustomerDetailsPopover` component

**Rationale:**
- Encapsulates all popover logic
- Reusable if needed elsewhere
- Clean separation of concerns
- Easy to test and maintain

**Alternatives Considered:**
- Inline popover in table cell (rejected: less reusable, harder to maintain)

---

### 2. Data Fetching Strategy

**Decision:** Reuse existing `useCustomer(id)` hook with conditional enabling

**Rationale:**
- Hook already exists in Customers module
- React Query provides caching automatically
- Conditional enabling ensures lazy loading
- No need to create new API

**Implementation:**
```typescript
const { data: person, isLoading, error } = useCustomer(personId || '', {
  enabled: open && !!personId, // Only fetch when popover open and personId exists
});
```

**Alternatives Considered:**
- Prefetch all customer data (rejected: performance issue)
- Create new hook (rejected: unnecessary duplication)

---

### 3. Fallback Strategy

**Decision:** Use snapshot fields as fallback when person data unavailable

**Rationale:**
- Snapshot fields provide resilience
- Works when person_id is null
- Works when person fetch fails
- Maintains data display even if person record deleted

**Implementation:**
```typescript
const displayName = person 
  ? `${person.first_name} ${person.last_name}` 
  : (fallbackName || '—');
  
const displayPhone = person?.phone || fallbackPhone || '—';
const displayEmail = person?.email || fallbackEmail || '—';
```

---

### 4. UI Component Choice

**Decision:** Use shadcn/ui Popover + Card components

**Rationale:**
- Already in project dependencies
- Consistent with app design system
- Accessible by default
- Easy to style and customize

**Alternatives Considered:**
- Custom popover (rejected: unnecessary work, less accessible)
- Dialog/Modal (rejected: too intrusive for quick details)

---

### 5. Navigation Strategy

**Decision:** Navigate to `/dashboard/customers` page

**Rationale:**
- Route exists in router
- Users can find customer there
- No detail route exists yet
- Future enhancement could add detail route or query param

**Implementation:**
```typescript
<Button
  onClick={() => {
    navigate('/dashboard/customers');
    setOpen(false);
  }}
>
  Open Person
</Button>
```

**Alternatives Considered:**
- Create detail route (rejected: out of scope)
- Pass query param (rejected: customers page may not support it yet)

---

### 6. Badge Display Logic

**Decision:** Show "Linked" when person loaded, "Unlinked" when personId null or fetch fails

**Rationale:**
- Clear visual indicator of data source
- Helps users understand data relationship
- Distinguishes between linked and unlinked orders

**Implementation:**
```typescript
const isLinked = !!personId && !!person && !error;

<Badge variant={isLinked ? "default" : "secondary"}>
  {isLinked ? "Linked" : "Unlinked"}
</Badge>
```

---

### 7. Popover Width

**Decision:** Use `w-80` (320px) width

**Rationale:**
- Reasonable width for customer details
- Doesn't break table layout
- Enough space for all fields
- Consistent with shadcn/ui defaults

**Alternatives Considered:**
- Default width (rejected: may be too narrow)
- Larger width (rejected: may break table layout)

---

## Constraints

### Performance
- **No prefetching:** Must not fetch customer data for all orders
- **Lazy loading:** Only fetch when popover opens
- **Caching:** React Query handles caching automatically

### Data Model
- **No schema changes:** Must not modify database
- **No migrations:** Additive UI only
- **Backward compatibility:** Must work with existing orders

### UI/UX
- **No layout shift:** Popover must not break table layout
- **Accessibility:** Keyboard navigation and screen reader support
- **Responsive:** Works on different screen sizes

---

## Open Questions Resolved

1. **Customer details route:** Navigate to `/dashboard/customers` (no detail route exists)
2. **Customer notes field:** Not in schema, skip for now
3. **Popover width:** Use `w-80` (320px)
4. **Copy buttons:** Nice-to-have, skip for MVP
5. **Loading state:** Show skeleton while fetching

---

## References

- shadcn/ui Popover: https://ui.shadcn.com/docs/components/popover
- React Query useQuery: https://tanstack.com/query/latest/docs/react/reference/useQuery
- Existing `useCustomer` hook: `src/modules/customers/hooks/useCustomers.ts`
- Orders table component: `src/modules/orders/components/SortableOrdersTable.tsx`

