export type PermitStatus = 'not_started' | 'form_sent' | 'customer_completed' | 'pending' | 'approved';

export type CommentType = 'note' | 'system' | 'chase_sent';

export type ChaseTarget = 'cemetery' | 'customer';
export type ChaseContext = 'single' | 'multi';

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

export interface PermitOrder {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_email: string | null;
  person_name: string | null;
  deceased_name: string | null;
  order_type: string;
  location: string | null;
  memorial_type: string | null;
  permit_status: PermitStatus;
  permit_form_sent_at: string | null;
  permit_submitted_at: string | null;
  permit_approved_at: string | null;
  permit_correspondence_email: string | null;
  permit_cemetery_email: string | null;
  permit_gmail_thread_id: string | null;
  cemetery_id: string | null;
  cemetery: Cemetery | null;
  created_at: string;
  updated_at: string;
}

export interface OrderComment {
  id: string;
  order_id: string;
  author: string;
  body: string;
  comment_type: CommentType;
  created_at: string;
}

export type OrderCommentInsert = Omit<OrderComment, 'id' | 'created_at'>;

/** Urgency section for the action queue view */
export type PermitSection = 'action_needed' | 'chase_this_week' | 'awaiting_customer' | 'on_track';

export interface PermitSectionConfig {
  key: PermitSection;
  label: string;
  borderColor: string;
  badgeColor: string;
}

export const PERMIT_SECTIONS: PermitSectionConfig[] = [
  { key: 'action_needed', label: 'Action needed', borderColor: 'border-l-red-500', badgeColor: 'bg-gardens-red-lt text-gardens-red-dk' },
  { key: 'chase_this_week', label: 'Chase this week', borderColor: 'border-l-amber-500', badgeColor: 'bg-gardens-amb-lt text-gardens-amb-dk' },
  { key: 'awaiting_customer', label: 'Awaiting customer signature', borderColor: 'border-l-blue-500', badgeColor: 'bg-gardens-blu-lt text-gardens-blu-dk' },
  { key: 'on_track', label: 'With cemetery — on track', borderColor: 'border-l-gray-400', badgeColor: 'bg-gardens-page text-gardens-tx' },
];

export interface CemeteryGroup {
  cemetery: Cemetery | null;
  cemeteryName: string;
  orders: PermitOrder[];
  overdueCount: number;
  chasingCount: number;
  onTrackCount: number;
}

export interface ChaseEmailDraft {
  subject: string;
  body: string;
  to: string;
}

/** Thread scenario for the chase modal */
export type ChaseScenario = 'A' | 'B' | 'C';
