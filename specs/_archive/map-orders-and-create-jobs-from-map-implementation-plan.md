# Implementation Plan: Map Orders Visualization & Job Creation from Map

## Overview

This plan implements the transformation of the Map of Jobs module from displaying Jobs to displaying Orders, with multi-select functionality and Job creation directly from the map. The implementation replaces Job-based map pins with Order-based pins, enables selecting multiple Orders, and integrates with the existing CreateJobDrawer to create Jobs from selected Orders.

**Goal:** Replace Job pins with Order pins, enable multi-select, and allow creating Jobs from selected Orders on the map.

**Constraints:**
- No database schema changes (all required fields exist)
- UI-only changes (no backend API modifications)
- Backward compatibility required (existing Jobs and Orders unchanged)
- CreateJobDrawer integration only (no component structure changes)

---

## Phase 1: Switch Map Data Source to Orders

### Task 1.1: Create Orders Map Hook

**File:** `src/modules/map/hooks/useOrders.ts` (NEW)

**Description:**
Create a new hook to fetch Orders with coordinates for map display. This hook will filter Orders to only include those with valid latitude and longitude values.

**Implementation:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { Order } from '@/modules/orders/types/orders.types';

export const mapOrdersKeys = {
  all: ['map', 'orders'] as const,
};

async function fetchOrdersForMap(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Order[];
}

export function useOrdersForMap() {
  return useQuery({
    queryKey: mapOrdersKeys.all,
    queryFn: fetchOrdersForMap,
  });
}
```

**Validation:**
- Hook fetches only Orders with coordinates
- Returns empty array if no Orders have coordinates
- Handles errors gracefully

---

### Task 1.2: Create Orders Map Transform Utility

**File:** `src/modules/map/utils/orderMapTransform.ts` (NEW)

**Description:**
Create utility functions to transform Order data into MapMarker format, handling assigned vs unassigned Order styling.

**Implementation:**
```typescript
import type { Order } from '@/modules/orders/types/orders.types';
import type { MapMarker } from './mapTransform';

export interface OrderMapMarker extends MapMarker {
  jobId: string | null;
  isAssigned: boolean;
  value: number | null;
  sku: string | null;
  material: string | null;
  color: string | null;
}

/**
 * Get marker color based on assignment status
 */
export function getOrderMarkerColor(isAssigned: boolean, isSelected: boolean = false): string {
  if (isSelected) return '#8b5cf6'; // purple for selected
  if (isAssigned) return '#9ca3af'; // gray for assigned
  return '#3b82f6'; // blue for unassigned
}

/**
 * Transform Order to map marker format
 */
export function transformOrderToMarker(order: Order): OrderMapMarker | null {
  // Only include orders with valid coordinates
  if (order.latitude === null || order.longitude === null) {
    return null;
  }

  const isAssigned = order.job_id !== null;

  return {
    id: order.id,
    customer: order.customer_name, // Deceased name
    location: order.location || 'No location',
    address: order.location || '', // Use location as address fallback
    coordinates: {
      lat: order.latitude,
      lng: order.longitude,
    },
    status: 'scheduled', // Default status for Orders (not Job status)
    priority: order.priority,
    scheduledDate: null, // Orders don't have scheduled_date
    estimatedDuration: null, // Orders don't have estimated_duration
    jobId: order.job_id,
    isAssigned,
    value: order.value,
    sku: order.sku,
    material: order.material,
    color: order.color,
  };
}

/**
 * Transform array of Orders to map markers
 */
export function transformOrdersToMarkers(orders: Order[]): OrderMapMarker[] {
  return orders
    .map(transformOrderToMarker)
    .filter((marker): marker is OrderMapMarker => marker !== null);
}
```

**Validation:**
- Transforms Orders correctly to marker format
- Filters out Orders without coordinates
- Sets isAssigned flag correctly
- Handles null values gracefully

---

### Task 1.3: Update JobsMapPage to Use Orders

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Replace Jobs data source with Orders data source. Update imports, hooks, and transform functions.

**Changes:**
1. Replace `useJobsList()` import with `useOrdersForMap()`
2. Replace `transformJobsToMarkers()` with `transformOrdersToMarkers()`
3. Update variable names: `jobsData` → `ordersData`, `markers` → `orderMarkers`
4. Update filtering logic to work with Order fields instead of Job fields
5. Update search filter to search Order fields (customer_name, location, sku)

**Key Changes:**
```typescript
// OLD:
import { useJobsList } from '../hooks/useJobs';
import { transformJobsToMarkers } from '../utils/mapTransform';

// NEW:
import { useOrdersForMap } from '../hooks/useOrders';
import { transformOrdersToMarkers } from '../utils/orderMapTransform';

// OLD:
const { data: jobsData, isLoading, error, refetch } = useJobsList();
const markers = useMemo(() => {
  if (!jobsData) return [];
  return transformJobsToMarkers(jobsData);
}, [jobsData]);

// NEW:
const { data: ordersData, isLoading, error, refetch } = useOrdersForMap();
const markers = useMemo(() => {
  if (!ordersData) return [];
  return transformOrdersToMarkers(ordersData);
}, [ordersData]);
```

**Update Search Filter:**
```typescript
// Update search to work with Order fields
if (searchQuery) {
  const query = searchQuery.toLowerCase();
  filtered = filtered.filter(marker =>
    marker.customer.toLowerCase().includes(query) ||
    marker.location.toLowerCase().includes(query) ||
    (marker.sku && marker.sku.toLowerCase().includes(query))
  );
}
```

**Validation:**
- Map renders Order pins instead of Job pins
- No crashes when Orders list is empty
- Search filtering works with Order fields
- Status filter removed (Orders don't have Job status)

---

## Phase 2: Pin State & Selection Logic

### Task 2.1: Add Selection State Management

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Add state management for multi-select functionality. Track selected Order IDs and prevent selection of assigned Orders.

**Implementation:**
```typescript
// Add selection state
const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

// Toggle selection function
const toggleOrderSelection = (orderId: string, isAssigned: boolean) => {
  if (isAssigned) return; // Cannot select assigned Orders
  
  setSelectedOrderIds(prev => {
    const next = new Set(prev);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    return next;
  });
};

// Clear selection function
const clearSelection = () => {
  setSelectedOrderIds(new Set());
};
```

**Validation:**
- Selection state tracks multiple Order IDs
- Assigned Orders cannot be selected
- Selection can be toggled on/off

---

### Task 2.2: Update GoogleMap Component for Multi-Select

**File:** `src/modules/map/components/GoogleMap.tsx` (UPDATE)

**Description:**
Update GoogleMap component to support multi-select markers with visual states for selected, unselected, and assigned Orders.

**Interface Changes:**
```typescript
interface MapProps {
  markers: MapMarker[];
  selectedMarker: string | null; // DEPRECATED - keep for backward compatibility
  selectedMarkerIds: Set<string>; // NEW - multi-select support
  onMarkerSelect: (markerId: string | null) => void; // DEPRECATED
  onMarkerToggle: (markerId: string, isAssigned: boolean) => void; // NEW
  isLoading?: boolean;
  error?: Error | null;
}
```

**Marker Styling Updates:**
```typescript
// Update marker icon creation to handle selection and assignment states
const getMarkerIcon = (marker: OrderMapMarker, isSelected: boolean) => {
  const color = getOrderMarkerColor(marker.isAssigned, isSelected);
  // ... create SVG icon with color
};

// Update click handler
googleMarker.addListener('click', () => {
  if (marker.isAssigned) {
    // Show info but don't allow selection
    infoWindow.open(map, googleMarker);
    return;
  }
  
  // Toggle selection
  onMarkerToggle(marker.id, marker.isAssigned);
  
  // Show info window
  infoWindow.open(map, googleMarker);
});
```

**Visual States:**
- Unassigned + Unselected: Blue pin (#3b82f6)
- Unassigned + Selected: Purple pin (#8b5cf6) with border
- Assigned: Gray pin (#9ca3af), not clickable for selection

**Validation:**
- Multiple Orders can be selected
- Assigned Orders cannot be selected
- Visual feedback for selection state
- Click handler prevents selection of assigned Orders

---

### Task 2.3: Add Selection Action Bar

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Add a selection action bar that appears when Orders are selected, showing count and total price.

**Implementation:**
```typescript
// Calculate total price of selected Orders
const selectedOrdersTotal = useMemo(() => {
  if (!ordersData || selectedOrderIds.size === 0) return 0;
  
  return Array.from(selectedOrderIds)
    .reduce((sum, orderId) => {
      const order = ordersData.find(o => o.id === orderId);
      return sum + (order?.value || 0);
    }, 0);
}, [ordersData, selectedOrderIds]);

// Selection Action Bar Component
{selectedOrderIds.size > 0 && (
  <Card className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 shadow-lg">
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            {selectedOrderIds.size} Order{selectedOrderIds.size !== 1 ? 's' : ''} selected
          </p>
          <p className="text-xs text-slate-600">
            Total: £{selectedOrdersTotal.toFixed(2)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearSelection}>
            Clear
          </Button>
          <Button onClick={handleCreateJob}>
            Create Job
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

**Validation:**
- Action bar appears only when Orders are selected
- Total price updates live as selection changes
- Clear button resets selection
- Create Job button ready (will be implemented in Phase 5)

---

## Phase 3: Order Info UI (Pin Click)

### Task 3.1: Create OrderInfoPanel Component

**File:** `src/modules/map/components/OrderInfoPanel.tsx` (NEW)

**Description:**
Create a read-only Order details panel component that displays when clicking an Order pin.

**Implementation:**
```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { MapPin, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import type { Order } from '@/modules/orders/types/orders.types';

interface OrderInfoPanelProps {
  order: Order;
  isSelected: boolean;
  onToggleSelection: () => void;
  onViewOrder: () => void;
}

export const OrderInfoPanel: React.FC<OrderInfoPanelProps> = ({
  order,
  isSelected,
  onToggleSelection,
  onViewOrder,
}) => {
  const isAssigned = order.job_id !== null;
  
  // Parse dimensions from notes (if present)
  const parseDimensions = (notes: string | null): string | null => {
    if (!notes) return null;
    // Simple regex to find dimensions (e.g., "12x8x2", "12\" x 8\" x 2\"")
    const dimensionMatch = notes.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?/i);
    if (dimensionMatch) {
      return dimensionMatch[0];
    }
    return null;
  };

  const dimensions = parseDimensions(order.notes);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{order.customer_name}</CardTitle>
          {isAssigned && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
              Assigned
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Details */}
        <div className="space-y-2 text-sm">
          {order.sku && (
            <div>
              <span className="font-medium">Grave Number:</span> {order.sku}
            </div>
          )}
          {order.location && (
            <div className="flex items-start">
              <MapPin className="h-4 w-4 mr-1 mt-0.5 text-slate-500" />
              <span>{order.location}</span>
            </div>
          )}
          {order.latitude && order.longitude && (
            <div className="text-xs text-slate-600">
              Coordinates: {order.latitude.toFixed(6)}, {order.longitude.toFixed(6)}
            </div>
          )}
        </div>

        {/* Product Snapshot */}
        {(order.material || order.color) && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-medium text-slate-600">Product Details</p>
            {order.material && (
              <div className="text-sm">
                <span className="font-medium">Stone Type:</span> {order.material}
              </div>
            )}
            {order.color && (
              <div className="text-sm">
                <span className="font-medium">Stone Color:</span> {order.color}
              </div>
            )}
            {dimensions && (
              <div className="text-sm">
                <span className="font-medium">Dimensions:</span> {dimensions}
              </div>
            )}
          </div>
        )}

        {/* Price */}
        {order.value && (
          <div className="pt-2 border-t">
            <div className="text-sm">
              <span className="font-medium">Price:</span> £{order.value.toFixed(2)}
            </div>
          </div>
        )}

        {/* Notes (Collapsed) */}
        {order.notes && (
          <details className="pt-2 border-t">
            <summary className="text-sm font-medium cursor-pointer">Notes</summary>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{order.notes}</p>
          </details>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          {!isAssigned && (
            <Button
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={onToggleSelection}
              className="flex-1"
            >
              {isSelected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Deselect
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Select
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onViewOrder}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Order
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Validation:**
- Displays all Order details correctly
- Handles null/undefined values gracefully
- Selection button works correctly
- View Order button navigates to Orders module

---

### Task 3.2: Integrate Info Panel with Map

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Integrate OrderInfoPanel with the map, showing it when an Order pin is clicked.

**Implementation:**
```typescript
// Add state for selected Order (for info panel)
const [selectedOrderForInfo, setSelectedOrderForInfo] = useState<Order | null>(null);

// Update marker click handler
const handleMarkerClick = (orderId: string) => {
  const order = ordersData?.find(o => o.id === orderId);
  if (order) {
    setSelectedOrderForInfo(order);
  }
};

// Handle toggle selection from info panel
const handleToggleSelectionFromPanel = (orderId: string) => {
  const order = ordersData?.find(o => o.id === orderId);
  if (order && !order.job_id) {
    toggleOrderSelection(orderId, false);
  }
};

// Handle view order navigation
const handleViewOrder = (orderId: string) => {
  // Navigate to Orders module (or open Order detail drawer)
  window.location.href = `/dashboard/orders?order=${orderId}`;
};

// Render info panel
{selectedOrderForInfo && (
  <div className="fixed top-4 right-4 z-50">
    <OrderInfoPanel
      order={selectedOrderForInfo}
      isSelected={selectedOrderIds.has(selectedOrderForInfo.id)}
      onToggleSelection={() => handleToggleSelectionFromPanel(selectedOrderForInfo.id)}
      onViewOrder={() => handleViewOrder(selectedOrderForInfo.id)}
    />
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setSelectedOrderForInfo(null)}
      className="absolute top-2 right-2"
    >
      ×
    </Button>
  </div>
)}
```

**Validation:**
- Info panel appears when clicking Order pin
- Selection state is reflected in panel
- Panel can be closed
- Navigation to Orders module works

---

## Phase 4: Selection Action Bar (Already in Phase 2)

This phase was already covered in Task 2.3. No additional work needed.

---

## Phase 5: Create Job From Map

### Task 5.1: Integrate CreateJobDrawer

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Open CreateJobDrawer when "Create Job" is clicked, pre-filling order_ids and location from selected Orders.

**Implementation:**
```typescript
// Add state for CreateJobDrawer
const [isCreateJobDrawerOpen, setIsCreateJobDrawerOpen] = useState(false);

// Handle Create Job button click
const handleCreateJob = () => {
  if (selectedOrderIds.size === 0) return;
  setIsCreateJobDrawerOpen(true);
};

// Get first selected Order for auto-filling location
const firstSelectedOrder = useMemo(() => {
  if (!ordersData || selectedOrderIds.size === 0) return null;
  const firstId = Array.from(selectedOrderIds)[0];
  return ordersData.find(o => o.id === firstId) || null;
}, [ordersData, selectedOrderIds]);

// Handle drawer close
const handleDrawerClose = (open: boolean) => {
  setIsCreateJobDrawerOpen(open);
  if (!open) {
    // Optionally clear selection when drawer closes without creating
    // clearSelection();
  }
};

// Render CreateJobDrawer
<CreateJobDrawer
  open={isCreateJobDrawerOpen}
  onOpenChange={handleDrawerClose}
  initialOrderIds={Array.from(selectedOrderIds)}
  initialLocation={firstSelectedOrder?.location || ''}
/>
```

**Update CreateJobDrawer Interface:**
```typescript
// File: src/modules/jobs/components/CreateJobDrawer.tsx
interface CreateJobDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOrderIds?: string[]; // NEW - pre-fill order_ids
  initialLocation?: string; // NEW - pre-fill location
}
```

**Update CreateJobDrawer to Accept Initial Values:**
```typescript
export const CreateJobDrawer: React.FC<CreateJobDrawerProps> = ({
  open,
  onOpenChange,
  initialOrderIds = [],
  initialLocation = '',
}) => {
  // ... existing code ...
  
  // Update form default values
  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      order_ids: initialOrderIds, // Pre-fill from props
      assigned_people_ids: [],
      location_name: initialLocation, // Pre-fill from props
      address: '',
      latitude: null,
      longitude: null,
      status: 'scheduled',
      scheduled_date: null,
      estimated_duration: '',
      priority: 'medium',
      notes: '',
    },
  });

  // Update reset logic to use initial values
  useEffect(() => {
    if (open) {
      form.reset({
        order_ids: initialOrderIds,
        assigned_people_ids: [],
        location_name: initialLocation,
        address: '',
        latitude: null,
        longitude: null,
        status: 'scheduled',
        scheduled_date: null,
        estimated_duration: '',
        priority: 'medium',
        notes: '',
      });
    }
  }, [open, form, initialOrderIds, initialLocation]);
  
  // ... rest of component ...
};
```

**Validation:**
- CreateJobDrawer opens when "Create Job" clicked
- order_ids pre-filled with selected Order IDs
- location pre-filled from first selected Order
- Status defaults to 'scheduled'

---

### Task 5.2: Handle Job Creation Success

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
After Job creation, refresh Orders data, clear selection, and show success message. Assigned Orders should appear as non-selectable.

**Implementation:**
```typescript
// Add success handler
const handleJobCreated = () => {
  // Refresh Orders data
  refetch();
  
  // Clear selection
  clearSelection();
  
  // Close drawer
  setIsCreateJobDrawerOpen(false);
  
  // Close info panel if open
  setSelectedOrderForInfo(null);
  
  // Show success message
  toast({
    title: 'Job created',
    description: `Job created with ${selectedOrderIds.size} order(s).`,
  });
};

// Update CreateJobDrawer to call success handler
<CreateJobDrawer
  open={isCreateJobDrawerOpen}
  onOpenChange={handleDrawerClose}
  initialOrderIds={Array.from(selectedOrderIds)}
  initialLocation={firstSelectedOrder?.location || ''}
  onJobCreated={handleJobCreated} // NEW - callback for success
/>
```

**Update CreateJobDrawer to Accept onJobCreated Callback:**
```typescript
// File: src/modules/jobs/components/CreateJobDrawer.tsx
interface CreateJobDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOrderIds?: string[];
  initialLocation?: string;
  onJobCreated?: () => void; // NEW - callback after successful creation
}

// In onSubmit handler, after successful Job creation and Order updates:
onJobCreated?.(); // Call callback if provided
```

**Validation:**
- Orders data refreshes after Job creation
- Selection is cleared
- Success message is shown
- Assigned Orders appear as non-selectable on map
- Info panel closes if open

---

### Task 5.3: Error Handling

**File:** `src/modules/map/pages/JobsMapPage.tsx` (UPDATE)

**Description:**
Handle Job creation and Order update failures gracefully, showing appropriate error messages and maintaining selection state on error.

**Implementation:**
```typescript
// Error handling is already in CreateJobDrawer
// But we should handle errors at the map level too

const handleJobCreationError = (error: Error) => {
  toast({
    title: 'Failed to create job',
    description: error.message || 'An error occurred while creating the job.',
    variant: 'destructive',
  });
  // Selection state is maintained (not cleared) to allow retry
};

// Update CreateJobDrawer to accept error handler
<CreateJobDrawer
  open={isCreateJobDrawerOpen}
  onOpenChange={handleDrawerClose}
  initialOrderIds={Array.from(selectedOrderIds)}
  initialLocation={firstSelectedOrder?.location || ''}
  onJobCreated={handleJobCreated}
  onError={handleJobCreationError} // NEW - error callback
/>
```

**Update CreateJobDrawer Error Handling:**
```typescript
// File: src/modules/jobs/components/CreateJobDrawer.tsx
interface CreateJobDrawerProps {
  // ... existing props ...
  onError?: (error: Error) => void; // NEW - error callback
}

// In onSubmit catch block:
catch (error) {
  let errorMessage = 'Failed to create job.';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  }
  
  toast({
    title: 'Error',
    description: errorMessage,
    variant: 'destructive',
  });
  
  // Call error callback if provided
  onError?.(error instanceof Error ? error : new Error(errorMessage));
}
```

**Validation:**
- Job creation failures show error message
- Order update failures show error message
- Selection state maintained on error (allows retry)
- User can retry Job creation without re-selecting Orders

---

## Phase 6: Verification & Regression Checks

### Task 6.1: Verify Orders Module Unchanged

**Verification Steps:**
1. Navigate to Orders module (`/dashboard/orders`)
2. Verify Orders list displays correctly
3. Verify Order creation works
4. Verify Order editing works
5. Verify Order deletion works
6. Verify no console errors

**Expected Result:**
- Orders module functions identically to before
- No regressions in Orders CRUD operations

---

### Task 6.2: Verify Jobs Module Unchanged

**Verification Steps:**
1. Navigate to Jobs module (if exists) or use CreateJobDrawer from other locations
2. Verify Job creation works
3. Verify Job editing works (if implemented)
4. Verify Job deletion works (if implemented)
5. Verify no console errors

**Expected Result:**
- Jobs module functions identically to before
- CreateJobDrawer works from all entry points
- No regressions in Jobs CRUD operations

---

### Task 6.3: Verify Assigned Orders Render as Disabled

**Verification Steps:**
1. Create a Job with some Orders
2. Navigate to Map of Jobs
3. Verify assigned Orders appear on map with gray pins
4. Click assigned Order pin
5. Verify info panel shows "Assigned" badge
6. Verify assigned Order cannot be selected
7. Verify assigned Order pin is not clickable for selection

**Expected Result:**
- Assigned Orders visually distinct (gray pins)
- Assigned Orders non-selectable
- Info panel shows assignment status

---

### Task 6.4: Verify Map Loads Without Orders

**Verification Steps:**
1. Ensure no Orders have coordinates (or temporarily remove coordinates)
2. Navigate to Map of Jobs
3. Verify map loads without errors
4. Verify empty state message displays
5. Verify no crashes or console errors

**Expected Result:**
- Map handles empty Orders list gracefully
- Empty state message displays
- No crashes or errors

---

## File Changes Summary

| File | Action | Lines Changed | Description |
|------|--------|---------------|-------------|
| `src/modules/map/hooks/useOrders.ts` | CREATE | ~30 | New hook to fetch Orders for map |
| `src/modules/map/utils/orderMapTransform.ts` | CREATE | ~80 | Transform Orders to map markers |
| `src/modules/map/components/OrderInfoPanel.tsx` | CREATE | ~150 | Read-only Order details panel |
| `src/modules/map/pages/JobsMapPage.tsx` | UPDATE | ~200 | Replace Jobs with Orders, add selection, integrate CreateJobDrawer |
| `src/modules/map/components/GoogleMap.tsx` | UPDATE | ~100 | Support multi-select, visual states for assigned/unassigned |
| `src/modules/jobs/components/CreateJobDrawer.tsx` | UPDATE | ~50 | Accept initial values and callbacks |

**Total Estimated Changes:** ~610 lines across 7 files (3 new, 4 updated)

---

## Success Criteria Checklist

- [ ] Orders appear on map correctly (one pin per Order with coordinates)
- [ ] Assigned Orders (`job_id IS NOT NULL`) are visually distinct (muted/gray) and non-selectable
- [ ] Unassigned Orders (`job_id IS NULL`) are selectable with normal styling
- [ ] Multi-selection works reliably (click to toggle, visual feedback)
- [ ] Order details visible in info panel when clicking pin
- [ ] Selection action bar appears when Orders are selected
- [ ] "Create Job" opens CreateJobDrawer with pre-filled `order_ids`
- [ ] Job creation assigns Orders correctly (updates `orders.job_id`)
- [ ] Map refreshes after Job creation, assigned Orders become non-selectable
- [ ] No regressions in Jobs module (Jobs CRUD still works)
- [ ] No regressions in Orders module (Orders CRUD still works)
- [ ] No database schema changes
- [ ] Backward compatibility maintained (existing Jobs and Orders unchanged)

---

## Rollback Plan

If issues occur:

1. **Revert file changes:**
   - Delete new files: `useOrders.ts`, `orderMapTransform.ts`, `OrderInfoPanel.tsx`
   - Revert changes to: `JobsMapPage.tsx`, `GoogleMap.tsx`, `CreateJobDrawer.tsx`

2. **Restore Jobs-based map:**
   - Restore `useJobsList()` import
   - Restore `transformJobsToMarkers()` usage
   - Remove selection state and action bar

3. **No database changes required:**
   - No migrations to rollback
   - Existing data remains unchanged

---

## Notes

1. **Performance Considerations:**
   - If there are many Orders (100+), consider pagination or virtual scrolling for sidebar
   - Map clustering may be needed for large datasets

2. **Future Enhancements:**
   - Add filters for Order status (stone_status, permit_status, proof_status)
   - Implement drag/lasso selection
   - Add route optimization for selected Orders
   - Add map-based coordinate editing

3. **Testing Recommendations:**
   - Test with 0 Orders
   - Test with Orders without coordinates
   - Test with all Orders assigned
   - Test with mix of assigned and unassigned Orders
   - Test Job creation with 1 Order
   - Test Job creation with multiple Orders
   - Test error scenarios (network failures, validation errors)

---

## References

- Specification: `specs/map-orders-and-create-jobs-from-map.md`
- Current Map Implementation: `src/modules/map/pages/JobsMapPage.tsx`
- CreateJobDrawer: `src/modules/jobs/components/CreateJobDrawer.tsx`
- Orders Types: `src/modules/orders/types/orders.types.ts`
- Orders Hooks: `src/modules/orders/hooks/useOrders.ts`
- Orders API: `src/modules/orders/api/orders.api.ts`
- Jobs Hooks: `src/modules/jobs/hooks/useJobs.ts`

