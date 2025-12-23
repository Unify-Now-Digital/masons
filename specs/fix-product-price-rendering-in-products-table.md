# Fix Product price rendering in Products table

## Overview

The Products module (backed by the `memorials` table) now correctly fetches the `price` field from Supabase as a number. The API response contains numeric price values, but the Products UI does not display them due to incorrect rendering logic.

**Context:**
- The `price` field is correctly typed as `number | null` in both `Memorial` and `UIMemorial` interfaces
- The data is correctly fetched from Supabase and transformed through `transformMemorialFromDb()`
- The Products table currently hardcodes the Price column to display "—" instead of the actual price value
- The `UIMemorial` interface includes `price: number | null` field

**Goal:**
- Update the Price column cell renderer to correctly display numeric price values
- Handle null values gracefully by displaying "—"
- Use proper numeric checks (`price != null` or `price !== null`)
- Convert numeric values to display strings (e.g., "1200" or formatted currency if desired)

---

## Current State Analysis

### Products Table Implementation

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`

**Current Price Column Rendering (Line 149-151):**
```typescript
<TableCell>
  {'—'}
</TableCell>
```

**Observations:**
- Price column is hardcoded to display "—" regardless of data
- The `memorial.price` field is available but not being used
- No null checking or numeric conversion logic exists

### Data Structure

**UIMemorial Interface** (`src/modules/memorials/utils/memorialTransform.ts`):
```typescript
export interface UIMemorial {
  // ... other fields
  price: number | null;
  // ... other fields
}
```

**Observations:**
- `price` is correctly typed as `number | null`
- The value can be a number (e.g., 1200.50) or null
- Numeric values need to be converted to strings for display

### Product Name Column Rendering Pattern

**Current Implementation (Lines 143-147):**
```typescript
<TableCell className="font-medium">
  {(() => {
    const productName = (memorial as any).name || memorial.memorialType;
    return productName?.trim() || '—';
  })()}
</TableCell>
```

**Observations:**
- Uses an IIFE (Immediately Invoked Function Expression) for conditional rendering
- Has fallback logic (`|| memorial.memorialType`)
- Uses `?.trim()` for string methods
- Displays "—" when value is falsy

**Note for Price:**
- Price is a number, so we should NOT use string methods like `trim()` or `substring()`
- Should use explicit null checks (`price != null` or `price !== null`)
- Convert number to string using `.toString()` or template literals

---

## Recommended Implementation

### Update Price Column Cell Renderer

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`

**Change Required:**
Replace the hardcoded "—" with conditional rendering that:
1. Checks if `memorial.price` is not null
2. Converts numeric value to string for display
3. Shows "—" when price is null

**Recommended Implementation:**
```typescript
<TableCell>
  {memorial.price != null ? String(memorial.price) : '—'}
</TableCell>
```

**Alternative Implementation (using template literal):**
```typescript
<TableCell>
  {memorial.price != null ? `${memorial.price}` : '—'}
</TableCell>
```

**Alternative Implementation (using IIFE pattern like Product Name):**
```typescript
<TableCell>
  {(() => {
    return memorial.price != null ? String(memorial.price) : '—';
  })()}
</TableCell>
```

**Recommendation:**
- Use the first approach (simple ternary) as it's cleaner and more readable
- Use `!= null` (loose equality) to check for both `null` and `undefined` (defensive)
- Or use `!== null` (strict equality) if we're confident the value is either a number or null

---

## Implementation Approach

### Phase 1: Update Price Column Rendering

1. **Locate Price TableCell** (`src/modules/memorials/pages/MemorialsPage.tsx`, line 149-151)

2. **Replace hardcoded value** with conditional rendering:
   - Check if `memorial.price` is not null
   - Convert number to string using `String()` or template literal
   - Display "—" when null

3. **Validation:**
   - Price column displays numeric values when present
   - Price column displays "—" when null
   - No TypeScript errors
   - No runtime errors

---

## What NOT to Do

- **No database schema changes** - Price field already exists and is correctly typed
- **No Supabase query changes** - Queries already fetch the price field
- **No data transform changes** - Transform functions already handle price correctly
- **No type/interface changes** - Types are already correct
- **No refactoring of other columns** - Only Price column needs changes
- **No Orders, Jobs, or Invoicing changes** - Only Products module
- **Do not use string-only methods** - Avoid `trim()`, `substring()`, `length` on price
- **Do not use type assertions** - Price is already correctly typed

---

## Success Criteria

- ✅ Price column displays numeric values correctly (e.g., "1200", "99.50")
- ✅ Price column displays "—" when price is null
- ✅ No TypeScript compilation errors
- ✅ No runtime errors in browser console
- ✅ Products table renders correctly with price data
- ✅ Numeric values are properly converted to display strings
- ✅ Null checks use explicit comparisons (`!= null` or `!== null`)
- ✅ No string methods are used on numeric price values

---

## Testing Considerations

1. **Test with numeric values:**
   - Verify price "1200" displays as "1200"
   - Verify price "99.50" displays as "99.5" (or formatted)
   - Verify price "0" displays as "0"

2. **Test with null values:**
   - Verify null price displays as "—"
   - Verify undefined price (if possible) displays as "—"

3. **Test TypeScript compilation:**
   - Run `npm run build` to ensure no type errors
   - Verify no linting errors

4. **Test in browser:**
   - Load Products page
   - Verify price values display correctly
   - Check browser console for errors

---

## Notes

1. **Price Formatting:** 
   - This implementation displays raw numeric values (e.g., "1200")
   - Future enhancements could format as currency (e.g., "$1,200.00")
   - Currency formatting is out of scope for this task

2. **Null Checking:**
   - Using `!= null` checks for both `null` and `undefined` (defensive)
   - Using `!== null` only checks for `null` (strict, acceptable if type is correct)
   - Recommendation: Use `!= null` for defensive programming

3. **Number to String Conversion:**
   - `String(price)` - explicit conversion
   - `` `${price}` `` - template literal (coerces to string)
   - `price.toString()` - method call (fails if price is null)
   - Recommendation: Use `String()` or template literal within the null check

4. **Consistency with Product Name:**
   - Product Name uses IIFE pattern with fallback logic
   - Price is simpler (no fallback needed), so simple ternary is preferred
   - Both use "—" for missing/null values (consistent)

