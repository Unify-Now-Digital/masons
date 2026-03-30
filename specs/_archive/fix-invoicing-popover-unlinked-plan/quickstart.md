# Quickstart: Fix Invoicing Customer Popover Still Showing Unlinked

## Overview

This guide helps you quickly diagnose and fix the issue where the Invoicing Customer Details Popover shows "Unlinked" even when invoices are linked to orders with person_id.

---

## What It Does

- Audits invoice query to ensure `order_id` is selected
- Adds DEV-only debug visibility to diagnose runtime values
- Fixes any field name inconsistencies or data mapping issues
- Ensures popover shows "Linked" and full customer details when invoice has order_id with person_id

---

## How to Diagnose

### 1. Open Invoicing Page in DEV Mode

Navigate to `/dashboard/invoicing` in the app (development mode).

### 2. Open Browser DevTools

Open browser DevTools (F12) and go to Console tab.

### 3. Click Customer Name

- Click any customer name in the Invoices table
- Popover should open
- Check console for debug logs

### 4. Check DEV Debug Section

In the popover, scroll to the bottom and look for "Debug (DEV only)" section.

**Expected Values:**
- `orderId`: Should show UUID if invoice has order_id, or "null"
- `orderPersonId`: Should show UUID after order query completes, or "null"
- `resolvedPersonId`: Should show UUID when personId or orderPersonId exists, or "null"
- `personId prop`: Should show "null" (Invoicing doesn't pass personId)
- `open`: Should show "true" when popover is open
- `isResolvingOrder`: Should show "true" while fetching order, then "false"
- `isFetchingPerson`: Should show "true" while fetching person, then "false"

---

## Diagnosis Scenarios

### Scenario 1: orderId is null

**Symptom:**
- Debug shows `orderId: null`
- No order query fires

**Possible Causes:**
- Invoice doesn't have `order_id` in database
- Invoice query doesn't select `order_id`
- Transform doesn't map `order_id` → `orderId`
- Component doesn't pass `orderId` prop correctly

**Fix:**
- Check invoice in database has `order_id`
- Verify invoice query includes `order_id`
- Verify transform maps correctly
- Verify component passes prop

---

### Scenario 2: orderId is non-null but orderPersonId stays null

**Symptom:**
- Debug shows `orderId: <uuid>` but `orderPersonId: null`
- Order query might not fire or returns null

**Possible Causes:**
- Query not enabled (popover not open or orderId is falsy)
- Order doesn't exist
- Order query fails
- Order has no `person_id`

**Fix:**
- Check `open` state is true
- Check order exists in database
- Check order query in Network tab
- Check order has `person_id` in database

---

### Scenario 3: orderPersonId is non-null but resolvedPersonId is null

**Symptom:**
- Debug shows `orderPersonId: <uuid>` but `resolvedPersonId: null`

**Possible Causes:**
- ResolvedPersonId calculation is wrong
- personId prop is overriding (shouldn't happen in Invoicing)

**Fix:**
- Check resolvedPersonId calculation: `personId ?? orderPersonId ?? null`
- Verify personId prop is null (Invoicing doesn't pass it)

---

### Scenario 4: resolvedPersonId is non-null but person query doesn't fire

**Symptom:**
- Debug shows `resolvedPersonId: <uuid>` but person data doesn't load

**Possible Causes:**
- Person query not enabled
- Person doesn't exist
- Person query fails

**Fix:**
- Check `open` state is true
- Check person exists in database
- Check person query in Network tab

---

## Common Issues

### Issue: Debug section not visible

**Check:**
- Running in DEV mode (`import.meta.env.DEV === true`)
- Popover is open
- Scrolled to bottom of popover

**Fix:**
- Ensure running development server (not production build)
- Open popover and scroll down

---

### Issue: Console logs not appearing

**Check:**
- Running in DEV mode
- Console filter allows debug logs
- Popover actually opens

**Fix:**
- Ensure running development server
- Check console filter settings
- Verify popover opens

---

### Issue: orderId is null when invoice has order_id

**Check:**
- Invoice in database has `order_id`
- Invoice query selects `order_id`
- Transform maps `order_id` → `orderId`
- Component passes `invoice.orderId` (not `invoice.order_id`)

**Fix:**
- Verify invoice query: `select('*')` includes `order_id`
- Verify transform: `orderId: invoice.order_id`
- Verify component: `orderId={invoice.orderId || null}` (InvoicingPage) or `orderId={invoice.order_id || null}` (InvoiceDetailSidebar)

---

### Issue: Order query doesn't fire

**Check:**
- `orderId` is non-null
- Popover is actually open
- React Query enabled condition is correct

**Fix:**
- Verify `orderId` prop is passed
- Check `open` state is true
- Verify enabled condition: `enabled: open && !!orderId`

---

### Issue: Person query doesn't fire after order resolved

**Check:**
- `resolvedPersonId` is non-null
- Popover is open
- Person query enabled condition is correct

**Fix:**
- Verify `resolvedPersonId` calculation
- Check `open` state is true
- Verify enabled condition: `enabled: open && !!resolvedPersonId`

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

## Integration Points

### Invoice Query

- **File:** `src/modules/invoicing/api/invoicing.api.ts`
- **Function:** `fetchInvoices()`
- **Query:** `select('*')` - includes `order_id`

### Invoice Transform

- **File:** `src/modules/invoicing/utils/invoiceTransform.ts`
- **Function:** `transformInvoiceForUI(invoice: Invoice): UIInvoice`
- **Mapping:** `orderId: invoice.order_id`

### CustomerDetailsPopover

- **File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`
- **Props:** `orderId?: string | null`
- **Internal Logic:** Resolves personId from orderId when provided
- **Used by:** Orders module (personId), Invoicing module (orderId)

### InvoicingPage

- **File:** `src/modules/invoicing/pages/InvoicingPage.tsx`
- **Integration:** Passes `orderId={invoice.orderId}` to CustomerDetailsPopover
- **Type:** Uses `UIInvoice` (camelCase `orderId`)

### InvoiceDetailSidebar

- **File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`
- **Integration:** Passes `orderId={invoice.order_id}` to CustomerDetailsPopover
- **Type:** Uses `Invoice` (snake_case `order_id`)

---

## Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| orderId Source | Passed but might be null | Verified and fixed if needed |
| Debug Visibility | None | DEV-only debug section |
| Console Logging | None | DEV-only console.debug |
| Diagnosis | Guessing | Actual runtime values visible |
| Badge | Always "Unlinked" | "Linked" when person_id available |
| Person Data | Never fetched | Fetched when order has person_id |

---

## Next Steps

After diagnosis:

1. **Identify root cause** using DEV debug
2. **Fix identified issue** (query, transform, props, or enabling)
3. **Verify fix** using DEV debug
4. **Test all scenarios** (with/without order_id, with/without person_id)
5. **Remove or keep DEV debug** (guard it behind DEV flag)

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify Network tab for API calls
3. Check React DevTools for component state
4. Review DEV debug section in popover
5. Review implementation plan for details
6. Check research.md for technical decisions

