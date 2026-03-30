# Quickstart: Invoicing - Derive person_id from Linked Order

## Overview

This guide helps you quickly understand and test the enhanced Invoicing Customer Details Popover that derives person_id from linked orders.

---

## What It Does

- Derives `person_id` from linked Order when invoice has `order_id`
- Enables full People data display in Invoicing popover
- Shows "Linked" badge when person_id available via order
- Maintains lazy loading (no prefetching on page load)
- Two-step fetch: order.person_id → person data

---

## How to Test

### 1. Open Invoicing Page

Navigate to `/dashboard/invoicing` in the app.

### 2. Find Customer Column

Look for the "Customer" column in the Invoices table.

### 3. Click Customer Name

- Click any customer name in the table
- Popover should open showing customer details

### 4. Verify Popover Content

**For Invoice with order_id and person_id:**
- **Header:** Customer name (from Person), "Linked" badge
- **Basic Info:** Phone, email, address (from Person)
- **Actions:** "Open Person" button visible
- **Messages:** "Coming soon" placeholder

**For Invoice with order_id but no person_id:**
- **Header:** Customer name (from invoice.customer_name), "Unlinked" badge
- **Basic Info:** Phone/email show "—"
- **Actions:** "Open Person" button NOT visible

**For Invoice with no order_id:**
- **Header:** Customer name (from invoice.customer_name), "Unlinked" badge
- **Basic Info:** Phone/email show "—"
- **Actions:** "Open Person" button NOT visible

---

## Test Scenarios

### Scenario 1: Invoice with order_id and person_id

**Setup:**
- Invoice has `order_id` set
- Linked order has `person_id` set
- Person record exists in customers table

**Expected:**
- Click customer name → popover opens
- Order query fires (verify in Network tab)
- Person query fires after order.person_id resolved
- "Linked" badge shown
- Full People info displayed (name, phone, email, address)
- "Open Person" button visible
- Loading skeleton shows while resolving order → person

---

### Scenario 2: Invoice with order_id but no person_id

**Setup:**
- Invoice has `order_id` set
- Linked order has `person_id = null`

**Expected:**
- Click customer name → popover opens
- Order query fires (returns null person_id)
- No person query (person_id is null)
- "Unlinked" badge shown
- Customer name from invoice.customer_name
- Phone/email show "—"
- "Open Person" button NOT visible

---

### Scenario 3: Invoice with no order_id

**Setup:**
- Invoice has `order_id = null`

**Expected:**
- Click customer name → popover opens
- No order query (orderId is null)
- No person query (no personId)
- "Unlinked" badge shown
- Customer name from invoice.customer_name
- Phone/email show "—"
- "Open Person" button NOT visible

---

### Scenario 4: Orders Module Still Works

**Setup:**
- Navigate to Orders page

**Expected:**
- Orders popover still works using direct `personId` prop
- No order queries fired (Orders don't use orderId prop)
- "Linked" badge shows when person_id exists
- All existing functionality preserved

---

### Scenario 5: Caching

**Setup:**
- Invoice with order_id and person_id
- Click customer name → popover opens, data loads
- Close popover
- Click same customer name again

**Expected:**
- Popover opens
- No new order query (cached)
- No new person query (cached)
- Data displays immediately from cache

---

## Common Issues

### Issue: Popover shows "Unlinked" when order has person_id

**Check:**
- orderId prop is passed correctly
- Order query is enabled when popover opens
- Order has person_id in database
- No errors in console

**Fix:**
- Verify orderId prop: `orderId={invoice.orderId || null}`
- Check Network tab for order query
- Verify order.person_id exists in database
- Check React Query cache

---

### Issue: Order query not firing

**Check:**
- orderId is not null
- Popover is actually opening
- React Query enabled condition is correct

**Fix:**
- Verify orderId prop is passed
- Check popover open state
- Verify enabled condition: `enabled: open && !!orderId`

---

### Issue: Person query not firing after order resolved

**Check:**
- Order query returns person_id
- resolvedPersonId is not null
- Person query enabled condition is correct

**Fix:**
- Verify order.person_id in database
- Check resolvedPersonId calculation
- Verify enabled condition: `enabled: open && !!resolvedPersonId`

---

### Issue: Orders module broken

**Check:**
- CustomerDetailsPopover still accepts personId prop
- Orders module passes personId (not orderId)
- No regressions in component logic

**Fix:**
- Verify personId prop still works
- Check Orders module still passes personId
- Verify backward compatibility

---

## Performance Verification

### Lazy Loading

1. Open Invoicing page
2. Open browser DevTools → Network tab
3. Filter by "orders" or "customers" API endpoint
4. Verify no queries on page load
5. Click customer name → verify order query fires
6. Wait for order response → verify person query fires
7. Close popover, click same customer → verify no new queries (cached)

### No Prefetching

1. Open Invoicing page
2. Open browser DevTools → Network tab
3. Verify no order/person queries on page load
4. Only queries should occur when popover opens

---

## Accessibility Testing

### Keyboard Navigation

1. Tab to customer name in table
2. Press Enter/Space → popover should open
3. Press ESC → popover should close
4. Tab through popover content → focus should move correctly

### Screen Reader

1. Use screen reader (NVDA, JAWS, VoiceOver)
2. Navigate to customer name
3. Verify customer name is announced as button/link
4. Open popover → verify content is announced correctly
5. Verify "Linked" or "Unlinked" badge is announced

---

## Integration Points

### CustomerDetailsPopover

- **File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`
- **New Prop:** `orderId?: string | null`
- **Internal Logic:** Resolves personId from orderId when provided
- **Used by:** Orders module (personId), Invoicing module (orderId)

### Orders API

- **File:** `src/modules/orders/api/orders.api.ts`
- **New Function:** `fetchOrderPersonId(orderId)`
- **Query:** Selects only `person_id` from orders table

### Orders Hooks

- **File:** `src/modules/orders/hooks/useOrders.ts`
- **New Hook:** `useOrderPersonId(orderId, { enabled })`
- **Caching:** By orderId key

### Invoicing List

- **File:** `src/modules/invoicing/pages/InvoicingPage.tsx`
- **Integration:** Passes `orderId={invoice.orderId}` to CustomerDetailsPopover
- **Props:** orderId, fallbackName, fallbackPhone, fallbackEmail

### Invoice Detail

- **File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`
- **Integration:** Passes `orderId={invoice.order_id}` to CustomerDetailsPopover
- **Props:** Same as list/table

---

## Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| personId Source | Always null | Derived from orderId when available |
| Badge | Always "Unlinked" | "Linked" when person_id available |
| Person Data | Never fetched | Fetched when order has person_id |
| Phone/Email | Always "—" | From Person when available |
| "Open Person" Button | Never shown | Shown when person_id available |
| Queries | None | Order → Person (when orderId exists) |

---

## Next Steps

After testing:

1. **Verify all scenarios pass**
2. **Check performance (lazy loading, caching)**
3. **Test accessibility (keyboard, screen reader)**
4. **Confirm no regressions in Orders module**
5. **Build and lint pass**

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify Network tab for API calls
3. Check React DevTools for component state
4. Review implementation plan for details
5. Check research.md for technical decisions

