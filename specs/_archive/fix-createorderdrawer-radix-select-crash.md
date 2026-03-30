# Fix CreateOrderDrawer Crash: Radix SelectItem Empty String Value

## Overview

Fix a runtime crash in CreateOrderDrawer that occurs when opening "Create New Order" due to Radix Select component rejecting empty string values in SelectItem components.

**Context:**
- CreateOrderDrawer was recently updated to include Person selector
- Radix UI Select component requires non-empty string values for SelectItem
- Current implementation uses `value=""` for "None" option, causing crash
- Similar pattern already exists in CreateInvoiceDrawer using sentinel value

**Goal:**
- Fix crash by replacing empty string SelectItem values with sentinel value
- Maintain existing UX (optional Person selection)
- Apply consistent pattern across CreateOrderDrawer and EditOrderDrawer
- No migrations or schema changes required

---

## Current State Analysis

### CreateOrderDrawer Component

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Current Implementation:**
```typescript
<SelectContent>
  <SelectItem value="">None</SelectItem>  // ❌ CRASH: Empty string not allowed
  {customers?.map((customer) => (
    <SelectItem key={customer.id} value={customer.id}>
      {customer.first_name} {customer.last_name}
    </SelectItem>
  ))}
</SelectContent>
```

**Observations:**
- Line 260: `<SelectItem value="">None</SelectItem>` causes Radix error
- Form field uses `value={field.value || ''}` which can be empty string
- `onValueChange` maps empty string to null: `field.onChange(value || null)`
- Default value in form is `person_id: null` (correct)

**Error:**
```
A <Select.Item /> must have a value prop that is not an empty string.
```

### EditOrderDrawer Component

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Current Implementation:**
```typescript
<SelectContent>
  <SelectItem value="">None</SelectItem>  // ❌ SAME ISSUE: Empty string not allowed
  {customers?.map((customer) => (
    <SelectItem key={customer.id} value={customer.id}>
      {customer.first_name} {customer.last_name}
    </SelectItem>
  ))}
</SelectContent>
```

**Observations:**
- Line 188: `<SelectItem value="">None</SelectItem>` has same issue
- Form field uses `value={field.value || ''}` which can be empty string
- `onValueChange` maps empty string to null: `field.onChange(value || null)`
- Default value in form is `person_id: null` (correct)
- **Both CreateOrderDrawer and EditOrderDrawer need the same fix**

### Existing Pattern (CreateInvoiceDrawer)

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Working Implementation:**
```typescript
// Sentinel value for "no person selected" in Radix Select (cannot use empty string)
const NO_PERSON_SENTINEL = '__none__';

// In Select:
<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>

// In onValueChange:
if (value === NO_PERSON_SENTINEL) {
  field.onChange(''); // Map sentinel to empty string for form state
}

// In value prop:
value={
  field.value && field.value !== ''
    ? customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? NO_PERSON_SENTINEL
    : NO_PERSON_SENTINEL
}
```

**Observations:**
- Uses `__none__` as sentinel value
- Maps sentinel ↔ empty string in form state
- Handles display value correctly

---

## Recommended Solution

### Fix Strategy

**Use Sentinel Value Pattern:**
1. Define `NO_PERSON_SENTINEL = '__none__'` constant
2. Replace `<SelectItem value="">None</SelectItem>` with `<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>`
3. Map sentinel ↔ null in form state:
   - Select `__none__` → set `person_id=null`, `person_name=null`
   - Select customer id → set `person_id=<id>`, `person_name=<snapshot>`
4. Update Select `value` prop to use sentinel when field value is null/empty
5. Update `onValueChange` to map sentinel to null

### Implementation Details

**For CreateOrderDrawer:**
```typescript
// Add constant
const NO_PERSON_SENTINEL = '__none__';

// Update Select value prop
<Select
  value={field.value || NO_PERSON_SENTINEL}
  onValueChange={(value) => {
    if (value === NO_PERSON_SENTINEL) {
      field.onChange(null);
    } else {
      field.onChange(value);
      // Set person_name snapshot
      const customer = customers?.find(c => c.id === value);
      if (customer) {
        form.setValue('person_name', `${customer.first_name} ${customer.last_name}`);
      }
    }
  }}
>
  <SelectContent>
    <SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>
    {customers?.map((customer) => (
      <SelectItem key={customer.id} value={customer.id}>
        {customer.first_name} {customer.last_name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**For EditOrderDrawer:**
- Apply same pattern if it has similar issue
- Verify current implementation

---

## Implementation Approach

### Phase 1: Fix CreateOrderDrawer

1. **Add sentinel constant:**
   - Define `NO_PERSON_SENTINEL = '__none__'` at top of component

2. **Update SelectItem:**
   - Replace `<SelectItem value="">None</SelectItem>` with `<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>`

3. **Update Select value prop:**
   - Change `value={field.value || ''}` to `value={field.value || NO_PERSON_SENTINEL}`

4. **Update onValueChange handler:**
   - Map `NO_PERSON_SENTINEL` to `null` for `person_id`
   - Set `person_name` to `null` when sentinel selected
   - Set `person_name` snapshot when customer selected

5. **Verify form defaultValues:**
   - Ensure `person_id: null` (not empty string)

### Phase 2: Fix EditOrderDrawer (if needed)

1. **Check for same issue:**
   - Verify if EditOrderDrawer has `<SelectItem value="">None</SelectItem>`

2. **Apply same fix:**
   - Use same sentinel pattern
   - Ensure consistent behavior

### Phase 3: Testing

1. **Test CreateOrderDrawer:**
   - Open "Create New Order" → no crash
   - Select "None" → person_id is null
   - Select customer → person_id and person_name set correctly
   - No console errors

2. **Test EditOrderDrawer:**
   - Open edit for order with no person → no crash
   - Open edit for order with person → pre-populated correctly
   - Change selection → works correctly
   - Clear selection → works correctly

---

## What NOT to Do

- **Do NOT change database schema** (no migrations)
- **Do NOT change form schema** (person_id remains optional nullable)
- **Do NOT change UX** (Person selection remains optional)
- **Do NOT use different sentinel value** (use `__none__` for consistency)

---

## Open Questions / Considerations

1. **EditOrderDrawer verification:**
   - Does EditOrderDrawer have the same issue?
   - **Decision:** Check implementation, apply fix if needed

2. **person_name handling:**
   - Should person_name be set to null when sentinel selected?
   - **Decision:** Yes, for consistency

3. **Form state mapping:**
   - Should we map sentinel in form state or only in Select?
   - **Decision:** Only in Select component, form state uses null

---

## Acceptance Criteria

- ✅ Clicking "Create New Order" never blanks the page
- ✅ Opening "Edit Order" never blanks the page
- ✅ Person selector supports choosing a customer (in both drawers)
- ✅ Person selector supports clearing selection (None) (in both drawers)
- ✅ No Radix Select errors in console
- ✅ Build passes
- ✅ No linter errors
- ✅ Consistent pattern with CreateInvoiceDrawer
- ✅ Both CreateOrderDrawer and EditOrderDrawer work correctly

---

## Success Metrics

- CreateOrderDrawer opens without crashing
- Person selection works correctly
- No console errors
- Consistent code pattern across components
- All existing functionality preserved

