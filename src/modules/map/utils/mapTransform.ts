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

