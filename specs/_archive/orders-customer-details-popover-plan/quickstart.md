# Quickstart: Orders Customer Details Popover

## Overview

This guide helps you quickly understand and test the Orders Customer Details Popover feature.

---

## What It Does

- Makes customer name clickable in Orders table
- Opens popover card showing customer details on click
- Displays Person data (if linked) or snapshot fields (if not)
- Includes "Messages (Coming soon)" placeholder

---

## How to Test

### 1. Open Orders Page

Navigate to `/dashboard/orders` in the app.

### 2. Find Customer Column

Look for the "Customer" column in the Orders table.

### 3. Click Customer Name

- Click any customer name in the table
- Popover should open showing customer details

### 4. Verify Popover Content

**Header:**
- Customer name displayed
- "Linked" or "Unlinked" badge shown

**Basic Info:**
- Phone number (or "—" if missing)
- Email address (or "—" if missing)
- Address (or "—" if missing)

**Actions:**
- "Open Person" button (only if person_id exists)
- Navigates to `/dashboard/customers` when clicked

**Messages:**
- "Coming soon" placeholder text
- Optional skeleton rows

---

## Test Scenarios

### Scenario 1: Order with Linked Person

**Setup:**
- Order has `person_id` set
- Person record exists in customers table

**Expected:**
- Click customer name → popover opens
- "Linked" badge shown
- Person data displayed (name, phone, email, address)
- "Open Person" button visible
- Data loads only when popover opens (check Network tab)

---

### Scenario 2: Order without Person

**Setup:**
- Order has `person_id` = null
- Order has snapshot fields (customer_name, customer_phone, customer_email)

**Expected:**
- Click customer name → popover opens
- "Unlinked" badge shown
- Snapshot fields displayed (name, phone, email)
- "Open Person" button NOT visible
- No API call to fetch person (person_id is null)

---

### Scenario 3: Order with Failed Person Fetch

**Setup:**
- Order has `person_id` set
- Person record does not exist (deleted or invalid)

**Expected:**
- Click customer name → popover opens
- "Unlinked" badge shown (fetch failed)
- Snapshot fields displayed as fallback
- "Open Person" button visible (person_id exists)
- Error handled gracefully

---

### Scenario 4: Order with No Customer Name

**Setup:**
- Order has no customer name (empty or "—")

**Expected:**
- Customer column shows "—"
- No popover trigger (not clickable)
- Plain text display

---

### Scenario 5: Multiple Orders with Same Person

**Setup:**
- Multiple orders have same `person_id`

**Expected:**
- Click first customer name → popover opens, person data loads
- Click second customer name → popover opens, person data from cache (no new API call)
- Verify in Network tab: only one fetch for same person_id

---

## Common Issues

### Issue: Popover doesn't open

**Check:**
- Customer name is not "—"
- Customer name is clickable (button element)
- No console errors

**Fix:**
- Verify CustomerDetailsPopover component is imported
- Check trigger prop is passed correctly
- Verify popover state management

---

### Issue: Person data not loading

**Check:**
- `person_id` is not null
- Person record exists in customers table
- Network tab shows API call when popover opens

**Fix:**
- Verify `useCustomer` hook is enabled correctly
- Check React Query configuration
- Verify person_id is valid UUID

---

### Issue: Fallback data not showing

**Check:**
- Snapshot fields exist in order data
- Fallback logic in component is correct

**Fix:**
- Verify `transformOrderForUI` includes fallback fields
- Check fallback display logic in component

---

### Issue: "Open Person" button not showing

**Check:**
- `person_id` is not null
- Button conditional rendering is correct

**Fix:**
- Verify `personId` prop is passed correctly
- Check button conditional logic

---

## Performance Verification

### Lazy Loading

1. Open Orders page
2. Open browser DevTools → Network tab
3. Filter by "customers" or API endpoint
4. Click customer name → verify API call occurs
5. Close popover, click same customer → verify no new API call (cached)
6. Click different customer with same person_id → verify no new API call (cached)

### No Prefetching

1. Open Orders page
2. Open browser DevTools → Network tab
3. Verify no customer API calls on page load
4. Only calls should occur when popover opens

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

### Orders Table

- **File:** `src/modules/orders/components/SortableOrdersTable.tsx`
- **Integration:** Customer column case in switch statement
- **Props Passed:** personId, fallbackName, fallbackPhone, fallbackEmail

### Order Transform

- **File:** `src/modules/orders/utils/orderTransform.ts`
- **Integration:** UIOrder interface and transformOrderForUI function
- **Fields Added:** personId, fallbackPhone, fallbackEmail

### Customer Hook

- **File:** `src/modules/customers/hooks/useCustomers.ts`
- **Integration:** Reused `useCustomer` hook
- **Configuration:** Enabled only when popover open and personId exists

---

## Next Steps

After testing:

1. **Verify all scenarios pass**
2. **Check performance (lazy loading, caching)**
3. **Test accessibility (keyboard, screen reader)**
4. **Confirm no regressions in Orders table**
5. **Build and lint pass**

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify Network tab for API calls
3. Check React DevTools for component state
4. Review implementation plan for details
5. Check research.md for technical decisions

