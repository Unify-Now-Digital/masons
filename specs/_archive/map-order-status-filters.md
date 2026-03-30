# Add Order status filters to Map (Map of Jobs module)

## Overview

The Map of Jobs module visualizes Orders on a map, allowing users to select Orders and create Jobs. Currently, users can filter by assignment status (all/unassigned) and search by text, but cannot filter Orders by their status fields (stone_status, permit_status, proof_status).

**Context:**
- Map of Jobs module displays Orders (not Jobs) as pins on a map
- Orders can be selected on the map to create Jobs
- Orders have three status fields: `stone_status`, `permit_status`, and `proof_status`
- Current filtering options: search text and assignment status (all/unassigned)
- No status-based filtering exists

**Goal:**
- Allow users to filter visible Order pins on the map by Order status
- Maintain existing selection and job creation functionality
- Provide clear UX for status filtering
- Ensure selected Orders remain consistent with visible pins

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `id` (uuid, primary key)
- `stone_status` (text) - Values: 'NA', 'Ordered', 'In Stock'
- `permit_status` (text) - Values: 'form_sent', 'customer_completed', 'pending', 'approved'
- `proof_status` (text) - Values: 'NA', 'Not_Received', 'Received', 'In_Progress', 'Lettered'
- `job_id` (uuid, nullable, foreign key to jobs.id) - Used to determine assignment status
- `latitude`, `longitude` (numeric, nullable) - Required for map display
- `location` (text, nullable)
- `customer_name` (text, not null)
- Other fields: order_type, sku, material, color, value, priority, etc.

**Observations:**
- Orders have three distinct status fields (not a single "status" field)
- Status values are defined by enum constraints in application layer
- All three status fields are relevant for different workflows
- Status values are stored as text in database

### Map of Jobs Module Structure

**File:** `src/modules/map/pages/JobsMapPage.tsx`

**Current Behavior:**
- Fetches Orders using `useOrdersForMap()` hook
- Transforms Orders to markers using `transformOrdersToMarkers()`
- Displays markers on GoogleMap component
- Supports text search filtering (`searchQuery`)
- Supports assignment-based filtering (all/unassigned via tabs)
- Supports Order selection for Job creation
- Shows OrderInfoPanel when Order is clicked

**Current Filtering:**
- Text search: filters by customer name, location, or SKU
- Assignment filter: "All Orders" vs "Unassigned Orders" (via Tabs)
- No status-based filtering exists

**Observations:**
- Filtering is client-side (UI-only)
- `filteredMarkers` computed from `markers` based on search query
- Assignment filter applied after search filter
- Selected Orders tracked in `selectedOrderIds` Set

### OrderMapMarker Structure

**File:** `src/modules/map/utils/orderMapTransform.ts`

**Current Structure:**
- Transforms `Order` to `OrderMapMarker`
- Includes: id, customer, location, address, coordinates, status, priority, jobId, isAssigned, value, sku, material, color
- `status` field is hardcoded to `'scheduled'` (not derived from Order status fields)
- `isAssigned` derived from `job_id !== null`

**Observations:**
- Marker `status` field is not connected to actual Order status fields
- Status information from Order (stone_status, permit_status, proof_status) is not included in marker
- Transformation happens before filtering, so status filtering must happen on Order data

### Relationship Analysis

**Current Relationship:**
- Orders → Map Markers: 1-to-1 transformation
- Orders → Selection: Many-to-many (multiple Orders can be selected)
- Selected Orders → Job Creation: 1-to-1 (one Job created from selected Orders)

**Gaps/Issues:**
- No status filtering capability
- Users cannot focus on Orders with specific status values
- Cannot filter by stone_status, permit_status, or proof_status
- Status information not visible in OrderInfoPanel or map markers

### Data Access Patterns

**How Orders are Currently Fetched:**
- `useOrdersForMap()` hook fetches Orders with coordinates
- Query includes Orders with `latitude IS NOT NULL AND longitude IS NOT NULL`
- All Orders with coordinates are loaded into memory
- No server-side filtering by status

**How Filtering Currently Works:**
- Client-side filtering in `JobsMapPage` component
- `filteredMarkers` computed from `markers` using `useMemo`
- Search filter: matches customer, location, or SKU
- Assignment filter: filters by `isAssigned` boolean
- Filters are applied sequentially (search → assignment)

**How Selection Works:**
- `selectedOrderIds` Set tracks selected Order IDs
- Selection is independent of filtering (can select hidden Orders)
- Job creation uses all selected Orders (regardless of current filter state)
- Selected Orders can become hidden when filters change (no auto-deselection)

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **NONE** - No database schema changes needed
- Status fields already exist in Orders table
- No new columns or indexes required
- No changes to Orders schema

**Non-Destructive Constraints:**
- No schema changes
- Existing Orders remain unchanged
- All status values remain valid

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Continue fetching all Orders with coordinates (no server-side filtering)
- Client-side filtering by status values after data fetch
- Filter Orders array before transformation to markers
- Apply status filters alongside existing search and assignment filters

**Recommended Display Patterns:**
- Multi-select checkbox or toggle buttons for status filtering
- Show all available status values for each status field
- Default: all statuses enabled (show all Orders)
- Filter control placement: top-left of map area (recommended)

---

## Implementation Approach

### Status Field Selection

**Decision Required:**
Orders have three status fields. The specification should support filtering by one or more of these fields. Options:

1. **Option A: Filter by stone_status only** (simplest)
   - Most commonly displayed status in UI
   - Clear business meaning (material availability)
   - 3 possible values: 'NA', 'Ordered', 'In Stock'

2. **Option B: Filter by all three status fields** (most flexible)
   - Separate filter controls for each status field
   - Users can combine filters across status types
   - More complex UI but more powerful filtering

3. **Option C: Single unified status filter** (hybrid)
   - Combine status values from all three fields into one filter
   - Show labels like "Stone: In Stock", "Permit: Approved", etc.
   - Single filter control with more options

**Recommendation:** Start with Option A (stone_status) as it's the most commonly referenced status in the codebase and has clear business value. Can be extended to other status fields in future iterations.

**For this specification:** Assume Option A (stone_status) unless user clarifies otherwise.

### Phase 1: Add Status Filter UI Component

**Task 1.1: Create StatusFilterControl Component**

**File:** `src/modules/map/components/StatusFilterControl.tsx` (NEW)

**Description:**
Create a new component for status filtering with multi-select checkboxes or toggle buttons.

**Required Features:**
- Checkbox or toggle for each status value ('NA', 'Ordered', 'In Stock')
- "Select All" / "Deselect All" option (optional but recommended)
- Visual indication of enabled/disabled states
- Compact design suitable for map overlay

**UI Options:**
- **Option 1: Checkboxes** (recommended)
  - Traditional checkbox list
  - Clear enabled/disabled states
  - Easy to understand
  
- **Option 2: Toggle Buttons**
  - More compact
  - Visual toggle state
  - Better for limited space

**Default State:**
- All statuses enabled by default (show all Orders)

---

### Phase 2: Integrate Status Filter into JobsMapPage

**Task 2.1: Add Status Filter State**

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Changes Required:**
- Add state for selected status values: `const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['NA', 'Ordered', 'In Stock']));`
- Default to all statuses enabled (empty Set means all, or Set with all values)

**Rationale:**
- Track which status values should be shown
- Default to "show all" behavior
- Use Set for efficient lookup

---

**Task 2.2: Add Status Filter Control to UI**

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Location:** Top-left area of map (inside CardHeader or as overlay)

**Changes Required:**
- Import and render `StatusFilterControl` component
- Position above or alongside search input
- Pass `selectedStatuses` and `setSelectedStatuses` as props

**UI Placement Options:**
- **Option 1: Above search input** (recommended)
  - Clear hierarchy: filter → search → map
  - Easy to find and use
  
- **Option 2: Overlay on map**
  - Doesn't take up sidebar space
  - May interfere with map interactions
  - Requires careful positioning

---

**Task 2.3: Include Status in Order Data**

**File:** `src/modules/map/utils/orderMapTransform.ts` (UPDATE)

**Changes Required:**
- Add `stone_status` (and optionally other status fields) to `OrderMapMarker` interface
- Include `stone_status` in `transformOrderToMarker()` function
- Pass status from Order to marker

**Rationale:**
- Status information needed for filtering
- Status should be available in marker data
- Enables status-based filtering in JobsMapPage

---

**Task 2.4: Apply Status Filter to Markers**

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Location:** `filteredMarkers` useMemo hook

**Changes Required:**
- Add status filter to `filteredMarkers` computation
- Filter markers by `stone_status` matching `selectedStatuses`
- Apply status filter after search filter, before assignment filter
- Ensure filter logic: `selectedStatuses.has(marker.stone_status)` or handle "all selected" case

**Filter Logic:**
```typescript
// If all statuses are selected (default), show all
// Otherwise, only show markers with status in selectedStatuses
if (selectedStatuses.size < 3) { // Assuming 3 total status values
  filtered = filtered.filter(marker => selectedStatuses.has(marker.stone_status));
}
```

---

### Phase 3: Handle Selection Consistency

**Task 3.1: Auto-deselect Hidden Orders**

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Changes Required:**
- Add useEffect to monitor `filteredMarkers` and `selectedOrderIds`
- When filter changes, remove any selected Order IDs that are not in `filteredMarkers`
- Clear selection for Orders that become hidden due to filter change

**Implementation:**
```typescript
useEffect(() => {
  const visibleOrderIds = new Set(filteredMarkers.map(m => m.id));
  setSelectedOrderIds(prev => {
    const next = new Set(prev);
    // Remove any selected IDs that are not visible
    prev.forEach(id => {
      if (!visibleOrderIds.has(id)) {
        next.delete(id);
      }
    });
    return next;
  });
}, [filteredMarkers]);
```

**Rationale:**
- Prevents selected Orders from being used for Job creation when hidden
- Maintains consistency between visible pins and selected Orders
- Improves UX by preventing confusion

---

**Task 3.2: Update Job Creation Logic**

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Changes Required:**
- Ensure `handleCreateJob` only uses Orders that are currently visible
- Add validation: check that all selected Order IDs exist in `filteredMarkers`
- Filter `initialOrderIds` passed to CreateJobDrawer to only include visible Orders

**Rationale:**
- Safety measure to prevent creating Jobs from hidden Orders
- Ensures Job creation only uses currently visible and selected Orders
- Double-check that selection consistency is maintained

---

### Phase 4: Display Status in UI

**Task 4.1: Show Status in OrderInfoPanel**

**File:** `src/modules/map/components/OrderInfoPanel.tsx` (UPDATE)

**Changes Required:**
- Add status display to OrderInfoPanel
- Show `stone_status` (and optionally other status fields) with label
- Use Badge component for visual status indication (consistent with Orders table)

**Rationale:**
- Users can see Order status when viewing Order details
- Provides context for filtering decisions
- Consistent with status display in other parts of application

---

**Task 4.2: Optional - Color-code Pins by Status**

**File:** `src/modules/map/utils/orderMapTransform.ts` or `src/modules/map/components/GoogleMap.tsx` (UPDATE - OPTIONAL)

**Changes Required:**
- Modify pin color based on `stone_status`
- Define color scheme for each status value
- Update `getOrderMarkerColor()` or create new function `getStatusMarkerColor()`

**Status Color Mapping (suggestion):**
- 'NA': Default blue
- 'Ordered': Orange/yellow (in progress)
- 'In Stock': Green (ready)

**Rationale:**
- Visual differentiation of Orders by status
- Quick status identification without clicking
- Non-blocking: can be added in future iteration

**Note:** Marked as optional/non-blocking in requirements.

---

### Phase 5: Empty State and Edge Cases

**Task 5.1: Handle Empty Filter Results**

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Changes Required:**
- Show empty state message when `filteredMarkers.length === 0` and status filter is active
- Message: "No orders match the selected status filters" or similar
- Clear indication that filters are active and can be adjusted

**Rationale:**
- Better UX when filters result in no visible Orders
- Helps users understand why map is empty
- Suggests adjusting filters

---

**Task 5.2: Handle Status Filter with Search and Assignment Filters**

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Changes Required:**
- Ensure status filter works correctly with existing search and assignment filters
- Filter order: search → status → assignment (or status → search → assignment)
- All filters should work together without conflicts

**Rationale:**
- Multiple filters should work in combination
- No regression in existing filtering behavior
- Consistent filtering logic

---

### Safety Considerations

- **No Data Loss:** All changes are UI-only, no database changes
- **Backward Compatibility:** Existing functionality preserved
- **Selection Safety:** Auto-deselection prevents creating Jobs from hidden Orders
- **Filter Persistence:** Filters reset on page reload (no persistence required per constraints)
- **Rollback:** Revert component changes if needed, no database rollback required

---

## What NOT to Do

- **Do NOT** change Orders table schema
- **Do NOT** add new status values or change existing ones
- **Do NOT** add server-side filtering (keep client-side only)
- **Do NOT** persist filter state (reset on page reload)
- **Do NOT** change Orders or Jobs modules (Map module only)
- **Do NOT** modify Job creation logic outside of selection validation
- **Do NOT** change existing search or assignment filtering
- **Do NOT** add status editing from map (view-only per requirements)

---

## Open Questions / Considerations

1. **Status Field Selection:**
   - Which status field(s) to filter by? (stone_status, permit_status, proof_status, or all?)
   - Recommendation: Start with stone_status, extend to others if needed

2. **Filter UI Design:**
   - Checkboxes vs toggle buttons?
   - Placement: above search or overlay on map?
   - "Select All" / "Deselect All" button?

3. **Color-coding:**
   - Should pins be color-coded by status (non-blocking)?
   - Color scheme preferences?

4. **Multiple Status Fields:**
   - If filtering by multiple status fields, how should filters combine? (AND or OR logic)
   - Should each status field have its own filter control?

5. **Filter Persistence:**
   - Should filter state persist across page reloads? (currently out of scope per requirements)
   - Should filters be saved to user preferences? (future enhancement)

---

## Success Criteria

- ✅ User can filter Orders on the map by status (stone_status)
- ✅ Filter control is visible and accessible (top-left recommended)
- ✅ All statuses enabled by default (show all Orders)
- ✅ Map updates instantly when filters change
- ✅ Selected Orders are automatically deselected when hidden by filters
- ✅ Job creation only uses visible and selected Orders
- ✅ Status is displayed in OrderInfoPanel
- ✅ Empty state shown when no Orders match filters
- ✅ No regressions in existing search, assignment filtering, or selection logic
- ✅ No database or API changes
- ✅ No changes to Orders or Jobs modules

---

## File Changes Summary

| File | Action | Lines Changed | Description |
|------|--------|---------------|-------------|
| `src/modules/map/components/StatusFilterControl.tsx` | NEW | ~50-80 | New component for status filtering UI |
| `src/modules/map/pages/JobsMapPage.tsx` | UPDATE | ~30-50 | Add status filter state, integrate filter control, apply filter logic, handle selection consistency |
| `src/modules/map/utils/orderMapTransform.ts` | UPDATE | ~5-10 | Add stone_status to OrderMapMarker interface and transformation |
| `src/modules/map/components/OrderInfoPanel.tsx` | UPDATE | ~5-10 | Display status in OrderInfoPanel |

**Total Estimated Changes:** ~90-150 lines across 3-4 files

---

## References

- Map of Jobs Page: `src/modules/map/pages/JobsMapPage.tsx`
- GoogleMap Component: `src/modules/map/components/GoogleMap.tsx`
- OrderInfoPanel: `src/modules/map/components/OrderInfoPanel.tsx`
- Order Transform: `src/modules/map/utils/orderMapTransform.ts`
- Order Types: `src/modules/orders/types/orders.types.ts`
- Orders Schema: `supabase/migrations/20250608000001_create_orders_table.sql`

