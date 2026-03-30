# Quickstart: Fix Invoicing List Missing order_id

## Overview

This guide helps you quickly understand and test the fix for missing `order_id` in Invoicing list data that prevents the customer popover from showing "Linked" status.

---

## What It Does

- Fixes invoice transform to handle `undefined` for `order_id`
- Ensures `orderId` in UIInvoice is always `string | null` (never `undefined`)
- Verifies invoice query returns `order_id` field
- Adds runtime validation to diagnose issues

---

## How to Test

### 1. Open Invoicing Page

Navigate to `/dashboard/invoicing` in the app.

### 2. Check Console (DEV mode)

Open browser DevTools → Console tab.

**Expected:**
- No warnings about missing `order_id`
- If warnings appear, it indicates query issue (not transform issue)

### 3. Click Customer Name

- Click any customer name in the Invoices table
- Popover should open

### 4. Check DEV Debug Section

In the popover, scroll to the bottom and look for "Debug (DEV only)" section.

**Expected Values:**
- `orderId`: Should show UUID if invoice has order_id, or "null" (not "undefined")
- `orderPersonId`: Should show UUID after order query completes, or "null"
- `resolvedPersonId`: Should show UUID when personId or orderPersonId exists, or "null"

---

## Test Scenarios

### Scenario 1: Invoice with order_id

**Setup:**
- Invoice has `order_id` set in database
- Linked order has `person_id` set

**Expected:**
- `orderId` shows UUID (not null, not undefined)
- Order query fires (check Network tab)
- Person query fires after order.person_id resolved
- "Linked" badge shows
- Full customer details appear (phone, email, address)
- "Open Person" button visible

---

### Scenario 2: Invoice without order_id

**Setup:**
- Invoice has `order_id = null` in database

**Expected:**
- `orderId` shows "null" (not undefined)
- No order query fires
- "Unlinked" badge shows
- Only customer name appears (no phone/email)
- "Open Person" button NOT visible

---

### Scenario 3: Invoice with missing order_id field

**Setup:**
- Invoice data doesn't include `order_id` field (query issue)

**Expected:**
- Transform normalizes `undefined` → `null`
- `orderId` shows "null" (not undefined)
- Console warning in DEV mode (if validation added)
- "Unlinked" badge shows
- No crashes or errors

---

## Common Issues

### Issue: orderId still shows undefined

**Check:**
- Transform uses nullish coalescing: `invoice.order_id ?? null`
- UIInvoice type is `string | null` (not including undefined)

**Fix:**
- Verify transform uses `?? null`
- Verify type definition is correct

---

### Issue: Console warning about missing order_id

**Check:**
- Invoice query includes `order_id`
- No view/RPC strips `order_id`

**Fix:**
- Verify query uses `select('*')` or explicit select includes `order_id`
- Check Supabase RLS policies
- Switch to explicit select if needed

---

### Issue: orderId is null when invoice has order_id

**Check:**
- Invoice in database has `order_id`
- Query returns `order_id`
- Transform maps correctly

**Fix:**
- Check database: `SELECT id, order_id FROM invoices WHERE id = '...'`
- Check query response in Network tab
- Check transform output in console

---

## Performance Verification

### Transform Performance

1. Open Invoicing page
2. Check performance (should be instant)
3. No noticeable slowdown from nullish coalescing

### Validation Performance

1. Open Invoicing page
2. Check console (DEV mode)
3. Validation should run once on first invoice
4. No performance impact

---

## Integration Points

### Invoice Transform

- **File:** `src/modules/invoicing/utils/invoiceTransform.ts`
- **Function:** `transformInvoiceForUI(invoice: Invoice): UIInvoice`
- **Change:** `orderId: invoice.order_id ?? null`

### Invoice API

- **File:** `src/modules/invoicing/api/invoicing.api.ts`
- **Function:** `fetchInvoices()`
- **Query:** `select('*')` (or explicit select if needed)

### CustomerDetailsPopover

- **File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`
- **Props:** `orderId?: string | null`
- **Usage:** Receives `orderId` from InvoicingPage

### InvoicingPage

- **File:** `src/modules/invoicing/pages/InvoicingPage.tsx`
- **Usage:** Passes `orderId={invoice.orderId}` to CustomerDetailsPopover
- **Type:** Uses `UIInvoice` (camelCase `orderId`)

---

## Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| orderId Source | `invoice.order_id` (might be undefined) | `invoice.order_id ?? null` (always string \| null) |
| Type Safety | `orderId` could be undefined | `orderId` is always string \| null |
| Popover Behavior | Always "Unlinked" (orderId is undefined) | "Linked" when order_id exists |
| Error Handling | Undefined propagates to UI | Undefined normalized to null |

---

## Next Steps

After testing:

1. **Verify fix works:**
   - `orderId` is never undefined
   - Popover shows "Linked" when invoice has order_id
   - No console warnings

2. **If issues persist:**
   - Check console for validation warnings
   - Check Network tab for query response
   - Check database for actual `order_id` values

3. **Remove validation (optional):**
   - After confirming fix works
   - Or keep it guarded behind DEV flag

---

## Support

If you encounter issues:

1. Check browser console for errors/warnings
2. Verify Network tab for API calls
3. Check React DevTools for component state
4. Review DEV debug section in popover
5. Review implementation plan for details
6. Check research.md for technical decisions

