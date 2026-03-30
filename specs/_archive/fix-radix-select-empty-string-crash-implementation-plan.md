# Implementation Plan: Fix Radix Select Empty String Crash

## Overview

This plan fixes the runtime crash in CreateInvoiceDrawer caused by Radix UI Select not supporting empty string (`""`) as a valid Select value. The fix introduces a sentinel value (`__none__`) for the UI layer while maintaining empty string in form state and database.

**Goal:** Prevent page crash when creating Invoice without Person by using a sentinel value instead of empty string in Radix Select.

**Constraints:**
- UI-only changes (no database schema changes)
- No API changes
- Sentinel value must never be stored in database (only empty string)
- Backward compatibility required
- Must work with existing invoice behavior

---

## Phase 1: Introduce Sentinel Value

### Task 1.1: Define Sentinel Constant

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (ADD)

**Description:**
Add a constant at the top of the component file to represent "no person selected" in the UI layer.

**Location:** Top of component, after imports

**Change Required:**
```typescript
const NO_PERSON_SENTINEL = '__none__';
```

**Rationale:**
- Provides a non-empty string value for Radix Select
- Clearly indicates "no person selected" state
- Never conflicts with actual Person IDs (UUID format)
- Easy to identify and maintain

**Validation:**
- Constant is defined and exported if needed elsewhere
- Value does not conflict with Person IDs
- TypeScript compiles without errors

---

## Phase 2: Update Select Implementation

### Task 2.1: Replace Empty String SelectItem Value

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Description:**
Replace the empty string value in the "None" SelectItem with the sentinel constant.

**Location:** Line ~254 (in SelectContent)

**Current State:**
```typescript
<SelectItem value="">None</SelectItem>
```

**Change Required:**
```typescript
<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>
```

**Rationale:**
- Removes empty string from SelectItem value
- Uses sentinel value that Radix Select can handle
- Prevents runtime crash when "None" is selected

**Validation:**
- "None" option appears in dropdown
- Selecting "None" does not crash
- Select component remains stable

---

### Task 2.2: Update Select Value Binding

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Description:**
Update the Select `value` prop to use sentinel value when `customer_name` is empty, never passing empty string to Radix Select.

**Location:** Lines ~242-246 (Select component value prop)

**Current State:**
```typescript
value={
  field.value && field.value !== ''
    ? customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? ''
    : ''
}
```

**Change Required:**
```typescript
value={
  field.value && field.value !== ''
    ? customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? NO_PERSON_SENTINEL
    : NO_PERSON_SENTINEL
}
```

**Rationale:**
- Never passes empty string to Radix Select
- Maps empty `customer_name` to sentinel value for UI display
- Maintains correct display state (shows "None" selected)
- Prevents crash when form loads with empty `customer_name`

**Validation:**
- Select shows "None" when `customer_name` is empty
- Select shows correct Person when `customer_name` has value
- No empty string passed to Select component
- Form loads without errors when `customer_name` is empty

---

### Task 2.3: Update Select Handler to Map Sentinel to Empty String

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Description:**
Update the `onValueChange` handler to explicitly check for sentinel value and map it to empty string in form state, ensuring database receives empty string (not sentinel).

**Location:** Lines ~232-241 (Select component onValueChange handler)

**Current State:**
```typescript
onValueChange={(value) => {
  if (value && value !== '') {
    const customer = customers?.find(c => c.id === value);
    if (customer) {
      field.onChange(`${customer.first_name} ${customer.last_name}`);
    }
  } else {
    field.onChange(''); // Clear selection - set to empty string
  }
}}
```

**Change Required:**
```typescript
onValueChange={(value) => {
  if (value === NO_PERSON_SENTINEL) {
    field.onChange(''); // Map sentinel to empty string for form state
  } else if (value) {
    const customer = customers?.find(c => c.id === value);
    if (customer) {
      field.onChange(`${customer.first_name} ${customer.last_name}`);
    }
  }
}}
```

**Rationale:**
- Explicitly checks for sentinel value first
- Maps sentinel value to empty string in form state
- Maintains existing behavior for Person selection
- Ensures database receives empty string (not sentinel value)
- Prevents sentinel value from leaking into form state or database

**Validation:**
- Selecting "None" sets `customer_name` to empty string in form state
- Selecting a Person sets `customer_name` to their name
- Form submission stores empty string in database (not sentinel)
- No sentinel value appears in form state or database
- Console shows no errors

---

## Phase 3: Verification and Testing

### Task 3.1: TypeScript Compilation

**Verification Steps:**
1. Run `npm run build` to check TypeScript compilation
2. Verify no type errors related to sentinel constant
3. Verify all imports resolve correctly
4. Check for any type warnings

**Expected Result:**
- Build succeeds without errors
- No TypeScript errors
- No type warnings
- Sentinel constant is properly typed (string)

---

### Task 3.2: Runtime Testing

**Verification Steps:**
1. Open CreateInvoiceDrawer in browser
2. Verify "None" option appears in Person dropdown
3. Select "None" → verify no crash or console errors
4. Click "Create Invoice" without Person → verify Invoice is created
5. Verify browser console shows no errors
6. Select a Person from dropdown → verify Person name is stored
7. Submit form with Person → verify Invoice is created
8. Check browser console for any runtime errors

**Expected Result:**
- No runtime errors or crashes
- Form accepts empty Person selection
- Form accepts Person selection
- Invoice creation succeeds in both scenarios
- No empty string values passed to Radix Select
- Console shows no errors related to Select component

---

### Task 3.3: Database Integration Testing

**Verification Steps:**
1. Create Invoice without Person → verify DB stores empty string `''` in `customer_name`
2. Create Invoice with Person → verify DB stores Person's name in `customer_name`
3. Query database to verify no sentinel value (`__none__`) stored
4. Verify no database constraint errors
5. Verify existing Invoices remain unchanged

**Expected Result:**
- Invoice creation succeeds without Person
- Empty string stored correctly in database (not sentinel)
- No constraint violation errors
- No sentinel values in database
- Existing Invoices unaffected

---

### Task 3.4: Edge Case Testing

**Verification Steps:**
1. Test form with pre-filled `customer_name` (empty string) → verify "None" shows selected
2. Test form with pre-filled `customer_name` (person name) → verify correct Person shows selected
3. Test switching from Person to "None" → verify form state updates correctly
4. Test switching from "None" to Person → verify form state updates correctly
5. Test rapid switching between options → verify no crashes or errors

**Expected Result:**
- All edge cases handled correctly
- Form state stays in sync with UI
- No crashes or errors in edge cases

---

## File Changes Summary

| File | Action | Lines Changed | Description |
|------|--------|---------------|-------------|
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | UPDATE | ~15 | Add sentinel constant, update SelectItem value, update value binding, update handler |

**Total Estimated Changes:** ~15 lines in 1 file

---

## Success Criteria Checklist

- [ ] Sentinel constant `NO_PERSON_SENTINEL` is defined
- [ ] SelectItem "None" uses sentinel value (not empty string)
- [ ] Select `value` prop uses sentinel when `customer_name` is empty
- [ ] Select handler maps sentinel to empty string in form state
- [ ] Clicking "Create Invoice" no longer blanks the page
- [ ] Invoice can be created with no Person selected
- [ ] Invoice can still be created with a Person selected
- [ ] UI remains stable and backward compatible
- [ ] No empty string values passed to Radix Select component
- [ ] Sentinel value is never stored in database (only empty string)
- [ ] No runtime errors or crashes
- [ ] No TypeScript or compilation errors
- [ ] Form validation works correctly for both cases
- [ ] All edge cases handled correctly

---

## Rollback Plan

If issues occur:

1. **Revert file changes:**
   - Revert `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` to previous state
   - Remove sentinel constant
   - Restore empty string in SelectItem value
   - Restore original value binding and handler

2. **No database changes required:**
   - No migrations to rollback
   - Existing data remains unchanged

3. **Alternative approach (if needed):**
   - Consider using `undefined` instead of empty string for Select value (may require more changes)
   - Consider conditional rendering (hide Select when no Person, use different UI element)

---

## Notes

1. **Sentinel Value Choice:**
   - `'__none__'` chosen for clarity and uniqueness
   - Double underscore prefix ensures it won't conflict with Person IDs (UUIDs)
   - Easy to search for in codebase if needed

2. **Form State vs UI State:**
   - Sentinel value is ONLY used in UI layer (Radix Select)
   - Form state always uses empty string `''` when no Person selected
   - Database always receives empty string (not sentinel)
   - This separation ensures data integrity

3. **Backward Compatibility:**
   - Existing Invoices with `customer_name` values remain valid
   - Existing form behavior preserved (except for crash fix)
   - No changes to API or database schema
   - All existing functionality continues to work

4. **Future Considerations:**
   - If Radix UI adds support for empty string values in future, can simplify
   - Sentinel value approach is isolated and easy to remove if needed
   - Pattern can be reused for other optional Select fields if similar issues arise

---

## References

- Specification: `specs/fix-radix-select-empty-string-crash.md`
- Previous Implementation: `specs/allow-invoice-without-person-implementation-plan.md`
- Invoice Form Schema: `src/modules/invoicing/schemas/invoice.schema.ts`
- CreateInvoiceDrawer: `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`
- Radix UI Select Documentation: https://www.radix-ui.com/primitives/docs/components/select

