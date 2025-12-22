# Rename Modules in UI

## Overview

Update UI terminology to reflect correct business language by renaming modules throughout the user interface.

**Context:**
- This is a UI-only terminology update
- No database schema, API, or type changes required
- No behavior changes - purely cosmetic text updates
- Affects navigation, page titles, headings, buttons, and empty states

**Goal:**
- Rename "Customers" to "People" throughout the UI
- Rename "Memorials" to "Products" throughout the UI
- Ensure consistent terminology across all user-facing text
- Maintain all existing functionality and data structures

---

## Current State Analysis

### UI Terminology Locations

**Navigation Labels:**
- `src/app/layout/AppSidebar.tsx`: Line 21 - "Customers" navigation item
- `src/app/layout/AppSidebar.tsx`: Line 23 - "Memorials" navigation item

**Page Titles:**
- `src/modules/customers/pages/CustomersPage.tsx`: Page title and headings
- `src/modules/memorials/pages/MemorialsPage.tsx`: Page title and headings

**Section Headings:**
- Various components in `src/modules/customers/components/` may contain "Customer" in headings
- Various components in `src/modules/memorials/components/` may contain "Memorial" in headings

**Buttons and Actions:**
- "Create Customer" buttons → "Create Person"
- "Edit Customer" buttons → "Edit Person"
- "Delete Customer" buttons → "Delete Person"
- "Create Memorial" buttons → "Create Product"
- "Edit Memorial" buttons → "Edit Product"
- "Delete Memorial" buttons → "Delete Product"

**Empty States:**
- Empty state messages in CustomersPage and MemorialsPage
- Placeholder text in forms and drawers

**Observations:**
- The terms "Customer" and "Memorial" appear in 53+ and 19+ files respectively
- Most occurrences are in UI components, page titles, and user-facing text
- Database fields, API types, and internal code use snake_case (e.g., `customer_name`, `memorial_id`) which should remain unchanged

### Files Requiring Updates

**Customers → People:**
- `src/app/layout/AppSidebar.tsx` - Navigation label
- `src/modules/customers/pages/CustomersPage.tsx` - Page title, headings, buttons
- `src/modules/customers/components/CreateCustomerDrawer.tsx` - Drawer title, form labels
- `src/modules/customers/components/EditCustomerDrawer.tsx` - Drawer title, form labels
- `src/modules/customers/components/DeleteCustomerDialog.tsx` - Dialog title, messages
- Any other UI components with "Customer" in user-facing text

**Memorials → Products:**
- `src/app/layout/AppSidebar.tsx` - Navigation label
- `src/modules/memorials/pages/MemorialsPage.tsx` - Page title, headings, buttons
- `src/modules/memorials/components/CreateMemorialDrawer.tsx` - Drawer title, form labels
- `src/modules/memorials/components/EditMemorialDrawer.tsx` - Drawer title, form labels
- `src/modules/memorials/components/DeleteMemorialDialog.tsx` - Dialog title, messages
- Any other UI components with "Memorial" in user-facing text

**Cross-References:**
- Components that reference "Customer" or "Memorial" in labels when displaying related data
- Form placeholders and help text
- Error messages and validation text
- Toast notifications

---

## Recommended Changes

### UI Text Updates Only

**Navigation:**
- Update sidebar navigation items to use new terminology
- Ensure route paths remain unchanged (e.g., `/dashboard/customers` stays the same)

**Page Components:**
- Update page titles (h1, h2 headings)
- Update section headings
- Update button labels ("Create Customer" → "Create Person", etc.)
- Update empty state messages
- Update search placeholders if they reference the old terms

**Form Components:**
- Update drawer/dialog titles
- Update form field labels that reference the entity name
- Update placeholder text
- Update validation messages if they reference the entity name
- Update success/error toast messages

**Table Components:**
- Update column headers if they reference the entity name
- Update table empty states

### What NOT to Change

**Database & API:**
- No changes to database table names (`customers`, `memorials`)
- No changes to column names (`customer_name`, `memorial_id`, etc.)
- No changes to API endpoints or function names
- No changes to TypeScript types or interfaces
- No changes to database migrations

**Code Structure:**
- No changes to module directory names (`src/modules/customers/`, `src/modules/memorials/`)
- No changes to component file names
- No changes to hook names or API function names
- No changes to route paths in router configuration

**Internal Code:**
- Variable names in code can remain unchanged (e.g., `customerToEdit`, `memorialsData`)
- Function names can remain unchanged
- Comments and internal documentation can remain unchanged

---

## Implementation Approach

### Phase 1: Navigation and Page Titles
1. Update `AppSidebar.tsx` navigation labels:
   - "Customers" → "People"
   - "Memorials" → "Products"
2. Update page component titles in:
   - `CustomersPage.tsx` - Update h1 title and page description
   - `MemorialsPage.tsx` - Update h1 title and page description

### Phase 2: Component Headers and Buttons
1. Update drawer components:
   - `CreateCustomerDrawer.tsx` - Title, description, button labels
   - `EditCustomerDrawer.tsx` - Title, description, button labels
   - `DeleteCustomerDialog.tsx` - Title, description, confirmation text
   - `CreateMemorialDrawer.tsx` - Title, description, button labels
   - `EditMemorialDrawer.tsx` - Title, description, button labels
   - `DeleteMemorialDialog.tsx` - Title, description, confirmation text

2. Update button labels throughout:
   - "New Customer" → "New Person"
   - "Create Customer" → "Create Person"
   - "Edit Customer" → "Edit Person"
   - "Delete Customer" → "Delete Person"
   - "New Memorial" → "New Product"
   - "Create Memorial" → "Create Product"
   - "Edit Memorial" → "Edit Product"
   - "Delete Memorial" → "Delete Product"

### Phase 3: Form Labels and Placeholders
1. Update form field labels in drawers:
   - Any labels that say "Customer" → "Person"
   - Any labels that say "Memorial" → "Product"
2. Update placeholder text in input fields
3. Update help text and descriptions

### Phase 4: Empty States and Messages
1. Update empty state messages in table components
2. Update toast notification messages
3. Update error messages that reference entity names
4. Update search placeholder text

### Phase 5: Cross-References
1. Review components that display related data:
   - Order forms that reference "Customer"
   - Invoice forms that reference "Customer"
   - Job forms that reference "Memorial"
   - Any other cross-references in labels or descriptions
2. Update only user-facing text, not data field names

### Safety Considerations
- Use find-and-replace carefully to avoid changing code identifiers
- Test each page after updates to ensure functionality remains intact
- Verify that database queries and API calls still work correctly
- Ensure route paths remain functional
- Check that form submissions still work with updated labels

---

## What NOT to Do

- **Do NOT** rename database tables or columns
- **Do NOT** rename TypeScript types or interfaces
- **Do NOT** rename module directories or component files
- **Do NOT** rename API functions or hooks
- **Do NOT** change route paths in the router
- **Do NOT** change variable names in code (only user-facing text)
- **Do NOT** update internal comments or code documentation
- **Do NOT** change any behavior or functionality
- **Do NOT** update database migrations
- **Do NOT** change any data structures or schemas

---

## Open Questions / Considerations

- Should the icon in the sidebar navigation change? (Currently `Users` for Customers, `Landmark` for Memorials)
- Are there any third-party integrations or external references that use these terms?
- Should we update any documentation or help text that users might see?
- Are there any email templates or notifications that reference these terms?

