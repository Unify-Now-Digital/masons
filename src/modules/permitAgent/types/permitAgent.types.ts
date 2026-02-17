export type PermitPhase =
  | 'REQUIRED'
  | 'SEARCHING'
  | 'FORM_FOUND'
  | 'PREFILLED'
  | 'SENT_TO_CLIENT'
  | 'SUBMITTED'
  | 'APPROVED';

export type ActivityType =
  | 'SEARCH_STARTED'
  | 'FORM_FOUND'
  | 'PREFILLED'
  | 'SENT_TO_CLIENT'
  | 'CLIENT_RETURNED'
  | 'SUBMITTED'
  | 'FOLLOW_UP_SENT'
  | 'APPROVED'
  | 'NOTE';

export interface OrderPermit {
  id: string;
  order_id: string;
  permit_phase: PermitPhase;
  authority_name: string | null;
  authority_contact: string | null;
  form_url: string | null;
  readiness_score: number;
  fee_paid: boolean;
  submission_date: string | null;
  prefilled_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderPermitInsert = Omit<OrderPermit, 'id' | 'created_at' | 'updated_at'>;
export type OrderPermitUpdate = Partial<Omit<OrderPermitInsert, 'order_id'>>;

export interface PermitActivityLog {
  id: string;
  order_permit_id: string;
  activity_type: ActivityType;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type PermitActivityLogInsert = Omit<PermitActivityLog, 'id' | 'created_at'>;

/** Combined permit + order data for the pipeline view */
export interface PermitPipelineItem {
  permit: OrderPermit;
  order: {
    id: string;
    order_number: number | null;
    customer_name: string;
    person_name: string | null;
    location: string | null;
    installation_date: string | null;
    material: string | null;
    order_type: string;
    permit_status: string;
    value: number | null;
  };
  activities: PermitActivityLog[];
  daysUntilInstall: number | null;
  isUrgent: boolean;
}

export interface PrefilledFormData {
  authority_recipient: string;
  deceased_full_name: string;
  memorial_dimensions: string;
  material_type: string;
  inscription_summary: string;
  grave_location: string;
}

export interface SearchResult {
  report: string;
  links: Array<{ title: string; url: string }>;
  authorityName: string | null;
  authorityContact: string | null;
}

export const PHASE_ORDER: PermitPhase[] = [
  'REQUIRED',
  'SEARCHING',
  'FORM_FOUND',
  'PREFILLED',
  'SENT_TO_CLIENT',
  'SUBMITTED',
  'APPROVED',
];

export const PHASE_LABELS: Record<PermitPhase, string> = {
  REQUIRED: 'Required',
  SEARCHING: 'Searching',
  FORM_FOUND: 'Form Found',
  PREFILLED: 'Pre-filled',
  SENT_TO_CLIENT: 'Sent to Client',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
};

export const PHASE_COLORS: Record<PermitPhase, string> = {
  REQUIRED: 'bg-slate-100 text-slate-700',
  SEARCHING: 'bg-yellow-100 text-yellow-800',
  FORM_FOUND: 'bg-blue-100 text-blue-800',
  PREFILLED: 'bg-indigo-100 text-indigo-800',
  SENT_TO_CLIENT: 'bg-purple-100 text-purple-800',
  SUBMITTED: 'bg-orange-100 text-orange-800',
  APPROVED: 'bg-green-100 text-green-800',
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  SEARCH_STARTED: 'AI search started',
  FORM_FOUND: 'Form discovered',
  PREFILLED: 'Data pre-filled',
  SENT_TO_CLIENT: 'Sent to client for signature',
  CLIENT_RETURNED: 'Client returned signed form',
  SUBMITTED: 'Submitted to authority',
  FOLLOW_UP_SENT: 'Follow-up email sent',
  APPROVED: 'Permit approved',
  NOTE: 'Note added',
};
