import type { Job, JobInsert, JobUpdate } from '../hooks/useJobs';
import type { JobFormData } from '../schemas/job.schema';

// UI-friendly job format (camelCase)
export interface UIJob {
  id: string;
  orderId: string | null; // Legacy field
  customerName: string; // Legacy field
  locationName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  scheduledDate: string;
  estimatedDuration: string;
  priority: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Transform database job to UI-friendly format
 */
export function transformJobFromDb(job: Job): UIJob {
  // Status values from database are already correct - pass through as-is
  return {
    id: job.id,
    orderId: job.order_id || null, // Legacy field
    customerName: job.customer_name || '', // Legacy field
    locationName: job.location_name,
    address: job.address,
    latitude: job.latitude,
    longitude: job.longitude,
    status: job.status, // Pass through DB value as-is
    scheduledDate: job.scheduled_date || '',
    estimatedDuration: job.estimated_duration || '',
    priority: job.priority,
    notes: job.notes || '',
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

/**
 * Transform array of database jobs to UI format
 */
export function transformJobsFromDb(jobs: Job[]): UIJob[] {
  return jobs.map(transformJobFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toJobInsert(form: JobFormData): JobInsert {
  // Extract UI-only fields (order_ids, assigned_people_ids)
  const { order_ids, assigned_people_ids, ...jobData } = form;
  
  return {
    order_id: null, // Legacy field, set to null for new Jobs
    customer_name: '', // Legacy field, set to empty string for new Jobs
    location_name: jobData.location_name.trim(),
    address: jobData.address.trim(),
    latitude: jobData.latitude ?? null,
    longitude: jobData.longitude ?? null,
    status: jobData.status,
    scheduled_date: normalizeOptional(jobData.scheduled_date),
    estimated_duration: normalizeOptional(jobData.estimated_duration),
    priority: jobData.priority,
    notes: normalizeOptional(jobData.notes),
  };
}

/**
 * Convert form data to database update payload
 */
export function toJobUpdate(form: JobFormData): JobUpdate {
  // Extract UI-only fields (order_ids, assigned_people_ids)
  const { order_ids, assigned_people_ids, ...jobData } = form;
  
  return {
    // Removed: order_id, customer_name
    location_name: jobData.location_name.trim(),
    address: jobData.address.trim(),
    latitude: jobData.latitude ?? null,
    longitude: jobData.longitude ?? null,
    status: jobData.status,
    scheduled_date: normalizeOptional(jobData.scheduled_date),
    estimated_duration: normalizeOptional(jobData.estimated_duration),
    priority: jobData.priority,
    notes: normalizeOptional(jobData.notes),
  };
}

