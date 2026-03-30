# Fix Invoicing Customer Popover Still Showing Unlinked After Deriving person_id

## Overview

After implementing the orderId → personId derivation feature, the Invoicing CustomerDetailsPopover still shows "Unlinked" badge and no customer details, even when invoices are linked to orders with person_id. The build passes, indicating this is likely a runtime data/mapping issue rather than a compilation error.

**Context:**
- Feature was implemented: `fetchOrderPersonId` API, `useOrderPersonId` hook, and `orderId` prop in CustomerDetailsPopover
- InvoicingPage and InvoiceDetailSidebar were updated to pass `orderId` prop
- Build and lint pass, but runtime behavior shows "Unlinked" for all invoices
- Need to diagnose and fix the data flow from invoice → order → person

**Goal:**
- Fix field name inconsistencies (order_id vs orderId)
- Ensure correct orderId is passed to CustomerDetailsPopover
- Add DEV-only debug visibility to confirm runtime values
- Verify fetchOrderPersonId query works correctly
- Ensure popover shows "Linked" and full customer details when invoice has order_id with person_id

---

## Current State Analysis

### Invoice Schema

**Table:** `public.invoices`

**Relevant Fields:**
- `id uuid pk`
- `order_id uuid null` - FK to orders table (snake_case in DB)
- `customer_name text not null` - Customer name snapshot
- Other invoice fields...

**Observations:**
- Database uses `order_id` (snake_case)
- Invoice type (`Invoice`) uses `order_id` (snake_case)
- UIInvoice transform converts to `orderId` (camelCase) for UI

### Invoice Type vs UIInvoice Transform

**Invoice Type (`src/modules/invoicing/types/invoicing.types.ts`):**
```typescript
export interface Invoice {
  order_id: string | null; // snake_case
  // ... other fields
}
```

**UIInvoice Transform (`src/modules/invoicing/utils/invoiceTransform.ts`):**
```typescript
export interface UIInvoice {
  orderId: string | null; // camelCase
  // ... other fields
}

export function transformInvoiceForUI(invoice: Invoice): UIInvoice {
  return {
    orderId: invoice.order_id, // Converts snake_case to camelCase
    // ... other fields
  };
}
```

**Observations:**
- Transform correctly maps `order_id` → `orderId`
- InvoicingPage uses `UIInvoice` (should have `orderId`)
- InvoiceDetailSidebar uses `Invoice` (has `order_id`)

### Current Implementation

**InvoicingPage (`src/modules/invoicing/pages/InvoicingPage.tsx`):**
```typescript
<CustomerDetailsPopover
  orderId={invoice.orderId || null} // Uses UIInvoice.orderId (camelCase)
  // ...
/>
```

**InvoiceDetailSidebar (`src/modules/invoicing/components/InvoiceDetailSidebar.tsx`):**
```typescript
<CustomerDetailsPopover
  orderId={invoice.order_id || null} // Uses Invoice.order_id (snake_case)
  // ...
/>
```

**Observations:**
- Both components pass orderId correctly based on their invoice type
- Field names should be correct

### Relationship Analysis

**Current Relationship:**
- Invoice → Order: `invoices.order_id` → `orders.id` (optional FK)
- Order → Person: `orders.person_id` → `customers.id` (optional FK)
- Data flow: Invoice.order_id → fetchOrderPersonId → order.person_id → useCustomer → person data

**Gaps/Issues:**
- Possible issues:
  1. `invoice.orderId` might be null/undefined even when `order_id` exists in DB
  2. `fetchOrderPersonId` query might be incorrect
  3. Order query might not be enabled when popover opens
  4. Invoice data might not include `order_id` in the query result

### Data Access Patterns

**How Invoices are Currently Fetched:**
- `useInvoicesList()` hook fetches invoices
- Transform converts to `UIInvoice[]` with `orderId` field
- Need to verify invoices query includes `order_id` field

**How Orders are Currently Fetched:**
- `fetchOrderPersonId(orderId)` selects only `person_id` from orders
- Query: `.select('person_id').eq('id', orderId).single()`
- Need to verify query is correct

**How They Are Queried Together:**
- CustomerDetailsPopover uses `useOrderPersonId(orderId, { enabled: open && !!orderId })`
- Then uses `useCustomer(resolvedPersonId)` when resolvedPersonId exists
- Need to verify both queries fire correctly

---

## Root Cause Analysis

### Suspected Issues

1. **Field Name Mismatch:**
   - InvoicingPage uses `invoice.orderId` (from UIInvoice)
   - Transform should map `order_id` → `orderId`
   - **Risk:** If transform is missing or incorrect, `orderId` will be undefined

2. **Invoice Query Missing order_id:**
   - Invoices query might not select `order_id` field
   - **Risk:** `order_id` is null in fetched invoices even if it exists in DB

3. **fetchOrderPersonId Query Issue:**
   - Query might be selecting wrong column or filtering incorrectly
   - **Risk:** Query returns null even when order exists

4. **Query Not Enabled:**
   - `useOrderPersonId` might not be enabled when popover opens
   - **Risk:** Order query never fires

5. **Order Has No person_id:**
   - Invoice has order_id, but linked order has null person_id
   - **Risk:** Query succeeds but returns null person_id

---

## Recommended Solution

### 1. Audit Invoice Query

**Verify invoices query includes order_id:**
- Check `useInvoicesList` hook
- Ensure query selects `order_id` field
- Verify transform correctly maps to `orderId`

### 2. Add DEV-Only Debug Visibility

**Add debug section in CustomerDetailsPopover:**
- Show `orderId` prop value
- Show `orderPersonId` from query
- Show `resolvedPersonId` calculation
- Only visible when `import.meta.env.DEV === true`
- Place in popover footer (after Messages section)

### 3. Verify fetchOrderPersonId Query

**Verify query correctness:**
- Table: `orders`
- Select: `person_id`
- Filter: `id = orderId`
- Single result

### 4. Fix Field Name Consistency

**Ensure consistent usage:**
- InvoicingPage: Use `invoice.orderId` (from UIInvoice) ✓
- InvoiceDetailSidebar: Use `invoice.order_id` (from Invoice) ✓
- Both should work, but verify runtime values

### 5. Add Defensive Checks

**Add null/undefined guards:**
- Verify `orderId` is not null/undefined before passing to popover
- Log warnings in DEV mode when orderId is unexpectedly null

---

## Implementation Approach

### Phase 1: Audit & Verify Current State

1. **Check invoices query:**
   - Verify `useInvoicesList` selects `order_id`
   - Verify transform includes `orderId` mapping
   - Test with real invoice data

2. **Verify fetchOrderPersonId:**
   - Check query syntax
   - Test with real orderId
   - Verify returns person_id correctly

3. **Check CustomerDetailsPopover:**
   - Verify `useOrderPersonId` is called correctly
   - Verify enabled condition works
   - Check resolvedPersonId calculation

### Phase 2: Add DEV Debug Visibility

1. **Add debug section to CustomerDetailsPopover:**
   - Condition: `import.meta.env.DEV === true`
   - Display: orderId, orderPersonId, resolvedPersonId
   - Place in footer after Messages section
   - Style: subtle, monospace font, muted colors

2. **Add console logging (DEV only):**
   - Log orderId prop value
   - Log orderPersonId query result
   - Log resolvedPersonId calculation
   - Log person query result

### Phase 3: Fix Identified Issues

1. **Fix invoices query (if needed):**
   - Ensure `order_id` is selected
   - Verify transform mapping

2. **Fix field name usage (if needed):**
   - Ensure consistent camelCase/snake_case usage
   - Fix any mismatches

3. **Fix query enabling (if needed):**
   - Verify `enabled` condition in `useOrderPersonId`
   - Ensure popover open state triggers query

### Phase 4: Testing & Validation

1. **Test with invoice that has order_id:**
   - Verify orderId is passed correctly
   - Verify order query fires
   - Verify person query fires
   - Verify "Linked" badge shows

2. **Test with invoice without order_id:**
   - Verify "Unlinked" badge shows
   - Verify no unnecessary queries

3. **Verify DEV debug:**
   - Confirm debug section visible in DEV
   - Confirm values are correct
   - Verify not visible in production build

---

## What NOT to Do

- **Do NOT remove lazy loading** (queries should only fire when popover opens)
- **Do NOT change database schema** (no migrations)
- **Do NOT remove DEV debug** (keep it for troubleshooting, but guard it)
- **Do NOT break Orders module** (no regressions)

---

## Open Questions / Considerations

1. **Invoice query:**
   - Does `useInvoicesList` select `order_id`?
   - **Action:** Verify in invoices API/hooks

2. **Transform mapping:**
   - Is `orderId: invoice.order_id` correct?
   - **Action:** Verify transform function

3. **Runtime values:**
   - What is the actual value of `invoice.orderId` at runtime?
   - **Action:** Add DEV debug to see

4. **Order query:**
   - Does `fetchOrderPersonId` work correctly?
   - **Action:** Test with real orderId

5. **Query enabling:**
   - Is `useOrderPersonId` enabled when popover opens?
   - **Action:** Verify enabled condition

---

## Acceptance Criteria

- ✅ For invoice linked to order with person_id:
  - Popover shows "Linked" badge
  - Person phone/email/address appear
  - "Open Person" button visible
- ✅ Network tab shows:
  - Orders query to fetch person_id fires only after popover opens
  - Then people/customer query fires
- ✅ DEV debug confirms:
  - Non-null orderId when invoice has order_id
  - Non-null orderPersonId when order has person_id
  - Non-null resolvedPersonId when personId or orderPersonId exists
- ✅ No regressions in Orders module popover
- ✅ Build + lint pass
- ✅ No runtime crashes

---

## Success Metrics

- Invoicing popover shows "Linked" when invoice has order_id with person_id
- Full customer details displayed (phone, email, address)
- DEV debug helps identify any remaining issues
- Lazy loading still works (no prefetching)
- No regressions in Orders module
- All existing functionality preserved

---

## Future Considerations

- **Remove DEV debug:**
  - After issue is resolved and verified
  - Or keep it guarded behind DEV flag for future troubleshooting

- **Add error boundaries:**
  - Catch and display query errors gracefully
  - Show user-friendly error messages

- **Add loading states:**
  - Show loading indicator while resolving order → person
  - Improve UX during two-step fetch

