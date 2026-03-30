# Implementation Plan: Allow creating Invoice without assigned Person

## Overview

This plan makes Person selection optional in CreateInvoiceDrawer, allowing Invoices to be created without a Person. This unblocks workflows like Map → Job → Invoice where a Person may not be available or required.

**Goal:** Make `customer_name` optional in Invoice form validation, allowing empty string to be stored when no Person is selected.

**Constraints:**
- UI-only changes (no database schema changes)
- No API changes
- Backward compatibility required
- Person selection remains available but optional

---

## Phase 1: Update Invoice Form Schema

### Task 1.1: Make customer_name Optional in Zod Schema

**File:** `src/modules/invoicing/schemas/invoice.schema.ts` (UPDATE)

**Description:**
Update the Zod schema to allow `customer_name` to be optional or empty string.

**Current State:**
```typescript
customer_name: z.string().min(1, 'Person name is required'),
```

**Change Required:**
Update to allow empty string:
```typescript
customer_name: z.string().default(''),
```

**Alternative (if we want to allow undefined):**
```typescript
customer_name: z.string().optional().or(z.literal('')),
```

**Rationale:**
- Remove minimum length requirement (`.min(1)`)
- Allow empty string as valid value
- Default to empty string if not provided
- Maintains type safety (still `string`, not `string | null`)

**Validation:**
- Schema accepts empty string `''`
- Schema accepts undefined (if using optional)
- Type inference works correctly
- TypeScript compiles without errors

---

## Phase 2: Update CreateInvoiceDrawer Component

### Task 2.1: Remove Required Indicator from Person Field

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Description:**
Update the FormLabel to remove the asterisk indicating required field.

**Location:** Line ~230

**Current State:**
```typescript
<FormLabel>Person *</FormLabel>
```

**Change Required:**
```typescript
<FormLabel>Person</FormLabel>
```

**Rationale:**
- Visual indication that field is optional
- Matches actual validation behavior after schema update

**Validation:**
- Label displays without asterisk
- Field appears optional to users

---

### Task 2.2: Update Placeholder Text

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Description:**
Update Select placeholder to indicate field is optional.

**Location:** Line ~242

**Current State:**
```typescript
<SelectValue placeholder="Select person" />
```

**Change Required:**
```typescript
<SelectValue placeholder="Select person (optional)" />
```

**Rationale:**
- Clear indication that Person selection is optional
- Better UX for users

**Validation:**
- Placeholder text indicates optional field

---

### Task 2.3: Add "None" Option to Person Selector

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Description:**
Add a "None" option to the Person selector dropdown to allow explicitly clearing the selection.

**Location:** Lines ~245-254 (SelectContent)

**Current State:**
```typescript
<SelectContent>
  {!customers || customers.length === 0 ? (
    <div className="p-2 text-sm text-muted-foreground">No people available</div>
  ) : (
    customers.map((customer) => (
      <SelectItem key={customer.id} value={customer.id}>
        {customer.first_name} {customer.last_name}
      </SelectItem>
    ))
  )}
</SelectContent>
```

**Change Required:**
```typescript
<SelectContent>
  <SelectItem value="">None</SelectItem>
  {!customers || customers.length === 0 ? (
    <div className="p-2 text-sm text-muted-foreground">No people available</div>
  ) : (
    customers.map((customer) => (
      <SelectItem key={customer.id} value={customer.id}>
        {customer.first_name} {customer.last_name}
      </SelectItem>
    ))
  )}
</SelectContent>
```

**Rationale:**
- Allows user to explicitly choose "None"
- Provides clear way to clear Person selection
- Better UX than leaving field empty

**Validation:**
- "None" option appears in dropdown
- Selecting "None" clears Person selection

---

### Task 2.4: Update Person Selection Handler

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Description:**
Update the `onValueChange` handler to handle empty value (when "None" is selected).

**Location:** Lines ~232-237

**Current State:**
```typescript
onValueChange={(value) => {
  const customer = customers?.find(c => c.id === value);
  if (customer) {
    field.onChange(`${customer.first_name} ${customer.last_name}`);
  }
}}
```

**Change Required:**
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

**Rationale:**
- Handles empty value when "None" is selected
- Sets `customer_name` to empty string when cleared
- Maintains existing behavior when Person is selected

**Validation:**
- Selecting "None" sets `customer_name` to empty string
- Selecting a Person sets `customer_name` to their name
- Form can be submitted with empty `customer_name`

---

### Task 2.5: Update Select Value Binding

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Description:**
Update the Select `value` prop to handle empty `customer_name` correctly.

**Location:** Line ~238

**Current State:**
```typescript
value={customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? undefined}
```

**Change Required:**
```typescript
value={
  field.value && field.value !== ''
    ? customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? ''
    : ''
}
```

**Rationale:**
- Shows "None" selected when `customer_name` is empty
- Shows Person selected when `customer_name` has value
- Handles edge cases correctly

**Validation:**
- Empty `customer_name` shows "None" as selected
- Non-empty `customer_name` shows correct Person as selected

---

## Phase 3: Update Display Logic (Optional)

### Task 3.1: Handle Empty customer_name in Transform

**File:** `src/modules/invoicing/utils/invoiceTransform.ts` (UPDATE - OPTIONAL)

**Description:**
Update the transform function to display placeholder text when `customer_name` is empty.

**Location:** Line ~38

**Current State:**
```typescript
customer: invoice.customer_name,
```

**Change Required:**
```typescript
customer: invoice.customer_name || 'No person assigned',
```

**Rationale:**
- Better UX when displaying invoices without Person
- Clear indication that Person is not assigned
- Prevents blank/empty display

**Note:** This is optional - empty string display may be acceptable depending on design requirements.

**Validation:**
- Empty `customer_name` displays placeholder text
- Non-empty `customer_name` displays correctly

---

## Phase 4: Verification and Testing

### Task 4.1: TypeScript Compilation

**Verification Steps:**
1. Run `npm run build` to check TypeScript compilation
2. Verify no type errors
3. Verify all imports resolve correctly

**Expected Result:**
- Build succeeds without errors
- No TypeScript errors
- No type warnings

---

### Task 4.2: Form Validation Testing

**Verification Steps:**
1. Open CreateInvoiceDrawer
2. Verify Person field shows "Person" (no asterisk)
3. Verify placeholder says "Select person (optional)"
4. Verify "None" option appears in dropdown
5. Select "None" → verify `customer_name` is empty
6. Submit form without Person → verify Invoice is created
7. Select a Person → verify `customer_name` is set
8. Submit form with Person → verify Invoice is created

**Expected Result:**
- Form accepts empty Person selection
- Form accepts Person selection
- Validation works correctly for both cases
- Invoice creation succeeds in both scenarios

---

### Task 4.3: Database Integration Testing

**Verification Steps:**
1. Create Invoice without Person → verify DB stores empty string `''` in `customer_name`
2. Create Invoice with Person → verify DB stores Person's name in `customer_name`
3. Verify no database constraint errors
4. Verify existing Invoices remain unchanged

**Expected Result:**
- Invoice creation succeeds without Person
- Empty string stored correctly in database
- No constraint violation errors
- Existing Invoices unaffected

---

### Task 4.4: Map → Job → Invoice Flow Testing

**Verification Steps:**
1. Navigate to Map of Orders
2. Select Orders on map
3. Create Job from selected Orders
4. Create Invoice (if this flow exists) → verify works without Person
5. Verify no errors in console

**Expected Result:**
- Map → Job → Invoice flow works without errors
- Invoice can be created without Person in this workflow
- No validation errors block the flow

---

## File Changes Summary

| File | Action | Lines Changed | Description |
|------|--------|---------------|-------------|
| `src/modules/invoicing/schemas/invoice.schema.ts` | UPDATE | ~1 | Make `customer_name` optional (allow empty string) |
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | UPDATE | ~15 | Remove required indicator, add "None" option, update handlers |
| `src/modules/invoicing/utils/invoiceTransform.ts` | UPDATE | ~1 | Handle empty `customer_name` in display (optional) |

**Total Estimated Changes:** ~17-20 lines across 2-3 files

---

## Success Criteria Checklist

- [ ] Invoice form schema accepts empty `customer_name`
- [ ] Person field label shows "Person" (no asterisk)
- [ ] Person selector placeholder indicates optional
- [ ] "None" option appears in Person dropdown
- [ ] Selecting "None" clears Person selection
- [ ] Invoice can be created without selecting a Person
- [ ] Invoice can still be created with a Person (backward compatibility)
- [ ] Empty `customer_name` is stored as empty string in database
- [ ] Map → Job → Invoice flow works without errors
- [ ] Existing Invoices remain unchanged and valid
- [ ] No database schema changes
- [ ] No TypeScript or runtime errors
- [ ] Form validation works correctly for both cases

---

## Rollback Plan

If issues occur:

1. **Revert file changes:**
   - Revert `src/modules/invoicing/schemas/invoice.schema.ts` to require `customer_name`
   - Revert `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` to require Person
   - Revert `src/modules/invoicing/utils/invoiceTransform.ts` if changed

2. **No database changes required:**
   - No migrations to rollback
   - Existing data remains unchanged

---

## Notes

1. **Database Constraint:**
   - `customer_name` is `NOT NULL` in database, but empty string `''` is valid
   - No need to change database schema
   - Empty string satisfies the constraint

2. **Backward Compatibility:**
   - Existing Invoices with `customer_name` values remain valid
   - New Invoices can have empty `customer_name`
   - No data migration needed

3. **Display Considerations:**
   - Consider how empty `customer_name` should display in Invoice lists
   - May want to show "No person assigned" or similar placeholder
   - Optional transform update handles this

4. **Future Enhancements:**
   - Could add `person_id` foreign key column in future
   - Could add filtering for invoices without Person
   - Could add bulk assignment of Person to invoices

---

## References

- Specification: `specs/allow-invoice-without-person.md`
- Invoice Schema Migration: `supabase/migrations/20250608000002_create_invoices_table.sql`
- Invoice Form Schema: `src/modules/invoicing/schemas/invoice.schema.ts`
- CreateInvoiceDrawer: `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`
- Invoice Transform: `src/modules/invoicing/utils/invoiceTransform.ts`
- Invoice Types: `src/modules/invoicing/types/invoicing.types.ts`

