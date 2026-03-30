# Include Product name and price in Products data fetching

## Overview

Ensure that the `name` and `price` columns from the `memorials` table are correctly fetched from Supabase and available in the Products UI. These columns were added to Supabase and populated, but are not currently selected or typed in the frontend.

**Context:**
- The Products module is backed by the `memorials` table in Supabase
- Columns `name` and `price` were added to Supabase and populated
- The frontend currently uses `.select('*')` which should include these fields, but they are not typed in TypeScript
- The Products UI was recently simplified to show only Product Name and Price columns
- The UI currently uses fallback logic (`(memorial as any).name || memorial.memorialType`) to access the name field

**Goal:**
- Update TypeScript interfaces to include `name` and `price` fields
- Ensure these fields are explicitly selected in queries (replace `select('*')` with explicit field list)
- Update transformation utilities to handle the new fields
- Maintain backward compatibility with existing code

---

## Current State Analysis

### Memorials Table Schema

**Table:** `memorials`

**Current Structure:**
- Existing columns: `id`, `order_id`, `job_id`, `deceased_name`, `date_of_birth`, `date_of_death`, `cemetery_name`, `cemetery_section`, `cemetery_plot`, `memorial_type`, `material`, `color`, `dimensions`, `inscription_text`, `inscription_language`, `installation_date`, `status`, `condition`, `notes`, `created_at`, `updated_at`
- **New columns (added to Supabase):** `name`, `price`
- `name`: string | null (product name)
- `price`: number | null (product price)

**Observations:**
- The `name` field exists in the database but is not typed in the frontend
- The `price` field exists in the database but is not typed in the frontend
- Current queries use `.select('*')` which should fetch these fields, but TypeScript doesn't know about them
- The UI currently uses type assertions `(memorial as any).name` to access the name field

### Type Definitions

**Current `Memorial` Interface** (`src/modules/memorials/hooks/useMemorials.ts`):
```typescript
export interface Memorial {
  id: string;
  order_id: string;
  job_id: string | null;
  deceased_name: string;
  date_of_birth: string | null;
  date_of_death: string | null;
  cemetery_name: string;
  cemetery_section: string | null;
  cemetery_plot: string | null;
  memorial_type: string;
  material: string | null;
  color: string | null;
  dimensions: string | null;
  inscription_text: string | null;
  inscription_language: string | null;
  installation_date: string | null;
  status: 'planned' | 'in_progress' | 'installed' | 'removed';
  condition: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Missing: name, price
}
```

**Current `UIMemorial` Interface** (`src/modules/memorials/utils/memorialTransform.ts`):
```typescript
export interface UIMemorial {
  id: string;
  orderId: string;
  jobId: string | null;
  deceasedName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  cemeteryName: string;
  cemeterySection: string | null;
  cemeteryPlot: string | null;
  memorialType: string;
  material: string | null;
  color: string | null;
  dimensions: string | null;
  inscriptionText: string | null;
  inscriptionLanguage: string | null;
  installationDate: string | null;
  status: 'planned' | 'in_progress' | 'installed' | 'removed';
  condition: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Missing: name, price
}
```

**Observations:**
- Both interfaces are missing `name` and `price` fields
- The UI transform functions don't handle these fields
- The UI currently uses type assertions to access `name`

### Data Access Patterns

**How Memorials are Currently Accessed:**

1. **List Query** (`fetchMemorials` in `src/modules/memorials/hooks/useMemorials.ts`):
   ```typescript
   const { data, error } = await supabase
     .from('memorials')
     .select('*')  // Uses wildcard - should be explicit
     .order('installation_date', { ascending: false, nullsLast: true })
     .order('created_at', { ascending: false });
   ```

2. **Single Query** (`fetchMemorial` in `src/modules/memorials/hooks/useMemorials.ts`):
   ```typescript
   const { data, error } = await supabase
     .from('memorials')
     .select('*')  // Uses wildcard - should be explicit
     .eq('id', id)
     .single();
   ```

3. **Create/Update Queries**:
   - Use `.select()` without arguments (returns all fields)
   - Should explicitly select fields including `name` and `price`

**Observations:**
- All queries use `select('*')` or `.select()` without arguments
- The constraint requires not using `select('*')`, so we need to make field lists explicit
- Need to preserve all existing fields while adding `name` and `price`

### Transformation Patterns

**Current Transform Function** (`transformMemorialFromDb` in `src/modules/memorials/utils/memorialTransform.ts`):
- Transforms snake_case database fields to camelCase UI fields
- Does not include `name` or `price` transformations
- The UI currently uses `(memorial as any).name || memorial.memorialType` as a workaround

**Observations:**
- Transform function needs to handle `name` and `price` fields
- `name` should map from `name` (snake_case) to `name` (camelCase - same name)
- `price` should map from `price` (snake_case) to `price` (camelCase - same name)

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- None - columns already exist in Supabase

**Non-Destructive Constraints:**
- No database changes needed
- Columns are already added and populated
- Only frontend type definitions and queries need updates

### Query/Data-Access Alignment

**Recommended Query Patterns:**

1. **Replace `select('*')` with explicit field lists:**
   - Include all existing fields
   - Add `name` and `price` to the selection
   - Maintain field order for consistency

2. **Update all query functions:**
   - `fetchMemorials()` - list query
   - `fetchMemorial()` - single query
   - `createMemorial()` - insert with select
   - `updateMemorial()` - update with select

**Recommended Display Patterns:**
- Product Name should use `memorial.name` (with fallback to `memorial.memorialType` if needed)
- Price should use `memorial.price` (display as currency or "—" if null)
- Remove type assertions `(memorial as any).name` from UI code

---

## Implementation Approach

### Phase 1: Update Type Definitions

1. **Update `Memorial` interface** (`src/modules/memorials/hooks/useMemorials.ts`):
   - Add `name: string | null;`
   - Add `price: number | null;`
   - Place after `memorial_type` for logical grouping

2. **Update `UIMemorial` interface** (`src/modules/memorials/utils/memorialTransform.ts`):
   - Add `name: string | null;`
   - Add `price: number | null;`
   - Place after `memorialType` for logical grouping

3. **Update `MemorialInsert` and `MemorialUpdate` types:**
   - These are derived from `Memorial`, so they'll automatically include the new fields
   - Verify that `Omit` and `Partial` work correctly with nullable fields

### Phase 2: Update Data Access Layer

1. **Create explicit field list constant:**
   - Define all fields in a constant for reuse
   - Include all existing fields plus `name` and `price`
   - Use this constant in all queries

2. **Update `fetchMemorials()` function:**
   - Replace `.select('*')` with explicit field list
   - Include `name` and `price` in the selection

3. **Update `fetchMemorial()` function:**
   - Replace `.select('*')` with explicit field list
   - Include `name` and `price` in the selection

4. **Update `createMemorial()` function:**
   - Replace `.select()` with explicit field list
   - Include `name` and `price` in the selection

5. **Update `updateMemorial()` function:**
   - Replace `.select()` with explicit field list
   - Include `name` and `price` in the selection

### Phase 3: Update Transformation Utilities

1. **Update `transformMemorialFromDb()` function:**
   - Add `name: memorial.name || null`
   - Add `price: memorial.price || null`
   - Map from snake_case to camelCase (both are the same for these fields)

2. **Update `toMemorialInsert()` function:**
   - Add `name: normalizeOptional(form.name)` if form includes name field
   - Add `price: form.price ?? null` if form includes price field
   - Note: Form schema may need updates in future, but out of scope for this task

3. **Update `toMemorialUpdate()` function:**
   - Add `name: normalizeOptional(form.name)` if form includes name field
   - Add `price: form.price ?? null` if form includes price field
   - Note: Form schema may need updates in future, but out of scope for this task

### Phase 4: Update UI Code (Remove Type Assertions)

1. **Update `MemorialsPage.tsx`:**
   - Remove `(memorial as any).name` type assertions
   - Use `memorial.name` directly (with fallback to `memorial.memorialType` if needed)
   - Use `memorial.price` directly (display as currency or "—" if null)

### Safety Considerations

- **Backward Compatibility:**
  - Fields are nullable, so existing code won't break
  - UI already handles null values with fallbacks
  - Transform functions use `|| null` to ensure null safety

- **Testing:**
  - Verify Products page loads without errors
  - Verify Product Name displays correctly (from `name` field)
  - Verify Price displays correctly (from `price` field)
  - Verify TypeScript builds without errors
  - Verify no runtime errors in console

- **Rollback Strategy:**
  - Changes are additive (adding fields to types)
  - If issues occur, can revert type definitions
  - Database columns remain unchanged

---

## What NOT to Do

- **No UI changes** - Only data access and type definitions
- **No database schema changes** - Columns already exist
- **No Supabase migrations** - Database is already updated
- **No table renaming** - Keep `memorials` table name
- **No Orders, Jobs, Invoicing changes** - Only Products module
- **No form schema changes** - Form updates are out of scope
- **No validation changes** - Keep existing validation logic
- **Do not use `select('*')`** - Must use explicit field lists per constraints

---

## Open Questions / Considerations

1. **Field Order:**
   - Should `name` and `price` be placed after `memorial_type` for logical grouping?
   - Or should they be at the end of the interface?

2. **Price Formatting:**
   - Should price be formatted as currency in the UI? (Out of scope, but worth noting)
   - Currently UI shows "—" for price, which is fine

3. **Name Fallback:**
   - Should the UI continue to fallback to `memorialType` if `name` is null?
   - This is a UI concern, but worth documenting

4. **Form Integration:**
   - Forms don't currently include `name` and `price` fields
   - This is out of scope, but may be needed in future
   - Transform functions should handle these fields even if forms don't use them yet

---

## Success Criteria

- ✅ Products page shows Product Name correctly from `name` field
- ✅ Products page shows Price correctly from `price` field
- ✅ No runtime errors in browser console
- ✅ TypeScript builds without errors
- ✅ No type assertions `(memorial as any)` in UI code
- ✅ All queries use explicit field lists (no `select('*')`)
- ✅ Type definitions include `name: string | null` and `price: number | null`
- ✅ Transform functions handle `name` and `price` fields
- ✅ Backward compatibility maintained (nullable fields)

