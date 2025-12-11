import type { Job, JobInsert, JobUpdate } from '../hooks/useJobs';
import type { JobFormData } from '../schemas/job.schema';

// UI-friendly job format (camelCase)
export interface UIJob {
  id: string;
  orderId: string | null;
  customerName: string;
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
  return {
    id: job.id,
    orderId: job.order_id,
    customerName: job.customer_name,
    locationName: job.location_name,
    address: job.address,
    latitude: job.latitude,
    longitude: job.longitude,
    status: job.status,
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
  // Ensure order_id is either a valid UUID string or null (not empty string or undefined)
  const orderId = form.order_id && form.order_id.trim() !== '' ? form.order_id : null;
  
  return {
    order_id: orderId,
    customer_name: form.customer_name.trim(),
    location_name: form.location_name.trim(),
    address: form.address.trim(),
    latitude: form.latitude ?? null,
    longitude: form.longitude ?? null,
    status: form.status,
    scheduled_date: normalizeOptional(form.scheduled_date),
    estimated_duration: normalizeOptional(form.estimated_duration),
    priority: form.priority,
    notes: normalizeOptional(form.notes),
  };
}

/**
 * Convert form data to database update payload
 */
export function toJobUpdate(form: JobFormData): JobUpdate {
  return {
    order_id: form.order_id || null,
    customer_name: form.customer_name.trim(),
    location_name: form.location_name.trim(),
    address: form.address.trim(),
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    status: form.status,
    scheduled_date: normalizeOptional(form.scheduled_date),
    estimated_duration: normalizeOptional(form.estimated_duration),
    priority: form.priority,
    notes: normalizeOptional(form.notes),
  };
}

