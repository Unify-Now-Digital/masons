/**
 * A unit of work in the Map-tab scheduler. `jobId` is the order's pipeline
 * job when one exists. The saved install day is `orders.installation_date`.
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
  /** Saved install day (`orders.installation_date`, yyyy-MM-dd), or null. */
  scheduledDate: string | null;
  /** Used as a tiebreaker so older orders schedule first. */
  createdAt: string;
  /** True when this stop is part of seeded demo data. */
  isTest: boolean;
}
