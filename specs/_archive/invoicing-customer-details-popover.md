# Invoicing: Add Customer Details Popover (Same as Orders)

## Overview

Add a clickable customer name in the Invoicing module that opens a popover card showing customer (Person) details, matching the implementation in the Orders module. The popover displays information from the People module (linked via `person_id` or `customer_id`) with fallback to snapshot fields, and includes a "Messages (Coming soon)" section.

**Context:**
- Orders module already has a working CustomerDetailsPopover component
- Invoicing module displays customer names in invoices list/table and invoice detail pages
- Need to provide quick access to customer details without navigating away
- Should reuse existing component to maintain consistency

**Goal:**
- Make customer name clickable in Invoicing module (list/table and detail pages)
- Open popover card on click showing customer details (same as Orders)
- Prefer People data via linked ID, fallback to snapshot fields
- Include "Messages (Coming soon)" placeholder section
- Lazy-load Person data only when popover opens
- Refactor CustomerDetailsPopover to shared location for reuse

---

## Current State Analysis

### Invoices Schema

**Table:** `public.invoices`

**Current Structure (Verified):**
- `id uuid pk`
- `invoice_number text not null`
- `customer_name text not null` - Customer name (snapshot, may be empty)
- `amount numeric not null`
- `status text not null`
- `due_date date`
- `issue_date date`
- `order_id uuid null` - FK to orders table
- `payment_method text null`
- `payment_date date null`
- `notes text null`
- `created_at timestamptz`
- `updated_at timestamptz`

**Observations:**
- **No `person_id` or `customer_id` field currently exists** in invoices table
- Only has `customer_name` as snapshot field
- No `customer_email` or `customer_phone` fields
- Invoices can be created without assigned person (customer_name can be empty)
- May need to add `person_id` field in future, but for now will use customer_name only

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
- Same structure as used in Orders module
- Existing `useCustomer` hook can be reused

### Relationship Analysis

**Current Relationship:**
- **No direct relationship:** Invoices table does NOT have `person_id` or `customer_id` field
- Invoices only store `customer_name` as snapshot text
- Invoices can link to Orders via `order_id`, and Orders have `person_id`
- Indirect relationship: Invoice → Order → Person (via order.person_id)

**Gaps/Issues:**
- No direct person_id in invoices table
- No UI component to display customer details in Invoicing module
- CustomerDetailsPopover currently in Orders module (needs refactoring to shared location)
- Need to handle invoices with only customer_name (no person_id)
- May need to derive person_id from linked order if order_id exists

### Data Access Patterns

**How Invoices are Currently Accessed:**
- `useInvoicesList()` - fetches all invoices
- `transformInvoicesForUI()` - maps invoice data to UI format
- Invoices table displays customer name (need to verify field name)

**How Customers/People are Currently Accessed:**
- `useCustomer(id)` - fetches single customer by ID (exists, can be reused)
- Same hook used in Orders module

**How They Are Queried Together (if at all):**
- Need to verify if invoices API joins customers table
- May need to add join if not present

---

## Recommended Solution

### Component Refactoring

**Move CustomerDetailsPopover to Shared Location:**

**Current Location:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**New Location Options:**
1. `src/shared/components/customer/CustomerDetailsPopover.tsx` (recommended)
2. `src/modules/customers/components/CustomerDetailsPopover.tsx` (alternative)

**Rationale:**
- Shared location makes it clear the component is reusable
- Both Orders and Invoicing can import from shared location
- Matches pattern of other shared UI components

**Update Orders Import:**
- Change Orders module import from local to shared location
- Verify Orders popover still works after refactor

### Data Fetching Strategy

**Hook:** Reuse existing `useCustomer(id)` from `src/modules/customers/hooks/useCustomers.ts`

**Query Configuration:**
- Same lazy-loading pattern as Orders
- Only fetch when popover opens and personId exists
- Use conditional ID passing (empty string when popover closed)

**Caching:**
- React Query automatically caches by customer ID
- Multiple invoices with same person_id share cached data
- No prefetching for all rows

### UI Integration Points

**1. Invoices List/Table:**
- Add popover to "Customer" column (or equivalent)
- Make customer name clickable (button/link style)
- Show "—" when no customer name (no popover trigger)

**2. Invoice Detail Page/Header:**
- Add popover to customer name display (if shown in header)
- Same clickable trigger pattern
- Same fallback handling

### Fallback Strategy

**Priority Order:**
1. **Person Data (via order.person_id if order_id exists):**
   - If invoice has `order_id`, fetch the order and use `order.person_id`
   - If person_id exists, fetch person data
   - Name: `${person.first_name} ${person.last_name}`
   - Phone: `person.phone`
   - Email: `person.email`
   - Address: `${person.address}, ${person.city}, ${person.country}`

2. **Snapshot Fields (from invoices table):**
   - Name: `invoice.customer_name` (always available)
   - Phone: "—" (not stored in invoices)
   - Email: "—" (not stored in invoices)

3. **Default:**
   - Show "—" for missing fields

**Note:** Since invoices don't have person_id directly, we'll:
- Try to get person_id from linked order (if order_id exists)
- If no order or order has no person_id, use customer_name only
- Show "Unlinked" badge when no person_id available

---

## Implementation Approach

### Phase 1: Refactor CustomerDetailsPopover to Shared Location

1. **Create shared component directory:**
   - `src/shared/components/customer/` (or verify existing structure)

2. **Move component:**
   - Move `CustomerDetailsPopover.tsx` from Orders to shared location
   - Update imports in component (should remain the same)

3. **Update Orders import:**
   - Change Orders module import to use shared location
   - Verify Orders popover still works
   - Test all Orders scenarios

### Phase 2: Derive Person ID from Linked Order (Optional Enhancement)

**Note:** Since invoices don't have person_id directly, we have two options:

**Option A: Simple approach (recommended for MVP):**
- Use only `customer_name` from invoices
- Show "Unlinked" badge always (no person_id available)
- Popover shows only customer_name, phone/email show "—"
- No API changes needed

**Option B: Enhanced approach (if time permits):**
1. **Check invoice-order relationship:**
   - Invoices have `order_id` field linking to orders
   - Orders have `person_id` field
   - Join orders when fetching invoices to get person_id

2. **Update invoice API/queries:**
   - Modify `fetchInvoices()` to join orders table
   - Select `orders(person_id, person_name)` in invoice query
   - Make person_id available in Invoice type

3. **Update invoice types/transform:**
   - Add `personId` and `personName` to Invoice interface (from joined order)
   - Add `fallbackName` to UIInvoice interface (from invoice.customer_name)
   - Update `transformInvoiceForUI()` to include personId and fallbackName
   - Handle case where order_id is null (no person_id available)

**Decision:** Start with Option A for simplicity. Option B can be added later if needed.

### Phase 3: Integrate Popover in Invoices List/Table

1. **Update Invoices table:**
   - Find where "Customer" column is rendered (line ~276 in InvoicingPage.tsx)
   - Add CustomerDetailsPopover import (from shared location)
   - Wrap customer name with popover component
   - Pass props:
     - `personId={null}` (no person_id in invoices currently)
     - `fallbackName={invoice.customer}` (from invoice.customer_name)
     - `fallbackPhone={null}` (not stored in invoices)
     - `fallbackEmail={null}` (not stored in invoices)

2. **Handle edge cases:**
   - If customer name is "—" or empty, don't show popover trigger
   - Always show "Unlinked" badge (no person_id available)
   - Popover will show customer_name only, phone/email as "—"

### Phase 4: Integrate Popover in Invoice Detail (if applicable)

1. **Check invoice detail page:**
   - Verify if customer name is displayed in header/sidebar
   - Add popover to customer name display
   - Same pattern as list/table

2. **Handle edge cases:**
   - Same as list/table integration

### Phase 5: Testing & Validation

1. **Test Orders module:**
   - Verify popover still works after refactor
   - No regressions

2. **Test Invoicing module:**
   - Test with person_id present
   - Test with person_id null (fallback)
   - Test with person fetch failure (fallback)
   - Verify lazy loading (check Network tab)
   - Verify caching (multiple invoices, same person)

3. **Build & lint:**
   - Build passes
   - Lint passes
   - No TypeScript errors

---

## What NOT to Do

- **Do NOT create a duplicate component** (reuse existing)
- **Do NOT change database schema** (no migrations)
- **Do NOT change invoice table structure** (additive UI only)
- **Do NOT implement Messages functionality** (coming soon placeholder only)
- **Do NOT create new customer API** (reuse existing `useCustomer` hook)
- **Do NOT prefetch customer data for all invoices** (performance issue)

---

## Open Questions / Considerations

1. **Invoice customer field name:**
   - What is the exact field name? (`person_id`, `customer_id`, or other?)
   - **Decision:** Invoices don't have person_id directly. Will derive from linked order (order.person_id) if order_id exists.

2. **Invoice snapshot fields:**
   - Do invoices have `customer_phone` and `customer_email` fields?
   - **Decision:** No, invoices only have `customer_name`. Phone and email will show "—" when no person linked.

3. **Invoice detail page:**
   - Is customer name displayed in invoice detail/header?
   - **Decision:** Check InvoiceDetailSidebar or similar component, add popover if customer name is shown

4. **Shared component location:**
   - Should it be `src/shared/components/customer/` or `src/modules/customers/components/`?
   - **Decision:** Prefer `src/shared/components/customer/` for clarity, but verify existing structure

5. **Empty customer handling:**
   - Can invoices have empty `customer_name`?
   - **Decision:** Handle safely, show "—" without popover trigger

---

## Acceptance Criteria

- ✅ CustomerDetailsPopover moved to shared location
- ✅ Orders module still works with refactored component
- ✅ Clicking customer name in Invoices list opens popover
- ✅ Clicking customer name in Invoice detail (if applicable) opens popover
- ✅ Popover shows customer details (name, phone, email, address)
- ✅ Person data loads only when popover opens (lazy loading)
- ✅ Fallback to snapshot fields if person_id null or fetch fails
- ✅ "Linked" badge shown when person_id exists and loaded
- ✅ "Unlinked" badge shown when person_id null or fetch fails
- ✅ "Open Person" link navigates to `/dashboard/customers` (when person_id exists)
- ✅ "Messages (Coming soon)" section displayed
- ✅ No performance issues (no prefetching, proper caching)
- ✅ Build + lint pass
- ✅ No runtime crashes
- ✅ No regressions in Orders module

---

## Success Metrics

- Customer details accessible via click in Invoicing module
- Same UX as Orders module (consistent experience)
- Lazy loading works correctly (verify in Network tab)
- Fallback data displays correctly when person missing
- Popover doesn't break table layout
- Navigation to customer details works
- All existing functionality preserved (Orders + Invoicing)

