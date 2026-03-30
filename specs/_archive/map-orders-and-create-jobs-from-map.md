# Map Orders Visualization & Job Creation from Map

## Overview

Replace Job-based map pins with Order-based map pins in the "Map of Jobs" module and enable creating Jobs directly from selected Orders on the map. This feature transforms the map from a Job visualization tool into an Order-based workflow where users can select multiple Orders and create Jobs to assign them.

**Context:**
- Currently, the Map of Jobs module (`src/modules/map/pages/JobsMapPage.tsx`) displays Jobs as map pins
- Orders have latitude/longitude fields and can be linked to Jobs via `job_id`
- Users need a visual way to see unassigned Orders and group them into Jobs
- Job creation workflow already exists (`CreateJobDrawer`) and supports multiple Orders

**Goal:**
- Replace Job pins with Order pins on the map
- Enable multi-select of Orders via map pins
- Allow creating Jobs from selected Orders
- Automatically assign selected Orders to the created Job

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `id` (uuid, primary key)
- `latitude` (numeric(10, 8), nullable) - Added in migration `20251223022543_add_latitude_longitude_to_orders.sql`
- `longitude` (numeric(10, 8), nullable) - Added in migration `20251223022543_add_latitude_longitude_to_orders.sql`
- `job_id` (uuid, nullable, foreign key to `jobs.id`) - Added in migration `20251223041858_add_job_id_to_orders.sql`
- `customer_name` (text) - Used as deceased_name snapshot
- `sku` (text, nullable) - Grave number
- `material` (text, nullable) - Stone type
- `color` (text, nullable) - Stone color
- `location` (text, nullable) - Location text
- `value` (decimal(10,2), nullable) - Order price
- `notes` (text, nullable) - May contain dimensions
- Other fields: invoice_id, order_type, status fields, dates, etc.

**Observations:**
- Orders have geographic coordinates (latitude/longitude)
- Orders can be linked to Jobs via `job_id` (nullable, one-to-one relationship)
- Orders without coordinates cannot be displayed on map
- Orders with `job_id IS NOT NULL` are already assigned to a Job

### Jobs Schema

**Table:** `public.jobs`

**Current Structure:**
- `id` (uuid, primary key)
- `location_name` (text) - Job location name
- `address` (text) - Job address
- `latitude` (numeric, nullable) - Job coordinates
- `longitude` (numeric, nullable) - Job coordinates
- `status` (text) - Values: 'scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled'
- `scheduled_date` (timestamp, nullable)
- `estimated_duration` (text, nullable)
- `priority` (text) - Values: 'low', 'medium', 'high'
- `notes` (text, nullable)
- Legacy fields: `order_id`, `customer_name` (kept for backward compatibility)

**Observations:**
- Jobs can have their own coordinates (separate from Order coordinates)
- Jobs are linked to Orders via `orders.job_id` (reverse relationship)
- CreateJobDrawer already supports creating Jobs with multiple Orders via `order_ids` field

### Relationship Analysis

**Current Relationship:**
- One-to-many: One Job can have multiple Orders (via `orders.job_id`)
- Each Order can belong to at most one Job (`job_id` is nullable)
- Foreign key constraint: `orders.job_id` references `jobs.id` ON DELETE SET NULL

**Gaps/Issues:**
- Map currently shows Jobs, not Orders
- No visual distinction between assigned and unassigned Orders
- No way to select multiple Orders from map to create a Job
- Order details not accessible from map pins

### Data Access Patterns

**How Orders are Currently Accessed:**
- Orders module: `src/modules/orders/` - CRUD operations
- Orders API: `src/modules/orders/api/orders.api.ts`
- Orders hooks: Fetch all orders, create, update, delete
- Orders filtered by `job_id IS NULL` to find unassigned Orders

**How Jobs are Currently Accessed:**
- Jobs module: `src/modules/jobs/` - CRUD operations
- Jobs hooks: `src/modules/jobs/hooks/useJobs.ts` - `useJobsList()`, `useCreateJob()`, etc.
- CreateJobDrawer: `src/modules/jobs/components/CreateJobDrawer.tsx`
- Job creation supports `order_ids` array (UI-only field)

**How They Are Queried Together:**
- Currently not queried together in map context
- CreateJobDrawer accepts `order_ids` and updates Orders after Job creation
- Map module (`src/modules/map/`) currently uses Jobs data only

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **NONE** - All required fields already exist:
  - `orders.latitude` and `orders.longitude` (added in migration `20251223022543`)
  - `orders.job_id` (added in migration `20251223041858`)

**Non-Destructive Constraints:**
- No schema changes needed
- Existing data remains valid
- Backward compatibility maintained

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Fetch Orders with coordinates: `SELECT * FROM orders WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
- Filter unassigned Orders: `WHERE job_id IS NULL`
- Filter assigned Orders: `WHERE job_id IS NOT NULL`
- Join with Jobs (optional): `LEFT JOIN jobs ON orders.job_id = jobs.id` (for displaying Job info)

**Recommended Display Patterns:**
- Map pins: One pin per Order (not per Job)
- Pin color: Normal for unassigned (`job_id IS NULL`), muted/gray for assigned (`job_id IS NOT NULL`)
- Selection: Only unassigned Orders can be selected
- Info panel: Show Order details when clicking pin
- Selection bar: Show count and total price of selected Orders

---

## Implementation Approach

### Phase 1: Update Map Data Source

**Task 1.1: Create Orders Map Hooks**
- **File:** `src/modules/map/hooks/useOrders.ts` (new file)
- Fetch Orders with coordinates: `latitude IS NOT NULL AND longitude IS NOT NULL`
- Filter by `job_id IS NULL` for selectable Orders
- Return Orders data formatted for map markers

**Task 1.2: Create Orders Map Transform Utility**
- **File:** `src/modules/map/utils/orderMapTransform.ts` (new file)
- Transform Order data to `MapMarker` format
- Handle assigned vs unassigned Order styling
- Extract Order fields: deceased_name (customer_name), sku, location, coordinates, value, etc.

**Task 1.3: Update JobsMapPage to Use Orders**
- **File:** `src/modules/map/pages/JobsMapPage.tsx`
- Replace `useJobsList()` with `useOrdersList()` (or similar)
- Replace `transformJobsToMarkers()` with `transformOrdersToMarkers()`
- Update marker filtering logic for Orders

### Phase 2: Implement Multi-Select

**Task 2.1: Add Selection State Management**
- **File:** `src/modules/map/pages/JobsMapPage.tsx`
- Add `selectedOrderIds` state (array of Order IDs)
- Add selection toggle function
- Prevent selection of assigned Orders (`job_id IS NOT NULL`)

**Task 2.2: Update GoogleMap Component**
- **File:** `src/modules/map/components/GoogleMap.tsx`
- Support multi-select markers
- Visual distinction: selected, unselected, assigned
- Handle marker click events for selection

**Task 2.3: Add Selection Action Bar**
- **File:** `src/modules/map/pages/JobsMapPage.tsx`
- Display when `selectedOrderIds.length > 0`
- Show selected count and total price (sum of `order.value`)
- "Create Job" button (primary action)

### Phase 3: Order Details UI

**Task 3.1: Create Order Info Panel Component**
- **File:** `src/modules/map/components/OrderInfoPanel.tsx` (new file)
- Read-only display of Order details
- Fields: Deceased Name, Grave Number, Location, Coordinates, Product snapshot, Stone Type, Stone Color, Dimensions (from notes), Price, Notes
- Actions: Select/Deselect Order, View Order (navigate to Orders module)

**Task 3.2: Integrate Info Panel with Map**
- **File:** `src/modules/map/pages/JobsMapPage.tsx`
- Open info panel when clicking Order pin
- Show selected state in panel
- Handle selection from panel

### Phase 4: Job Creation Integration

**Task 4.1: Update CreateJobDrawer Integration**
- **File:** `src/modules/map/pages/JobsMapPage.tsx`
- Open CreateJobDrawer when "Create Job" clicked
- Pre-fill `order_ids` with selected Order IDs
- Auto-fill location from first selected Order
- Default status to "scheduled"

**Task 4.2: Handle Job Creation Success**
- **File:** `src/modules/map/pages/JobsMapPage.tsx`
- After Job creation, refresh Orders data
- Clear selection state
- Show success message
- Assigned Orders should appear as non-selectable on map

**Task 4.3: Error Handling**
- Handle Job creation failures
- Handle Order update failures
- Show appropriate error messages
- Maintain selection state on error (allow retry)

### Phase 5: Visual Polish

**Task 5.1: Pin Styling**
- Normal pins: Blue/default color for unassigned Orders
- Assigned pins: Gray/muted color for assigned Orders
- Selected pins: Highlighted border or different color
- Cluster pins when zoomed out (if using clustering library)

**Task 5.2: Empty States**
- Show count of Orders without coordinates
- Warning message if no Orders have coordinates
- Helpful message when no Orders match filters

**Task 5.3: Loading and Error States**
- Loading skeleton for Orders data
- Error message if Orders fetch fails
- Retry mechanism

### Safety Considerations
- No data loss: All changes are UI-only or additive (Job creation, Order updates)
- Test with existing Orders: Ensure backward compatibility
- Test with assigned Orders: Verify they appear correctly but are non-selectable
- Rollback: Revert to Jobs-based map if needed (keep JobsMapPage backup)

---

## What NOT to Do

- **Do NOT** edit Orders from map (read-only info panel only)
- **Do NOT** add map-based coordinate editing (out of scope)
- **Do NOT** implement drag/lasso selection (click-based only)
- **Do NOT** show Jobs pins on map (Orders only)
- **Do NOT** change database schema (all fields already exist)
- **Do NOT** modify CreateJobDrawer component structure (only integration)
- **Do NOT** add automatic geocoding (manual coordinates only)
- **Do NOT** implement route optimization UI changes (keep existing)

---

## Open Questions / Considerations

1. **Clustering:** Should we use a clustering library (e.g., `@googlemaps/markerclusterer`) for Orders when zoomed out? Or simple pin rendering?

2. **Order Details Parsing:** How should dimensions be parsed from `notes` field? Is there a consistent format, or should we display raw notes?

3. **Product Snapshot:** Orders have `material` and `color` fields. Should we show a "Product" label or just "Stone Type" and "Stone Color"?

4. **Navigation:** When clicking "View Order" in info panel, should it navigate to Orders module with filter applied, or open Order detail drawer?

5. **Selection Persistence:** Should selection persist when user navigates away and returns? Or clear on page load?

6. **Performance:** If there are many Orders (100+), should we implement pagination or virtual scrolling for the sidebar list?

7. **Filtering:** Should we add filters for Order status (stone_status, permit_status, proof_status) in addition to assignment status?

---

## Success Criteria

- ✅ Orders appear on map correctly (one pin per Order with coordinates)
- ✅ Assigned Orders (`job_id IS NOT NULL`) are visually distinct (muted/gray) and non-selectable
- ✅ Unassigned Orders (`job_id IS NULL`) are selectable with normal styling
- ✅ Multi-selection works reliably (click to toggle, visual feedback)
- ✅ Order details visible in info panel when clicking pin
- ✅ Selection action bar appears when Orders are selected
- ✅ "Create Job" opens CreateJobDrawer with pre-filled `order_ids`
- ✅ Job creation assigns Orders correctly (updates `orders.job_id`)
- ✅ Map refreshes after Job creation, assigned Orders become non-selectable
- ✅ No regressions in Jobs module (Jobs CRUD still works)
- ✅ No regressions in Orders module (Orders CRUD still works)
- ✅ No database schema changes
- ✅ Backward compatibility maintained (existing Jobs and Orders unchanged)

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/modules/map/hooks/useOrders.ts` | CREATE | New hook to fetch Orders for map |
| `src/modules/map/utils/orderMapTransform.ts` | CREATE | Transform Orders to map markers |
| `src/modules/map/components/OrderInfoPanel.tsx` | CREATE | Read-only Order details panel |
| `src/modules/map/pages/JobsMapPage.tsx` | UPDATE | Replace Jobs with Orders, add selection, integrate CreateJobDrawer |
| `src/modules/map/components/GoogleMap.tsx` | UPDATE | Support multi-select, visual states for assigned/unassigned |
| `src/modules/map/utils/mapTransform.ts` | DEPRECATE | May keep for backward compatibility or remove if unused |

**Total Estimated Changes:** ~500-800 lines across 4-6 files

---

## References

- Current Map Implementation: `src/modules/map/pages/JobsMapPage.tsx`
- CreateJobDrawer: `src/modules/jobs/components/CreateJobDrawer.tsx`
- Orders Schema: `supabase/migrations/20250608000001_create_orders_table.sql`
- Latitude/Longitude Migration: `supabase/migrations/20251223022543_add_latitude_longitude_to_orders.sql`
- Job ID Migration: `supabase/migrations/20251223041858_add_job_id_to_orders.sql`
- Orders Types: `src/modules/orders/types/orders.types.ts`
- Jobs Types: `src/modules/jobs/hooks/useJobs.ts`

