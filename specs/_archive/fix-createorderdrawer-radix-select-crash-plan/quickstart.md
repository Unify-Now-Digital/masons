# Quickstart: Fix CreateOrderDrawer/EditOrderDrawer Radix Select Crash

## Overview

Quick fix for Radix Select crash caused by empty string values in SelectItem components. This is a simple bug fix requiring minimal code changes.

## What's Broken

- CreateOrderDrawer crashes when opening "Create New Order"
- EditOrderDrawer crashes when opening "Edit Order"
- Error: "A <Select.Item /> must have a value prop that is not an empty string."

## Quick Fix Steps

### 1. Fix CreateOrderDrawer

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

```typescript
// 1. Add constant at top of file (after imports)
const NO_PERSON_SENTINEL = '__none__';

// 2. Update Select value prop (line ~249)
value={field.value || NO_PERSON_SENTINEL}

// 3. Update onValueChange (line ~250)
onValueChange={(value) => {
  if (value === NO_PERSON_SENTINEL) {
    field.onChange(null);
    form.setValue('person_name', null);
  } else {
    field.onChange(value);
    const customer = customers?.find(c => c.id === value);
    if (customer) {
      form.setValue('person_name', `${customer.first_name} ${customer.last_name}`);
    }
  }
}}

// 4. Update SelectItem (line ~260)
<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>
```

### 2. Fix EditOrderDrawer

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

Apply the same changes as CreateOrderDrawer (same line numbers approximately).

### 3. Test

- Open "Create New Order" → should not crash
- Open "Edit Order" → should not crash
- Select Person → should work
- Clear Person → should work
- No console errors

## Key Files

- `src/modules/orders/components/CreateOrderDrawer.tsx`
- `src/modules/orders/components/EditOrderDrawer.tsx`

## Pattern Reference

See working implementation in:
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` (line 59)

## Common Issues

### Still Getting Crash
- Check that all `value=""` are replaced with `NO_PERSON_SENTINEL`
- Verify Select `value` prop uses sentinel for null/empty
- Ensure onValueChange maps sentinel to null

### Person Not Saving
- Check onValueChange handler sets person_id correctly
- Verify person_name snapshot is set when customer selected

## Next Steps

1. Review implementation plan: `specs/fix-createorderdrawer-radix-select-crash-implementation-plan.md`
2. Apply fixes to both components
3. Test thoroughly
4. Verify build passes

