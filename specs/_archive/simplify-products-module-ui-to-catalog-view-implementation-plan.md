# Simplify Products Module UI to Catalog View - Implementation Plan

## Overview

This plan details the step-by-step implementation for simplifying the Products module UI to display only product-relevant fields (Name, Price, Actions), removing all legacy order/job/deceased-specific columns and filters.

**Branch:** `feature/simplify-products-module-ui-to-catalog-view`  
**Specification:** `specs/simplify-products-module-ui-to-catalog-view.md`

---

## Implementation Phases

### Phase 1: Products Page Table Changes

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`

#### 1.1 Remove Legacy Table Columns

**Table Headers to Remove (Lines 197-202):**
- Line 197: `<TableHead>Deceased</TableHead>` - Remove
- Line 198: `<TableHead>Cemetery</TableHead>` - Remove
- Line 199: `<TableHead>Product Type</TableHead>` - Remove (will be replaced with "Product Name")
- Line 200: `<TableHead>Status</TableHead>` - Remove
- Line 201: `<TableHead>Installation Date</TableHead>` - Remove
- Line 202: `<TableHead>Order</TableHead>` - Remove

**Table Cells to Remove (Lines 209-228):**
- Lines 209-211: Deceased name `TableCell` - Remove
- Line 212: Cemetery `TableCell` with `formatCemeteryInfo()` - Remove
- Line 213: Product Type `TableCell` - Remove (will be replaced)
- Lines 214-220: Status `TableCell` with Badge - Remove
- Lines 221-223: Installation Date `TableCell` with `formatInstallationDate()` - Remove
- Lines 224-228: Order `TableCell` - Remove

#### 1.2 Add New Minimal Columns

**New Table Headers (Replace lines 197-202):**
```tsx
<TableRow>
  <TableHead>Product Name</TableHead>
  <TableHead>Price</TableHead>
  <TableHead className="text-right">Actions</TableHead>
</TableRow>
```

**New Table Cells (Replace lines 209-228):**
```tsx
<TableRow key={memorial.id}>
  <TableCell className="font-medium">
    {memorial.name || '—'}
  </TableCell>
  <TableCell>
    {'—'} {/* Price field - to be determined if exists in DB */}
  </TableCell>
  <TableCell className="text-right">
    <div className="flex justify-end gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleEdit(memorial)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleDelete(memorial)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </TableCell>
</TableRow>
```

**Note on Price Field:**
- Check if `price` field exists in `Memorial` type or database
- If exists, format as currency: `£{price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
- If null/undefined, display `'—'`
- If field doesn't exist, display `'—'` for all products (can be updated later when price field is added)

---

### Phase 2: Filter and Search Cleanup

#### 2.1 Remove Status Filter

**Remove Status Filter State (Line 42):**
- Remove: `const [statusFilter, setStatusFilter] = useState<string>('all');`

**Remove Status Filter UI (Lines 158-169):**
- Remove entire `Select` component for status filtering
- Remove the gap-4 flex container if it only contains search and status filter

**Update Filter Logic (Lines 53-76):**
- Remove status filtering from `filteredMemorials` useMemo
- Remove `statusFilter` from dependency array
- Simplify to only search filtering

**Updated filteredMemorials:**
```tsx
const filteredMemorials = useMemo(() => {
  if (!memorials) return [];
  
  if (!searchQuery) return memorials;
  
  const query = searchQuery.toLowerCase();
  return memorials.filter((m) =>
    m.name?.toLowerCase().includes(query)
  );
}, [memorials, searchQuery]);
```

#### 2.2 Update Search

**Update Search Placeholder (Line 153):**
- Change from: `"Search by deceased name, cemetery, plot, or product type..."`
- Change to: `"Search products..."`

**Update Search Filter Logic:**
- Remove deceased name, cemetery, and plot from search
- Search only by product name (`name`)

**Updated search filter (already in 2.1 above):**
- Only search `name` field
- Use null-safe optional chaining: `m.name?.toLowerCase().includes(query)`

---

### Phase 3: Null-Safe Rendering

#### 3.1 Product Name Null Handling

**In Table Cell (Line 209 area):**
```tsx
<TableCell className="font-medium">
  {memorial.name || '—'}
</TableCell>
```

**Alternative (if empty string should also show placeholder):**
```tsx
<TableCell className="font-medium">
  {memorial.name?.trim() || 'Unnamed Product'}
</TableCell>
```

#### 3.2 Price Null Handling

**Create Price Formatting Helper Function:**
```tsx
const formatPrice = (price: number | null | undefined): string => {
  if (price === null || price === undefined || isNaN(price)) {
    return '—';
  }
  return `£${price.toLocaleString('en-GB', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};
```

**In Table Cell:**
```tsx
<TableCell>
  {formatPrice(memorial.price)} {/* If price field exists */}
  {/* OR */}
  {'—'} {/* If price field doesn't exist yet */}
</TableCell>
```

**Note:** If `price` field doesn't exist in `Memorial` type, use `'—'` for now. Can be updated when price field is added to database/type.

---

### Phase 4: Empty State Updates

#### 4.1 Update Empty State Message (Lines 181-185)

**Current:**
```tsx
<p className="text-muted-foreground mb-4">
  {searchQuery || statusFilter !== 'all'
    ? 'No products match your filters'
    : 'No products found'}
</p>
```

**Updated (remove statusFilter reference):**
```tsx
<p className="text-muted-foreground mb-4">
  {searchQuery
    ? 'No products match your search'
    : 'No products found. Create your first product to get started.'}
</p>
```

#### 4.2 Update Empty State Button Condition (Line 186)

**Current:**
```tsx
{!searchQuery && statusFilter === 'all' && (
```

**Updated:**
```tsx
{!searchQuery && (
```

#### 4.3 Update Page Description (Line 136)

**Current:**
```tsx
<p className="text-muted-foreground">
  Manage client product records for installed/planned products
</p>
```

**Updated:**
```tsx
<p className="text-muted-foreground">
  Manage your product catalog
</p>
```

#### 4.4 Update Card Description (Line 148)

**Current:**
```tsx
<CardDescription>View and manage all product records</CardDescription>
```

**Updated (optional - already appropriate):**
```tsx
<CardDescription>View and manage your product catalog</CardDescription>
```

---

### Phase 5: Code Cleanup

#### 5.1 Remove Unused Helper Functions

**Remove formatCemeteryInfo (Lines 95-100):**
- Delete entire function - no longer needed

**Remove formatInstallationDate (Lines 102-113):**
- Delete entire function - no longer needed

#### 5.2 Remove Unused Constants

**Remove statusColors (Lines 32-37):**
- Delete the `statusColors` constant object

#### 5.3 Remove Unused Imports

**Check and remove if unused:**
- `Badge` from `@/shared/components/ui/badge` - Remove (no longer used)
- `format` from `date-fns` - Remove (no longer used)
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` - Remove (status filter removed)

**Keep:**
- All other imports are still needed

#### 5.4 Clean Up Unused Variables

**Remove:**
- `statusFilter` state variable (already removed in Phase 2)

---

## Detailed File-by-File Checklist

### Products Page
- [ ] Remove legacy table columns (Deceased, Cemetery, Product Type, Status, Installation Date, Order)
- [ ] Add Product Name column (using `name`)
- [ ] Add Price column (with null-safe rendering)
- [ ] Keep Actions column unchanged
- [ ] Remove status filter dropdown
- [ ] Update search placeholder to "Search products..."
- [ ] Update search filter to only search by product name
- [ ] Remove `statusFilter` state variable
- [ ] Update `filteredMemorials` logic to remove status filtering
- [ ] Update empty state messages (remove status filter references)
- [ ] Update page description to "Manage your product catalog"
- [ ] Remove `formatCemeteryInfo` function
- [ ] Remove `formatInstallationDate` function
- [ ] Remove `statusColors` constant
- [ ] Remove unused imports (Badge, format from date-fns, Select components)
- [ ] Add null-safe rendering for Product Name
- [ ] Add null-safe rendering for Price (or display "—" if field doesn't exist)

---

## Field Mapping Decisions

### Product Name
- **Source Field:** `memorial.name`
- **Display:** Use `name` directly
- **Null Handling:** Display `'—'` or `'Unnamed Product'` if null/empty
- **Implementation:** `{memorial.name || '—'}`

### Price
- **Current Status:** No `price` field visible in `Memorial` type
- **Decision:** Display `'—'` for all products initially
- **Future:** When price field is added to database/type, update to:
  ```tsx
  {formatPrice(memorial.price)}
  ```
- **Format:** When implemented, use `£1,234.56` format (GBP)

### Actions
- **Keep Unchanged:** Edit and Delete buttons remain as-is
- **No Changes Required**

---

## Implementation Order

1. **Phase 1** - Table structure changes (most visible impact)
2. **Phase 2** - Filter and search cleanup (simplifies UI)
3. **Phase 3** - Null-safe rendering (ensures robustness)
4. **Phase 4** - Empty state updates (polish)
5. **Phase 5** - Code cleanup (maintainability)

---

## Testing Checklist

After completing all phases:

1. **Table Display:**
   - [ ] Only Product Name, Price, and Actions columns are visible
   - [ ] Product Name displays correctly (shows `name`)
   - [ ] Price displays "—" (or formatted value if field exists)
   - [ ] Actions column shows Edit and Delete buttons

2. **Search:**
   - [ ] Search placeholder says "Search products..."
   - [ ] Search only filters by product name
   - [ ] Search works correctly with product names
   - [ ] Empty search shows all products

3. **Filters:**
   - [ ] Status filter is completely removed
   - [ ] No filter dropdowns remain

4. **Empty States:**
   - [ ] Empty state message is catalog-appropriate
   - [ ] No references to status filters
   - [ ] "Create First Product" button appears when no products exist

5. **Null Handling:**
   - [ ] Products with null/empty `name` show "—" or "Unnamed Product"
   - [ ] Price column shows "—" for all products (if field doesn't exist)

6. **Functionality:**
   - [ ] Edit button still works
   - [ ] Delete button still works
   - [ ] Create product button still works
   - [ ] No console errors
   - [ ] No TypeScript errors

7. **Code Quality:**
   - [ ] No unused imports
   - [ ] No unused functions
   - [ ] No unused constants
   - [ ] Code is clean and maintainable

---

## Constraints Reminder

**DO NOT CHANGE:**
- Database schema or migrations
- API endpoints or functions
- TypeScript types/interfaces (unless adding null handling utilities)
- Orders, Jobs, Invoicing, or Payments modules
- Create/Edit drawers (leave as-is)
- Data transformation utilities
- Edit/Delete functionality

**ONLY CHANGE:**
- Products page UI (`MemorialsPage.tsx`)
- Table structure and columns
- Search and filter logic
- Empty state messages
- Remove unused code

---

## Price Field Investigation

**Action Required:**
1. Check if `price` field exists in `memorials` database table
2. Check if `price` field exists in `Memorial` TypeScript type but is optional
3. If field exists, add to display with currency formatting
4. If field doesn't exist, display "—" for now (can be updated later)

**Implementation Note:**
- For initial implementation, use `'—'` for price column
- When price field is confirmed/added, update to use `formatPrice()` helper

---

## Completion Criteria

The implementation is complete when:
- ✅ Only Product Name, Price, and Actions columns are visible
- ✅ All legacy columns are removed
- ✅ Status filter is removed
- ✅ Search only searches by product name
- ✅ Empty states are catalog-appropriate
- ✅ Null-safe rendering is implemented
- ✅ Unused code is removed
- ✅ All functionality still works
- ✅ No TypeScript or linting errors
- ✅ No console errors

