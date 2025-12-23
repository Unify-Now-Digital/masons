# Implementation Plan: Fix Product price rendering in Products table

## Overview

This plan fixes the Price column rendering in the Products table to display actual numeric price values instead of a hardcoded "—". The change is minimal and UI-only, affecting only the Price column cell renderer.

**Goal:** Replace hardcoded "—" with conditional rendering that displays numeric price values or "—" for null values.

**Constraints:**
- UI-only change
- Modify only the Price column rendering
- No database, query, transform, or type changes
- Minimal change (one line replacement)

---

## Phase 1: Update Price Column Rendering

### Task 1.1: Identify and Update Price TableCell

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`

**Location:** Line 149-151

**Current Code:**
```typescript
<TableCell>
  {'—'}
</TableCell>
```

**Change Required:**
Replace the hardcoded "—" with conditional rendering that:
- Checks if `memorial.price` is not null
- Converts numeric value to string using `String()`
- Displays "—" when price is null

**New Code:**
```typescript
<TableCell>
  {memorial.price != null ? String(memorial.price) : '—'}
</TableCell>
```

**Rationale:**
- `memorial.price != null` checks for both `null` and `undefined` (defensive programming)
- `String(memorial.price)` safely converts number to string
- Ternary operator provides clean conditional rendering
- Maintains consistent "—" display for null values

**Alternative (if strict null checking preferred):**
```typescript
<TableCell>
  {memorial.price !== null ? String(memorial.price) : '—'}
</TableCell>
```

**Recommendation:** Use `!= null` for defensive null/undefined checking.

---

## Verification Checklist

After completing the implementation, verify:

- [ ] Price column displays numeric values correctly (e.g., "1200", "99.5")
- [ ] Price column displays "—" when price is null
- [ ] No TypeScript compilation errors
- [ ] No runtime errors in browser console
- [ ] Products table renders correctly
- [ ] Only Price column was modified (no other changes)
- [ ] No database, query, transform, or type changes were made

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/memorials/pages/MemorialsPage.tsx` | Replace hardcoded "—" with conditional price rendering | 1 line (line 150) |

**Total Estimated Changes:** 1 line modified in 1 file

---

## Implementation Steps

1. **Open** `src/modules/memorials/pages/MemorialsPage.tsx`
2. **Locate** the Price column TableCell (line 149-151)
3. **Replace** the hardcoded `{'—'}` with `{memorial.price != null ? String(memorial.price) : '—'}`
4. **Save** the file
5. **Verify** TypeScript compilation: `npm run build`
6. **Test** in browser: Load Products page and verify price displays correctly

---

## Success Criteria

- ✅ Price column displays numeric values correctly
- ✅ Price column displays "—" when price is null
- ✅ TypeScript compiles without errors
- ✅ No runtime errors
- ✅ Only Price column rendering was changed
- ✅ No other files or logic were modified

---

## Notes

1. **Null Checking Approach:**
   - `!= null` (loose equality) checks for both `null` and `undefined` - recommended for defensive programming
   - `!== null` (strict equality) only checks for `null` - acceptable if types are guaranteed

2. **Number to String Conversion:**
   - `String(price)` - explicit conversion, recommended
   - `` `${price}` `` - template literal, also acceptable
   - `price.toString()` - method call, fails if price is null, not recommended

3. **Consistency:**
   - Product Name column uses IIFE with fallback logic
   - Price column is simpler (no fallback), so ternary is preferred
   - Both use "—" for missing/null values (consistent)

4. **Testing:**
   - Test with numeric values: 1200, 99.5, 0
   - Test with null values: should display "—"
   - Verify no console errors

