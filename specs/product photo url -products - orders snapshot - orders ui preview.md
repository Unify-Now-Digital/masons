# Product Photo URL (Products + Orders Snapshot + Orders UI Preview)

## Overview

Add support for a single optional product photo URL, editable in the Products module, and reliably displayable in the Orders module (table thumbnail + order sidebar preview).

**Context:**
- Products (memorials) are editable over time and can change
- Orders must remain historically stable (snapshot of product at time of order creation)
- Current product selection in orders: When creating a New Memorial order, users select a product (memorial) which snapshots `material`, `color`, `value` onto the order
- Orders do NOT store a foreign key to products - they store snapshot values
- Image source: URL input only (no uploads, no storage)
- Images per product: single main image
- Applies ONLY to New Memorial orders; Renovation orders unaffected

**Goal:**
- Allow products (memorials) to have an optional photo URL
- When creating/updating a New Memorial order, snapshot the product's photo URL onto the order
- Display product photo in Orders table (thumbnail) and OrderDetailsSidebar (larger preview)
- Ensure historical order photos remain stable even if product photo changes

---

## Current State Analysis

### Products (Memorials) Schema

**Table:** `public.memorials`

**Current Structure:**
- `id` uuid primary key
- `order_id` string (references orders)
- `job_id` uuid nullable (references jobs)
- `deceased_name` text NOT NULL
- `date_of_birth` text nullable
- `date_of_death` text nullable
- `cemetery_name` text NOT NULL
- `cemetery_section` text nullable
- `cemetery_plot` text nullable
- `memorial_type` text NOT NULL
- `name` text nullable
- `price` numeric nullable
- `material` text nullable
- `color` text nullable
- `dimensions` text nullable
- `inscription_text` text nullable
- `inscription_language` text nullable
- `installation_date` date nullable
- `status` text NOT NULL (enum: 'planned', 'in_progress', 'installed', 'removed')
- `condition` text nullable
- `notes` text nullable
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- RLS enabled
- No explicit indexes on photo-related fields

**Observations:**
- No `photo_url` field currently exists
- Products are used as catalog items when creating orders
- Products can be edited over time (price, material, color, etc. can change)
- Product selection in orders does not store `product_id` - only snapshot values

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `id` uuid primary key
- `invoice_id` uuid nullable
- `job_id` uuid nullable
- `person_id` uuid nullable
- `person_name` text nullable
- `customer_name` text NOT NULL
- `customer_email` text nullable
- `customer_phone` text nullable
- `order_type` text NOT NULL (enum: 'New Memorial', 'Renovation')
- `sku` text nullable
- `material` text nullable (snapshot from product)
- `color` text nullable (snapshot from product)
- `value` numeric nullable (snapshot from product price for New Memorial, or null for Renovation)
- `renovation_service_description` text nullable (Renovation orders only)
- `renovation_service_cost` numeric(10,2) NOT NULL DEFAULT 0 (Renovation orders only)
- `permit_cost` numeric(10,2) NOT NULL DEFAULT 0
- `stone_status` text NOT NULL DEFAULT 'NA'
- `permit_status` text NOT NULL DEFAULT 'pending'
- `proof_status` text NOT NULL DEFAULT 'Not_Received'
- `deposit_date` date nullable
- `second_payment_date` date nullable
- `due_date` date nullable
- `installation_date` date nullable
- `location` text nullable
- `latitude` numeric nullable
- `longitude` numeric nullable
- `progress` integer NOT NULL DEFAULT 0
- `assigned_to` text nullable
- `priority` text NOT NULL DEFAULT 'medium'
- `timeline_weeks` integer NOT NULL DEFAULT 12
- `notes` text nullable
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- RLS enabled
- View: `orders_with_options_total` (includes additional_options_total)

**Observations:**
- Orders store snapshot values from products (material, color, value) but NO `product_id` FK
- Orders have `order_type` field distinguishing 'New Memorial' vs 'Renovation'
- No `product_photo_url` field currently exists
- Orders are displayed in `SortableOrdersTable` and `OrderDetailsSidebar`

### Relationship Analysis

**Current Relationship:**
- Products (memorials) are selected when creating New Memorial orders
- Orders snapshot product values (material, color, value/price) at creation time
- No foreign key relationship: Orders do NOT reference products via `product_id`
- Products can be edited independently - changes do NOT affect existing orders
- Orders remain historically stable - they preserve the product state at order creation time

**Gaps/Issues:**
- No photo URL support in products
- No photo URL snapshot in orders
- No photo display in Orders table or OrderDetailsSidebar
- No visual preview of products when selecting in order creation

### Data Access Patterns

**How Products (Memorials) are Currently Accessed:**
- `useMemorialsList()` - Fetches all memorials/products
- `useMemorial(id)` - Fetches single memorial/product
- `useCreateMemorial()` - Creates product
- `useUpdateMemorial()` - Updates product
- `useDeleteMemorial()` - Deletes product
- Location: `src/modules/memorials/hooks/useMemorials.ts`
- Products are transformed via `transformMemorialsFromDb()` to `UIMemorial[]`
- Products are displayed in `MemorialsPage.tsx`

**How Orders are Currently Accessed:**
- `fetchOrders()` - Fetches from `orders_with_options_total` view
- `fetchOrder(id)` - Fetches single order with joined data
- `fetchOrdersByInvoice(invoiceId)` - Fetches orders for invoice
- `createOrder()` - Creates order (snapshots product values)
- `updateOrder()` - Updates order
- Location: `src/modules/orders/api/orders.api.ts`
- Orders are transformed via `transformOrderForUI()` to `UIOrder`
- Orders are displayed in `SortableOrdersTable.tsx` and `OrderDetailsSidebar.tsx`

**How They Are Queried Together (if at all):**
- Currently: Products are queried separately and used for selection in order creation
- Order creation: Product selection triggers snapshot of `material`, `color`, `value` onto order
- Orders do NOT query products - they only store snapshot values
- Product editing does NOT affect existing orders (historical stability maintained)

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
1. **Add `photo_url` to `public.memorials`:**
   ```sql
   alter table public.memorials
     add column photo_url text null;

   comment on column public.memorials.photo_url is 
     'Optional URL to a product photo/image. Used for visual reference in product catalog and order creation.';
   ```

2. **Add `product_photo_url` to `public.orders`:**
   ```sql
   alter table public.orders
     add column product_photo_url text null;

   comment on column public.orders.product_photo_url is 
     'Snapshot of the product photo URL at the time of order creation/update. Only used for New Memorial order types. Preserves historical product appearance even if product photo changes.';
   ```

3. **No indexes required:**
   - Photo URLs are not filtered or searched
   - No performance concerns for URL fields

**Non-Destructive Constraints:**
- Only additive changes (two new nullable columns)
- No table renames or column deletions
- Backward compatible: existing products/orders remain valid (photo URLs are null)
- No foreign key constraints (maintains snapshot pattern)

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Products: Include `photo_url` in all product queries (already in SELECT *)
- Orders: Include `product_photo_url` in all order queries (already in SELECT *)
- No joins required (snapshot pattern maintained)
- No additional queries needed for photos (stored directly on orders)

**Recommended Display Patterns:**
- Products module: Show photo preview when editing product, allow URL input
- Orders table: Show thumbnail (32-40px) if `product_photo_url` exists, placeholder otherwise
- OrderDetailsSidebar: Show larger preview (200-300px) if `product_photo_url` exists, hide section if missing
- Handle broken image URLs gracefully (onError fallback to placeholder)
- Only show photos for New Memorial orders (Renovation orders ignore this field)

---

## Implementation Approach

### Phase 1: Database Migration
- Create migration to add `photo_url` to `public.memorials`
- Create migration to add `product_photo_url` to `public.orders`
- Add column comments for clarity
- Verify existing data remains valid (null values are acceptable)

### Phase 2: Types & Schema Updates
- Update `Memorial` TypeScript interface: `photo_url: string | null`
- Update `Order` TypeScript interface: `product_photo_url: string | null`
- Update Zod schemas (`memorialFormSchema`, `orderFormSchema`) to accept nullable photo URLs
- Update transform utilities to handle nullable photo URLs
- Normalize empty strings to `null` on insert/update

### Phase 3: Products Module UI
- Update `CreateMemorialDrawer`:
  - Add "Photo URL" input field (optional)
  - Add live image preview when URL exists
  - Add "Clear" button to remove photo (sets to null)
  - Handle broken image URLs gracefully (onError fallback)
- Update `EditMemorialDrawer`:
  - Add same "Photo URL" input field (prefilled with current photo_url)
  - Add same preview and clear functionality
- Update `MemorialsPage` (optional):
  - Display photo thumbnail in products table if photo_url exists

### Phase 4: Orders Module Logic (Snapshot)
- Update `CreateOrderDrawer`:
  - When product is selected for New Memorial order:
    - Copy `product.photo_url` → `order.product_photo_url` in order payload
  - When product is cleared or changed:
    - Update snapshot accordingly (set to new product's photo_url or null)
- Update `EditOrderDrawer`:
  - When product is changed for New Memorial order:
    - Update `product_photo_url` snapshot accordingly
- Ensure Renovation orders always set `product_photo_url` to `null` (or omit from payload)

### Phase 5: Orders Module UI
- Update `SortableOrdersTable`:
  - Add new "Photo" column
  - Render thumbnail (32-40px, object-cover) if `product_photo_url` exists
  - Show placeholder ("—" or icon) if missing
  - Only display for New Memorial orders (or show placeholder for Renovation)
- Update `OrderDetailsSidebar`:
  - Add photo preview section (only for New Memorial orders with `product_photo_url`)
  - Show larger preview image (200-300px, object-contain or object-cover)
  - Handle broken image URLs gracefully (onError fallback)
  - Hide section if photo missing or order is Renovation

### Safety Considerations
- Migration is additive (making columns nullable is safe)
- Existing products/orders remain valid (photo URLs default to null)
- Snapshot pattern maintained (orders do NOT reference products dynamically)
- Product photo changes do NOT affect existing orders (historical stability)
- Broken image URLs handled gracefully (no crashes)
- Renovation orders unaffected (product_photo_url ignored for them)

---

## What NOT to Do

- Do not add image uploads or Supabase Storage integration
- Do not add multiple images or galleries
- Do not create foreign key from orders to products (maintain snapshot pattern)
- Do not dynamically fetch product photos in orders (always use snapshot)
- Do not retroactively update existing orders when product photos change
- Do not add photo URL to Renovation orders
- Do not add photo filtering or searching
- Do not add photo caching or CDN logic
- Do not change invoice totals, order totals, or map logic
- Do not add N+1 queries (photos are stored directly on orders)

---

## Open Questions / Considerations

- **Image validation:** Should we validate URL format or just accept any string? (Recommend: Basic URL format validation in Zod schema)
- **Image size limits:** Should we recommend max dimensions or leave to external URLs? (Recommend: Document recommended size, but no enforcement)
- **Broken image handling:** What placeholder should be shown? Icon? Generic image? (Recommend: Simple icon or "—" placeholder)
- **Thumbnail dimensions:** What exact size for table thumbnails? (Recommend: 40px × 40px with object-cover)
- **Preview dimensions:** What exact size for sidebar preview? (Recommend: 300px width max, height auto, object-contain)
- **Photo in product list:** Should MemorialsPage show photos in the products table? (Recommend: Yes, but optional - can be added in Phase 3 or later)
- **Performance:** Are there any concerns with loading many product photos in orders table? (Recommend: Use lazy loading or image optimization if needed, but URLs should be fast)

---

## Acceptance Criteria

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

## Technical Notes

### Migration File Naming
- Format: `YYYYMMDDHHmmss_add_product_photo_urls.sql`
- Example: `20260110140000_add_product_photo_urls.sql`

### Snapshot Pattern
- Orders MUST snapshot product photo URL at creation/update time
- Orders MUST NOT query products dynamically for photos
- Product photo changes MUST NOT affect existing orders
- This maintains historical accuracy and order stability

### Image Handling
- No image validation beyond basic URL format (let external URLs handle validation)
- Use standard HTML `<img>` tags with `onError` handlers for broken images
- No image optimization or transformation (rely on external URLs)
- Use `object-cover` for thumbnails (crop to fit), `object-contain` for previews (fit within bounds)

### Normalization
- Empty strings should be normalized to `null` on insert/update
- Use existing `normalizeOptional` helper pattern
- Defensive null handling throughout codebase

### Performance
- Photo URLs stored directly on orders (no joins required)
- No additional queries needed for photos
- Lazy loading optional for large tables (can be added later if needed)
- Image loading is browser-native (no server-side processing)

### RLS Policy
- No changes needed to RLS policies (photo_url is just another column)
- Existing policies continue to work

---

## Out of Scope

- Image uploads or Supabase Storage
- Multiple images or galleries
- Dynamic product matching in orders
- Photo caching or CDN integration
- Image editing or transformation
- Photo filtering or search
- Product photo in orders search/filter
- Backfilling old orders with product photos

