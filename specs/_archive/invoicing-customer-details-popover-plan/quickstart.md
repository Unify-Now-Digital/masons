# Quickstart: Invoicing Customer Details Popover

## Overview

This guide helps you quickly understand and test the Invoicing Customer Details Popover feature, which reuses the Orders module implementation.

---

## What It Does

- Makes customer name clickable in Invoicing module (list/table and detail view)
- Opens popover card showing customer details on click
- Shows customer_name from invoice (no person_id available)
- Displays "Unlinked" badge (no person linked)
- Includes "Messages (Coming soon)" placeholder

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

**Header:**
- Customer name displayed (from invoice.customer_name)
- "Unlinked" badge shown (no person_id available)

**Basic Info:**
- Phone: "—" (not stored in invoices)
- Email: "—" (not stored in invoices)
- Address: "—" (not stored in invoices)

**Actions:**
- "Open Person" button NOT shown (no personId)

**Messages:**
- "Coming soon" placeholder text
- Optional skeleton rows

---

## Test Scenarios

### Scenario 1: Invoice with Customer Name

**Setup:**
- Invoice has `customer_name` set (e.g., "John Smith")

**Expected:**
- Click customer name → popover opens
- "Unlinked" badge shown
- Customer name displayed in header
- Phone/email show "—"
- "Open Person" button NOT visible
- No API call to fetch person (personId is null)

---

### Scenario 2: Invoice with Empty Customer Name

**Setup:**
- Invoice has empty or null `customer_name`

**Expected:**
- Customer column shows "—"
- No popover trigger (not clickable)
- Plain text display

---

### Scenario 3: Verify Orders Module Still Works

**Setup:**
- Navigate to Orders page after refactor

**Expected:**
- Orders popover still works exactly as before
- Click customer name → popover opens
- Person data loads when personId exists
- "Linked" badge shown when person loaded
- All existing functionality preserved

---

## Common Issues

### Issue: Popover doesn't open

**Check:**
- Customer name is not "—" or empty
- Customer name is clickable (button element)
- No console errors

**Fix:**
- Verify CustomerDetailsPopover component is imported from shared location
- Check trigger prop is passed correctly
- Verify popover state management

---

### Issue: Orders popover broken after refactor

**Check:**
- Import path updated to shared location
- Component file exists in shared location
- No TypeScript errors

**Fix:**
- Verify import: `@/shared/components/customer/CustomerDetailsPopover`
- Check component file exists at new location
- Rebuild and clear cache if needed

---

### Issue: "Unlinked" badge not showing

**Check:**
- personId is null (should be for invoices)
- Badge logic in component is correct

**Fix:**
- Verify personId prop is null or undefined
- Check isLinked calculation in component

---

### Issue: "Open Person" button showing

**Check:**
- personId should be null for invoices
- Button conditional rendering is correct

**Fix:**
- Verify personId prop is null
- Check button conditional logic: `{personId && ...}`

---

## Performance Verification

### No Prefetching

1. Open Invoicing page
2. Open browser DevTools → Network tab
3. Filter by "customers" or API endpoint
4. Verify no customer API calls on page load
5. Click customer name → verify no API call (personId is null)

### Lazy Loading (Future - Option B)

If Option B is implemented later:
1. Open Invoicing page
2. Open browser DevTools → Network tab
3. Click customer name with personId → verify API call occurs
4. Close popover, click same customer → verify no new API call (cached)

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

---

## Integration Points

### Shared Component

- **File:** `src/shared/components/customer/CustomerDetailsPopover.tsx`
- **Used by:** Orders module, Invoicing module
- **Props:** personId, fallbackName, fallbackPhone, fallbackEmail, trigger

### Invoices List

- **File:** `src/modules/invoicing/pages/InvoicingPage.tsx`
- **Integration:** Customer column (around line 276)
- **Props Passed:** personId=null, fallbackName=invoice.customer, fallbackPhone=null, fallbackEmail=null

### Invoice Detail

- **File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`
- **Integration:** Customer name display (if present)
- **Props:** Same as list/table

### Orders Module

- **File:** `src/modules/orders/components/SortableOrdersTable.tsx`
- **Integration:** Updated to import from shared location
- **Props:** personId, fallbackName, fallbackPhone, fallbackEmail (from order data)

---

## Comparison: Orders vs Invoicing

| Feature | Orders | Invoicing |
|---------|--------|-----------|
| personId | Available (from order.person_id) | null (not available) |
| Badge | "Linked" or "Unlinked" | Always "Unlinked" |
| Person Data | Fetched when popover opens | Not fetched (personId is null) |
| Phone/Email | From person or snapshot | Always "—" |
| "Open Person" Button | Shown when personId exists | Never shown (personId is null) |
| Fallback | person_name or customer_name | customer_name only |

---

## Next Steps

After testing:

1. **Verify all scenarios pass**
2. **Check performance (no prefetching)**
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

