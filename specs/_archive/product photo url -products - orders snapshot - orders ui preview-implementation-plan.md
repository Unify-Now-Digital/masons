# Implementation Plan: Product Photo URL (Products + Orders Snapshot + Orders UI Preview)

## Feature Overview

Add support for a single optional product photo URL, editable in the Products module, and reliably displayable in the Orders module (table thumbnail + order sidebar preview). Orders store a snapshot of the product photo at creation/update time to maintain historical stability.

**Branch:** `feature/product-photo-url`  
**Spec File:** `specs/product photo url -products - orders snapshot - orders ui preview.md`

---

## Technical Context

### Current State
- Products (memorials) table exists with fields: `id`, `name`, `price`, `material`, `color`, `dimensions`, etc.
- Products are selected when creating New Memorial orders
- Orders snapshot product values (`material`, `color`, `value`) when product is selected
- Orders do NOT store a `product_id` foreign key - they store snapshot values only
- Orders table is displayed in `SortableOrdersTable.tsx`
- Order details are displayed in `OrderDetailsSidebar.tsx`
- Orders have `order_type` field: 'New Memorial' or 'Renovation'
- Renovation orders do not use products (they use `renovation_service_cost` instead)

### Key Files
- `supabase/migrations/20250608000001_create_orders_table.sql` - Orders table schema
- `src/modules/memorials/hooks/useMemorials.ts` - Product (Memorial) hooks and API functions
- `src/modules/memorials/types/memorials.types.ts` - Product TypeScript types (if exists, otherwise in hooks file)
- `src/modules/memorials/utils/memorialTransform.ts` - Product UI transformation
- `src/modules/memorials/schemas/memorial.schema.ts` - Product Zod schema
- `src/modules/memorials/components/CreateMemorialDrawer.tsx` - Product creation UI
- `src/modules/memorials/components/EditMemorialDrawer.tsx` - Product editing UI
- `src/modules/orders/api/orders.api.ts` - Order API functions
- `src/modules/orders/types/orders.types.ts` - Order TypeScript types
- `src/modules/orders/utils/orderTransform.ts` - Order UI transformation
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Order creation UI (product selection + snapshot)
- `src/modules/orders/components/EditOrderDrawer.tsx` - Order editing UI (product selection + snapshot)
- `src/modules/orders/components/SortableOrdersTable.tsx` - Orders table display
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Order details view
- `src/modules/orders/components/orderColumnDefinitions.tsx` - Orders table column definitions
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Invoice creation with inline order creation
- `src/modules/invoicing/components/OrderFormInline.tsx` - Inline order form in invoice creation
- `src/modules/orders/schemas/order.schema.ts` - Order form validation schema

### Constraints
- **CRITICAL: Snapshot Pattern Only** - Orders MUST snapshot product photo URL at creation/update time, NEVER query products dynamically
- **Additive-only migrations** - Only adding two nullable columns, no destructive changes
- **Defensive null handling** - Handle null photo URLs throughout codebase
- **Renovation orders unaffected** - `product_photo_url` field ignored for Renovation order types
- **No impact on totals** - No changes to invoice totals, order totals, map logic, reporting, or additional options
- **No N+1 queries** - Photos stored directly on orders (no joins required)
- **Broken image URLs** - Must handle gracefully (onError fallback, no crashes)
- **Historical stability** - Product photo changes must NOT affect existing orders (snapshot preserved)

### Snapshot Pattern (Critical)
- When creating a New Memorial order and selecting a product:
  - Copy `product.photo_url` → `order.product_photo_url` in the order payload
- When editing a New Memorial order and changing the product:
  - Update `order.product_photo_url` snapshot to the new product's `photo_url` (or null if no product)
- When creating/editing a Renovation order:
  - Always set `product_photo_url` to `null` (or omit from payload)
- Orders MUST NEVER query products dynamically for photos (maintain snapshot pattern)

---

## Implementation Phases

### Phase 1: Database Migration

**Goal:** Add nullable `photo_url` column to products and `product_photo_url` column to orders.

#### Task 1.1: Create Migration to Add Photo URL Columns
**File:** `supabase/migrations/YYYYMMDDHHmmss_add_product_photo_urls.sql`

**Implementation:**
```sql
-- Add photo_url to products (memorials) table
alter table public.memorials
  add column if not exists photo_url text null;

comment on column public.memorials.photo_url is 
  'Optional URL to a product photo/image. Used for visual reference in product catalog and order creation.';

-- Add product_photo_url to orders table
alter table public.orders
  add column if not exists product_photo_url text null;

comment on column public.orders.product_photo_url is 
  'Snapshot of the product photo URL at the time of order creation/update. Only used for New Memorial order types. Preserves historical product appearance even if product photo changes.';

-- Recreate orders_with_options_total view to include product_photo_url
-- The view uses o.* which should include new columns, but recreating ensures compatibility
drop view if exists public.orders_with_options_total;

create view public.orders_with_options_total as
select
  o.*,
  coalesce(sum(ao.cost), 0)::numeric as additional_options_total
from public.orders o
left join public.order_additional_options ao
  on ao.order_id = o.id
group by o.id;

comment on view public.orders_with_options_total is
  'View of orders with pre-calculated additional_options_total to avoid N+1 queries. Includes all order columns including product_photo_url and renovation fields.';
```

**Validation:**
- Migration runs without errors
- Existing products/orders remain valid (photo URLs default to null)
- Columns are nullable (no data migration required)
- View is recreated and includes new `product_photo_url` column

**Acceptance Criteria:**
- ✅ `memorials.photo_url` exists, nullable
- ✅ `orders.product_photo_url` exists, nullable
- ✅ `orders_with_options_total` view includes `product_photo_url`
- ✅ Existing data remains valid

---

### Phase 2: Types & Schemas

**Goal:** Update TypeScript types and Zod schemas to accept nullable photo URLs.

#### Task 2.1: Update Product (Memorial) TypeScript Interface
**File:** `src/modules/memorials/hooks/useMemorials.ts` (or separate types file if exists)

**Implementation:**
- Update `Memorial` interface: `photo_url: string | null` (add to existing interface)
- Update `MemorialInsert` type: `photo_url: string | null` (add to insert type)
- Update `MemorialUpdate` type: `photo_url?: string | null` (add to update type)

**Validation:**
- TypeScript compilation passes
- No type errors in existing code

**Acceptance Criteria:**
- ✅ `Memorial.photo_url` is `string | null`
- ✅ `MemorialInsert.photo_url` is `string | null`
- ✅ `MemorialUpdate.photo_url` is `string | null | undefined`

#### Task 2.2: Update Product (Memorial) Zod Schema
**File:** `src/modules/memorials/schemas/memorial.schema.ts`

**Implementation:**
- Update `memorialFormSchema`:
  ```typescript
  photoUrl: z.string().url('Photo URL must be a valid URL').optional().nullable(),
  ```
  (Use `.url()` for basic URL validation, but allow empty/null)

**Validation:**
- Form validation accepts null/undefined/valid URL strings
- Form validation rejects invalid URLs
- Form validation accepts empty string (normalized to null)

**Acceptance Criteria:**
- ✅ Schema accepts `null`, `undefined`, or valid URL string for `photoUrl`
- ✅ Schema rejects invalid URLs (if provided)

#### Task 2.3: Update Product (Memorial) Transform Utilities
**File:** `src/modules/memorials/utils/memorialTransform.ts`

**Implementation:**
- Update `UIMemorial` interface: `photoUrl: string | null` (add to existing interface)
- Update `transformMemorialFromDb`: Handle null `photo_url` → `photoUrl: string | null`
- Update `toMemorialInsert`: Normalize empty string to null: `photo_url: normalizeOptional(form.photoUrl)`
- Update `toMemorialUpdate`: Normalize empty string to null: `photo_url: normalizeOptional(form.photoUrl)`

**Validation:**
- Transform handles null values correctly
- Normalization converts empty strings to null
- No runtime errors with null values

**Acceptance Criteria:**
- ✅ Transform preserves null `photo_url` as null `photoUrl`
- ✅ Transform handles undefined/missing `photoUrl` as null
- ✅ Normalization converts empty strings to null
- ✅ No crashes with null values

#### Task 2.4: Update Order TypeScript Interface
**File:** `src/modules/orders/types/orders.types.ts`

**Implementation:**
- Update `Order` interface: `product_photo_url: string | null` (add to existing interface)
- Update `OrderInsert` type: `product_photo_url: string | null` (add to insert type)
- Update `OrderUpdate` type: `product_photo_url?: string | null` (add to update type)

**Validation:**
- TypeScript compilation passes
- No type errors in existing code

**Acceptance Criteria:**
- ✅ `Order.product_photo_url` is `string | null`
- ✅ `OrderInsert.product_photo_url` is `string | null`
- ✅ `OrderUpdate.product_photo_url` is `string | null | undefined`

#### Task 2.5: Update Order Zod Schema
**File:** `src/modules/orders/schemas/order.schema.ts`

**Implementation:**
- Update `orderFormSchema`:
  ```typescript
  productPhotoUrl: z.string().url('Product photo URL must be a valid URL').optional().nullable(),
  ```
  (Note: This field will be populated automatically from product selection, not user input directly)

**Validation:**
- Schema accepts null/undefined/valid URL strings
- Schema validation works correctly

**Acceptance Criteria:**
- ✅ Schema accepts `null`, `undefined`, or valid URL string for `productPhotoUrl`

#### Task 2.6: Update Order Transform Utilities
**File:** `src/modules/orders/utils/orderTransform.ts`

**Implementation:**
- Update `UIOrder` interface: `productPhotoUrl: string | null` (add to existing interface, optional for backward compatibility)
- Update `transformOrderForUI`: Handle null `product_photo_url` → `productPhotoUrl: string | null`

**Validation:**
- Transform handles null values correctly
- No runtime errors with null values

**Acceptance Criteria:**
- ✅ Transform preserves null `product_photo_url` as null `productPhotoUrl`
- ✅ Transform handles undefined/missing `product_photo_url` as null

---

### Phase 3: Products Module UI

**Goal:** Add photo URL input and preview to product create/edit forms.

#### Task 3.1: Update `CreateMemorialDrawer`
**File:** `src/modules/memorials/components/CreateMemorialDrawer.tsx`

**Implementation:**
- Add "Photo URL" field to form:
  ```tsx
  <FormField
    control={form.control}
    name="photoUrl"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Photo URL (optional)</FormLabel>
        <FormControl>
          <Input
            type="url"
            placeholder="https://example.com/image.jpg"
            {...field}
            value={field.value || ''}
            onChange={(e) => field.onChange(e.target.value || null)}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
  ```

- Add live image preview:
  ```tsx
  {form.watch('photoUrl') && (
    <div className="space-y-2">
      <img
        src={form.watch('photoUrl') || ''}
        alt="Product preview"
        className="w-full max-w-md h-48 object-contain border rounded"
        onError={(e) => {
          // Fallback to placeholder on error
          e.currentTarget.style.display = 'none';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => form.setValue('photoUrl', null)}
      >
        Remove Photo
      </Button>
    </div>
  )}
  ```

- Update form default values: `photoUrl: null`
- Update form reset: `photoUrl: null`

**Validation:**
- Form accepts photo URL input
- Image preview shows when URL exists
- "Remove Photo" button clears URL (sets to null)
- Broken image URLs handled gracefully (onError fallback)

**Acceptance Criteria:**
- ✅ Photo URL input appears in create form
- ✅ Image preview shows when URL is provided
- ✅ "Remove Photo" button works correctly
- ✅ Broken image URLs don't crash (onError handler)

#### Task 3.2: Update `EditMemorialDrawer`
**File:** `src/modules/memorials/components/EditMemorialDrawer.tsx`

**Implementation:**
- Add same "Photo URL" field as in create form
- Prefill with current `memorial.photo_url ?? null`
- Add same live image preview and "Remove Photo" button
- Update form default values to use `memorial.photo_url ?? null`
- Update form reset to use `memorial.photo_url ?? null`

**Validation:**
- Form pre-fills with current photo URL
- Image preview shows existing photo
- Editing and clearing photo works correctly

**Acceptance Criteria:**
- ✅ Photo URL input appears in edit form (prefilled)
- ✅ Image preview shows existing photo
- ✅ Editing and clearing photo works correctly

---

### Phase 4: Orders Module Logic (Snapshot)

**Goal:** Implement snapshot logic to copy product photo URL to orders when product is selected.

#### Task 4.1: Update `CreateOrderDrawer` - Product Selection Handler
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Implementation:**
- Update `handleProductSelect` function:
  ```typescript
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    if (orderType === 'New Memorial' && products.length > 0) {
      const product = products.find(p => p.id === productId);
      if (product) {
        form.setValue('material', product.material || '');
        form.setValue('color', product.color || '');
        form.setValue('value', product.price ?? null);
        form.setValue('productPhotoUrl', product.photoUrl ?? null); // NEW: Snapshot photo URL
        setDimensions(product.dimensions || '');
      }
    }
  };
  ```

- Update form default values: `productPhotoUrl: null`
- Update `orderData` payload in `onSubmit`:
  ```typescript
  const orderData = {
    // ... existing fields
    product_photo_url: data.order_type === 'Renovation' 
      ? null // Renovation orders don't have product photos
      : (data.productPhotoUrl ?? null), // Snapshot photo URL for New Memorial orders
    // ... other fields
  };
  ```

**Validation:**
- Product selection copies photo URL to form field
- Order creation saves photo URL snapshot
- Renovation orders set photo URL to null

**Acceptance Criteria:**
- ✅ Product selection copies `product.photoUrl` → `order.product_photo_url`
- ✅ Order creation saves photo URL snapshot
- ✅ Renovation orders ignore photo URL (set to null)

#### Task 4.2: Update `CreateOrderDrawer` - Product Clearing
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Implementation:**
- Update order_type change handler to clear photo URL when switching to Renovation:
  ```typescript
  useEffect(() => {
    if (orderType === 'Renovation') {
      // Clear product selection and photo URL
      setSelectedProductId('');
      setDimensions('');
      form.setValue('material', '');
      form.setValue('color', '');
      form.setValue('value', null);
      form.setValue('productPhotoUrl', null); // NEW: Clear photo URL
    } else if (orderType === 'New Memorial') {
      // Clear renovation fields
      form.setValue('renovation_service_description', null);
      form.setValue('renovation_service_cost', null);
    }
  }, [orderType, form]);
  ```

- When product is cleared (setSelectedProductId('')):
  ```typescript
  // Clear photo URL when product is cleared
  form.setValue('productPhotoUrl', null);
  ```

**Validation:**
- Switching to Renovation clears photo URL
- Clearing product selection clears photo URL

**Acceptance Criteria:**
- ✅ Switching to Renovation clears photo URL
- ✅ Clearing product selection clears photo URL

#### Task 4.3: Update `EditOrderDrawer` - Product Selection Handler
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Implementation:**
- Update `handleProductSelect` function (similar to CreateOrderDrawer):
  ```typescript
  const handleProductSelect = (productId: string) => {
    // Defensive guard: only process if orderType is New Memorial
    const currentOrderType = form.watch('order_type') || order.order_type;
    if (currentOrderType !== 'New Memorial' || !products || products.length === 0) {
      setSelectedProductId('');
      form.setValue('productPhotoUrl', null); // Clear photo URL if not New Memorial
      return;
    }
    
    setSelectedProductId(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue('material', product.material || '');
      form.setValue('color', product.color || '');
      form.setValue('value', product.price ?? null);
      form.setValue('productPhotoUrl', product.photoUrl ?? null); // NEW: Snapshot photo URL
      setDimensions(product.dimensions || '');
    }
  };
  ```

- Update `orderData` payload in `onSubmit`:
  ```typescript
  const orderData = {
    // ... existing fields
    product_photo_url: data.order_type === 'Renovation' 
      ? null // Renovation orders don't have product photos
      : (data.productPhotoUrl ?? null), // Snapshot photo URL for New Memorial orders
    // ... other fields
  };
  ```

- Update form default values to include current `order.product_photo_url ?? null`
- Update form reset to include `order.product_photo_url ?? null`
- Update order_type change handler to clear photo URL when switching to Renovation

**Validation:**
- Product selection in edit copies photo URL to form field
- Order update saves photo URL snapshot
- Switching order type clears photo URL appropriately

**Acceptance Criteria:**
- ✅ Product selection in edit copies photo URL
- ✅ Order update saves photo URL snapshot
- ✅ Type switching clears photo URL correctly

#### Task 4.4: Update Inline Order Creation (CreateInvoiceDrawer)
**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Implementation:**
- Update `OrderFormInline` component usage to handle `productPhotoUrl`
- In `onSubmit` where orders are created, ensure `product_photo_url` is included:
  ```typescript
  const orderData = {
    // ... existing fields
    product_photo_url: order.data.order_type === 'Renovation' 
      ? null 
      : (order.data.productPhotoUrl ?? null),
    // ... other fields
  };
  ```

**File:** `src/modules/invoicing/components/OrderFormInline.tsx`

**Implementation:**
- Add `productPhotoUrl` to form schema (should be auto-populated, not user input)
- Update `handleProductSelect` to snapshot photo URL:
  ```typescript
  const handleProductSelect = (productId: string) => {
    // ... existing logic
    if (product) {
      form.setValue('material', product.material || '');
      form.setValue('color', product.color || '');
      form.setValue('value', product.price ?? null);
      form.setValue('productPhotoUrl', product.photoUrl ?? null); // NEW: Snapshot photo URL
      onDimensionsChange(product.dimensions || '');
    }
  };
  ```

- Update form default values: `productPhotoUrl: order.data.product_photo_url ?? null`
- Update order_type change handler to clear photo URL when switching types

**Validation:**
- Inline order creation snapshots photo URL correctly
- Inline order creation saves photo URL in order payload

**Acceptance Criteria:**
- ✅ Inline order creation snapshots photo URL
- ✅ Inline order creation saves photo URL correctly

---

### Phase 5: Orders Module UI

**Goal:** Display product photos in Orders table and OrderDetailsSidebar.

#### Task 5.1: Add Photo Column to Orders Table
**File:** `src/modules/orders/components/orderColumnDefinitions.tsx`

**Implementation:**
- Add new column definition:
  ```typescript
  {
    id: 'photo',
    label: 'Photo',
    defaultWidth: 60,
    sortable: false,
    renderHeader: () => (
      <div className="flex items-center gap-2">
        <span className="font-medium">Photo</span>
      </div>
    ),
    renderCell: (order) => (
      <TableCell>
        {order.order_type === 'New Memorial' && order.productPhotoUrl ? (
          <img
            src={order.productPhotoUrl}
            alt="Product"
            className="w-10 h-10 object-cover rounded border"
            onError={(e) => {
              // Fallback to placeholder on error
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.appendChild(document.createTextNode('—'));
            }}
          />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
    ),
  },
  ```

- Add column to `orderColumnDefinitions` array
- Update `UIOrder` interface in `orderTransform.ts` to include `productPhotoUrl: string | null`
- Update `transformOrderForUI` to include `productPhotoUrl: order.product_photo_url ?? null`

**Validation:**
- Photo column appears in Orders table
- Thumbnails display for New Memorial orders with photos
- Placeholder displays for Renovation orders or missing photos
- Broken image URLs handled gracefully

**Acceptance Criteria:**
- ✅ Photo column appears in Orders table
- ✅ Thumbnails (40px × 40px) display correctly
- ✅ Placeholder shows when photo missing
- ✅ Broken images don't crash

#### Task 5.2: Add Photo Preview to OrderDetailsSidebar
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Implementation:**
- Add photo preview section (only for New Memorial orders with photo):
  ```tsx
  {currentOrder.order_type === 'New Memorial' && currentOrder.product_photo_url && (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Product Photo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <img
            src={currentOrder.product_photo_url}
            alt="Product photo"
            className="max-w-full max-h-[300px] object-contain rounded border"
            onError={(e) => {
              // Fallback to placeholder on error
              e.currentTarget.style.display = 'none';
              const placeholder = document.createElement('div');
              placeholder.className = 'text-center text-muted-foreground py-8';
              placeholder.textContent = 'Photo unavailable';
              e.currentTarget.parentElement?.appendChild(placeholder);
            }}
          />
        </div>
      </CardContent>
    </Card>
  )}
  ```

- Add import for Card components if not already imported
- Place photo section after "Order Information" card, before "Important Dates" card

**Validation:**
- Photo preview appears for New Memorial orders with photos
- Photo preview hidden for Renovation orders
- Photo preview hidden when photo URL is null
- Broken image URLs handled gracefully (onError fallback)

**Acceptance Criteria:**
- ✅ Photo preview appears for New Memorial orders with photos
- ✅ Photo preview hidden for Renovation orders
- ✅ Larger preview (max 300px width) displays correctly
- ✅ Broken images don't crash (onError handler)

---

### Phase 6: QA & Validation

**Goal:** Verify all acceptance criteria are met.

#### Task 6.1: Functional Testing
**Test Cases:**
1. **Create product with photo URL:**
   - Open create product drawer
   - Enter photo URL
   - Verify image preview shows
   - Submit form
   - Verify product is created with `photo_url` set

2. **Edit product photo URL:**
   - Open edit product drawer for product with photo
   - Verify photo URL is prefilled
   - Change photo URL
   - Verify preview updates
   - Submit form
   - Verify product is updated

3. **Clear product photo URL:**
   - Open edit product drawer
   - Click "Remove Photo" button
   - Submit form
   - Verify product `photo_url` is set to null

4. **Create New Memorial order with product photo:**
   - Create New Memorial order
   - Select product with photo URL
   - Verify order snapshot includes `product_photo_url`
   - Submit order
   - Verify order is created with `product_photo_url` snapshot

5. **Create New Memorial order without product photo:**
   - Create New Memorial order
   - Select product without photo URL (or no product)
   - Submit order
   - Verify order `product_photo_url` is null

6. **Edit order and change product:**
   - Edit existing New Memorial order
   - Change to different product with photo
   - Verify `product_photo_url` updates to new product's photo
   - Submit order
   - Verify order `product_photo_url` is updated

7. **Switch order type clears photo:**
   - Edit New Memorial order with photo
   - Switch to Renovation
   - Verify `product_photo_url` is cleared
   - Switch back to New Memorial
   - Verify photo URL remains cleared (product not reselected)

8. **Orders table displays photos:**
   - View Orders table
   - Verify "Photo" column appears
   - Verify thumbnails show for New Memorial orders with photos
   - Verify placeholder shows for Renovation orders or missing photos

9. **OrderDetailsSidebar displays photos:**
   - Open order details for New Memorial order with photo
   - Verify photo preview section appears
   - Verify larger preview image displays
   - Open order details for Renovation order
   - Verify photo section is hidden

10. **Broken image URLs:**
    - Create product with invalid/broken image URL
    - Verify product form handles gracefully (onError fallback)
    - Create order with product with broken URL
    - Verify Orders table handles gracefully
    - Verify OrderDetailsSidebar handles gracefully

11. **Renovation orders unaffected:**
    - Create Renovation order
    - Verify `product_photo_url` is null
    - Verify Orders table shows placeholder for photo
    - Verify OrderDetailsSidebar doesn't show photo section

12. **Historical stability:**
    - Create order with product that has photo
    - Edit product to change/remove photo
    - Verify order's `product_photo_url` snapshot remains unchanged
    - Verify order details still show original photo

#### Task 6.2: Build & Lint Checks
**Commands:**
- `npx tsc --noEmit` - Verify TypeScript compilation passes
- `npm run lint` - Verify linting passes
- `npm run build` - Verify production build succeeds

**Validation:**
- No TypeScript errors
- No linting errors
- Build succeeds without warnings

**Acceptance Criteria:**
- ✅ TypeScript compilation passes
- ✅ Linting passes
- ✅ Production build succeeds

#### Task 6.3: Verify No Impact on Existing Features
**Validation:**
- Invoice totals remain unchanged (no code changes to invoice logic)
- Order totals remain unchanged (no code changes to order calculation)
- Map functionality remains unchanged (no code changes to map logic)
- Reporting remains unchanged (no code changes to reporting logic)
- Additional options remain unchanged (no code changes to options logic)

**Acceptance Criteria:**
- ✅ Invoice totals unaffected
- ✅ Order totals unaffected
- ✅ Map functionality unaffected
- ✅ Reporting functionality unaffected
- ✅ Additional options functionality unaffected

---

## Progress Tracking

- [ ] Phase 1: Database Migration
  - [ ] Task 1.1: Create migration to add photo URL columns
- [ ] Phase 2: Types & Schemas
  - [ ] Task 2.1: Update Product TypeScript interface
  - [ ] Task 2.2: Update Product Zod schema
  - [ ] Task 2.3: Update Product transform utilities
  - [ ] Task 2.4: Update Order TypeScript interface
  - [ ] Task 2.5: Update Order Zod schema
  - [ ] Task 2.6: Update Order transform utilities
- [ ] Phase 3: Products Module UI
  - [ ] Task 3.1: Update CreateMemorialDrawer
  - [ ] Task 3.2: Update EditMemorialDrawer
- [ ] Phase 4: Orders Module Logic (Snapshot)
  - [ ] Task 4.1: Update CreateOrderDrawer - Product Selection Handler
  - [ ] Task 4.2: Update CreateOrderDrawer - Product Clearing
  - [ ] Task 4.3: Update EditOrderDrawer - Product Selection Handler
  - [ ] Task 4.4: Update Inline Order Creation (CreateInvoiceDrawer)
- [ ] Phase 5: Orders Module UI
  - [ ] Task 5.1: Add Photo Column to Orders Table
  - [ ] Task 5.2: Add Photo Preview to OrderDetailsSidebar
- [ ] Phase 6: QA & Validation
  - [ ] Task 6.1: Functional testing
  - [ ] Task 6.2: Build & lint checks
  - [ ] Task 6.3: Verify no impact on existing features

---

## Acceptance Criteria Summary

- ✅ `memorials.photo_url` exists, nullable, no constraints
- ✅ `orders.product_photo_url` exists, nullable, no constraints
- ✅ Products can set/update/clear photo URL
- ✅ Orders snapshot product photo reliably at product selection time
- ✅ Orders table shows thumbnails without crashes
- ✅ OrderDetailsSidebar shows correct preview
- ✅ Renovation orders unaffected (product_photo_url ignored)
- ✅ Deleting or editing products does not break historical orders (snapshot preserved)
- ✅ Broken image URLs handled gracefully (no crashes)
- ✅ Build passes; no blank pages; no runtime errors

---

## File-by-File Change List

### Database
- `supabase/migrations/YYYYMMDDHHmmss_add_product_photo_urls.sql` (NEW) - Migration to add photo URL columns

### Products (Memorials) Module
- `src/modules/memorials/hooks/useMemorials.ts` - Update `Memorial` interface to include `photo_url: string | null`
- `src/modules/memorials/schemas/memorial.schema.ts` - Update Zod schema to include `photoUrl: z.string().url().optional().nullable()`
- `src/modules/memorials/utils/memorialTransform.ts` - Update `UIMemorial` interface and transform functions to handle `photoUrl`
- `src/modules/memorials/components/CreateMemorialDrawer.tsx` - Add Photo URL input, preview, and clear button
- `src/modules/memorials/components/EditMemorialDrawer.tsx` - Add Photo URL input, preview, and clear button (prefilled)

### Orders Module
- `src/modules/orders/types/orders.types.ts` - Update `Order` interface to include `product_photo_url: string | null`
- `src/modules/orders/schemas/order.schema.ts` - Update Zod schema to include `productPhotoUrl: z.string().url().optional().nullable()`
- `src/modules/orders/utils/orderTransform.ts` - Update `UIOrder` interface and transform functions to handle `productPhotoUrl`
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Update product selection handler to snapshot photo URL
- `src/modules/orders/components/EditOrderDrawer.tsx` - Update product selection handler to snapshot photo URL
- `src/modules/orders/components/orderColumnDefinitions.tsx` - Add Photo column to Orders table
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Add Photo preview section for New Memorial orders

### Invoicing Module
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Update inline order creation to handle `product_photo_url` in payload
- `src/modules/invoicing/components/OrderFormInline.tsx` - Update product selection handler to snapshot photo URL

---

## Implementation Risks & Mitigation

### Risk 1: Broken Image URLs Causing Crashes
**Mitigation:**
- Use `onError` handlers on all `<img>` tags
- Provide fallback placeholders ("—" or icon)
- Test with invalid URLs during QA

### Risk 2: Snapshot Logic Missing in Some Places
**Mitigation:**
- Review all product selection handlers (CreateOrderDrawer, EditOrderDrawer, OrderFormInline)
- Ensure snapshot happens in all three locations
- Test order creation from all entry points

### Risk 3: Renovation Orders Incorrectly Showing Photos
**Mitigation:**
- Always check `order_type === 'New Memorial'` before displaying photos
- Set `product_photo_url` to `null` explicitly for Renovation orders in payloads
- Test with both order types

### Risk 4: Historical Stability Violated
**Mitigation:**
- Never query products dynamically from orders
- Always use snapshot value (`order.product_photo_url`)
- Test that product photo changes don't affect existing orders

### Risk 5: N+1 Query Problem
**Risk Level:** Low
**Mitigation:**
- Photos stored directly on orders (no joins required)
- No additional queries needed
- Verify with existing query patterns

---

## Follow-up Recommendations

1. **Product Photo in MemorialsPage Table (Optional Enhancement):**
   - Consider adding photo thumbnails to the products table in `MemorialsPage.tsx`
   - This would help users visually identify products when selecting in order creation
   - Can be added in Phase 3 or as a future enhancement

2. **Lazy Loading for Large Tables (Performance Optimization):**
   - If Orders table becomes slow with many photos, consider adding lazy loading
   - Use `loading="lazy"` attribute on `<img>` tags
   - Can be added later if needed

3. **Image Optimization (Future Enhancement):**
   - If external URLs are slow, consider using a CDN or image proxy
   - This is out of scope for current implementation
   - Can be evaluated after initial deployment

4. **Photo URL Validation (Enhanced Validation):**
   - Consider adding more robust URL validation (check for common image extensions)
   - Current basic URL validation should be sufficient
   - Can be enhanced if issues arise

5. **Searchable Product Selector (UX Enhancement):**
   - Consider adding search/filter to product selector when creating orders
   - This would help users find products by name when many products exist
   - Can be added as future enhancement

---

## Notes

- Migration file naming: `YYYYMMDDHHmmss_add_product_photo_urls.sql`
- Snapshot pattern is critical: Orders MUST NOT query products dynamically
- Photo URLs are not indexed (not filtered or searched)
- RLS policies remain unchanged (photo_url is just another column)
- Normalization: Empty strings normalized to null using existing `normalizeOptional` pattern
- Image handling: Standard HTML `<img>` tags with `onError` handlers (no special libraries needed)

