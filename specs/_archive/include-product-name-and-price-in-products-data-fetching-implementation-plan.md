# Implementation Plan: Include Product name and price in Products data fetching

## Overview

This plan ensures the `name` and `price` columns from the `memorials` table are correctly fetched from Supabase and available in the Products UI. The columns already exist in Supabase and are populated, but are not currently selected or typed in the frontend.

**Goal:** Add `name` and `price` fields to TypeScript types, explicitly select them in queries, and pass them through transform functions.

**Constraints:**
- No UI changes
- No database schema changes
- Minimal changes only (no unrelated refactoring)
- Must use explicit field lists (no `select('*')`)

---

## Phase 1: Update Type Definitions

### Task 1.1: Update `Memorial` Interface

**File:** `src/modules/memorials/hooks/useMemorials.ts`

**Current State:**
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
  // ... other fields
  created_at: string;
  updated_at: string;
}
```

**Change Required:**
Add two fields after `memorial_type`:
```typescript
  memorial_type: string;
  name: string | null;
  price: number | null;
  material: string | null;
```

**Validation:**
- TypeScript compiles without errors
- `MemorialInsert` and `MemorialUpdate` types automatically include new fields (they're derived from `Memorial`)

---

### Task 1.2: Update `UIMemorial` Interface

**File:** `src/modules/memorials/utils/memorialTransform.ts`

**Current State:**
```typescript
export interface UIMemorial {
  id: string;
  orderId: string;
  jobId: string | null;
  deceasedName: string;
  // ... other fields
  memorialType: string;
  material: string | null;
  // ... other fields
  createdAt: string;
  updatedAt: string;
}
```

**Change Required:**
Add two fields after `memorialType`:
```typescript
  memorialType: string;
  name: string | null;
  price: number | null;
  material: string | null;
```

**Validation:**
- TypeScript compiles without errors
- Interface matches the camelCase naming convention

---

## Phase 2: Update Data Access Layer

### Task 2.1: Create Explicit Field List Constant

**File:** `src/modules/memorials/hooks/useMemorials.ts`

**Change Required:**
Add a constant at the top of the file (after the type definitions, before the query functions):

```typescript
const MEMORIAL_FIELDS = [
  'id',
  'order_id',
  'job_id',
  'deceased_name',
  'date_of_birth',
  'date_of_death',
  'cemetery_name',
  'cemetery_section',
  'cemetery_plot',
  'memorial_type',
  'name',
  'price',
  'material',
  'color',
  'dimensions',
  'inscription_text',
  'inscription_language',
  'installation_date',
  'status',
  'condition',
  'notes',
  'created_at',
  'updated_at',
].join(', ');
```

**Rationale:**
- Centralizes field list for reuse across all queries
- Ensures consistency
- Makes it easy to add/remove fields in the future

**Validation:**
- Constant is defined correctly
- All existing fields are included
- `name` and `price` are included

---

### Task 2.2: Update `fetchMemorials()` Function

**File:** `src/modules/memorials/hooks/useMemorials.ts`

**Current State:**
```typescript
async function fetchMemorials() {
  const { data, error } = await supabase
    .from('memorials')
    .select('*')
    .order('installation_date', { ascending: false, nullsLast: true })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Memorial[];
}
```

**Change Required:**
Replace `.select('*')` with `.select(MEMORIAL_FIELDS)`:

```typescript
async function fetchMemorials() {
  const { data, error } = await supabase
    .from('memorials')
    .select(MEMORIAL_FIELDS)
    .order('installation_date', { ascending: false, nullsLast: true })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Memorial[];
}
```

**Validation:**
- Function still returns `Memorial[]`
- No TypeScript errors
- Query explicitly selects all fields including `name` and `price`

---

### Task 2.3: Update `fetchMemorial()` Function

**File:** `src/modules/memorials/hooks/useMemorials.ts`

**Current State:**
```typescript
async function fetchMemorial(id: string) {
  const { data, error } = await supabase
    .from('memorials')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}
```

**Change Required:**
Replace `.select('*')` with `.select(MEMORIAL_FIELDS)`:

```typescript
async function fetchMemorial(id: string) {
  const { data, error } = await supabase
    .from('memorials')
    .select(MEMORIAL_FIELDS)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}
```

**Validation:**
- Function still returns `Memorial`
- No TypeScript errors
- Query explicitly selects all fields including `name` and `price`

---

### Task 2.4: Update `createMemorial()` Function

**File:** `src/modules/memorials/hooks/useMemorials.ts`

**Current State:**
```typescript
async function createMemorial(memorial: MemorialInsert) {
  const { data, error } = await supabase
    .from('memorials')
    .insert(memorial)
    .select()
    .single();
  
  if (error) throw error;
  return data as Memorial;
}
```

**Change Required:**
Replace `.select()` with `.select(MEMORIAL_FIELDS)`:

```typescript
async function createMemorial(memorial: MemorialInsert) {
  const { data, error } = await supabase
    .from('memorials')
    .insert(memorial)
    .select(MEMORIAL_FIELDS)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}
```

**Validation:**
- Function still returns `Memorial`
- No TypeScript errors
- Query explicitly selects all fields including `name` and `price`

---

### Task 2.5: Update `updateMemorial()` Function

**File:** `src/modules/memorials/hooks/useMemorials.ts`

**Current State:**
```typescript
async function updateMemorial(id: string, updates: MemorialUpdate) {
  const { data, error } = await supabase
    .from('memorials')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Memorial;
}
```

**Change Required:**
Replace `.select()` with `.select(MEMORIAL_FIELDS)`:

```typescript
async function updateMemorial(id: string, updates: MemorialUpdate) {
  const { data, error } = await supabase
    .from('memorials')
    .update(updates)
    .eq('id', id)
    .select(MEMORIAL_FIELDS)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}
```

**Validation:**
- Function still returns `Memorial`
- No TypeScript errors
- Query explicitly selects all fields including `name` and `price`

---

## Phase 3: Update Transformation Utilities

### Task 3.1: Update `transformMemorialFromDb()` Function

**File:** `src/modules/memorials/utils/memorialTransform.ts`

**Current State:**
```typescript
export function transformMemorialFromDb(memorial: Memorial): UIMemorial {
  return {
    id: memorial.id,
    orderId: memorial.order_id,
    jobId: memorial.job_id,
    deceasedName: memorial.deceased_name,
    // ... other fields
    memorialType: memorial.memorial_type,
    material: memorial.material || null,
    // ... other fields
    createdAt: memorial.created_at,
    updatedAt: memorial.updated_at,
  };
}
```

**Change Required:**
Add `name` and `price` fields after `memorialType`:

```typescript
export function transformMemorialFromDb(memorial: Memorial): UIMemorial {
  return {
    id: memorial.id,
    orderId: memorial.order_id,
    jobId: memorial.job_id,
    deceasedName: memorial.deceased_name,
    // ... other fields
    memorialType: memorial.memorial_type,
    name: memorial.name || null,
    price: memorial.price ?? null,
    material: memorial.material || null,
    // ... other fields
    createdAt: memorial.created_at,
    updatedAt: memorial.updated_at,
  };
}
```

**Notes:**
- `name`: Use `|| null` for consistency with other string fields
- `price`: Use `?? null` since `number | null` doesn't need string coercion

**Validation:**
- Function returns `UIMemorial` with all fields
- TypeScript compiles without errors
- Null values are handled correctly

---

## Verification Checklist

After completing all phases, verify:

- [ ] TypeScript builds without errors (`npm run build` or `tsc --noEmit`)
- [ ] No runtime errors in browser console when loading Products page
- [ ] Products page loads successfully
- [ ] `Memorial` interface includes `name: string | null` and `price: number | null`
- [ ] `UIMemorial` interface includes `name: string | null` and `price: number | null`
- [ ] All queries use `MEMORIAL_FIELDS` constant (no `select('*')` or `.select()` without arguments)
- [ ] `transformMemorialFromDb()` includes `name` and `price` transformations
- [ ] No UI code changes were made (this is a data access layer change only)

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/memorials/hooks/useMemorials.ts` | Add `name` and `price` to `Memorial` interface; Add `MEMORIAL_FIELDS` constant; Update 4 query functions | ~10 lines added/modified |
| `src/modules/memorials/utils/memorialTransform.ts` | Add `name` and `price` to `UIMemorial` interface; Update `transformMemorialFromDb()` function | ~4 lines added/modified |

**Total Estimated Changes:** ~14 lines across 2 files

---

## Success Criteria

- ✅ `Memorial` interface includes `name: string | null` and `price: number | null`
- ✅ `UIMemorial` interface includes `name: string | null` and `price: number | null`
- ✅ All Supabase queries explicitly select `name` and `price` fields
- ✅ Transform functions pass `name` and `price` through correctly
- ✅ TypeScript compiles without errors
- ✅ No runtime errors
- ✅ No UI changes made
- ✅ Minimal changes (only what's necessary)

---

## Notes

1. **Field Order:** `name` and `price` are placed after `memorial_type` / `memorialType` for logical grouping (product-related fields together).

2. **Form Integration:** The `toMemorialInsert()` and `toMemorialUpdate()` functions are **NOT** updated in this plan because:
   - Forms don't currently include `name` and `price` fields (out of scope)
   - These functions only handle fields that exist in the form schema
   - If `name` or `price` are not provided, they'll be `undefined` in the insert/update payload, which is fine (they're nullable in the database)

3. **Backward Compatibility:** All new fields are nullable, ensuring backward compatibility with existing data and code.

4. **Testing:** After implementation, manually test:
   - Products page loads
   - Product Name displays (if `name` exists in database)
   - Price displays (if `price` exists in database)
   - No console errors

