# Simplify and refactor Order creation form (UI-only, invoice-centric)

## Overview

Orders are now created under Invoices and represent concrete scopes of work (New Memorial or Renovation). The current Order creation form contains many legacy CRM, status, scheduling, and project-management fields that are no longer relevant.

This change simplifies the Order creation UI while preserving the existing Orders database schema and keeping all existing Orders valid.

**Context:**
- Orders are created under Invoices and represent concrete work scopes
- Current form has legacy CRM, status, scheduling, and project-management fields
- Database schema must remain unchanged
- All existing Orders must remain valid
- New UI semantics map to existing database fields

**Goal:**
- Redesign Order creation form to collect only essential information
- Add Product selection with snapshot functionality
- Map new UI semantics to existing database fields
- Maintain backward compatibility with existing Orders

---

## Current State Analysis

### Orders Table Schema

**Table:** `orders`

**Current Structure (from migration and types):**
- `id`: UUID (primary key)
- `invoice_id`: UUID | null (foreign key to invoices)
- `customer_name`: TEXT (required)
- `customer_email`: TEXT | null
- `customer_phone`: TEXT | null
- `order_type`: TEXT (required)
- `sku`: TEXT | null
- `material`: TEXT | null
- `color`: TEXT | null
- `stone_status`: ENUM ('NA', 'Ordered', 'In Stock')
- `permit_status`: ENUM ('form_sent', 'customer_completed', 'pending', 'approved')
- `proof_status`: ENUM ('NA', 'Not_Received', 'Received', 'In_Progress', 'Lettered')
- `deposit_date`: DATE | null
- `second_payment_date`: DATE | null
- `due_date`: DATE | null
- `installation_date`: DATE | null
- `location`: TEXT | null
- `value`: NUMERIC | null (price/value)
- `progress`: INTEGER (0-100)
- `assigned_to`: TEXT | null
- `priority`: ENUM ('low', 'medium', 'high')
- `timeline_weeks`: INTEGER
- `notes`: TEXT | null
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Observations:**
- No `product_id` column exists (Product selection is UI-only)
- No `dimensions` column exists (will be stored in `notes` with prefix or in existing field)
- All fields are nullable except `id`, `customer_name`, `order_type`, `progress`, `priority`, `timeline_weeks`

### Current Order Creation Form

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Current Form Sections:**
1. **Person Information:**
   - Person Name (customer_name) *
   - Email (customer_email)
   - Phone (customer_phone)

2. **Order Details:**
   - Order Type (order_type) * (free text input)
   - SKU (sku)
   - Material (material)
   - Color (color)

3. **Status:**
   - Stone Status (stone_status)
   - Permit Status (permit_status)
   - Proof Status (proof_status)

4. **Important Dates:**
   - Deposit Date (deposit_date)
   - Second Payment Date (second_payment_date)
   - Due Date (due_date)
   - Installation Date (installation_date)

5. **Additional Information:**
   - Location (location)
   - Value (£) (value)
   - Progress (%) (progress)
   - Assigned To (assigned_to)
   - Priority (priority)
   - Timeline (Weeks) (timeline_weeks)
   - Notes (notes)

**Observations:**
- Form has 20+ fields across 5 sections
- Many fields are legacy CRM/project management (status, dates, progress, assigned_to, priority, timeline)
- No Product selection exists
- Material, color, dimensions are manual inputs
- Order Type is free text (should be enum: "New Memorial" | "Renovation")

### Products Module (Memorials)

**Products Table:** `memorials`

**Relevant Fields for Snapshot:**
- `id`: UUID (for selection)
- `name`: TEXT | null (product name)
- `price`: NUMERIC | null (product price)
- `material`: TEXT | null (stone type)
- `color`: TEXT | null (stone color)
- `dimensions`: TEXT | null (dimensions)

**Observations:**
- Products have name, price, material, color, dimensions
- These can be snapshotted into Order fields at creation time
- No `product_id` column in Orders table (UI-only selection)

---

## Field Semantic Mapping

### Locked Mapping (Must Use Existing Fields)

| UI Label | Database Field | Type | Notes |
|----------|---------------|------|-------|
| Deceased Name | `customer_name` | TEXT | Required, UI label only |
| Location | `location` | TEXT | Required |
| Grave Number | `sku` | TEXT | Required, repurposed from SKU |
| Stone Type | `material` | TEXT | Snapshot from Product, editable |
| Stone Color | `color` | TEXT | Snapshot from Product, editable |
| Dimensions | `notes` (prefixed) OR `material`/`color` if space allows | TEXT | Snapshot from Product, editable |
| Price | `value` | NUMERIC | Snapshot from Product, editable |
| Order Type | `order_type` | TEXT | Enum: "New Memorial" \| "Renovation" |
| Notes | `notes` | TEXT | Keep existing |

**Important Notes:**
- `sku` field is repurposed as "Grave Number" (UI semantic change only)
- `dimensions` can be stored in `notes` with prefix like "Dimensions: 24x18x4" or in a separate field if available
- `order_type` changes from free text to enum dropdown: "New Memorial" | "Renovation"
- Product selection is UI-only (no `product_id` column exists)

---

## Recommended Implementation

### Simplified Form Structure

**New Form Sections:**

1. **Order Type** (required)
   - Dropdown: "New Memorial" | "Renovation"
   - Maps to: `order_type`

2. **Deceased & Location** (required)
   - Deceased Name (required)
     - Maps to: `customer_name`
   - Location (required)
     - Maps to: `location`
   - Grave Number (required)
     - Maps to: `sku` (repurposed)

3. **Product Selection** (optional but recommended)
   - Select Product dropdown
     - Shows: Product Name (from `memorials.name` or `memorials.memorial_type`)
     - On selection, snapshots:
       - Stone Type → `material`
       - Stone Color → `color`
       - Dimensions → `notes` (with prefix) or available field
       - Price → `value`

4. **Product Snapshot Fields** (editable)
   - Stone Type (editable)
     - Maps to: `material`
     - Defaults from Product selection
   - Stone Color (editable)
     - Maps to: `color`
     - Defaults from Product selection
   - Dimensions (editable)
     - Maps to: `notes` (with prefix "Dimensions: ") or available field
     - Defaults from Product selection
   - Price (editable numeric input)
     - Maps to: `value`
     - Defaults from Product selection

5. **Notes** (optional)
   - Maps to: `notes` (appended after dimensions if stored there)

### Fields to Remove

**Remove from Form (but keep in database):**
- Person email (`customer_email`) - set to null
- Person phone (`customer_phone`) - set to null
- Status fields:
  - Stone Status (`stone_status`) - set to default 'NA'
  - Permit Status (`permit_status`) - set to default 'pending'
  - Proof Status (`proof_status`) - set to default 'Not_Received'
- Date fields:
  - Deposit Date (`deposit_date`) - set to null
  - Second Payment Date (`second_payment_date`) - set to null
  - Due Date (`due_date`) - set to null
  - Installation Date (`installation_date`) - set to null
- Project management fields:
  - Progress (`progress`) - set to default 0
  - Assigned To (`assigned_to`) - set to null
  - Priority (`priority`) - set to default 'medium'
  - Timeline Weeks (`timeline_weeks`) - set to default 12

**Note:** These fields are set to defaults/null values in the form submission, but remain in the database for existing Orders.

---

## Implementation Approach

### Phase 1: Update Form Schema

1. **Update `order.schema.ts`:**
   - Change `order_type` from `z.string()` to `z.enum(['New Memorial', 'Renovation'])`
   - Add optional `productId` field (UI-only, not saved to DB)
   - Keep all existing fields for backward compatibility
   - Mark removed fields as optional with defaults

2. **Update default values:**
   - Set defaults for removed fields (status, dates, project management)
   - Ensure backward compatibility

### Phase 2: Update CreateOrderDrawer Component

1. **Remove legacy form sections:**
   - Remove Person email/phone fields
   - Remove Status section
   - Remove Important Dates section
   - Remove Project Management fields (Progress, Assigned To, Priority, Timeline)

2. **Add new form sections:**
   - Order Type dropdown (enum)
   - Deceased & Location section (3 required fields)
   - Product Selection dropdown
   - Product Snapshot Fields section (4 editable fields)
   - Notes field (keep existing)

3. **Implement Product selection logic:**
   - Fetch products list using `useMemorialsList()`
   - On product selection, snapshot:
     - `material` → Stone Type
     - `color` → Stone Color
     - `dimensions` → Dimensions (store in notes with prefix)
     - `price` → Price
   - Allow editing of snapshot fields

4. **Update form submission:**
   - Set removed fields to defaults/null
   - Handle dimensions storage (prefix in notes or separate field)
   - Ensure all required fields are validated

### Phase 3: Handle Dimensions Storage

**Option 1: Store in `notes` with prefix (Recommended)**
- Format: "Dimensions: 24x18x4\n\n[other notes]"
- Parse on edit if needed
- Simple, uses existing field

**Option 2: Use existing field if available**
- Check if `dimensions` column exists in Orders table
- If yes, use it directly
- If no, use Option 1

**Recommendation:** Use Option 1 (notes with prefix) for simplicity and compatibility.

---

## What NOT to Do

- **NO database schema changes** - Orders table schema remains unchanged
- **NO new Orders table columns** - Use existing fields only
- **NO migrations** - Database structure is locked
- **NO changes to existing Orders** - All existing Orders must remain valid
- **NO changes to Order edit form** - Unless strictly required for consistency
- **NO changes to Jobs, Payments, Reporting, Inbox, Notifications, Team Chat**
- **NO changes to Invoicing UI** - Except where Order creation is launched
- **NO Product table changes** - Products (memorials) table is read-only for this feature

---

## Success Criteria

- ✅ Order creation form shows only simplified fields
- ✅ Order Type is enum dropdown: "New Memorial" | "Renovation"
- ✅ Deceased Name, Location, Grave Number are required fields
- ✅ Product selection dropdown works and shows Product names
- ✅ Product selection snapshots material, color, dimensions, price correctly
- ✅ Snapshot fields are editable after selection
- ✅ Price defaults from Product and is editable
- ✅ Dimensions are stored correctly (in notes with prefix or separate field)
- ✅ Orders can be created successfully under an Invoice
- ✅ Existing Orders remain unaffected
- ✅ Removed fields are set to defaults/null on submission
- ✅ No TypeScript or runtime errors
- ✅ Form validation works correctly

---

## Testing Considerations

1. **Test Order creation:**
   - Create order with Product selection
   - Verify snapshot fields populate correctly
   - Edit snapshot fields and verify changes
   - Create order without Product selection (manual entry)
   - Verify all required fields are validated

2. **Test field mapping:**
   - Verify `customer_name` stores Deceased Name
   - Verify `sku` stores Grave Number
   - Verify `material` stores Stone Type
   - Verify `color` stores Stone Color
   - Verify `value` stores Price
   - Verify `order_type` stores enum value
   - Verify dimensions stored correctly in notes

3. **Test backward compatibility:**
   - Verify existing Orders still load correctly
   - Verify existing Orders can be edited (if edit form exists)
   - Verify no database errors occur

4. **Test Product selection:**
   - Select Product and verify snapshot
   - Change Product selection and verify snapshot updates
   - Clear Product selection and verify fields remain editable
   - Verify Product changes don't affect existing Orders

---

## Notes

1. **Product Selection:**
   - Product selection is UI-only (no `product_id` column)
   - Snapshot occurs only at Order creation time
   - Later Product changes do NOT affect existing Orders
   - Works for both "New Memorial" and "Renovation" order types

2. **Dimensions Storage:**
   - Recommended: Store in `notes` with prefix "Dimensions: "
   - Format: "Dimensions: 24x18x4\n\n[other notes]"
   - On edit, parse dimensions from notes if needed
   - Alternative: Use separate field if available in schema

3. **Field Defaults:**
   - Removed fields are set to defaults/null on submission:
     - `stone_status`: 'NA'
     - `permit_status`: 'pending'
     - `proof_status`: 'Not_Received'
     - `progress`: 0
     - `priority`: 'medium'
     - `timeline_weeks`: 12
     - All date fields: null
     - `customer_email`, `customer_phone`, `assigned_to`: null

4. **Order Type Enum:**
   - Change from free text to enum dropdown
   - Values: "New Memorial" | "Renovation"
   - Update schema validation accordingly

5. **Grave Number:**
   - Repurposes `sku` field (UI semantic change only)
   - Field remains `sku` in database
   - UI label changes to "Grave Number"

