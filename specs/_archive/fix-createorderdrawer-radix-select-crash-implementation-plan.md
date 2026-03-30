# Implementation Plan: Fix CreateOrderDrawer/EditOrderDrawer Radix Select Crash

**Branch:** `feature/fix-createorderdrawer-radix-select-crash`  
**Specification:** `specs/fix-createorderdrawer-radix-select-crash.md`

---

## Overview

This implementation plan fixes a runtime crash in CreateOrderDrawer and EditOrderDrawer caused by Radix Select component rejecting empty string values in SelectItem components.

**Goal:** 
- Fix crash by replacing empty string SelectItem values with sentinel value
- Maintain existing UX (optional Person selection)
- Apply consistent pattern across both drawers
- No migrations or schema changes required

**Constraints:**
- No database changes
- No form schema changes
- No UX changes
- Use `__none__` sentinel value for consistency with CreateInvoiceDrawer

---

## Phase 1 — Fix CreateOrderDrawer

### Task 1.1: Add Sentinel Constant

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Add sentinel constant at the top of the component, matching the pattern used in CreateInvoiceDrawer.

**Changes:**
```typescript
// Add after imports, before component definition
const NO_PERSON_SENTINEL = '__none__';
```

**Validation:**
- Constant defined correctly
- Matches CreateInvoiceDrawer pattern

---

### Task 1.2: Replace Empty String SelectItem

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Replace `<SelectItem value="">None</SelectItem>` with sentinel value.

**Changes:**
```typescript
// Before:
<SelectItem value="">None</SelectItem>

// After:
<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>
```

**Validation:**
- No empty string values in SelectItem
- "None" option still displays correctly

---

### Task 1.3: Update Select Value Prop

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Update Select `value` prop to use sentinel when field value is null/empty.

**Changes:**
```typescript
// Before:
value={field.value || ''}

// After:
value={field.value || NO_PERSON_SENTINEL}
```

**Validation:**
- Select value never becomes empty string
- Null values map to sentinel correctly

---

### Task 1.4: Update onValueChange Handler

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Update `onValueChange` to map sentinel to null and set person_name snapshot when customer selected.

**Changes:**
```typescript
// Before:
onValueChange={(value) => {
  field.onChange(value || null);
}}

// After:
onValueChange={(value) => {
  if (value === NO_PERSON_SENTINEL) {
    field.onChange(null);
    form.setValue('person_name', null);
  } else {
    field.onChange(value);
    // Set person_name snapshot
    const customer = customers?.find(c => c.id === value);
    if (customer) {
      form.setValue('person_name', `${customer.first_name} ${customer.last_name}`);
    }
  }
}}
```

**Validation:**
- Sentinel maps to null correctly
- Customer selection sets person_id and person_name
- person_name snapshot set correctly

---

### Task 1.5: Verify Form DefaultValues

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Ensure form defaultValues use `null` (not empty string) for `person_id` and `person_name`.

**Validation:**
- `person_id: null` in defaultValues
- `person_name: null` in defaultValues (if present)
- No empty strings in defaults

---

## Phase 2 — Fix EditOrderDrawer

### Task 2.1: Add Sentinel Constant

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Add sentinel constant at the top of the component.

**Changes:**
```typescript
// Add after imports, before component definition
const NO_PERSON_SENTINEL = '__none__';
```

**Validation:**
- Constant defined correctly
- Matches CreateOrderDrawer pattern

---

### Task 2.2: Replace Empty String SelectItem

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Replace `<SelectItem value="">None</SelectItem>` with sentinel value.

**Changes:**
```typescript
// Before:
<SelectItem value="">None</SelectItem>

// After:
<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>
```

**Validation:**
- No empty string values in SelectItem
- "None" option still displays correctly

---

### Task 2.3: Update Select Value Prop

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Update Select `value` prop to use sentinel when field value is null/empty.

**Changes:**
```typescript
// Before:
value={field.value || ''}

// After:
value={field.value || NO_PERSON_SENTINEL}
```

**Validation:**
- Select value never becomes empty string
- Null values map to sentinel correctly
- Pre-population works (order with person_id shows that id)

---

### Task 2.4: Update onValueChange Handler

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Update `onValueChange` to map sentinel to null and set person_name snapshot when customer selected.

**Changes:**
```typescript
// Before:
onValueChange={(value) => {
  field.onChange(value || null);
}}

// After:
onValueChange={(value) => {
  if (value === NO_PERSON_SENTINEL) {
    field.onChange(null);
    form.setValue('person_name', null);
  } else {
    field.onChange(value);
    // Set person_name snapshot
    const customer = customers?.find(c => c.id === value);
    if (customer) {
      form.setValue('person_name', `${customer.first_name} ${customer.last_name}`);
    }
  }
}}
```

**Validation:**
- Sentinel maps to null correctly
- Customer selection sets person_id and person_name
- Clearing selection works correctly

---

## Phase 3 — Testing & Validation

### Task 3.1: Test CreateOrderDrawer

**Scenarios:**
- [ ] Open "Create New Order" → no crash
- [ ] Select "None" → person_id is null, person_name is null
- [ ] Select customer → person_id and person_name set correctly
- [ ] No console errors
- [ ] Form submission works correctly

**Validation:**
- All scenarios pass
- No Radix Select errors in console
- No blank page

---

### Task 3.2: Test EditOrderDrawer

**Scenarios:**
- [ ] Open edit for order with no person → no crash, shows "None"
- [ ] Open edit for order with person → pre-populated correctly
- [ ] Change selection → works correctly
- [ ] Clear selection (select "None") → person_id and person_name set to null
- [ ] No console errors

**Validation:**
- All scenarios pass
- No Radix Select errors in console
- No blank page

---

### Task 3.3: Build & Lint Validation

**Validation:**
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] No TypeScript errors
- [ ] No console warnings

---

## Deliverables

- ✅ CreateOrderDrawer fixed (no crash)
- ✅ EditOrderDrawer fixed (no crash)
- ✅ Consistent sentinel pattern applied
- ✅ Person selection works correctly
- ✅ All tests pass
- ✅ Build and lint pass

---

## Success Criteria

- Clicking "Create New Order" never blanks the page
- Opening "Edit Order" never blanks the page
- Person selector supports choosing a customer (in both drawers)
- Person selector supports clearing selection (None) (in both drawers)
- No Radix Select errors in console
- Build passes
- No linter errors
- Consistent pattern with CreateInvoiceDrawer
- Both CreateOrderDrawer and EditOrderDrawer work correctly

