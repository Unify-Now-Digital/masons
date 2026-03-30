# Allow creating Invoice without assigned Person

## Overview

Currently, CreateInvoiceDrawer requires selecting a Person from the People module, which blocks workflows where Invoices must be created without a Person (e.g., creating Jobs from Map-selected Orders). This feature makes Person selection optional, allowing Invoices to be created with an empty or null customer_name.

**Context:**
- CreateInvoiceDrawer currently requires `customer_name` field to be non-empty
- The invoices table stores `customer_name` as `text not null` (cannot be NULL in database)
- Some workflows (e.g., Map → Job → Invoice) need to create Invoices without a Person
- Person selection should remain available but optional

**Goal:**
- Allow creating Invoices without selecting a Person
- Make `customer_name` optional in form validation
- Store empty string or placeholder when no Person is selected
- Maintain backward compatibility with existing Invoices

---

## Current State Analysis

### Invoices Schema

**Table:** `public.invoices`

**Current Structure:**
- `id` (uuid, primary key)
- `customer_name` (text, NOT NULL) - Stores person's name as text snapshot
- `invoice_number` (text, unique, not null)
- `amount` (decimal(10,2), not null)
- `status` (text) - Values: 'draft', 'pending', 'paid', 'overdue', 'cancelled'
- `due_date` (date, not null)
- `issue_date` (date, default current_date)
- `payment_method` (text, nullable)
- `payment_date` (date, nullable)
- `notes` (text, nullable)
- `order_id` (uuid, nullable, foreign key to orders.id) - Legacy field
- `created_at`, `updated_at` (timestamps)

**Observations:**
- `customer_name` is `NOT NULL` in database (cannot store NULL)
- No `person_id` foreign key column exists
- Person information is stored as text snapshot in `customer_name`
- Current form validation requires `customer_name` to be non-empty string

### Invoice Form Schema

**File:** `src/modules/invoicing/schemas/invoice.schema.ts`

**Current Structure:**
```typescript
customer_name: z.string().min(1, 'Person name is required'),
```

**Observations:**
- Zod schema enforces minimum length of 1 character
- Form validation blocks submission if `customer_name` is empty
- UI shows "Person *" indicating required field

### CreateInvoiceDrawer Component

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Current Behavior:**
- Person selector is required (marked with *)
- Form validation fails if no Person is selected
- `customer_name` is populated from selected Person's name
- Cannot submit form without selecting a Person

**Observations:**
- Person selection is tightly coupled to form submission
- No option to skip Person selection
- UI indicates Person is required

### Relationship Analysis

**Current Relationship:**
- Invoices do NOT have a foreign key to People table
- Person information is stored as text snapshot (`customer_name`)
- No referential integrity between Invoices and People
- Person selection is UI-only (for convenience)

**Gaps/Issues:**
- Form validation prevents creating Invoice without Person
- No way to create Invoice with empty `customer_name`
- Blocks workflows that don't require Person assignment

### Data Access Patterns

**How Invoices are Currently Created:**
- CreateInvoiceDrawer component
- Form requires `customer_name` to be non-empty
- Person is selected from People module dropdown
- Selected Person's name is stored in `customer_name`

**How Person Selection Works:**
- Dropdown shows all People from `useCustomersList()` hook
- Selected Person's ID is used to find name
- Name is stored as text in `customer_name` field
- No foreign key relationship exists

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
- Empty string is acceptable for `customer_name` column

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Allow `customer_name` to be empty string `''`
- Filter invoices with empty customer: `WHERE customer_name = '' OR customer_name IS NULL` (though NULL not possible)
- Display placeholder text when `customer_name` is empty

**Recommended Display Patterns:**
- Show "No person assigned" or similar when `customer_name` is empty
- Person selector remains available but optional
- Form validation allows empty `customer_name`

---

## Implementation Approach

### Phase 1: Update Invoice Form Schema

**Task 1.1: Make customer_name Optional in Zod Schema**

**File:** `src/modules/invoicing/schemas/invoice.schema.ts`

**Change Required:**
Update the `customer_name` field to be optional:
```typescript
customer_name: z.string().optional().or(z.literal('')),
```

Or allow empty string:
```typescript
customer_name: z.string().default(''),
```

**Rationale:**
- Remove minimum length requirement
- Allow empty string as valid value
- Maintain type safety

**Validation:**
- Schema accepts empty string
- Schema accepts undefined (optional)
- Type inference works correctly

---

### Phase 2: Update CreateInvoiceDrawer Component

**Task 2.1: Remove Required Indicator from Person Field**

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Change Required:**
Update FormLabel to remove asterisk:
```typescript
<FormLabel>Person</FormLabel>  // Remove * from "Person *"
```

**Rationale:**
- Visual indication that field is optional
- Matches actual validation behavior

**Task 2.2: Update Form Default Value**

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Change Required:**
Allow `customer_name` to default to empty string:
```typescript
defaultValues: {
  customer_name: '',  // Allow empty string
  // ... other fields
},
```

**Task 2.3: Handle Empty Person Selection**

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Change Required:**
Update Person selector to allow clearing selection:
```typescript
<Select
  onValueChange={(value) => {
    if (value) {
      const customer = customers?.find(c => c.id === value);
      if (customer) {
        field.onChange(`${customer.first_name} ${customer.last_name}`);
      }
    } else {
      field.onChange(''); // Allow clearing selection
    }
  }}
  value={customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? ''}
>
  <SelectTrigger>
    <SelectValue placeholder="Select person (optional)" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">None</SelectItem>  // Add option to clear selection
    {customers?.map((customer) => (
      <SelectItem key={customer.id} value={customer.id}>
        {customer.first_name} {customer.last_name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Rationale:**
- Allow user to explicitly choose "None"
- Clear selection sets `customer_name` to empty string
- Maintains existing behavior when Person is selected

**Validation:**
- Form can be submitted without Person
- Person can still be selected if desired
- Empty string is stored in database

---

### Phase 3: Update Display Logic

**Task 3.1: Handle Empty customer_name in Display**

**File:** `src/modules/invoicing/utils/invoiceTransform.ts` (if needed)

**Change Required:**
Display placeholder when `customer_name` is empty:
```typescript
customer: invoice.customer_name || 'No person assigned',
```

**Rationale:**
- Better UX when displaying invoices without Person
- Clear indication that Person is not assigned

**Validation:**
- Empty `customer_name` displays placeholder text
- Existing invoices with names display correctly

---

### Safety Considerations
- No data loss: All changes are UI-only
- Backward compatibility: Existing Invoices with `customer_name` remain valid
- Database constraint: Empty string is valid for `text NOT NULL` column
- Rollback: Revert form schema and component changes if needed

---

## What NOT to Do

- **Do NOT** change database schema (keep `customer_name` as `NOT NULL`)
- **Do NOT** add `person_id` foreign key column
- **Do NOT** modify existing Invoice records
- **Do NOT** change API calls or backend logic
- **Do NOT** remove Person selection functionality (keep it available)
- **Do NOT** change Invoice display components (unless needed for empty name handling)

---

## Open Questions / Considerations

1. **Display Placeholder:** What text should display when `customer_name` is empty? Options:
   - "No person assigned"
   - "Unassigned"
   - Empty string (blank)
   - "N/A"

2. **Default Behavior:** Should the form default to empty `customer_name` or try to auto-select a Person if only one exists?

3. **Validation:** Should there be any business logic validation (e.g., warn if creating Invoice without Person)?

4. **Filtering:** Should invoices without Person be filterable/visible in a separate view?

5. **Reporting:** How should invoices without Person be handled in reports and analytics?

---

## Success Criteria

- ✅ Invoice can be created without selecting a Person
- ✅ Invoice can still be created with a Person (backward compatibility)
- ✅ Form validation allows empty `customer_name`
- ✅ Empty `customer_name` is stored as empty string in database
- ✅ Map → Job → Invoice flow works without errors
- ✅ Existing Invoices remain unchanged and valid
- ✅ No database schema changes
- ✅ No TypeScript or runtime errors

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/modules/invoicing/schemas/invoice.schema.ts` | UPDATE | Make `customer_name` optional (allow empty string) |
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | UPDATE | Remove required indicator, allow empty Person selection, add "None" option |
| `src/modules/invoicing/utils/invoiceTransform.ts` | UPDATE | Handle empty `customer_name` in display (optional) |

**Total Estimated Changes:** ~20-30 lines across 2-3 files

---

## References

- Invoice Schema Migration: `supabase/migrations/20250608000002_create_invoices_table.sql`
- Invoice Form Schema: `src/modules/invoicing/schemas/invoice.schema.ts`
- CreateInvoiceDrawer: `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`
- Invoice Transform: `src/modules/invoicing/utils/invoiceTransform.ts`
- Invoice Types: `src/modules/invoicing/types/invoicing.types.ts`

