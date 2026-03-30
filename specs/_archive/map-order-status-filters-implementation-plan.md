# Implementation Plan: Add Order status filters to Map

## Overview

This plan adds status filtering to the Map of Jobs module, allowing users to filter Order pins by operational status. The implementation uses an operational status model that maps from database status values to meaningful operational states for job planning.

**Goal:** Enable filtering of Orders on the map by operational status, improving visibility and planning capabilities for job creation workflows.

**Constraints:**
- UI-only changes (no database schema changes)
- No API changes
- Map module only (no changes to Orders or Jobs modules)
- Client-side filtering only

---

## Phase 1: Define Operational Status Model & Filter State

### Decisions

- **Status Field:** Map filtering uses `stone_status` as the primary status indicator
- **Status Model:** Status values represent operational readiness for job planning
- **Mapping Required:** Database values ('NA', 'Ordered', 'In Stock') must be mapped to operational statuses

### Operational Status Values

**Allowed operational status values (for map filtering):**
- `'planned'` - Order is in planning phase (stone_status: 'NA')
- `'in_progress'` - Order is being processed (stone_status: 'Ordered')
- `'ready_for_installation'` - Order is ready for installation (stone_status: 'In Stock')
- `'completed'` - Order installation completed (if job exists and completed)
- `'cancelled'` - Order is cancelled (if applicable)

**Note:** For initial implementation, focus on the three `stone_status` values and map them to operational statuses. The `completed` and `cancelled` statuses can be derived from job status if needed, but may be out of scope for v1.

### Simplified Mapping (v1)

For initial implementation, map `stone_status` directly to operational statuses:
- `'NA'` → `'planned'`
- `'Ordered'` → `'in_progress'`
- `'In Stock'` → `'ready_for_installation'`

### Task 1.1: Define Status Constants and Mapping

**File:** `src/modules/map/utils/orderStatusMap.ts` (NEW)

**Description:**
Create utility file with status constants and mapping functions.

**Required Constants:**
```typescript
export const OPERATIONAL_STATUSES = [
  'planned',
  'in_progress', 
  'ready_for_installation'
] as const;

export type OperationalStatus = typeof OPERATIONAL_STATUSES[number];

export const STATUS_LABELS: Record<OperationalStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  ready_for_installation: 'Ready for Installation',
};

// Map database stone_status to operational status
export function mapStoneStatusToOperational(stoneStatus: string): OperationalStatus {
  switch (stoneStatus) {
    case 'NA':
      return 'planned';
    case 'Ordered':
      return 'in_progress';
    case 'In Stock':
      return 'ready_for_installation';
    default:
      return 'planned'; // Default fallback
  }
}
```

**Rationale:**
- Centralized status definitions
- Type-safe status values
- Clear mapping from database to operational model
- Easy to extend with additional statuses later

**Validation:**
- All status values defined
- Mapping function handles all database values
- TypeScript types are correct

---

### Task 1.2: Add Filter State to JobsMapPage

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Add state for tracking enabled operational statuses in the filter.

**Changes Required:**
```typescript
import { OPERATIONAL_STATUSES, type OperationalStatus } from '../utils/orderStatusMap';

// Inside component:
const [enabledStatuses, setEnabledStatuses] = useState<Set<OperationalStatus>>(
  new Set(OPERATIONAL_STATUSES) // Default: all enabled
);
```

**Rationale:**
- Default to showing all Orders (all statuses enabled)
- Set data structure for efficient lookup
- Type-safe status values

**Validation:**
- State initializes correctly with all statuses enabled
- State updates properly when filter changes

---

## Phase 2: Create StatusFilterControl Component

### Task 2.1: Create StatusFilterControl Component

**File:** `src/modules/map/components/StatusFilterControl.tsx` (NEW)

**Description:**
Create a reusable filter control component for status filtering.

**Component Interface:**
```typescript
interface StatusFilterControlProps {
  enabledStatuses: Set<OperationalStatus>;
  onStatusToggle: (status: OperationalStatus) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}
```

**UI Requirements:**
- Checkbox list for each operational status
- Human-readable labels from STATUS_LABELS
- Visual indication of enabled/disabled states
- Optional: "Select All" and "Clear All" buttons
- Compact design suitable for map overlay

**Implementation:**
```typescript
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { OPERATIONAL_STATUSES, STATUS_LABELS, type OperationalStatus } from '../utils/orderStatusMap';

export const StatusFilterControl: React.FC<StatusFilterControlProps> = ({
  enabledStatuses,
  onStatusToggle,
  onSelectAll,
  onClearAll,
}) => {
  const allEnabled = OPERATIONAL_STATUSES.every(status => enabledStatuses.has(status));
  
  return (
    <div className="space-y-2 p-3 bg-white rounded-lg border shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold">Filter by Status</Label>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onSelectAll} className="h-6 text-xs">
            All
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 text-xs">
            None
          </Button>
        </div>
      </div>
      {OPERATIONAL_STATUSES.map((status) => (
        <div key={status} className="flex items-center space-x-2">
          <Checkbox
            id={`status-${status}`}
            checked={enabledStatuses.has(status)}
            onCheckedChange={() => onStatusToggle(status)}
          />
          <Label
            htmlFor={`status-${status}`}
            className="text-sm font-normal cursor-pointer"
          >
            {STATUS_LABELS[status]}
          </Label>
        </div>
      ))}
    </div>
  );
};
```

**Rationale:**
- Reusable component for status filtering
- Clear UX with checkboxes and labels
- Quick actions for common operations
- Consistent with shadcn/ui design system

**Validation:**
- Component renders correctly
- Checkboxes toggle correctly
- Labels display correctly
- Select All / Clear All work correctly

---

### Task 2.2: Integrate StatusFilterControl into JobsMapPage

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Add StatusFilterControl component to the UI, positioned above the search input.

**Location:** Inside CardHeader, above search input

**Changes Required:**
```typescript
import { StatusFilterControl } from '../components/StatusFilterControl';

// Inside CardHeader, before search input:
<StatusFilterControl
  enabledStatuses={enabledStatuses}
  onStatusToggle={(status) => {
    setEnabledStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }}
  onSelectAll={() => setEnabledStatuses(new Set(OPERATIONAL_STATUSES))}
  onClearAll={() => setEnabledStatuses(new Set())}
/>
```

**Rationale:**
- Clear placement above search (filter → search → map hierarchy)
- Easy to find and use
- Doesn't interfere with map interactions

**Validation:**
- Component renders in correct location
- Filter state updates correctly
- UI doesn't interfere with existing elements

---

## Phase 3: Apply Filters to Order Pins

### Task 3.1: Update OrderMapMarker to Include Operational Status

**File:** `src/modules/map/utils/orderMapTransform.ts` (UPDATE)

**Description:**
Add operational status to OrderMapMarker interface and transformation.

**Changes Required:**
```typescript
import { mapStoneStatusToOperational, type OperationalStatus } from './orderStatusMap';

export interface OrderMapMarker extends MapMarker {
  // ... existing fields
  operationalStatus: OperationalStatus; // NEW
  stone_status: 'NA' | 'Ordered' | 'In Stock'; // NEW - keep original for reference
}

export function transformOrderToMarker(order: Order): OrderMapMarker | null {
  // ... existing validation
  
  const operationalStatus = mapStoneStatusToOperational(order.stone_status);
  
  return {
    // ... existing fields
    operationalStatus, // NEW
    stone_status: order.stone_status, // NEW
  };
}
```

**Rationale:**
- Operational status available for filtering
- Original stone_status preserved for display/reference
- Type-safe status values

**Validation:**
- Marker includes operationalStatus
- Mapping works correctly for all status values
- TypeScript types are correct

---

### Task 3.2: Apply Status Filter to Markers

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Update filteredMarkers computation to include status filtering.

**Location:** `filteredMarkers` useMemo hook

**Changes Required:**
```typescript
const filteredMarkers = useMemo(() => {
  let filtered = markers;
  
  // Search filter (existing)
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(marker =>
      marker.customer.toLowerCase().includes(query) ||
      marker.location.toLowerCase().includes(query) ||
      (marker.sku && marker.sku.toLowerCase().includes(query))
    );
  }
  
  // Status filter (NEW)
  if (enabledStatuses.size > 0 && enabledStatuses.size < OPERATIONAL_STATUSES.length) {
    filtered = filtered.filter(marker => 
      enabledStatuses.has(marker.operationalStatus)
    );
  }
  
  // Assignment filter (existing - applied after status)
  // This is handled separately in the sidebar list
  
  return filtered;
}, [markers, searchQuery, enabledStatuses]);
```

**Rationale:**
- Status filter applied after search, before assignment filter
- Only applies filter if not all statuses are enabled (performance)
- Maintains existing filter logic
- Works correctly with other filters

**Validation:**
- Status filter works correctly
- Filters combine correctly (search + status)
- No performance issues
- All Orders shown when all statuses enabled

---

### Task 3.3: Handle Pin Visibility and Selectability

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE - VERIFY)

**Description:**
Ensure that assigned Orders (job_id IS NOT NULL) remain visible but non-selectable, regardless of status filter.

**Current Behavior:**
- Assigned Orders are visible but non-selectable (handled in toggleOrderSelection)
- Status filter should not change this behavior

**Verification:**
- Assigned Orders are still visible when their status is enabled
- Assigned Orders cannot be selected (existing logic)
- Unassigned Orders with enabled status can be selected

**Rationale:**
- Consistency with existing behavior
- Users can see assigned Orders even if filtered
- Clear distinction between visibility and selectability

**Validation:**
- Assigned Orders remain visible when status matches
- Assignment status takes precedence over selection
- No regressions in selection logic

---

## Phase 4: Selection Consistency & Safety

### Task 4.1: Auto-deselect Hidden Orders

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Automatically deselect Orders that become hidden when filters change.

**Changes Required:**
```typescript
// Add useEffect to monitor filteredMarkers and selectedOrderIds
useEffect(() => {
  const visibleOrderIds = new Set(filteredMarkers.map(m => m.id));
  setSelectedOrderIds(prev => {
    const next = new Set(prev);
    let changed = false;
    // Remove any selected IDs that are not visible
    prev.forEach(id => {
      if (!visibleOrderIds.has(id)) {
        next.delete(id);
        changed = true;
      }
    });
    return changed ? next : prev;
  });
}, [filteredMarkers]);
```

**Rationale:**
- Prevents selected Orders from being used when hidden
- Maintains consistency between visible pins and selected Orders
- Improves UX by preventing confusion

**Validation:**
- Selected Orders are deselected when hidden by filter
- Selection state updates correctly
- No unnecessary re-renders
- Performance is acceptable

---

### Task 4.2: Ensure Job Creation Uses Only Visible Orders

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Add validation to ensure Job creation only uses visible and unassigned Orders.

**Changes Required:**
```typescript
// Update handleCreateJob function
const handleCreateJob = () => {
  if (selectedOrderIds.size === 0) return;
  
  // Filter to only visible and unassigned Orders
  const visibleOrderIds = new Set(filteredMarkers.map(m => m.id));
  const validSelectedIds = Array.from(selectedOrderIds).filter(id => {
    const marker = filteredMarkers.find(m => m.id === id);
    return marker && !marker.isAssigned && visibleOrderIds.has(id);
  });
  
  if (validSelectedIds.length === 0) {
    toast({
      title: 'No valid orders selected',
      description: 'Selected orders must be visible and unassigned.',
      variant: 'destructive',
    });
    return;
  }
  
  // Use validSelectedIds for job creation
  // (may need to update CreateJobDrawer to accept filtered IDs)
  setIsCreateJobDrawerOpen(true);
};
```

**Note:** May need to verify how CreateJobDrawer handles initialOrderIds. If it validates internally, this may be redundant but provides safety.

**Rationale:**
- Safety measure to prevent creating Jobs from hidden Orders
- Ensures only valid Orders are used
- Better error messaging for users

**Validation:**
- Job creation only uses visible Orders
- Error handling works correctly
- No regressions in Job creation flow

---

## Phase 5: Display Status in OrderInfoPanel

### Task 5.1: Add Status Display to OrderInfoPanel

**File:** `src/modules/map/components/OrderInfoPanel.tsx` (UPDATE)

**Description:**
Display operational status in OrderInfoPanel with human-readable label.

**Changes Required:**
```typescript
import { mapStoneStatusToOperational, STATUS_LABELS } from '../utils/orderStatusMap';
import { Badge } from '@/shared/components/ui/badge';

// Inside component, add status display:
const operationalStatus = mapStoneStatusToOperational(order.stone_status);
const statusLabel = STATUS_LABELS[operationalStatus];

// In CardContent, add status display section:
<div className="pt-2 border-t">
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium">Status:</span>
    <Badge variant="outline">{statusLabel}</Badge>
  </div>
</div>
```

**Rationale:**
- Users can see Order status when viewing details
- Provides context for filtering decisions
- Consistent with status display in other parts of application
- Read-only display (no editing)

**Validation:**
- Status displays correctly
- Label is human-readable
- Badge styling is consistent
- No editing capability (read-only)

---

## Phase 6: Empty States & UX Polish

### Task 6.1: Handle Empty Filter Results

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Show appropriate empty state when no Orders match the filters.

**Changes Required:**
```typescript
// Update empty state message in sidebar
{filteredMarkers.length === 0 ? (
  <div className="text-center py-8 text-slate-600">
    {searchQuery
      ? 'No orders match your search'
      : enabledStatuses.size === 0
      ? 'No status filters selected. Enable at least one status to view orders.'
      : 'No orders match the selected status filters'}
  </div>
) : (
  // ... existing marker list
)}
```

**Rationale:**
- Better UX when filters result in no visible Orders
- Helps users understand why map is empty
- Suggests adjusting filters

**Validation:**
- Empty state message displays correctly
- Message is appropriate for different scenarios
- Users understand how to fix the issue

---

### Task 6.2: Handle Selection Action Bar Visibility

**File:** `src/modules/map/pages/JobsMapPage.tsx` (VERIFY)

**Description:**
Ensure selection action bar hides when nothing is selected (existing behavior should be correct).

**Current Behavior:**
```typescript
{selectedOrderIds.size > 0 && (
  <Card className="fixed bottom-4...">
    // Action bar
  </Card>
)}
```

**Verification:**
- Action bar only shows when Orders are selected
- Action bar hides when selection is cleared
- No changes needed if behavior is correct

**Rationale:**
- Clean UI when no selection
- Action bar only appears when relevant

---

## Phase 7: Verification & Regression Checks

### Task 7.1: TypeScript Compilation

**Verification Steps:**
1. Run `npm run build` to check TypeScript compilation
2. Verify no type errors
3. Verify all imports resolve correctly

**Expected Result:**
- Build succeeds without errors
- No TypeScript errors
- No type warnings

---

### Task 7.2: Runtime Testing

**Verification Steps:**
1. Open Map of Jobs page
2. Verify StatusFilterControl appears above search
3. Toggle status filters → verify map updates
4. Select Orders → verify selection works
5. Change filters with Orders selected → verify auto-deselection
6. Create Job from selected Orders → verify works correctly
7. Verify assigned Orders remain visible but non-selectable
8. Test with all statuses enabled → verify all Orders shown
9. Test with no statuses enabled → verify empty state

**Expected Result:**
- All functionality works as expected
- No console errors
- Filters work correctly
- Selection consistency maintained
- Job creation works correctly

---

### Task 7.3: Regression Testing

**Verification Steps:**
1. Verify existing search filtering still works
2. Verify existing assignment filtering still works
3. Verify Order selection from map still works
4. Verify Order selection from sidebar still works
5. Verify OrderInfoPanel displays correctly
6. Verify navigation to Order details still works
7. Verify Orders module unchanged (no regressions)
8. Verify Jobs module unchanged (no regressions)

**Expected Result:**
- No regressions in existing functionality
- All existing features work as before
- Status filtering is additive (doesn't break existing features)

---

### Task 7.4: Database and API Verification

**Verification Steps:**
1. Verify no database migrations were created
2. Verify no API changes were made
3. Verify data fetching unchanged
4. Verify Orders table schema unchanged

**Expected Result:**
- No database changes
- No API changes
- Data access patterns unchanged
- Schema remains as-is

---

## File Changes Summary

| File | Action | Lines Changed | Description |
|------|--------|---------------|-------------|
| `src/modules/map/utils/orderStatusMap.ts` | NEW | ~40-50 | Status constants, mapping functions, labels |
| `src/modules/map/components/StatusFilterControl.tsx` | NEW | ~60-80 | Filter control component with checkboxes |
| `src/modules/map/pages/JobsMapPage.tsx` | UPDATE | ~50-70 | Add filter state, integrate component, apply filters, selection consistency |
| `src/modules/map/utils/orderMapTransform.ts` | UPDATE | ~10-15 | Add operationalStatus to marker interface and transformation |
| `src/modules/map/components/OrderInfoPanel.tsx` | UPDATE | ~10-15 | Display operational status with label |

**Total Estimated Changes:** ~170-230 lines across 5 files

---

## Success Criteria Checklist

- [ ] Operational status model defined and mapped from database values
- [ ] StatusFilterControl component created and integrated
- [ ] Status filter applies to Order pins on map
- [ ] Map updates instantly when filters change
- [ ] Selected Orders automatically deselected when hidden
- [ ] Job creation only uses visible and unassigned Orders
- [ ] Operational status displayed in OrderInfoPanel
- [ ] Empty state shown when no Orders match filters
- [ ] No regressions in search, assignment filtering, or selection
- [ ] No database or API changes
- [ ] No changes to Orders or Jobs modules
- [ ] TypeScript compilation succeeds
- [ ] All tests pass (if applicable)

---

## Rollback Plan

If issues occur:

1. **Revert file changes:**
   - Delete `src/modules/map/utils/orderStatusMap.ts`
   - Delete `src/modules/map/components/StatusFilterControl.tsx`
   - Revert changes to `JobsMapPage.tsx`, `orderMapTransform.ts`, `OrderInfoPanel.tsx`

2. **No database changes required:**
   - No migrations to rollback
   - No data changes

3. **No API changes:**
   - No backend changes to revert

---

## Notes

1. **Status Mapping:**
   - Database uses inventory-style values ('NA', 'Ordered', 'In Stock')
   - Map uses operational status model ('planned', 'in_progress', 'ready_for_installation')
   - Mapping function provides translation layer
   - Can be extended with additional statuses (completed, cancelled) in future

2. **Filter Default:**
   - All statuses enabled by default (show all Orders)
   - Users can disable statuses to focus on specific states
   - Empty filter (no statuses enabled) shows empty state

3. **Selection Safety:**
   - Auto-deselection prevents confusion
   - Job creation validates visible and unassigned Orders
   - Multiple safety layers prevent invalid Job creation

4. **Performance:**
   - Filter applied in useMemo for efficiency
   - Only filters when not all statuses enabled
   - Set data structure for O(1) lookup

5. **Future Enhancements:**
   - Could add filtering by permit_status or proof_status
   - Could add color-coding of pins by status
   - Could persist filter state (currently resets on reload)
   - Could add status-based grouping or clustering

---

## References

- Specification: `specs/map-order-status-filters.md`
- Map of Jobs Page: `src/modules/map/pages/JobsMapPage.tsx`
- Order Transform: `src/modules/map/utils/orderMapTransform.ts`
- OrderInfoPanel: `src/modules/map/components/OrderInfoPanel.tsx`
- Order Types: `src/modules/orders/types/orders.types.ts`
- Orders Schema: `supabase/migrations/20250608000001_create_orders_table.sql`

