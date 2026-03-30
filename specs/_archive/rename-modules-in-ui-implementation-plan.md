# Rename Modules in UI - Implementation Plan

## Overview

This plan details the step-by-step implementation for renaming UI terminology from "Customers" to "People" and "Memorials" to "Products" throughout the application. This is a UI-only change with no database, API, or code structure modifications.

**Branch:** `feature/rename-modules-in-ui`  
**Specification:** `specs/rename-modules-in-ui.md`

---

## Implementation Phases

### Phase 1: Navigation and Sidebar Labels

**Files to Update:**
- `src/app/layout/AppSidebar.tsx`

**Changes:**
1. Line 21: Change `{ title: "Customers", ... }` → `{ title: "People", ... }`
2. Line 23: Change `{ title: "Memorials", ... }` → `{ title: "Products", ... }`

**Verification:**
- Sidebar navigation displays "People" and "Products"
- Navigation links still work correctly
- Icons remain unchanged (Users for People, Landmark for Products)

---

### Phase 2: Page Titles and Headers

#### 2.1 Customers Page → People Page

**File:** `src/modules/customers/pages/CustomersPage.tsx`

**Changes:**
1. **Page Title (h1):**
   - Find the main page heading (likely around line 100-150)
   - Change "Customers" → "People"
   - Example: `<h1>Customers</h1>` → `<h1>People</h1>`

2. **Page Description:**
   - Update any subtitle or description text
   - Change "Manage customers" → "Manage people"
   - Change "customer records" → "people records"

3. **Card Titles:**
   - Update `CardTitle` components that reference "Customer"
   - Change "Customer List" → "People List" (if present)

**Verification:**
- Page title displays "People"
- All headings use new terminology
- Page functionality remains intact

#### 2.2 Memorials Page → Products Page

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`

**Changes:**
1. **Page Title (h1):**
   - Find the main page heading
   - Change "Memorials" → "Products"
   - Example: `<h1>Memorials</h1>` → `<h1>Products</h1>`

2. **Page Description:**
   - Update any subtitle or description text
   - Change "Manage memorials" → "Manage products"
   - Change "memorial records" → "product records"

3. **Card Titles:**
   - Update `CardTitle` components that reference "Memorial"
   - Change "Memorial List" → "Product List" (if present)

**Verification:**
- Page title displays "Products"
- All headings use new terminology
- Page functionality remains intact

---

### Phase 3: Form Labels and Button Text

#### 3.1 Customer Drawer Components

**Files:**
- `src/modules/customers/components/CreateCustomerDrawer.tsx`
- `src/modules/customers/components/EditCustomerDrawer.tsx`
- `src/modules/customers/components/DeleteCustomerDialog.tsx`

**CreateCustomerDrawer.tsx Changes:**
1. **Drawer Title (Line 79):**
   - `"Create Customer"` → `"Create Person"`

2. **Drawer Description (Line 80):**
   - `"Add a new customer record."` → `"Add a new person record."`

3. **Button Labels:**
   - `"Create Customer"` → `"Create Person"`
   - Any "New Customer" → "New Person"

4. **Toast Messages (Lines 57-58, 67-68):**
   - `"Customer created"` → `"Person created"`
   - `"Customer has been created successfully."` → `"Person has been created successfully."`
   - `"Error creating customer"` → `"Error creating person"`
   - `"Failed to create customer."` → `"Failed to create person."`

**EditCustomerDrawer.tsx Changes:**
1. **Drawer Title:**
   - `"Edit Customer"` → `"Edit Person"`

2. **Drawer Description:**
   - `"Update customer information."` → `"Update person information."`

3. **Button Labels:**
   - `"Update Customer"` → `"Update Person"`
   - `"Save Customer"` → `"Save Person"`

4. **Toast Messages:**
   - `"Customer updated"` → `"Person updated"`
   - `"Customer has been updated successfully."` → `"Person has been updated successfully."`
   - `"Error updating customer"` → `"Error updating person"`
   - `"Failed to update customer."` → `"Failed to update person."`

**DeleteCustomerDialog.tsx Changes:**
1. **Dialog Title:**
   - `"Delete Customer"` → `"Delete Person"`

2. **Dialog Description:**
   - `"Are you sure you want to delete this customer?"` → `"Are you sure you want to delete this person?"`
   - `"This action cannot be undone."` (keep as is)

3. **Confirmation Text:**
   - Any references to "customer" in confirmation messages → "person"

4. **Toast Messages:**
   - `"Customer deleted"` → `"Person deleted"`
   - `"Customer has been deleted successfully."` → `"Person has been deleted successfully."`
   - `"Error deleting customer"` → `"Error deleting person"`
   - `"Failed to delete customer."` → `"Failed to delete person."`

#### 3.2 Memorial Drawer Components

**Files:**
- `src/modules/memorials/components/CreateMemorialDrawer.tsx`
- `src/modules/memorials/components/EditMemorialDrawer.tsx`
- `src/modules/memorials/components/DeleteMemorialDialog.tsx`

**CreateMemorialDrawer.tsx Changes:**
1. **Drawer Title:**
   - `"Create Memorial"` → `"Create Product"`

2. **Drawer Description:**
   - `"Add a new memorial record."` → `"Add a new product record."`

3. **Button Labels:**
   - `"Create Memorial"` → `"Create Product"`
   - Any "New Memorial" → "New Product"

4. **Toast Messages:**
   - `"Memorial created"` → `"Product created"`
   - `"Memorial has been created successfully."` → `"Product has been created successfully."`
   - `"Error creating memorial"` → `"Error creating product"`
   - `"Failed to create memorial."` → `"Failed to create product."`

**EditMemorialDrawer.tsx Changes:**
1. **Drawer Title:**
   - `"Edit Memorial"` → `"Edit Product"`

2. **Drawer Description:**
   - `"Update memorial information."` → `"Update product information."`

3. **Button Labels:**
   - `"Update Memorial"` → `"Update Product"`
   - `"Save Memorial"` → `"Save Product"`

4. **Toast Messages:**
   - `"Memorial updated"` → `"Product updated"`
   - `"Memorial has been updated successfully."` → `"Product has been updated successfully."`
   - `"Error updating memorial"` → `"Error updating product"`
   - `"Failed to update memorial."` → `"Failed to update product."`

**DeleteMemorialDialog.tsx Changes:**
1. **Dialog Title:**
   - `"Delete Memorial"` → `"Delete Product"`

2. **Dialog Description:**
   - `"Are you sure you want to delete this memorial?"` → `"Are you sure you want to delete this product?"`
   - `"This action cannot be undone."` (keep as is)

3. **Confirmation Text:**
   - Any references to "memorial" in confirmation messages → "product"

4. **Toast Messages:**
   - `"Memorial deleted"` → `"Product deleted"`
   - `"Memorial has been deleted successfully."` → `"Product has been deleted successfully."`
   - `"Error deleting memorial"` → `"Error deleting product"`
   - `"Failed to delete memorial."` → `"Failed to delete product."`

---

### Phase 4: Empty States and Helper Text

#### 4.1 CustomersPage Empty States

**File:** `src/modules/customers/pages/CustomersPage.tsx`

**Changes (around lines 84-99):**
1. **Empty State Title:**
   - `"No customers found"` → `"No people found"`

2. **Empty State Description:**
   - `"Try adjusting your search."` (keep as is)
   - `"Create your first customer to get started."` → `"Create your first person to get started."`

3. **Empty State Button:**
   - `"New Customer"` → `"New Person"`

4. **Error Messages:**
   - `"Failed to load customers."` → `"Failed to load people."`

5. **Search Placeholder:**
   - If there's a search input, check placeholder text
   - `"Search customers..."` → `"Search people..."` (if present)

#### 4.2 MemorialsPage Empty States

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`

**Changes:**
1. **Empty State Title:**
   - `"No memorials found"` → `"No products found"`

2. **Empty State Description:**
   - `"Try adjusting your search."` (keep as is)
   - `"Create your first memorial to get started."` → `"Create your first product to get started."`

3. **Empty State Button:**
   - `"New Memorial"` → `"New Product"`

4. **Error Messages:**
   - `"Failed to load memorials."` → `"Failed to load products."`

5. **Search Placeholder:**
   - `"Search memorials..."` → `"Search products..."` (if present)

---

### Phase 5: Cross-Module References

#### 5.1 Invoicing Module References

**Files to Review:**
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`
- `src/modules/invoicing/components/EditInvoiceDrawer.tsx`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`
- `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`
- `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
1. **Form Labels:**
   - `"Customer Name"` → `"Person Name"` (if present in invoice forms)
   - `"Select Customer"` → `"Select Person"` (if present)

2. **Table Headers:**
   - `"Customer"` column header → `"Person"` (if present)

3. **Display Text:**
   - Any labels that say "Customer" when displaying invoice data → "Person"
   - Keep data field names unchanged (e.g., `customer_name` in code)

4. **Placeholder Text:**
   - `"Select a customer..."` → `"Select a person..."` (if present)

**Note:** Only update user-facing labels. Do NOT change:
- Variable names like `customer_name`
- API field names
- Type definitions

#### 5.2 Orders Module References

**Files to Review:**
- `src/modules/orders/components/CreateOrderDrawer.tsx`
- `src/modules/orders/components/EditOrderDrawer.tsx`
- `src/modules/orders/pages/OrdersPage.tsx`

**Changes:**
1. **Form Labels:**
   - `"Customer Name"` → `"Person Name"`
   - `"Customer Email"` → `"Person Email"`
   - `"Customer Phone"` → `"Person Phone"`
   - `"Select Customer"` → `"Select Person"`

2. **Table Headers:**
   - `"Customer"` column header → `"Person"` (if present)

3. **Display Text:**
   - Any labels that say "Customer" when displaying order data → "Person"
   - References to "Memorial" in order context → "Product"

4. **Placeholder Text:**
   - `"Select a customer..."` → `"Select a person..."`
   - `"Select a memorial..."` → `"Select a product..."` (if present)

**Note:** Only update user-facing labels. Do NOT change:
- Variable names like `customer_name`, `customer_email`
- API field names
- Type definitions

#### 5.3 Jobs Module References (if applicable)

**Files to Review:**
- Any job-related components that reference "Memorial"

**Changes:**
1. **Form Labels:**
   - `"Select Memorial"` → `"Select Product"` (if present)

2. **Display Text:**
   - Any labels that say "Memorial" when displaying job data → "Product"

---

## Detailed File-by-File Checklist

### Navigation
- [ ] `src/app/layout/AppSidebar.tsx` - Update navigation labels

### Customers → People Pages
- [ ] `src/modules/customers/pages/CustomersPage.tsx` - Page title, headings, empty states, buttons

### Customers → People Components
- [ ] `src/modules/customers/components/CreateCustomerDrawer.tsx` - Title, description, buttons, toast messages
- [ ] `src/modules/customers/components/EditCustomerDrawer.tsx` - Title, description, buttons, toast messages
- [ ] `src/modules/customers/components/DeleteCustomerDialog.tsx` - Title, description, confirmation text, toast messages

### Memorials → Products Pages
- [ ] `src/modules/memorials/pages/MemorialsPage.tsx` - Page title, headings, empty states, buttons

### Memorials → Products Components
- [ ] `src/modules/memorials/components/CreateMemorialDrawer.tsx` - Title, description, buttons, toast messages
- [ ] `src/modules/memorials/components/EditMemorialDrawer.tsx` - Title, description, buttons, toast messages
- [ ] `src/modules/memorials/components/DeleteMemorialDialog.tsx` - Title, description, confirmation text, toast messages

### Cross-Module References
- [ ] `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Customer references → Person
- [ ] `src/modules/invoicing/components/EditInvoiceDrawer.tsx` - Customer references → Person
- [ ] `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` - Customer references → Person
- [ ] `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx` - Customer references → Person
- [ ] `src/modules/invoicing/pages/InvoicingPage.tsx` - Customer references → Person
- [ ] `src/modules/orders/components/CreateOrderDrawer.tsx` - Customer/Memorial references → Person/Product
- [ ] `src/modules/orders/components/EditOrderDrawer.tsx` - Customer/Memorial references → Person/Product
- [ ] `src/modules/orders/pages/OrdersPage.tsx` - Customer/Memorial references → Person/Product

---

## Search Patterns for Verification

After implementation, search for any remaining user-facing text:

**Search for "Customer" (case-insensitive) in UI text:**
```bash
grep -r "Customer" src/ --include="*.tsx" | grep -v "customer_name\|customer_email\|customer_phone\|customerTo\|customerId\|customerData"
```

**Search for "Memorial" (case-insensitive) in UI text:**
```bash
grep -r "Memorial" src/ --include="*.tsx" | grep -v "memorialId\|memorialData\|memorialTo\|memorialType"
```

**Common patterns to update:**
- "Create Customer" → "Create Person"
- "Edit Customer" → "Edit Person"
- "Delete Customer" → "Delete Person"
- "New Customer" → "New Person"
- "No customers" → "No people"
- "Customer created" → "Person created"
- "Customer updated" → "Person updated"
- "Customer deleted" → "Person deleted"

- "Create Memorial" → "Create Product"
- "Edit Memorial" → "Edit Product"
- "Delete Memorial" → "Delete Product"
- "New Memorial" → "New Product"
- "No memorials" → "No products"
- "Memorial created" → "Product created"
- "Memorial updated" → "Product updated"
- "Memorial deleted" → "Product deleted"

---

## Testing Checklist

After completing all phases:

1. **Navigation:**
   - [ ] Sidebar shows "People" and "Products"
   - [ ] Navigation links work correctly
   - [ ] Active state highlighting works

2. **People Page:**
   - [ ] Page title displays "People"
   - [ ] "New Person" button works
   - [ ] Create Person drawer shows correct title
   - [ ] Edit Person drawer shows correct title
   - [ ] Delete Person dialog shows correct text
   - [ ] Empty state shows "No people found"
   - [ ] Toast messages use "Person" terminology

3. **Products Page:**
   - [ ] Page title displays "Products"
   - [ ] "New Product" button works
   - [ ] Create Product drawer shows correct title
   - [ ] Edit Product drawer shows correct title
   - [ ] Delete Product dialog shows correct text
   - [ ] Empty state shows "No products found"
   - [ ] Toast messages use "Product" terminology

4. **Cross-Module:**
   - [ ] Invoice forms show "Person" instead of "Customer"
   - [ ] Order forms show "Person" instead of "Customer"
   - [ ] Order forms show "Product" instead of "Memorial" (if applicable)
   - [ ] All form submissions still work
   - [ ] All data displays correctly

5. **Functionality:**
   - [ ] All CRUD operations work
   - [ ] Search and filtering work
   - [ ] No console errors
   - [ ] No TypeScript errors
   - [ ] No broken links or routes

---

## Constraints Reminder

**DO NOT CHANGE:**
- Database table names (`customers`, `memorials`)
- Database column names (`customer_name`, `memorial_id`)
- TypeScript types or interfaces
- Variable names in code (`customerToEdit`, `memorialsData`)
- Function names (`useCustomersList`, `createCustomer`)
- Module directory names (`src/modules/customers/`, `src/modules/memorials/`)
- Component file names
- Route paths (`/dashboard/customers`, `/dashboard/memorials`)
- API endpoints or function names
- Internal comments or code documentation

**ONLY CHANGE:**
- User-facing text in JSX/TSX
- String literals in UI components
- Toast notification messages
- Form labels and placeholders
- Button text
- Page titles and headings
- Empty state messages
- Dialog/drawer titles and descriptions

---

## Implementation Order

1. Start with Phase 1 (Navigation) - Quick win, visible immediately
2. Then Phase 2 (Page Titles) - High visibility
3. Then Phase 3 (Forms/Buttons) - Most user interaction
4. Then Phase 4 (Empty States) - Edge cases
5. Finally Phase 5 (Cross-References) - Comprehensive coverage

Test after each phase to catch issues early.

---

## Completion Criteria

The implementation is complete when:
- ✅ All navigation labels updated
- ✅ All page titles updated
- ✅ All form/drawer titles updated
- ✅ All button labels updated
- ✅ All toast messages updated
- ✅ All empty states updated
- ✅ All cross-module references updated
- ✅ No remaining "Customer" or "Memorial" in user-facing text
- ✅ All functionality still works
- ✅ No TypeScript or linting errors
- ✅ All tests pass (if applicable)

