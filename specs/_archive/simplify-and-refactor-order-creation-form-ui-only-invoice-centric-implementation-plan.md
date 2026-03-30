# Implementation Plan: Simplify and refactor Order creation form (UI-only, invoice-centric)

## Overview

This plan simplifies the Order creation form to collect only essential information while preserving the existing Orders database schema. The form will include Product selection with snapshot functionality, mapping new UI semantics to existing database fields.

**Goal:** Redesign CreateOrderDrawer to show only essential fields, add Product selection with snapshot, and maintain backward compatibility.

**Constraints:**
- NO database schema changes
- NO new columns
- NO migrations
- NO renaming of DB fields
- Modify CreateOrderDrawer only (unless strictly required)

---

## 1. Explicit Field Mapping Table

### UI Field → Database Column Mapping

| UI Field Label | Database Column | Type | Required | Source | Notes |
|----------------|----------------|------|----------|--------|-------|
| **Order Type** | `order_type` | TEXT | ✅ Yes | User input (enum dropdown) | Enum: "New Memorial" \| "Renovation" |
| **Deceased Name** | `customer_name` | TEXT | ✅ Yes | User input | UI label only (semantic change) |
| **Location** | `location` | TEXT | ✅ Yes | User input | Cemetery/location name |
| **Grave Number** | `sku` | TEXT | ✅ Yes | User input | Repurposed from SKU (semantic change) |
| **Stone Type** | `material` | TEXT | ❌ No | Product snapshot (editable) | Defaults from Product, user can edit |
| **Stone Color** | `color` | TEXT | ❌ No | Product snapshot (editable) | Defaults from Product, user can edit |
| **Dimensions** | `notes` (prefixed) | TEXT | ❌ No | Product snapshot (editable) | Format: "Dimensions: 24x18x4\n\n[notes]" |
| **Price** | `value` | NUMERIC | ❌ No | Product snapshot (editable) | Defaults from Product, user can edit |
| **Notes** | `notes` (appended) | TEXT | ❌ No | User input | Appended after dimensions if present |

### Fields Set to Defaults/Null (Removed from UI)

| Database Column | Default Value | Notes |
|----------------|--------------|-------|
| `customer_email` | `null` | Removed from form |
| `customer_phone` | `null` | Removed from form |
| `stone_status` | `'NA'` | Removed from form |
| `permit_status` | `'pending'` | Removed from form |
| `proof_status` | `'Not_Received'` | Removed from form |
| `deposit_date` | `null` | Removed from form |
| `second_payment_date` | `null` | Removed from form |
| `due_date` | `null` | Removed from form |
| `installation_date` | `null` | Removed from form |
| `progress` | `0` | Removed from form |
| `assigned_to` | `null` | Removed from form |
| `priority` | `'medium'` | Removed from form |
| `timeline_weeks` | `12` | Removed from form |

---

## 2. CreateOrderDrawer Changes

### 2.1. Fields to Remove

**Remove from Form UI (but set defaults in submission):**

1. **Person Information Section:**
   - ❌ Remove: Email (`customer_email`)
   - ❌ Remove: Phone (`customer_phone`)
   - ✅ Keep: Person Name → Rename to "Deceased Name" (`customer_name`)

2. **Status Section (Entire Section):**
   - ❌ Remove: Stone Status (`stone_status`)
   - ❌ Remove: Permit Status (`permit_status`)
   - ❌ Remove: Proof Status (`proof_status`)

3. **Important Dates Section (Entire Section):**
   - ❌ Remove: Deposit Date (`deposit_date`)
   - ❌ Remove: Second Payment Date (`second_payment_date`)
   - ❌ Remove: Due Date (`due_date`)
   - ❌ Remove: Installation Date (`installation_date`)

4. **Additional Information Section (Partial):**
   - ❌ Remove: Progress (`progress`)
   - ❌ Remove: Assigned To (`assigned_to`)
   - ❌ Remove: Priority (`priority`)
   - ❌ Remove: Timeline Weeks (`timeline_weeks`)
   - ✅ Keep: Location (`location`) - Move to Deceased & Location section
   - ✅ Keep: Value (`value`) - Move to Product Snapshot Fields section
   - ✅ Keep: Notes (`notes`) - Keep in Notes section

### 2.2. New Simplified Form Sections

**New Form Structure:**

1. **Order Type** (Required)
   - Dropdown select: "New Memorial" | "Renovation"
   - Maps to: `order_type`
   - Validation: Required, must be one of enum values

2. **Deceased & Location** (All Required)
   - Deceased Name (text input)
     - Maps to: `customer_name`
     - Validation: Required, min 1 character
   - Location (text input)
     - Maps to: `location`
     - Validation: Required, min 1 character
   - Grave Number (text input)
     - Maps to: `sku`
     - Validation: Required, min 1 character
     - Placeholder: "e.g., Plot 123, Section A"

3. **Product Selection** (Optional)
   - Select Product (dropdown)
     - Shows: Product Name (from `memorials.name` or `memorials.memorial_type` fallback)
     - Maps to: UI-only field `productId` (not saved to DB)
     - On selection: Triggers snapshot logic
     - Placeholder: "Select a product (optional)"

4. **Product Snapshot Fields** (All Editable)
   - Stone Type (text input)
     - Maps to: `material`
     - Default: From selected Product
     - Editable: Yes
     - Placeholder: "e.g., Black Granite"
   - Stone Color (text input)
     - Maps to: `color`
     - Default: From selected Product
     - Editable: Yes
     - Placeholder: "e.g., Jet Black"
   - Dimensions (text input)
     - Maps to: `notes` (with prefix "Dimensions: ")
     - Default: From selected Product
     - Editable: Yes
     - Placeholder: "e.g., 24x18x4"
   - Price (number input)
     - Maps to: `value`
     - Default: From selected Product
     - Editable: Yes
     - Type: number, step 0.01, min 0
     - Placeholder: "0.00"

5. **Notes** (Optional)
   - Notes (textarea)
     - Maps to: `notes` (appended after dimensions if present)
     - Editable: Yes
     - Placeholder: "Additional notes about this order..."
     - Rows: 4

### 2.3. Required/Optional Field Handling

**Required Fields:**
- Order Type (`order_type`)
- Deceased Name (`customer_name`)
- Location (`location`)
- Grave Number (`sku`)

**Optional Fields:**
- Product Selection (`productId` - UI-only)
- Stone Type (`material`)
- Stone Color (`color`)
- Dimensions (stored in `notes`)
- Price (`value`)
- Notes (`notes`)

**Validation:**
- Required fields must have non-empty values
- Optional fields can be empty/null
- Price must be >= 0 if provided
- Dimensions and Notes are combined in `notes` field with prefix

---

## 3. Product Selection Behavior

### 3.1. How Products are Fetched

**Implementation:**
- Import `useMemorialsList` from `@/modules/memorials/hooks/useMemorials`
- Use hook in component: `const { data: products, isLoading: productsLoading } = useMemorialsList()`
- Transform products using `transformMemorialsFromDb` from `@/modules/memorials/utils/memorialTransform`
- Filter/display products in dropdown

**Product Display Logic:**
```typescript
// Get product display name
const getProductDisplayName = (product: UIMemorial): string => {
  return product.name || product.memorialType || `Product ${product.id.substring(0, 8)}`;
};
```

**Dropdown Options:**
- Show: Product Name (prefer `name`, fallback to `memorialType`)
- Value: Product ID (`product.id`)
- Include empty option: "Select a product (optional)"

### 3.2. Snapshot Logic on Selection

**When Product is Selected:**

1. **Get Selected Product:**
   ```typescript
   const selectedProduct = products?.find(p => p.id === productId);
   ```

2. **Snapshot Fields:**
   - `material` ← `selectedProduct.material || ''`
   - `color` ← `selectedProduct.color || ''`
   - `dimensions` ← `selectedProduct.dimensions || ''` (stored separately in form state)
   - `value` ← `selectedProduct.price || null`

3. **Update Form Values:**
   ```typescript
   form.setValue('material', selectedProduct.material || '');
   form.setValue('color', selectedProduct.color || '');
   form.setValue('value', selectedProduct.price ?? null);
   // Dimensions stored in separate state, combined with notes on submit
   ```

4. **Handle Dimensions:**
   - Store dimensions in component state (separate from notes)
   - On submit, combine with notes: `"Dimensions: {dimensions}\n\n{notes}"`

### 3.3. Editable Snapshot Fields

**Behavior:**
- All snapshot fields are editable after selection
- User can modify Stone Type, Stone Color, Dimensions, Price
- Changing Product selection updates snapshot fields (overwrites user edits)
- Clearing Product selection keeps current field values (does not clear)

**Implementation:**
- Use controlled inputs with `form.setValue()` for snapshot
- Allow user to edit after snapshot
- On Product change, re-snapshot (overwrite current values)

---

## 4. Data Handling

### 4.1. How Snapshot Values are Written

**Form Submission Flow:**

1. **Get Form Data:**
   ```typescript
   const formData = form.getValues();
   ```

2. **Handle Dimensions:**
   ```typescript
   let notesValue = '';
   if (dimensions) {
     notesValue = `Dimensions: ${dimensions}`;
   }
   if (formData.notes) {
     notesValue = notesValue ? `${notesValue}\n\n${formData.notes}` : formData.notes;
   }
   ```

3. **Build Order Payload:**
   ```typescript
   const orderData = {
     // Required fields
     customer_name: formData.customer_name.trim(),
     location: formData.location.trim(),
     sku: formData.sku.trim(), // Grave Number
     order_type: formData.order_type, // "New Memorial" | "Renovation"
     
     // Snapshot fields (editable)
     material: formData.material || null,
     color: formData.color || null,
     value: formData.value ?? null,
     notes: notesValue || null,
     
     // Removed fields (set to defaults)
     customer_email: null,
     customer_phone: null,
     stone_status: 'NA',
     permit_status: 'pending',
     proof_status: 'Not_Received',
     deposit_date: null,
     second_payment_date: null,
     due_date: null,
     installation_date: null,
     progress: 0,
     assigned_to: null,
     priority: 'medium',
     timeline_weeks: 12,
     
     // Invoice ID (from props)
     invoice_id: invoiceId || null,
   };
   ```

### 4.2. Dimensions Storage Strategy

**Recommended: Store in `notes` with Prefix**

**Format:**
```
Dimensions: 24x18x4

[Additional notes here if provided]
```

**Implementation:**
```typescript
// Component state for dimensions (separate from notes)
const [dimensions, setDimensions] = useState<string>('');

// On submit, combine dimensions and notes
const buildNotes = (dimensions: string, notes: string): string | null => {
  const parts: string[] = [];
  
  if (dimensions?.trim()) {
    parts.push(`Dimensions: ${dimensions.trim()}`);
  }
  
  if (notes?.trim()) {
    parts.push(notes.trim());
  }
  
  return parts.length > 0 ? parts.join('\n\n') : null;
};
```

**Parsing on Edit (if needed later):**
```typescript
// Extract dimensions from notes (for edit form)
const parseDimensions = (notes: string | null): string => {
  if (!notes) return '';
  const match = notes.match(/^Dimensions:\s*(.+?)(?:\n\n|$)/);
  return match ? match[1].trim() : '';
};

// Extract notes without dimensions
const parseNotes = (notes: string | null): string => {
  if (!notes) return '';
  return notes.replace(/^Dimensions:\s*.+?\n\n?/s, '').trim();
};
```

**Note:** For this implementation, parsing is not needed since we're only creating orders. If edit form is updated later, parsing logic can be added.

---

## 5. Backward Compatibility Checks

### 5.1. Ensure Existing Orders Remain Valid

**Database Schema:**
- ✅ No schema changes - all existing columns remain
- ✅ All existing Orders have valid data in all columns
- ✅ New Orders set removed fields to defaults/null (valid values)

**Data Integrity:**
- ✅ Required fields (`customer_name`, `order_type`) are always provided
- ✅ Default values match existing schema constraints
- ✅ Null values are allowed for optional fields (as per schema)

**Validation:**
- ✅ Form schema includes all existing fields (for backward compatibility)
- ✅ Submission sets all fields (required + defaults for removed fields)
- ✅ No database constraint violations

### 5.2. Ensure Other Modules are Unaffected

**Orders Module:**
- ✅ Only `CreateOrderDrawer` component is modified
- ✅ `EditOrderDrawer` is NOT modified (unless strictly required)
- ✅ Order types, API, hooks remain unchanged
- ✅ Order list/display components unaffected

**Other Modules:**
- ✅ Jobs module: No changes
- ✅ Payments module: No changes
- ✅ Reporting module: No changes
- ✅ Inbox module: No changes
- ✅ Notifications module: No changes
- ✅ Team Chat module: No changes
- ✅ Invoicing module: No changes (except Order creation launch point)

**Products Module (Memorials):**
- ✅ Read-only access (no changes to Products)
- ✅ Uses existing `useMemorialsList()` hook
- ✅ No changes to Products table or API

---

## Implementation Phases

### Phase 1: Update Form Schema

**File:** `src/modules/orders/schemas/order.schema.ts`

**Changes:**
1. Change `order_type` from `z.string()` to `z.enum(['New Memorial', 'Renovation'])`
2. Add optional `productId` field: `z.string().optional()` (UI-only, not saved)
3. Add optional `dimensions` field: `z.string().optional()` (UI-only, combined with notes on submit)
4. Keep all existing fields for backward compatibility
5. All removed fields remain in schema with defaults (for submission)

**Validation:**
- `order_type`: Required, must be "New Memorial" or "Renovation"
- `customer_name`: Required, min 1 character
- `location`: Required, min 1 character
- `sku`: Required, min 1 character
- `productId`: Optional (UI-only)
- `dimensions`: Optional (UI-only)
- All other fields: Optional with defaults

### Phase 2: Update CreateOrderDrawer Component

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**

1. **Add Imports:**
   ```typescript
   import { useMemorialsList } from '@/modules/memorials/hooks/useMemorials';
   import { transformMemorialsFromDb } from '@/modules/memorials/utils/memorialTransform';
   import type { UIMemorial } from '@/modules/memorials/utils/memorialTransform';
   ```

2. **Add Component State:**
   ```typescript
   const [selectedProductId, setSelectedProductId] = useState<string>('');
   const [dimensions, setDimensions] = useState<string>('');
   ```

3. **Fetch Products:**
   ```typescript
   const { data: memorialsData } = useMemorialsList();
   const products = useMemo(() => {
     if (!memorialsData) return [];
     return transformMemorialsFromDb(memorialsData);
   }, [memorialsData]);
   ```

4. **Remove Legacy Form Sections:**
   - Remove Person email/phone fields
   - Remove Status section (entire section)
   - Remove Important Dates section (entire section)
   - Remove Project Management fields (Progress, Assigned To, Priority, Timeline)

5. **Add New Form Sections:**
   - Order Type dropdown (enum)
   - Deceased & Location section (3 required fields)
   - Product Selection dropdown
   - Product Snapshot Fields section (4 editable fields)
   - Notes field (keep existing)

6. **Implement Product Selection Handler:**
   ```typescript
   const handleProductSelect = (productId: string) => {
     setSelectedProductId(productId);
     const product = products.find(p => p.id === productId);
     if (product) {
       form.setValue('material', product.material || '');
       form.setValue('color', product.color || '');
       form.setValue('value', product.price ?? null);
       setDimensions(product.dimensions || '');
     }
   };
   ```

7. **Update Form Submission:**
   ```typescript
   const onSubmit = (data: OrderFormData) => {
     // Build notes with dimensions prefix
     const notesValue = buildNotes(dimensions, data.notes || '');
     
     const orderData = {
       // Required fields
       customer_name: data.customer_name.trim(),
       location: data.location.trim(),
       sku: data.sku.trim(),
       order_type: data.order_type,
       
       // Snapshot fields
       material: data.material || null,
       color: data.color || null,
       value: data.value ?? null,
       notes: notesValue,
       
       // Removed fields (set to defaults)
       customer_email: null,
       customer_phone: null,
       stone_status: 'NA',
       permit_status: 'pending',
       proof_status: 'Not_Received',
       deposit_date: null,
       second_payment_date: null,
       due_date: null,
       installation_date: null,
       progress: 0,
       assigned_to: null,
       priority: 'medium',
       timeline_weeks: 12,
       
       invoice_id: invoiceId || null,
     };
     
     createOrder(orderData, { /* ... */ });
   };
   ```

8. **Update Default Values:**
   ```typescript
   defaultValues: {
     customer_name: '',
     order_type: '', // Will be enum dropdown
     sku: '',
     location: '',
     material: '',
     color: '',
     value: null,
     notes: '',
     // Keep all other fields for schema compatibility
     customer_email: '',
     customer_phone: '',
     stone_status: 'NA',
     permit_status: 'pending',
     proof_status: 'Not_Received',
     deposit_date: null,
     second_payment_date: null,
     due_date: null,
     installation_date: null,
     progress: 0,
     assigned_to: '',
     priority: 'medium',
     timeline_weeks: 12,
   },
   ```

### Phase 3: Helper Functions

**Add to CreateOrderDrawer component:**

```typescript
// Build notes with dimensions prefix
const buildNotes = (dimensions: string, notes: string): string | null => {
  const parts: string[] = [];
  
  if (dimensions?.trim()) {
    parts.push(`Dimensions: ${dimensions.trim()}`);
  }
  
  if (notes?.trim()) {
    parts.push(notes.trim());
  }
  
  return parts.length > 0 ? parts.join('\n\n') : null;
};

// Get product display name
const getProductDisplayName = (product: UIMemorial): string => {
  return product.name || product.memorialType || `Product ${product.id.substring(0, 8)}`;
};
```

---

## Verification Checklist

After implementation, verify:

- [ ] Order creation form shows only simplified fields
- [ ] Order Type is enum dropdown: "New Memorial" | "Renovation"
- [ ] Deceased Name, Location, Grave Number are required and validated
- [ ] Product selection dropdown works and shows Product names
- [ ] Product selection snapshots material, color, dimensions, price correctly
- [ ] Snapshot fields are editable after selection
- [ ] Price defaults from Product and is editable
- [ ] Dimensions are stored correctly in notes with prefix
- [ ] Orders can be created successfully under an Invoice
- [ ] Existing Orders remain unaffected (no errors)
- [ ] Removed fields are set to defaults/null on submission
- [ ] No TypeScript compilation errors
- [ ] No runtime errors in browser console
- [ ] Form validation works correctly
- [ ] Other modules are unaffected

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/orders/schemas/order.schema.ts` | Update `order_type` to enum, add `productId` and `dimensions` (UI-only) | ~5 lines modified, ~2 lines added |
| `src/modules/orders/components/CreateOrderDrawer.tsx` | Remove legacy sections, add new sections, implement Product selection | ~200 lines modified/removed, ~150 lines added |

**Total Estimated Changes:** ~350 lines across 2 files

---

## Success Criteria

- ✅ Order creation form shows only simplified fields (9 fields vs 20+)
- ✅ Order Type is enum dropdown: "New Memorial" | "Renovation"
- ✅ Deceased Name, Location, Grave Number are required fields
- ✅ Product selection dropdown works and shows Product names
- ✅ Product selection snapshots material, color, dimensions, price correctly
- ✅ Snapshot fields are editable after selection
- ✅ Price defaults from Product and is editable
- ✅ Dimensions are stored correctly in notes with prefix
- ✅ Orders can be created successfully under an Invoice
- ✅ Existing Orders remain unaffected
- ✅ Removed fields are set to defaults/null on submission
- ✅ No TypeScript or runtime errors
- ✅ Form validation works correctly
- ✅ Backward compatibility maintained

---

## Notes

1. **Product Selection:**
   - Product selection is UI-only (no `product_id` column)
   - Snapshot occurs only at Order creation time
   - Later Product changes do NOT affect existing Orders
   - Works for both "New Memorial" and "Renovation" order types

2. **Dimensions Storage:**
   - Stored in `notes` with prefix "Dimensions: "
   - Format: "Dimensions: 24x18x4\n\n[other notes]"
   - Parsing not needed for create form (only for edit if updated later)

3. **Field Defaults:**
   - Removed fields are set to defaults/null on submission
   - All defaults match existing schema constraints
   - No database constraint violations

4. **Backward Compatibility:**
   - All existing Orders remain valid
   - Schema unchanged
   - Other modules unaffected
   - Only CreateOrderDrawer component modified

