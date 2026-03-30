# Simplify Products Module UI to Catalog View

## Overview

Simplify the Products module UI to display only product-relevant fields, transforming it from an order/job-specific view to a clean product catalog interface.

**Context:**
- The Products module is backed by the legacy `memorials` database table
- The table now represents a Product catalog, not order- or job-specific records
- Current UI displays many legacy fields (deceased name, cemetery, status, installation date, order references)
- Users need a simplified catalog view showing only essential product information

**Goal:**
- Update the Products page UI to display only product-relevant fields
- Remove all order-, job-, and deceased-specific fields from the Products UI
- Create a clean, catalog-style interface focused on product information
- Maintain existing CRUD functionality (Create, Edit, Delete)

---

## Current State Analysis

### Products Page UI Structure

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`

**Current Table Columns:**
- Deceased (from `deceased_name`)
- Cemetery (from `cemetery_name`, `cemetery_section`, `cemetery_plot`)
- Product Type (from `memorial_type`)
- Status (from `status`: planned, in_progress, installed, removed)
- Installation Date (from `installation_date`)
- Order (from `order_id`)
- Actions (Edit / Delete buttons)

**Current Filters:**
- Search by: deceased name, cemetery, plot, or product type
- Status filter: All Statuses, Planned, In Progress, Installed, Removed

**Current Data Structure:**
- `UIMemorial` interface includes many legacy fields:
  - `deceasedName`, `dateOfBirth`, `dateOfDeath`
  - `cemeteryName`, `cemeterySection`, `cemeteryPlot`
  - `orderId`, `jobId`
  - `installationDate`, `status`
  - `memorialType` (likely maps to Product Name)
  - No `price` field currently visible in the type definition

**Observations:**
- The UI is cluttered with order/job/deceased-specific information
- Status and installation date are not relevant for a product catalog
- Order references should not appear in a catalog view
- Product Name likely maps to `memorial_type` field
- Price field may need to be added to the display (check if it exists in DB or needs to be handled as null)

---

## Recommended Changes

### UI Simplification

**Target Table Columns:**
1. **Product Name** - Display product name (likely from `memorial_type` field)
2. **Price** - Display product price (field to be determined - may need null handling)
3. **Actions** - Edit and Delete buttons (keep existing functionality)

**Fields to Remove from UI:**
- Deceased name column
- Cemetery column
- Status column
- Installation Date column
- Order column
- Status filter dropdown
- Search filters related to deceased/cemetery

**Fields to Keep (but may need adjustment):**
- Product Name (from `memorial_type` or `name` field if exists)
- Price (to be determined - may need to handle as null or missing field)
- Actions (Edit/Delete - maintain existing functionality)

### Search and Filter Updates

**Remove:**
- Status filter dropdown
- Search placeholder text referencing deceased/cemetery

**Update:**
- Search should only search by product name
- Simplify search placeholder to "Search products..."

### Empty State Updates

**Current:** References "products" but may mention filters
**Update:** Ensure empty state text reflects product catalog usage (not order/job context)

---

## Implementation Approach

### Phase 1: Update Table Structure
1. Remove legacy columns from table header:
   - Remove `TableHead` for Deceased
   - Remove `TableHead` for Cemetery
   - Remove `TableHead` for Product Type (if separate from Name)
   - Remove `TableHead` for Status
   - Remove `TableHead` for Installation Date
   - Remove `TableHead` for Order

2. Add/Update columns:
   - Add/Update `TableHead` for "Product Name"
   - Add/Update `TableHead` for "Price"
   - Keep `TableHead` for "Actions"

3. Update table body cells:
   - Remove all `TableCell` components for removed columns
   - Update Product Name cell to display appropriate field (likely `memorialType`)
   - Add/Update Price cell with null-safe rendering
   - Keep Actions cells unchanged

### Phase 2: Update Filters and Search
1. Remove status filter:
   - Remove `Select` component for status filtering
   - Remove `statusFilter` state variable
   - Remove status filtering logic from `filteredMemorials` useMemo

2. Update search:
   - Update search placeholder to "Search products..."
   - Update search filter logic to only search by product name
   - Remove deceased/cemetery/plot from search filter

### Phase 3: Update Empty States and Helper Text
1. Update empty state messages:
   - Ensure text reflects product catalog context
   - Remove references to status filters
   - Update "Create First Product" button text if needed

2. Update page description:
   - Change from "Manage client product records for installed/planned products"
   - To something like "Manage your product catalog"

### Phase 4: Null-Safe Rendering
1. Ensure Product Name handles null/empty values:
   - Display "—" or "Unnamed Product" if name is null/empty

2. Ensure Price handles null/empty values:
   - Display "—" or "No price" if price is null/empty
   - Format price as currency if value exists (e.g., £1,234.56)

### Phase 5: Code Cleanup
1. Remove unused helper functions:
   - `formatCemeteryInfo` (no longer needed)
   - `formatInstallationDate` (no longer needed)
   - `statusColors` constant (no longer needed)

2. Remove unused imports if any

---

## What NOT to Do

- **Do NOT** change database schema
- **Do NOT** create Supabase migrations
- **Do NOT** rename database tables or columns
- **Do NOT** change API endpoints or functions
- **Do NOT** modify TypeScript types/interfaces (unless adding null handling)
- **Do NOT** change Orders, Jobs, Invoicing, or Payments modules
- **Do NOT** remove Edit/Delete functionality
- **Do NOT** change Create/Edit drawers (those can remain as-is for now)
- **Do NOT** modify data transformation utilities (unless needed for null handling)

---

## Field Mapping Considerations

### Product Name
- **Likely Source:** `memorial_type` field from database
- **Alternative:** Check if `name` field exists in database
- **Null Handling:** Display "—" or "Unnamed Product" if null/empty

### Price
- **Current Status:** Not visible in current `Memorial` type definition
- **Options:**
  1. Check if `price` field exists in database but not in TypeScript type
  2. If field doesn't exist, display "—" or "No price" for all products
  3. If field exists, format as currency (e.g., £1,234.56)
- **Null Handling:** Display "—" or "No price" if null

### Actions
- **Keep:** Edit and Delete buttons
- **No Changes:** Maintain existing functionality

---

## Success Criteria

- ✅ Products page loads without errors
- ✅ Only Name, Price, and Actions columns are visible
- ✅ All legacy columns (Deceased, Cemetery, Status, Installation Date, Order) are removed
- ✅ Status filter is removed
- ✅ Search only searches by product name
- ✅ Product Name displays correctly (null-safe)
- ✅ Price displays correctly (null-safe, formatted if value exists)
- ✅ Edit action still works
- ✅ Delete action still works
- ✅ Empty states reflect product catalog context
- ✅ No console errors
- ✅ No TypeScript errors

---

## Open Questions / Considerations

1. **Price Field:**
   - Does a `price` field exist in the `memorials` database table?
   - If not, should we display "—" for all products, or is there another field that represents price?
   - Should we format price as currency? What currency symbol/format?

2. **Product Name Field:**
   - Confirm that `memorial_type` is the correct field for Product Name
   - Is there a separate `name` field that should be used instead?

3. **Search Functionality:**
   - Should search also search by price? (probably not for a catalog view)
   - Should we add any other filters (e.g., price range)?

4. **Create/Edit Drawers:**
   - Should these be updated in this phase, or left as-is?
   - User specified "Do not remove Edit/Delete functionality" but didn't mention Create/Edit forms

---

## Implementation Notes

- This is a UI-only change - no backend modifications
- Internal table name remains `memorials` (no changes)
- Existing CRUD operations must continue to work
- Focus on simplifying the list/table view only
- Maintain all existing functionality for Edit and Delete actions

