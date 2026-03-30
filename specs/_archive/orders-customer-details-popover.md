# Orders: Click-to-Open Customer Details Popover on Customer Column

## Overview

Add a clickable customer name in the Orders table that opens a popover card showing customer (Person) details. The popover displays information from the People module (linked via `person_id`) with fallback to snapshot fields, and includes a "Messages (Coming soon)" section.

**Context:**
- Orders table currently displays customer name in "Customer" column
- Orders have `person_id` linking to People module (customers table)
- Orders also have snapshot fields: `customer_name`, `customer_phone`, `customer_email`
- Need to provide quick access to customer details without navigating away

**Goal:**
- Make customer name clickable in Orders table
- Open popover card on click showing customer details
- Prefer People data via `person_id`, fallback to snapshot fields
- Include "Messages (Coming soon)" placeholder section
- Lazy-load Person data only when popover opens

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Relevant Fields:**
- `person_id uuid null` - FK to customers/people table
- `person_name text null` - Snapshot of person name
- `customer_name text not null` - Deceased name (legacy field, also used as fallback)
- `customer_email text null` - Snapshot email
- `customer_phone text null` - Snapshot phone

**Observations:**
- `person_id` links to People module (customers table)
- Snapshot fields provide fallback if person record missing
- Orders API already joins customers table when fetching

### Customers/People Schema

**Table:** `public.customers`

**Current Structure:**
- `id uuid pk`
- `first_name text not null`
- `last_name text not null`
- `email text null`
- `phone text null`
- `address text null`
- `city text null`
- `country text null`
- `created_at timestamptz`
- `updated_at timestamptz`

**Observations:**
- Full customer record available via `person_id`
- No `notes` field in current schema (may need to verify)

### Relationship Analysis

**Current Relationship:**
- Orders → Customers: `orders.person_id` → `customers.id` (optional FK)
- Orders API already joins customers table: `select('*, customers(id, first_name, last_name)')`
- Full customer data not always fetched (only basic fields in join)

**Gaps/Issues:**
- No UI component to display customer details in Orders table
- No lazy-loading hook for single customer fetch
- No navigation to customer details page (need to verify route)

### Data Access Patterns

**How Orders are Currently Accessed:**
- `useOrdersList()` - fetches all orders with basic customer join
- `transformOrdersForUI()` - maps customer name to `customer` field
- Orders table displays `order.customer` (Person name or "—")

**How Customers/People are Currently Accessed:**
- `useCustomersList()` - fetches all customers
- `useCustomer(id)` - fetches single customer by ID (exists, can be reused)
- Used in Customers module for list and detail views

**How They Are Queried Together (if at all):**
- Orders API joins customers for basic fields (first_name, last_name)
- Full customer details not fetched until needed

---

## Recommended Solution

### Component Architecture

**New Component:** `CustomerDetailsPopover`

**Props:**
```typescript
interface CustomerDetailsPopoverProps {
  personId?: string | null;
  fallbackName?: string | null;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
  trigger: React.ReactNode; // The clickable customer name
}
```

**Behavior:**
- Uses shadcn/ui Popover component
- Lazy-loads customer data only when popover opens
- Shows fallback data if person fetch fails or person_id is null
- Displays "Linked" or "Unlinked" badge based on person_id status

### Data Fetching Strategy

**Hook:** Reuse existing `useCustomer(id)` from `src/modules/customers/hooks/useCustomers.ts`

**Query Configuration:**
```typescript
const { data: person, isLoading } = useCustomer(personId || '', {
  enabled: isOpen && !!personId, // Only fetch when popover open and person_id exists
});
```

**Caching:**
- React Query automatically caches by customer ID
- Multiple orders with same person_id share cached data
- No prefetching for all rows

### UI Structure

**Popover Content:**
```
┌─────────────────────────────────┐
│ Customer Name        [Linked]   │ ← Header with badge
├─────────────────────────────────┤
│ Name: John Smith                │
│ Phone: +44 123 456 7890         │
│ Email: john@example.com         │
│ Address: 123 Main St, London     │
│                                 │
│ [Open Person]                    │ ← Link to customer details page
├─────────────────────────────────┤
│ Messages                         │
│ Coming soon — Inbox messages    │
│ are not connected to People yet. │
└─────────────────────────────────┘
```

---

## Implementation Approach

### Phase 1: Create CustomerDetailsPopover Component

1. **Create component file:**
   - `src/modules/orders/components/CustomerDetailsPopover.tsx`

2. **Implement popover structure:**
   - Use shadcn/ui Popover component
   - Accept trigger as prop (clickable customer name)
   - Manage open/close state internally

3. **Implement data fetching:**
   - Use `useCustomer(personId)` hook
   - Enable query only when popover is open and person_id exists
   - Handle loading and error states

4. **Implement content rendering:**
   - Header with customer name and badge
   - Basic info section (name, phone, email, address)
   - Fallback to snapshot fields if person data unavailable
   - "Open Person" link (only if person_id exists)
   - "Messages (Coming soon)" section

### Phase 2: Integrate into Orders Table

1. **Update UIOrder interface:**
   - Add `personId?: string | null` to UIOrder interface
   - Add fallback fields: `fallbackPhone?: string | null`, `fallbackEmail?: string | null`
   - Update `transformOrderForUI()` to include these fields

2. **Update SortableOrdersTable:**
   - Add specific case for 'customer' column (currently uses default case)
   - Wrap customer name with CustomerDetailsPopover component
   - Pass person_id and fallback fields from UIOrder
   - Make customer name clickable (button or link style)

3. **Handle edge cases:**
   - If customer name is "—", don't show popover trigger (just display "—")
   - If person_id is null, show "Unlinked" badge and use fallback data
   - If customer name is empty, show "—" without popover

### Phase 3: Navigation & Polish

1. **Add navigation link:**
   - Detect customer details route (likely `/dashboard/customers/:id` or similar)
   - Add "Open Person" button/link in popover
   - Only show when person_id exists

2. **Add optional features:**
   - Copy phone/email buttons (if easy to implement)
   - Loading skeleton in popover
   - Error state handling

3. **Testing:**
   - Test with person_id present
   - Test with person_id null (fallback)
   - Test with person fetch failure (fallback)
   - Verify lazy loading (check Network tab)
   - Verify caching (multiple orders, same person)

---

## What NOT to Do

- **Do NOT prefetch customer data for all orders** (performance issue)
- **Do NOT change database schema** (no migrations)
- **Do NOT change Orders table structure** (additive UI only)
- **Do NOT implement Messages functionality** (coming soon placeholder only)
- **Do NOT create new customer API** (reuse existing `useCustomer` hook)

---

## Open Questions / Considerations

1. **Customer details route:**
   - What is the exact route to customer details page?
   - **Decision:** Router shows `/dashboard/customers` exists but no detail route. "Open Person" link will navigate to `/dashboard/customers` page (users can find customer there). Future enhancement could add detail route or pass query param.

2. **Customer notes field:**
   - Does customers table have a notes field?
   - **Decision:** Check schema, include if exists

3. **Popover width:**
   - What is reasonable width for popover in table context?
   - **Decision:** Use default or `w-80` (320px), ensure doesn't break table layout

4. **Copy buttons:**
   - Should we add copy phone/email buttons?
   - **Decision:** Nice-to-have, implement if easy (use clipboard API)

5. **Loading state:**
   - Should popover show loading skeleton while fetching?
   - **Decision:** Yes, show skeleton for better UX

---

## Acceptance Criteria

- ✅ Clicking customer name in Orders table opens popover
- ✅ Popover shows customer details (name, phone, email, address)
- ✅ Person data loads only when popover opens (lazy loading)
- ✅ Fallback to snapshot fields if person_id null or fetch fails
- ✅ "Linked" badge shown when person_id exists and loaded
- ✅ "Unlinked" badge shown when person_id null or fetch fails
- ✅ "Open Person" link navigates to customer details page (when person_id exists)
- ✅ "Messages (Coming soon)" section displayed
- ✅ No performance issues (no prefetching, proper caching)
- ✅ Build + lint pass
- ✅ No runtime crashes

---

## Success Metrics

- Customer details accessible via click in Orders table
- Lazy loading works correctly (verify in Network tab)
- Fallback data displays correctly when person missing
- Popover doesn't break table layout
- Navigation to customer details works
- All existing functionality preserved

