/**
 * A unit of work in the Map-tab scheduler. Could be backed by an existing
 * `jobs` row (jobId !== null) or be a virtual stop derived from a ready
 * order without a job (jobId === null) — saving the schedule will create
 * the job in the latter case.
 */
export interface ScheduleStop {
  orderId: string;
  jobId: string | null;
  customerName: string;
  location: string;
  address: string;
  latitude: number;
  longitude: number;
  orderType: string;
  priority: 'low' | 'medium' | 'high';
  /** Date the stop is currently saved against (from jobs.scheduled_date), or null. */
  scheduledDate: string | null;
  /** Used as a tiebreaker so older orders schedule first. */
  createdAt: string;
  /** True when this stop is part of seeded demo data. */
  isTest: boolean;
}
