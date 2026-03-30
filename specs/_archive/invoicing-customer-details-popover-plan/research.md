# Research: Invoicing Customer Details Popover

## Problem Analysis

### Current State
- Orders module has working CustomerDetailsPopover component
- Component is located in Orders module (`src/modules/orders/components/`)
- Invoicing module displays customer names but no popover functionality
- Invoices table has `customer_name` field but no `person_id` field
- Need to reuse Orders implementation for consistency

### Requirements
- Make customer name clickable in Invoicing module
- Open popover card showing customer details (same as Orders)
- Reuse existing component (no duplication)
- Handle invoices with only `customer_name` (no person_id)
- Maintain consistency with Orders module UX

---

## Technical Decisions

### 1. Component Refactoring Strategy

**Decision:** Move CustomerDetailsPopover to shared location

**Rationale:**
- Component is reusable across modules
- Shared location makes reuse explicit
- Matches pattern of other shared UI components
- Both Orders and Invoicing can import from same location

**Location:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Alternatives Considered:**
- Keep in Orders, import from there (rejected: unclear ownership)
- Duplicate component (rejected: maintenance burden, inconsistency risk)

---

### 2. Implementation Approach (Option A vs Option B)

**Decision:** Start with Option A (simple approach)

**Option A (MVP - Chosen):**
- Use only `customer_name` from invoices
- Show "Unlinked" badge always (no person_id available)
- Popover shows customer_name only, phone/email as "—"
- No API changes needed
- Fast to implement

**Option B (Enhanced - Deferred):**
- Join orders table to get person_id from linked order
- Requires API changes
- More complex
- Can be added later if needed

**Rationale:**
- Option A is sufficient for MVP
- No API changes needed
- Faster implementation
- Option B can be added later if requirements change

---

### 3. Data Fetching Strategy

**Decision:** Reuse existing `useCustomer` hook with conditional enabling

**Rationale:**
- Hook already exists in Customers module
- React Query provides caching automatically
- Conditional enabling ensures lazy loading
- Same pattern as Orders module

**Implementation:**
```typescript
// For invoices (no personId):
const shouldFetch = open && !!personId; // Will be false for invoices
const { data: person, isLoading, error } = useCustomer(shouldFetch ? personId : '');
```

**Note:** For invoices, personId will be null, so no fetch will occur. Popover will show fallback data only.

---

### 4. Fallback Strategy

**Decision:** Use customer_name as fallback, show "—" for phone/email

**Rationale:**
- Invoices only have `customer_name` field
- No `customer_phone` or `customer_email` fields
- Show "Unlinked" badge to indicate no person_id
- Phone/email will show "—" when not available

**Implementation:**
```typescript
const displayName = fallbackName || '—';
const displayPhone = '—'; // Not stored in invoices
const displayEmail = '—'; // Not stored in invoices
const isLinked = false; // No person_id in invoices
```

---

### 5. UI Integration Points

**Decision:** Add popover to both list/table and detail view (if applicable)

**Rationale:**
- Consistent UX across all customer name displays
- Users can access details from any context
- Matches Orders module pattern

**Locations:**
1. Invoices list/table: Customer column
2. Invoice detail sidebar: Customer name (if displayed)

---

### 6. Empty State Handling

**Decision:** Show "—" without popover trigger when customer_name is empty/null

**Rationale:**
- Prevents empty popover from opening
- Clear indication that no customer assigned
- Consistent with Orders module behavior

**Implementation:**
```typescript
{invoice.customer && invoice.customer !== '—' && invoice.customer !== 'No person assigned' ? (
  <CustomerDetailsPopover ... />
) : (
  <span className="text-sm text-muted-foreground">—</span>
)}
```

---

## Constraints

### Performance
- **No prefetching:** Must not fetch customer data for all invoices
- **Lazy loading:** Only fetch when popover opens (but invoices have no personId, so no fetch)
- **Caching:** React Query handles caching automatically (if personId becomes available)

### Data Model
- **No schema changes:** Must not modify database
- **No migrations:** Additive UI only
- **Backward compatibility:** Must work with existing invoices

### UI/UX
- **No layout shift:** Popover must not break table layout
- **Accessibility:** Keyboard navigation and screen reader support
- **Consistency:** Same UX as Orders module

---

## Open Questions Resolved

1. **Shared component location:** `src/shared/components/customer/` (matches existing structure)
2. **Implementation approach:** Option A (simple, MVP approach)
3. **Person ID handling:** Use null for invoices (no person_id available)
4. **Empty customer handling:** Show "—" without popover trigger
5. **Detail view integration:** Add popover if customer name is displayed

---

## Future Enhancements (Out of Scope)

1. **Option B Implementation:**
   - Join orders table to get person_id
   - Update invoice API to include order.person_id
   - Show "Linked" badge when person_id available

2. **Invoice Schema Enhancement:**
   - Add `person_id` field to invoices table
   - Add `customer_phone` and `customer_email` fields
   - Direct relationship to customers table

3. **Messages Integration:**
   - Connect inbox messages to People
   - Display messages in popover
   - Replace "Coming soon" placeholder

---

## References

- Existing CustomerDetailsPopover: `src/modules/orders/components/CustomerDetailsPopover.tsx`
- Orders implementation plan: `specs/orders-customer-details-popover-implementation-plan.md`
- Invoice schema: `src/modules/invoicing/types/invoicing.types.ts`
- Invoice transform: `src/modules/invoicing/utils/invoiceTransform.ts`

