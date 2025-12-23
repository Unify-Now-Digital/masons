# Implementation Plan: Add latitude and longitude to Orders (manual input, optional)

## Overview

This plan adds optional latitude and longitude fields to Orders to support future map-based workflows. The implementation includes a database migration, type updates, validation, and UI changes to the Order creation form.

**Goal:** Add nullable latitude and longitude columns to Orders table, update types and validation, and add coordinate input fields to CreateOrderDrawer.

**Constraints:**
- Single migration
- No breaking changes
- No map picker
- No geocoding
- Manual input only

---

## Phase 1: Database Migration

### Task 1.1: Create Migration File

**File:** `supabase/migrations/YYYYMMDDHHmmss_add_latitude_longitude_to_orders.sql`

**Migration Naming:**
- Format: `YYYYMMDDHHmmss_add_latitude_longitude_to_orders.sql`
- Example: `20250115120000_add_latitude_longitude_to_orders.sql`
- Use current timestamp for YYYYMMDDHHmmss

**Migration SQL:**
```sql
-- Add latitude and longitude columns to orders table
alter table public.orders
  add column latitude numeric(10, 8),
  add column longitude numeric(10, 8);
```

**Rationale:**
- `numeric(10, 8)` provides 8 decimal places precision (~1.1 mm accuracy)
- Columns are nullable (no breaking changes)
- Single `ALTER TABLE` statement adds both columns
- No default values (existing Orders remain NULL)

**Validation:**
- Migration runs successfully
- Columns exist and are nullable
- Existing Orders have NULL coordinates
- New Orders can have NULL or numeric values

---

## Phase 2: Update Type Definitions

### Task 2.1: Update `Order` Interface

**File:** `src/modules/orders/types/orders.types.ts`

**Current State:**
```typescript
export interface Order {
  // ... other fields
  location: string | null;
  value: number | null;
  // ... other fields
}
```

**Change Required:**
Add `latitude` and `longitude` fields after `location`:
```typescript
export interface Order {
  // ... other fields
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  value: number | null;
  // ... other fields
}
```

**Validation:**
- TypeScript compiles without errors
- `OrderInsert` and `OrderUpdate` automatically include new fields (derived from `Order`)

---

## Phase 3: Update Form Schema

### Task 3.1: Add Latitude and Longitude to Schema

**File:** `src/modules/orders/schemas/order.schema.ts`

**Current State:**
```typescript
export const orderFormSchema = z.object({
  // ... other fields
  location: z.string().min(1, 'Location is required'),
  value: z.number().min(0, 'Value must be positive').optional().nullable(),
  // ... other fields
});
```

**Change Required:**
Add `latitude` and `longitude` fields after `location`:
```typescript
export const orderFormSchema = z.object({
  // ... other fields
  location: z.string().min(1, 'Location is required'),
  latitude: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional()
    .nullable(),
  longitude: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional()
    .nullable(),
  value: z.number().min(0, 'Value must be positive').optional().nullable(),
  // ... other fields
});
```

**Validation Rules:**
- `latitude`: Optional, nullable, if provided must be between -90 and 90
- `longitude`: Optional, nullable, if provided must be between -180 and 180
- Validation only applies when values are provided (not null/undefined)

**Validation:**
- Schema compiles without errors
- Optional fields can be null/undefined
- Range validation works when values are provided

---

## Phase 4: Update CreateOrderDrawer Component

### Task 4.1: Add Coordinate Input Fields

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Location:** Add after "Deceased & Location" section (after line 266)

**Change Required:**
Add a new "Coordinates" section with two numeric input fields:

```typescript
{/* Coordinates */}
<div className="space-y-4">
  <h3 className="text-sm font-semibold">Coordinates (Optional)</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField
      control={form.control}
      name="latitude"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Latitude</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.00000001"
              placeholder="e.g., 51.5074"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="longitude"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Longitude</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.00000001"
              placeholder="e.g., -0.1278"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
</div>
```

**Implementation Details:**
- Section title: "Coordinates (Optional)"
- Two-column grid layout (responsive)
- Number inputs with high precision step (0.00000001)
- Placeholders: "e.g., 51.5074" (London) and "e.g., -0.1278" (London)
- Null handling: Empty string converts to null
- Optional fields (no required validation)

### Task 4.2: Update Default Values

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Current State:**
```typescript
defaultValues: {
  // ... other fields
  location: '',
  value: null,
  // ... other fields
},
```

**Change Required:**
Add `latitude` and `longitude` to default values:
```typescript
defaultValues: {
  // ... other fields
  location: '',
  latitude: null,
  longitude: null,
  value: null,
  // ... other fields
},
```

**Validation:**
- Default values are null (undefined in form)
- Form initializes correctly
- Fields are optional

### Task 4.3: Update Form Submission

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Current State:**
```typescript
const orderData = {
  // Required fields
  customer_name: data.customer_name.trim(),
  location: data.location.trim(),
  sku: data.sku.trim(),
  order_type: data.order_type,
  
  // Snapshot fields
  material: data.material || null,
  color: data.color || null,
  value: data.value ?? null,
  notes: notesValue,
  
  // ... removed fields defaults
};
```

**Change Required:**
Add `latitude` and `longitude` to order payload:
```typescript
const orderData = {
  // Required fields
  customer_name: data.customer_name.trim(),
  location: data.location.trim(),
  sku: data.sku.trim(),
  order_type: data.order_type,
  
  // Snapshot fields
  material: data.material || null,
  color: data.color || null,
  value: data.value ?? null,
  notes: notesValue,
  
  // Coordinates
  latitude: data.latitude ?? null,
  longitude: data.longitude ?? null,
  
  // ... removed fields defaults
};
```

**Validation:**
- Coordinates are included in submission
- Null values are handled correctly
- Values are sent to Supabase

---

## Phase 5: Backward Compatibility Verification

### Task 5.1: Verify Existing Orders

**Verification Steps:**
1. Run migration successfully
2. Verify existing Orders load correctly (NULL coordinates)
3. Verify existing Orders can be queried without errors
4. Verify no database constraint violations

**Expected Behavior:**
- All existing Orders have `latitude = NULL` and `longitude = NULL`
- No errors when loading existing Orders
- No errors when querying Orders list

### Task 5.2: Verify No Breaking Changes

**Verification Steps:**
1. Verify TypeScript compilation succeeds
2. Verify no runtime errors
3. Verify Order creation works with NULL coordinates
4. Verify Order creation works with provided coordinates
5. Verify other modules are unaffected

**Expected Behavior:**
- TypeScript compiles without errors
- No runtime errors in browser console
- Orders can be created without coordinates
- Orders can be created with coordinates
- Jobs, Payments, Invoicing modules unaffected

---

## Verification Checklist

After completing all phases, verify:

- [ ] Migration file created with correct naming
- [ ] Migration runs successfully
- [ ] Orders table has `latitude` and `longitude` columns (nullable)
- [ ] `Order` interface includes `latitude` and `longitude` fields
- [ ] `OrderInsert` and `OrderUpdate` types include new fields
- [ ] Form schema validates coordinate ranges
- [ ] CreateOrderDrawer has Latitude and Longitude input fields
- [ ] Form default values include `latitude: null` and `longitude: null`
- [ ] Form submission includes coordinates in order payload
- [ ] Orders can be created without coordinates (both NULL)
- [ ] Orders can be created with coordinates
- [ ] Coordinate validation works (latitude: -90 to 90, longitude: -180 to 180)
- [ ] Existing Orders remain valid (NULL coordinates)
- [ ] No TypeScript compilation errors
- [ ] No runtime errors
- [ ] No breaking changes

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `supabase/migrations/YYYYMMDDHHmmss_add_latitude_longitude_to_orders.sql` | Create new migration file | ~4 lines (new file) |
| `src/modules/orders/types/orders.types.ts` | Add `latitude` and `longitude` to `Order` interface | ~2 lines added |
| `src/modules/orders/schemas/order.schema.ts` | Add `latitude` and `longitude` validation | ~10 lines added |
| `src/modules/orders/components/CreateOrderDrawer.tsx` | Add coordinate inputs, update defaults and submission | ~50 lines added |

**Total Estimated Changes:** ~66 lines across 4 files (1 new file, 3 modified)

---

## Success Criteria

- ✅ Orders table has nullable `latitude` and `longitude` columns
- ✅ Migration runs successfully
- ✅ TypeScript types include `latitude` and `longitude`
- ✅ Form schema validates coordinate ranges (if provided)
- ✅ Order creation form has Latitude and Longitude inputs
- ✅ New Orders can be created with or without coordinates
- ✅ Coordinates are validated if provided (latitude: -90 to 90, longitude: -180 to 180)
- ✅ Existing Orders continue to work unchanged (NULL coordinates)
- ✅ No runtime or TypeScript errors
- ✅ No breaking changes
- ✅ No changes outside CreateOrderDrawer (except types and schema)

---

## Implementation Steps

1. **Create Migration File:**
   - Generate timestamp: `YYYYMMDDHHmmss`
   - Create file: `supabase/migrations/YYYYMMDDHHmmss_add_latitude_longitude_to_orders.sql`
   - Add SQL to create columns

2. **Update Type Definitions:**
   - Open `src/modules/orders/types/orders.types.ts`
   - Add `latitude: number | null;` after `location`
   - Add `longitude: number | null;` after `latitude`

3. **Update Form Schema:**
   - Open `src/modules/orders/schemas/order.schema.ts`
   - Add `latitude` field with validation
   - Add `longitude` field with validation

4. **Update CreateOrderDrawer:**
   - Add "Coordinates" section after "Deceased & Location"
   - Add two FormField components for latitude and longitude
   - Update default values
   - Update form submission

5. **Verify:**
   - Run migration
   - Test Order creation with/without coordinates
   - Test validation
   - Verify backward compatibility

---

## Notes

1. **Migration Naming:**
   - Use format: `YYYYMMDDHHmmss_add_latitude_longitude_to_orders.sql`
   - Example: `20250115120000_add_latitude_longitude_to_orders.sql`
   - Use current date/time for timestamp

2. **Coordinate Precision:**
   - Using `numeric(10, 8)` for 8 decimal places
   - Step value `0.00000001` in form input for precision
   - 8 decimal places = ~1.1 mm accuracy

3. **Validation:**
   - Fields are optional (can be null/undefined)
   - Range validation only applies when values are provided
   - Latitude: -90 to 90 (standard range)
   - Longitude: -180 to 180 (standard range)

4. **UI Placement:**
   - Coordinates section placed after "Deceased & Location"
   - Logical grouping with location information
   - Optional fields clearly marked

5. **Backward Compatibility:**
   - All changes are additive
   - Existing Orders have NULL coordinates
   - No breaking changes to existing functionality
   - Other modules unaffected

