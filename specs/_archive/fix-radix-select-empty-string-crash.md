# Fix Radix Select Empty String Crash

## Overview

After making Person optional in CreateInvoiceDrawer, selecting or defaulting to an empty value causes the page to go blank when clicking "Create Invoice". This is caused by Radix UI Select not supporting empty string (`""`) as a valid Select value, which triggers a runtime error and crashes the page.

**Context:**
- Radix UI Select component does not accept empty string as a valid value
- The current implementation uses `<SelectItem value="">None</SelectItem>` which crashes
- Form state correctly uses empty string for `customer_name` when no Person is selected
- Database expects empty string (not NULL) for `customer_name` when unassigned

**Goal:**
- Allow creating Invoices without an assigned Person while keeping Radix Select stable
- Fix the runtime crash caused by empty string Select value
- Maintain backward compatibility with existing invoice behavior
- Keep the UI-only constraint (no database or API changes)

---

## Current State Analysis

### CreateInvoiceDrawer Component

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Current Structure:**
- Person selector uses Radix UI Select component
- `SelectItem value=""` used for "None" option (line ~254)
- Form state stores `customer_name` as empty string `''` when no Person selected
- Select `value` prop binds to empty string when `customer_name` is empty (line ~242-246)

**Observations:**
- Empty string (`""`) is used as SelectItem value for "None" option
- Radix UI Select throws runtime error when empty string is passed as value
- Page crashes when user clicks "Create Invoice" with no Person selected
- Form state management correctly uses empty string for `customer_name`

### Invoice Form Schema

**File:** `src/modules/invoicing/schemas/invoice.schema.ts`

**Current Structure:**
```typescript
customer_name: z.string().default(''),
```

**Observations:**
- Schema correctly allows empty string as default value
- No validation changes needed
- Form state correctly handles empty string

### Relationship Analysis

**Current Relationship:**
- `customer_name` field stores Person's name as text snapshot
- No foreign key relationship exists between Invoices and People
- Person selection is UI-only convenience feature
- Database `customer_name` column is `NOT NULL`, but accepts empty string

**Gaps/Issues:**
- Radix UI Select component cannot handle empty string as a valid value
- Runtime crash occurs when SelectItem has `value=""`
- Page goes blank when attempting to submit form with empty Person selection

### Data Access Patterns

**How Person Selection Works:**
- Select dropdown shows all People from `useCustomersList()` hook
- Selected Person's ID is used to find name
- Name is stored as text in `customer_name` field
- Empty string is stored when "None" is selected

**How Select Value is Bound:**
- Select `value` prop currently uses empty string when `customer_name` is empty
- SelectItem for "None" uses empty string as value
- This causes Radix UI to crash

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **NONE** - No database schema changes needed
- `customer_name` remains `NOT NULL` (database constraint)
- Empty string `''` is valid for `text NOT NULL` columns
- No foreign key changes needed

**Non-Destructive Constraints:**
- No schema changes
- Existing Invoices remain valid
- Empty string continues to be acceptable for `customer_name` column

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Allow `customer_name` to be empty string `''`
- Filter invoices with empty customer: `WHERE customer_name = ''`
- Display placeholder text when `customer_name` is empty

**Recommended Display Patterns:**
- Show "No person assigned" or similar when `customer_name` is empty
- Person selector remains available but optional
- Use sentinel value in UI, map to empty string in form state

---

## Implementation Approach

### Phase 1: Introduce Sentinel Value

**Task 1.1: Define Sentinel Constant**

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (ADD)

**Change Required:**
Add a constant at the top of the component file:
```typescript
const NO_PERSON_SENTINEL = '__none__';
```

**Rationale:**
- Provides a non-empty string value for Radix Select
- Clearly indicates "no person selected" state
- Never conflicts with actual Person IDs (UUID format)

**Validation:**
- Constant is defined and used consistently
- Value does not conflict with Person IDs

---

### Phase 2: Update Select Implementation

**Task 2.1: Replace Empty String SelectItem Value**

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Location:** Line ~254

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
- Prevents runtime crash

**Validation:**
- "None" option works without crashing
- Select remains stable when "None" is selected

---

**Task 2.2: Update Select Value Binding**

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Location:** Lines ~242-246

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
- Maps empty `customer_name` to sentinel value
- Maintains correct display state

**Validation:**
- Select shows "None" when `customer_name` is empty
- Select shows correct Person when `customer_name` has value
- No empty string passed to Select component

---

**Task 2.3: Update Select Handler to Map Sentinel to Empty String**

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (UPDATE)

**Location:** Lines ~232-241

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
- Explicitly checks for sentinel value
- Maps sentinel value to empty string in form state
- Maintains existing behavior for Person selection
- Ensures database receives empty string (not sentinel value)

**Validation:**
- Selecting "None" sets `customer_name` to empty string
- Selecting a Person sets `customer_name` to their name
- Form submission stores empty string in database (not sentinel)
- No sentinel value leaks into form state or database

---

### Phase 3: Verification

**Task 3.1: TypeScript Compilation**

**Verification Steps:**
1. Run `npm run build` to check TypeScript compilation
2. Verify no type errors
3. Verify all imports resolve correctly

**Expected Result:**
- Build succeeds without errors
- No TypeScript errors
- No type warnings

---

**Task 3.2: Runtime Testing**

**Verification Steps:**
1. Open CreateInvoiceDrawer
2. Verify "None" option appears in Person dropdown
3. Select "None" → verify no crash
4. Click "Create Invoice" without Person → verify Invoice is created
5. Select a Person → verify Person name is stored
6. Submit form with Person → verify Invoice is created
7. Check browser console for errors

**Expected Result:**
- No runtime errors or crashes
- Form accepts empty Person selection
- Form accepts Person selection
- Invoice creation succeeds in both scenarios
- No empty string values passed to Radix Select

---

**Task 3.3: Database Integration Testing**

**Verification Steps:**
1. Create Invoice without Person → verify DB stores empty string `''` in `customer_name`
2. Create Invoice with Person → verify DB stores Person's name in `customer_name`
3. Verify no sentinel value stored in database
4. Verify no database constraint errors

**Expected Result:**
- Invoice creation succeeds without Person
- Empty string stored correctly in database (not sentinel)
- No constraint violation errors
- No sentinel values in database

---

### Safety Considerations

- **No Data Loss:** All changes are UI-only, no database changes
- **Backward Compatibility:** Existing Invoices with `customer_name` remain valid
- **Form State Integrity:** Sentinel value is only used in UI layer, never in form state or database
- **Rollback:** Revert component changes if needed, no database rollback required

---

## What NOT to Do

- **Do NOT** change database schema (keep `customer_name` as `NOT NULL`)
- **Do NOT** add `person_id` foreign key column
- **Do NOT** use empty string as SelectItem value
- **Do NOT** store sentinel value in database (must map to empty string)
- **Do NOT** introduce fake placeholder names in database
- **Do NOT** change Zod schema validation (keep `customer_name` as `z.string().default('')`)
- **Do NOT** modify existing Invoice records
- **Do NOT** change API calls or backend logic

---

## Open Questions / Considerations

1. **Sentinel Value Choice:** Is `'__none__'` the best sentinel value? Alternatives:
   - `'__no_person__'`
   - `'__unassigned__'`
   - Consider if it could conflict with any Person ID format

2. **Error Handling:** Should we add error boundary or try-catch around Select component for extra safety?

3. **Testing:** Should we add unit tests for the sentinel value mapping logic?

---

## Success Criteria

- ✅ Clicking "Create Invoice" no longer blanks the page
- ✅ Invoice can be created with no Person selected
- ✅ Invoice can still be created with a Person selected
- ✅ UI remains stable and backward compatible
- ✅ No empty string values passed to Radix Select component
- ✅ Sentinel value is never stored in database (only empty string)
- ✅ No runtime errors or crashes
- ✅ No TypeScript or compilation errors
- ✅ Form validation works correctly for both cases

---

## File Changes Summary

| File | Action | Lines Changed | Description |
|------|--------|---------------|-------------|
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | UPDATE | ~10 | Add sentinel constant, update SelectItem value, update value binding, update handler |

**Total Estimated Changes:** ~10-15 lines in 1 file

---

## References

- Specification: `specs/allow-invoice-without-person.md`
- Invoice Form Schema: `src/modules/invoicing/schemas/invoice.schema.ts`
- CreateInvoiceDrawer: `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`
- Radix UI Select Documentation: https://www.radix-ui.com/primitives/docs/components/select

