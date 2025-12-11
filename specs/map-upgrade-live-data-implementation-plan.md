# Detailed Implementation Plan: Map of Jobs - Live Data Integration

**Branch:** `feature/map-live-data-integration`  
**Specification:** `specs/map-upgrade-live-data-plan.md`  
**Implementation Plan:** `specs/map-upgrade-live-data-implementation-plan.md`

---

## Overview

This plan provides step-by-step implementation details for upgrading the Map of Jobs module to use live Supabase data instead of dummy data. The implementation will connect GoogleMap to real job records, add status-based marker coloring, implement info windows, and add client-side filtering.

**Key Features:**
- Live Supabase integration for job markers
- Status-based marker coloring (5 statuses)
- Info windows with job details and navigation links
- Client-side status and search filtering
- Loading and error state handling
- Coordinate validation (only show jobs with lat/lng)

---

## Task 1: Update Map Hooks

**File:** `src/modules/map/hooks/useJobs.ts`  
**Action:** UPDATE

**Complete Code:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Job {
  id: string;
  order_id: string | null;
  customer_name: string;
  location_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
  scheduled_date: string | null;
  estimated_duration: string | null;
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const jobsKeys = {
  all: ['jobs', 'map'] as const,
};

async function fetchJobsForMap() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Job[];
}

export function useJobsList() {
  return useQuery({
    queryKey: jobsKeys.all,
    queryFn: fetchJobsForMap,
  });
}
```

**Key Points:**
- Filter out jobs without coordinates using `.not('latitude', 'is', null).not('longitude', 'is', null)`
- Use separate query key `['jobs', 'map']` to avoid conflicts with CRUD module
- Export `Job` interface for use in map components
- Order by scheduled_date first, then created_at

---

## Task 2: Create Map Transform Utility

**File:** `src/modules/map/utils/mapTransform.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import type { Job } from '../hooks/useJobs';

export interface MapMarker {
  id: string;
  customer: string;
  location: string;
  address: string;
  coordinates: { lat: number; lng: number };
  status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  scheduledDate: string | null;
  estimatedDuration: string | null;
}

/**
 * Get marker color based on job status
 */
export function getMarkerColor(status: string): string {
  switch (status) {
    case 'scheduled':
      return '#3b82f6'; // blue
    case 'in_progress':
      return '#f97316'; // orange
    case 'ready_for_installation':
      return '#10b981'; // green
    case 'completed':
      return '#10b981'; // green
    case 'cancelled':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // grey (pending/unknown)
  }
}

/**
 * Transform database job to map marker format
 */
export function transformJobToMarker(job: Job): MapMarker | null {
  // Only include jobs with valid coordinates
  if (job.latitude === null || job.longitude === null) {
    return null;
  }

  return {
    id: job.id,
    customer: job.customer_name,
    location: job.location_name,
    address: job.address,
    coordinates: {
      lat: job.latitude,
      lng: job.longitude,
    },
    status: job.status,
    priority: job.priority,
    scheduledDate: job.scheduled_date,
    estimatedDuration: job.estimated_duration,
  };
}

/**
 * Transform array of database jobs to map markers
 */
export function transformJobsToMarkers(jobs: Job[]): MapMarker[] {
  return jobs
    .map(transformJobToMarker)
    .filter((marker): marker is MapMarker => marker !== null);
}
```

**Key Points:**
- Filter out jobs without coordinates in transform function
- Map status to colors matching requirements
- Return null for invalid jobs (filtered out in array transform)
- Export `MapMarker` interface for component use

---

## Task 3: Update GoogleMap Component

**File:** `src/modules/map/components/GoogleMap.tsx`  
**Action:** UPDATE

**Key Changes:**

1. **Update imports:**
```typescript
import type { MapMarker, getMarkerColor } from '../utils/mapTransform';
```

2. **Update interface:**
```typescript
interface MapProps {
  markers: MapMarker[];
  selectedMarker: string | null;
  onMarkerSelect: (markerId: string | null) => void;
  isLoading?: boolean;
  error?: Error | null;
}
```

3. **Update marker rendering:**
```typescript
useEffect(() => {
  if (!map || !isLoaded) return;

  // Clear existing markers and info windows
  markersRef.current.forEach(marker => marker.setMap(null));
  infoWindowsRef.current.forEach(window => window.close());
  markersRef.current = [];
  infoWindowsRef.current = [];

  // Add new markers
  const newMarkers = markers.map(marker => {
    const markerColor = getMarkerColor(marker.status);
    
    const googleMarker = new google.maps.Marker({
      position: marker.coordinates,
      map: map,
      title: `${marker.customer} - ${marker.location}`,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="${markerColor}" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 32)
      }
    });

    // Create info window
    const infoWindow = new google.maps.InfoWindow({
      content: createInfoWindowContent(marker),
    });

    googleMarker.addListener('click', () => {
      // Close other info windows
      infoWindowsRef.current.forEach(window => window.close());
      
      // Open this info window
      infoWindow.open(map, googleMarker);
      onMarkerSelect(selectedMarker === marker.id ? null : marker.id);
    });

    markersRef.current.push(googleMarker);
    infoWindowsRef.current.push(infoWindow);

    return googleMarker;
  }, [map, markers, selectedMarker, onMarkerSelect, isLoaded]);

  // Fit bounds to show all markers
  if (newMarkers.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    newMarkers.forEach(marker => {
      const position = marker.getPosition();
      if (position) bounds.extend(position);
    });
    map.fitBounds(bounds);
  }
}, [map, markers, selectedMarker, onMarkerSelect, isLoaded]);
```

4. **Add info window content function:**
```typescript
const createInfoWindowContent = (marker: MapMarker): string => {
  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-orange-100 text-orange-700',
    ready_for_installation: 'bg-green-100 text-green-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not scheduled';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid date';
      return format(d, 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  return `
    <div style="padding: 12px; min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${marker.customer}</h3>
      <p style="margin: 0 0 4px 0; font-size: 14px; color: #666;">${marker.location}</p>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #888;">${marker.address}</p>
      <div style="margin: 8px 0;">
        <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; ${statusColors[marker.status] || 'bg-gray-100 text-gray-700'}">
          ${formatStatus(marker.status)}
        </span>
      </div>
      <p style="margin: 4px 0; font-size: 13px; color: #666;">Scheduled: ${formatDate(marker.scheduledDate)}</p>
      <a href="/dashboard/jobs/${marker.id}" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 500;">
        Open Job
      </a>
    </div>
  `;
};
```

5. **Add loading overlay:**
```typescript
{isLoading && (
  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
      <p className="text-sm text-slate-600">Loading jobs...</p>
    </div>
  </div>
)}
```

6. **Add info windows ref:**
```typescript
const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);
```

**Key Points:**
- Use `MapMarker` type instead of dummy job format
- Create InfoWindow for each marker with job details
- Use `getMarkerColor()` for status-based marker colors
- Add loading overlay when `isLoading` is true
- Info window includes formatted date and "Open Job" link

---

## Task 4: Update JobsMapPage

**File:** `src/modules/map/pages/JobsMapPage.tsx`  
**Action:** UPDATE

**Key Changes:**

1. **Remove dummy data:**
```typescript
// DELETE: const jobs = [...]
```

2. **Add imports:**
```typescript
import { useJobsList } from '../hooks/useJobs';
import { transformJobsToMarkers, type MapMarker } from '../utils/mapTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { format } from 'date-fns';
```

3. **Add hooks and state:**
```typescript
export const JobsMapPage: React.FC = () => {
  const { data: jobsData, isLoading, error, refetch } = useJobsList();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Transform jobs to markers
  const markers = useMemo(() => {
    if (!jobsData) return [];
    return transformJobsToMarkers(jobsData);
  }, [jobsData]);
```

4. **Update filtering logic:**
```typescript
const filteredMarkers = useMemo(() => {
  let filtered = markers;
  
  // Status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(marker => marker.status === statusFilter);
  }
  
  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(marker =>
      marker.customer.toLowerCase().includes(query) ||
      marker.location.toLowerCase().includes(query) ||
      marker.address.toLowerCase().includes(query)
    );
  }
  
  return filtered;
}, [markers, statusFilter, searchQuery]);
```

5. **Update GoogleMap props:**
```typescript
<GoogleMap 
  markers={filteredMarkers}
  selectedMarker={selectedJob}
  onMarkerSelect={setSelectedJob}
  isLoading={isLoading}
  error={error}
/>
```

6. **Update job list sidebar:**
```typescript
{filteredMarkers.map((marker) => (
  <Card 
    key={marker.id} 
    className={`cursor-pointer transition-all hover:shadow-md ${
      selectedJob === marker.id ? "ring-2 ring-blue-500" : ""
    }`}
    onClick={() => setSelectedJob(selectedJob === marker.id ? null : marker.id)}
  >
    <CardContent className="pt-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium">{marker.customer}</h4>
          <p className="text-sm text-slate-600">{marker.location}</p>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(marker.status)}>
            {marker.status.replace('_', ' ')}
          </Badge>
          {marker.priority === "high" && (
            <Badge variant="destructive">Urgent</Badge>
          )}
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-slate-600">
        <div className="flex items-center">
          <MapPin className="h-3 w-3 mr-1" />
          <span>{marker.location}</span>
        </div>
        <div className="flex items-center">
          <Calendar className="h-3 w-3 mr-1" />
          <span>Scheduled: {marker.scheduledDate ? format(new Date(marker.scheduledDate), 'MMM dd, yyyy') : 'Not scheduled'}</span>
        </div>
        {marker.estimatedDuration && (
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Est. {marker.estimatedDuration}</span>
          </div>
        )}
      </div>

      {selectedJob === marker.id && (
        <div className="mt-4 pt-4 border-t space-y-2">
          <p className="text-sm text-slate-600">{marker.address}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={`/dashboard/jobs/${marker.id}`}>
                View Job
              </a>
            </Button>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
))}
```

7. **Add error handling:**
```typescript
useEffect(() => {
  if (error) {
    toast({
      title: 'Error loading jobs',
      description: error.message || 'Failed to load job locations',
      variant: 'destructive',
    });
  }
}, [error, toast]);
```

8. **Add loading state for job list:**
```typescript
{isLoading ? (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-32 w-full" />
    ))}
  </div>
) : filteredMarkers.length === 0 ? (
  <div className="text-center py-8 text-slate-600">
    {searchQuery || statusFilter !== 'all'
      ? 'No jobs match your filters'
      : 'No jobs with coordinates found'}
  </div>
) : (
  // ... job list cards
)}
```

**Key Points:**
- Remove all dummy data
- Use `useJobsList()` hook for live data
- Transform jobs to markers
- Update filtering to work with `MapMarker` format
- Add loading and error states
- Update job list to show real markers

---

## Task 5: Add Status Filter UI

**File:** `src/modules/map/pages/JobsMapPage.tsx`  
**Action:** UPDATE

**Add status filter dropdown in map header:**

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

// In the CardHeader section, add status filter:
<div className="flex gap-2 items-center">
  <Select value={statusFilter} onValueChange={setStatusFilter}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Filter by status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Statuses</SelectItem>
      <SelectItem value="scheduled">Scheduled</SelectItem>
      <SelectItem value="in_progress">In Progress</SelectItem>
      <SelectItem value="ready_for_installation">Ready for Installation</SelectItem>
      <SelectItem value="completed">Completed</SelectItem>
      <SelectItem value="cancelled">Cancelled</SelectItem>
    </SelectContent>
  </Select>
  <Button variant="outline" size="sm">
    <Filter className="h-4 w-4 mr-2" />
    Filter
  </Button>
</div>
```

**Key Points:**
- Add status filter dropdown next to search input
- Options match job status enum values
- Filtering is client-side (no server requests)
- Update `filteredMarkers` to include status filter

---

## Task 6: Validation & QA

### Build & Lint Checks

1. **Run lint:**
   ```bash
   npm run lint
   ```
   - Should pass with no errors
   - No `any` types
   - All imports resolve correctly

2. **Run build:**
   ```bash
   npm run build
   ```
   - Should compile successfully
   - No TypeScript errors
   - No missing dependencies

### Runtime Tests

1. **Map Loading:**
   - Map loads with real job markers
   - Only jobs with coordinates appear
   - Loading spinner shows while fetching

2. **Marker Display:**
   - Marker colors match job status
   - Markers positioned correctly
   - Map bounds adjust to show all markers

3. **Info Window:**
   - Click marker → info window appears
   - Shows correct job details
   - "Open Job" link navigates correctly

4. **Filtering:**
   - Status filter works (All, Scheduled, In Progress, Ready, Completed, Cancelled)
   - Search filter works (customer, location, address)
   - Filters combine correctly

5. **Error Handling:**
   - Error shows toast notification
   - Map renders empty state safely
   - Retry button works

6. **Job List Sidebar:**
   - Shows real jobs matching filtered markers
   - Clicking job selects marker on map
   - Loading skeleton shows while fetching

### Validation Checklist

- [ ] All dummy data removed from JobsMapPage
- [ ] `useJobsList()` fetches real jobs from Supabase
- [ ] Only jobs with coordinates appear on map
- [ ] Marker colors match job status correctly
- [ ] Info window displays correct job details
- [ ] "Open Job" link navigates to `/dashboard/jobs/{id}`
- [ ] Status filter works (All, Scheduled, In Progress, Ready, Completed, Cancelled)
- [ ] Search filter works (customer, location, address)
- [ ] Loading state shows spinner on map
- [ ] Error state shows toast and fallback empty map
- [ ] Job list sidebar shows real jobs
- [ ] Map bounds adjust to show all visible markers
- [ ] All imports use `@/` aliases
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Map loads instantly with live markers

---

## Summary

This implementation plan provides complete step-by-step instructions for upgrading the Map of Jobs module to use live Supabase data. Each task includes:

- File path and action (CREATE/UPDATE)
- Complete code examples
- Key implementation points
- Integration details

The upgrade removes all dummy data, connects to live Supabase jobs, adds status-based marker coloring, implements info windows, and adds client-side filtering.

**Ready for implementation via `/implement` command**

