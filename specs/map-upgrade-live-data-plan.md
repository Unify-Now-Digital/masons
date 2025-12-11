# Implementation Plan: Map of Jobs - Live Data Integration

**Branch:** `feature/map-live-data-integration`  
**Specification:** `specs/map-upgrade-live-data-plan.md`

---

## Overview

Upgrade the Map of Jobs module to use live job records from Supabase instead of dummy data. Connect the GoogleMap component to real job data, add status-based marker coloring, implement info windows with job details, and add client-side filtering.

**Current State:**
- Module folder: `src/modules/map`
- Components: `GoogleMap.tsx` renders markers from dummy array
- Hooks: `useJobs.ts` exists but uses old API structure
- Jobs CRUD module: `src/modules/jobs/hooks/useJobs.ts` has real Supabase integration

**Goal:**
Connect the map to Supabase so markers represent real job locations with live data.

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Update map hooks | Update | `src/modules/map/hooks/useJobs.ts` | High | None |
| 2 | Create map transform utility | Create | `src/modules/map/utils/mapTransform.ts` | High | None |
| 3 | Update GoogleMap component | Update | `src/modules/map/components/GoogleMap.tsx` | High | Tasks 1-2 |
| 4 | Update JobsMapPage | Update | `src/modules/map/pages/JobsMapPage.tsx` | High | Tasks 1-3 |
| 5 | Add status filter UI | Update | `src/modules/map/pages/JobsMapPage.tsx` | Medium | Task 4 |
| 6 | Validate build & lint | Verify | - | High | Tasks 1-5 |

---

## Task 1: Update Map Hooks

**File:** `src/modules/map/hooks/useJobs.ts`  
**Action:** UPDATE

**Requirements:**
- Replace API-based hooks with direct Supabase queries
- Use the same structure as `src/modules/jobs/hooks/useJobs.ts`
- Export `useJobsList()` hook that fetches all jobs from Supabase
- Filter jobs to only include those with valid coordinates (latitude and longitude not null)
- Order by scheduled_date (ascending, nulls last), then created_at (descending)

**Updated Code:**
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

---

## Task 2: Create Map Transform Utility

**File:** `src/modules/map/utils/mapTransform.ts`  
**Action:** CREATE

**Requirements:**
- Transform database Job format to map marker format
- Handle coordinate validation
- Map status to marker colors
- Export interface for map markers

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

---

## Task 3: Update GoogleMap Component

**File:** `src/modules/map/components/GoogleMap.tsx`  
**Action:** UPDATE

**Requirements:**
- Update interface to use `MapMarker` type
- Use `getMarkerColor()` for status-based coloring
- Add info window on marker click showing:
  - Customer name
  - Location name
  - Address
  - Status badge
  - Scheduled date (formatted)
  - Link "Open Job" → `/dashboard/jobs/{id}`
- Remove dummy data references
- Handle loading and error states

**Key Changes:**
1. Import `MapMarker` and `getMarkerColor` from transform utility
2. Update marker icon generation to use status-based colors
3. Add InfoWindow component for job details
4. Add loading spinner overlay
5. Add error handling with toast

**Marker Color Logic:**
```typescript
const markerColor = getMarkerColor(marker.status);
```

**Info Window Content:**
- Customer name (bold)
- Location name
- Full address
- Status badge (colored)
- Scheduled date (formatted with date-fns)
- "Open Job" button linking to `/dashboard/jobs/{marker.id}`

---

## Task 4: Update JobsMapPage

**File:** `src/modules/map/pages/JobsMapPage.tsx`  
**Action:** UPDATE

**Requirements:**
- Remove ALL dummy data
- Use `useJobsList()` from map hooks
- Transform jobs to markers using `transformJobsToMarkers()`
- Update filtering to work with real job data
- Update job list sidebar to show real jobs
- Handle loading and error states

**Key Changes:**
1. Import `useJobsList` from `@/modules/map/hooks/useJobs`
2. Import `transformJobsToMarkers` from transform utility
3. Remove dummy `jobs` array
4. Use `data`, `isLoading`, `error` from `useJobsList()`
5. Transform jobs to markers: `const markers = transformJobsToMarkers(jobsData || [])`
6. Update filtering logic to work with `MapMarker` format
7. Update job list to show real job data
8. Add loading skeleton for job list
9. Add error state with retry button

**Filtering Updates:**
- Search filter: customer, location, address
- Status filter: All, Scheduled, In Progress, Ready for Installation, Completed, Cancelled
- Client-side filtering (no server requests)

---

## Task 5: Add Status Filter UI

**File:** `src/modules/map/pages/JobsMapPage.tsx`  
**Action:** UPDATE

**Requirements:**
- Add status filter dropdown in map header
- Options: All, Scheduled, In Progress, Ready for Installation, Completed, Cancelled
- Filter markers based on selected status
- Update job list sidebar to match filtered markers

**Filter Implementation:**
```typescript
const [statusFilter, setStatusFilter] = useState<string>('all');

const filteredMarkers = useMemo(() => {
  if (statusFilter === 'all') return markers;
  return markers.filter(marker => marker.status === statusFilter);
}, [markers, statusFilter]);
```

**UI Location:**
- Add Select dropdown next to search input in map header
- Place in CardHeader section with Filter button

---

## Task 6: Validation & QA

**Actions:**
- `npm run lint` and `npm run build` (ensure no TS/ESLint errors)
- Manual flows:
  - Map loads with real job markers
  - Only jobs with coordinates show on map
  - Marker colors match job status
  - Clicking marker shows info window with correct data
  - "Open Job" link navigates to correct job detail
  - Status filter works correctly
  - Search filter works correctly
  - Loading state shows spinner
  - Error state shows toast and fallback
  - No dummy data remains

---

## Target File Tree

```
src/modules/map/
├── components/
│   └── GoogleMap.tsx (UPDATED)
├── hooks/
│   └── useJobs.ts (UPDATED)
├── pages/
│   └── JobsMapPage.tsx (UPDATED)
├── utils/
│   └── mapTransform.ts (NEW)
└── index.ts
```

---

## Database Schema Reference

**Table:** `public.jobs` (already exists)

**Relevant Fields:**
- `id` uuid PK
- `customer_name` text NOT NULL
- `location_name` text NOT NULL
- `address` text NOT NULL
- `latitude` decimal(10,8) NULL
- `longitude` decimal(11,8) NULL
- `status` text NOT NULL (scheduled, in_progress, ready_for_installation, completed, cancelled)
- `priority` text NOT NULL (low, medium, high)
- `scheduled_date` date NULL
- `estimated_duration` text NULL

**Note:** Only jobs with both `latitude` and `longitude` not null should appear on map.

---

## Status Color Mapping

| Status | Color | Hex Code |
|--------|-------|----------|
| scheduled | Blue | #3b82f6 |
| in_progress | Orange | #f97316 |
| ready_for_installation | Green | #10b981 |
| completed | Green | #10b981 |
| cancelled | Red | #ef4444 |
| pending/unknown | Grey | #6b7280 |

---

## Validation Checklist

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

## Success Criteria

✅ Map of Jobs module displays live job markers from Supabase. Markers only show for jobs with valid coordinates. Marker colors reflect job status. Clicking a marker shows info window with job details and link to job detail page. Status and search filtering work correctly. Loading and error states are handled. All dummy data is removed.

---

## Implementation Notes

### Coordinate Validation
- Jobs without `latitude` or `longitude` are filtered out at query level
- Transform function also validates coordinates as safety check
- Map will show empty state if no jobs have coordinates

### Marker Icons
- Use SVG data URLs for custom colored markers
- Colors based on status using `getMarkerColor()` function
- Icon size: 32x32 pixels
- Anchor point: bottom center (16, 32)

### Info Window
- Use Google Maps InfoWindow component
- Display job details in readable format
- Include formatted scheduled date
- Add navigation link to job detail page
- Close info window when another marker is clicked

### Filtering Strategy
- Client-side filtering (no additional server requests)
- Filter markers array after fetching all jobs
- Update both map markers and sidebar job list
- Preserve search query when changing status filter

### Performance
- Use `useMemo` for filtered markers
- Only re-render markers when jobs data or filters change
- Debounce search input if needed (optional enhancement)

### Error Handling
- Show toast notification on fetch error
- Display fallback empty map with error message
- Provide retry button to refetch jobs
- Handle missing coordinates gracefully

---

*Specification created: Map of Jobs Live Data Integration*  
*Ready for implementation via `/plan` command*

