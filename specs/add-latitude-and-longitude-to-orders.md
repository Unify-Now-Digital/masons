# Add latitude and longitude to Orders (manual input, optional)

## Overview

Orders represent physical work performed at a real-world location. Currently, Orders have a free-text `location` field, but no structured geographic coordinates. This feature adds optional latitude and longitude fields to support map-based workflows later (Map of Jobs), starting with manual input.

**Context:**
- Orders represent physical work at real-world locations
- Current `location` field is free-text only
- Need structured geographic coordinates for future map features
- Starting with manual input (no automatic geocoding)

**Goal:**
- Add optional latitude and longitude fields to Orders
- Store coordinates in database
- Allow manual input in Order creation form
- Support future map-based workflows

---

## Current State Analysis

### Orders Table Schema

**Table:** `orders`

**Current Structure:**
- `id`: UUID (primary key)
- `invoice_id`: UUID | null
- `customer_name`: TEXT (required)
- `customer_email`: TEXT | null
- `customer_phone`: TEXT | null
- `order_type`: TEXT (required)
- `sku`: TEXT | null
- `material`: TEXT | null
- `color`: TEXT | null
- `stone_status`: TEXT (enum, default 'NA')
- `permit_status`: TEXT (enum, default 'pending')
- `proof_status`: TEXT (enum, default 'Not_Received')
- `deposit_date`: DATE | null
- `second_payment_date`: DATE | null
- `due_date`: DATE | null
- `installation_date`: DATE | null
- `location`: TEXT | null (free-text location name)
- `value`: NUMERIC(10,2) | null
- `progress`: INTEGER (default 0)
- `assigned_to`: TEXT | null
- `priority`: TEXT (enum, default 'medium')
- `timeline_weeks`: INTEGER (default 12)
- `notes`: TEXT | null
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Observations:**
- No geographic coordinate fields exist
- `location` field is free-text (e.g., "Oak Hill Cemetery")
- No structured way to store coordinates
- Existing Orders have no coordinate data

### Type Definitions

**Current `Order` Interface** (`src/modules/orders/types/orders.types.ts`):
```typescript
export interface Order {
  id: string;
  invoice_id: string | null;
  customer_name: string;
  // ... other fields
  location: string | null;
  // ... other fields
  created_at: string;
  updated_at: string;
}
```

**Observations:**
- No `latitude` or `longitude` fields
- `OrderInsert` and `OrderUpdate` types derived from `Order`

### Order Creation Form

**Current Form** (`src/modules/orders/components/CreateOrderDrawer.tsx`):
- Has "Deceased & Location" section with:
  - Deceased Name (required)
  - Location (required, free-text)
  - Grave Number (required)
- No coordinate input fields

**Observations:**
- Form collects location as free-text only
- No way to input coordinates
- Coordinates would be useful for map-based workflows

---

## Recommended Schema Adjustments

### Database Changes

**Migration Required:**
- Add two nullable numeric columns to `orders` table:
  - `latitude`: NUMERIC (or DOUBLE PRECISION) | null
  - `longitude`: NUMERIC (or DOUBLE PRECISION) | null
- Columns must allow NULL (optional fields)
- No default values (existing Orders remain NULL)
- No constraints on existing data

**PostgreSQL Column Types:**
- Option 1: `numeric(10, 8)` - High precision for coordinates (recommended)
- Option 2: `double precision` - Standard floating point
- Recommendation: Use `numeric(10, 8)` for precision (latitude/longitude need 6-8 decimal places)

**Migration SQL:**
```sql
alter table public.orders
  add column latitude numeric(10, 8),
  add column longitude numeric(10, 8);
```

**Observations:**
- Single migration adds both columns
- Columns are nullable (no breaking changes)
- Existing Orders remain valid (NULL values)
- No data migration needed

### Type Definitions

**Update `Order` Interface:**
- Add `latitude: number | null;`
- Add `longitude: number | null;`
- Place after `location` field for logical grouping

**Update `OrderInsert` and `OrderUpdate`:**
- Automatically include new fields (derived from `Order`)
- Both types support nullable coordinates

### Validation Rules

**Zod Schema** (`src/modules/orders/schemas/order.schema.ts`):
- Add optional `latitude` field with validation:
  - Type: `z.number().min(-90).max(90).optional().nullable()`
  - Message: "Latitude must be between -90 and 90"
- Add optional `longitude` field with validation:
  - Type: `z.number().min(-180).max(180).optional().nullable()`
  - Message: "Longitude must be between -180 and 180"

**Validation Behavior:**
- Fields are optional (can be null/undefined)
- If provided, must be within valid ranges
- Validation only applies when value is provided

---

## Implementation Approach

### Phase 1: Database Migration

1. **Create Migration File:**
   - File: `supabase/migrations/YYYYMMDDHHmmss_add_latitude_longitude_to_orders.sql`
   - Add `latitude` and `longitude` columns
   - Use `numeric(10, 8)` for precision
   - Columns are nullable

2. **Migration Content:**
   ```sql
   alter table public.orders
     add column latitude numeric(10, 8),
     add column longitude numeric(10, 8);
   ```

3. **Validation:**
   - Migration runs successfully
   - Existing Orders remain valid (NULL values)
   - New Orders can have NULL or numeric values

### Phase 2: Update Type Definitions

1. **Update `Order` Interface** (`src/modules/orders/types/orders.types.ts`):
   - Add `latitude: number | null;` after `location`
   - Add `longitude: number | null;` after `latitude`

2. **Validation:**
   - `OrderInsert` and `OrderUpdate` automatically include new fields
   - TypeScript compiles without errors

### Phase 3: Update Form Schema

1. **Update `order.schema.ts`:**
   - Add `latitude` field with validation
   - Add `longitude` field with validation
   - Both optional and nullable

2. **Validation Rules:**
   - Latitude: -90 to 90
   - Longitude: -180 to 180
   - Optional (can be null/undefined)

### Phase 4: Update CreateOrderDrawer

1. **Add Coordinate Input Fields:**
   - Add to "Deceased & Location" section or new "Coordinates" section
   - Two numeric inputs: Latitude and Longitude
   - Optional fields
   - Manual input only (no map picker)

2. **Form Field Implementation:**
   - Type: number input
   - Step: 0.00000001 (for precision)
   - Placeholders: "e.g., 51.5074" and "e.g., -0.1278"
   - Optional validation

3. **Default Values:**
   - Both fields default to `null` (undefined in form)

---

## What NOT to Do

- **NO automatic geocoding** - Manual input only
- **NO map picker** - Explicitly out of scope
- **NO changes to existing Orders data** - All remain valid with NULL
- **NO changes to Order edit form** - Unless strictly required for consistency
- **NO changes to Jobs module** - Out of scope
- **NO changes to Map of Jobs UI** - Out of scope
- **NO changes to Products, Invoices, Payments** - Out of scope
- **NO breaking changes** - All changes are additive

---

## Success Criteria

- ✅ Orders table has nullable `latitude` and `longitude` columns
- ✅ Migration runs successfully
- ✅ TypeScript types include `latitude` and `longitude`
- ✅ Form schema validates coordinate ranges
- ✅ Order creation form has latitude and longitude inputs
- ✅ New Orders can be created with or without coordinates
- ✅ Coordinates are validated if provided (latitude: -90 to 90, longitude: -180 to 180)
- ✅ Existing Orders continue to work unchanged (NULL coordinates)
- ✅ No runtime or TypeScript errors
- ✅ No breaking changes

---

## Testing Considerations

1. **Test Migration:**
   - Run migration successfully
   - Verify columns exist and are nullable
   - Verify existing Orders have NULL coordinates

2. **Test Order Creation:**
   - Create order without coordinates (both NULL)
   - Create order with latitude only (longitude NULL)
   - Create order with longitude only (latitude NULL)
   - Create order with both coordinates
   - Verify coordinates are saved correctly

3. **Test Validation:**
   - Enter latitude > 90 (should fail validation)
   - Enter latitude < -90 (should fail validation)
   - Enter longitude > 180 (should fail validation)
   - Enter longitude < -180 (should fail validation)
   - Enter valid coordinates (should pass validation)
   - Leave fields empty (should pass validation)

4. **Test Backward Compatibility:**
   - Verify existing Orders load correctly
   - Verify existing Orders can be edited (if edit form exists)
   - Verify no database errors occur

---

## Notes

1. **Coordinate Precision:**
   - Using `numeric(10, 8)` provides 8 decimal places
   - 6 decimal places = ~0.1 meter accuracy (sufficient for most use cases)
   - 8 decimal places = ~1.1 mm accuracy (very precise)

2. **Validation Ranges:**
   - Latitude: -90 (South Pole) to 90 (North Pole)
   - Longitude: -180 (International Date Line West) to 180 (International Date Line East)
   - These are standard geographic coordinate ranges

3. **Manual Input:**
   - Users must manually enter coordinates
   - No automatic geocoding from location text
   - No map picker (explicitly out of scope)
   - Future enhancement could add geocoding/map picker

4. **Future Use:**
   - Coordinates will support Map of Jobs feature
   - Can be used for distance calculations
   - Can be used for location-based filtering
   - Can be used for route optimization

5. **Migration Safety:**
   - Single migration adds both columns
   - Columns are nullable (no breaking changes)
   - Existing Orders remain valid
   - No data migration needed

