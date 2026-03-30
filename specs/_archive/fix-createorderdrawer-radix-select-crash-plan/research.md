# Research: Fix CreateOrderDrawer/EditOrderDrawer Radix Select Crash

## Problem Analysis

### Root Cause
- Radix UI Select component requires non-empty string values for SelectItem
- Current implementation uses `value=""` for "None" option
- Radix throws error: "A <Select.Item /> must have a value prop that is not an empty string."
- Error crashes the component, resulting in blank page

### Affected Components
1. **CreateOrderDrawer** - Line 260: `<SelectItem value="">None</SelectItem>`
2. **EditOrderDrawer** - Line 188: `<SelectItem value="">None</SelectItem>`

### Error Impact
- Component crashes on render
- Page becomes blank
- User cannot create or edit orders
- Console shows Radix error

---

## Technical Research

### Radix Select Requirements

**Radix UI Documentation:**
- SelectItem `value` prop must be a non-empty string
- Empty string (`""`) is explicitly forbidden
- Null/undefined values are also not allowed

**Current Implementation:**
```typescript
<SelectItem value="">None</SelectItem>  // ❌ Invalid
```

**Required Pattern:**
```typescript
<SelectItem value="__none__">None</SelectItem>  // ✅ Valid
```

---

## Existing Solution Pattern

### CreateInvoiceDrawer Implementation

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Working Pattern:**
```typescript
// Sentinel value for "no person selected" in Radix Select (cannot use empty string)
const NO_PERSON_SENTINEL = '__none__';

// In Select:
<Select
  value={
    field.value && field.value !== ''
      ? customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? NO_PERSON_SENTINEL
      : NO_PERSON_SENTINEL
  }
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

**Key Points:**
- Uses `__none__` as sentinel value
- Maps sentinel ↔ form state (empty string in this case)
- Handles display value correctly

---

## Solution Approach

### Sentinel Value Pattern

**Strategy:**
1. Use `__none__` as sentinel (consistent with CreateInvoiceDrawer)
2. Map sentinel ↔ null in form state (for person_id)
3. Update Select value prop to use sentinel when null
4. Update onValueChange to map sentinel to null

**Differences from CreateInvoiceDrawer:**
- CreateInvoiceDrawer uses `customer_name` (text field) → maps to empty string
- CreateOrderDrawer uses `person_id` (UUID field) → maps to null
- Both use same sentinel value for consistency

---

## Implementation Details

### Form State Mapping

**CreateOrderDrawer/EditOrderDrawer:**
- Form field: `person_id: string | null`
- Sentinel: `__none__`
- Mapping:
  - `null` → `__none__` (for Select display)
  - `__none__` → `null` (for form state)
  - Customer UUID → Customer UUID (no change)

### Person Name Snapshot

**When Customer Selected:**
- Set `person_id` = customer.id
- Set `person_name` = `${customer.first_name} ${customer.last_name}`

**When Sentinel Selected:**
- Set `person_id` = null
- Set `person_name` = null

---

## Constraints & Considerations

### No Breaking Changes
- Form schema unchanged (person_id remains optional nullable)
- Database schema unchanged (no migrations)
- UX unchanged (Person selection remains optional)

### Consistency
- Use same sentinel value (`__none__`) across all components
- Follow same pattern as CreateInvoiceDrawer
- Maintain consistent code style

### Performance
- No performance impact
- Minimal code changes
- No additional API calls

---

## References

- Radix UI Select Documentation
- Existing pattern: `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`
- Specification: `specs/fix-createorderdrawer-radix-select-crash.md`

