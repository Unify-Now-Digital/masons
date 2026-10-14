/** Cemetery row (moved from the removed permitTracker module, Oct 2026). */
export interface Cemetery {
  id: string;
  name: string;
  primary_email: string | null;
  phone: string | null;
  address: string | null;
  region: string | null;
  postcode: string | null;
  council: string | null;
  avg_approval_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
