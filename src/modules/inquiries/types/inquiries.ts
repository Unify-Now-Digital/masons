import type { Json } from '@/shared/types/database.types';

export type InquiryPipelineStage = 'new' | 'quoted' | 'order_created';

export type InquiryChannel = 'contact' | 'quote' | 'appointment' | 'call' | 'shortlist';

export type DateRangePreset = 'today' | 'last_7_days' | 'last_30_days' | 'all_time' | 'custom';

/** RPC row shape from `get_inquiries_pipeline` (snake_case from Postgres). */
export interface InquiryPipelineRow {
  enquiry_id: string;
  stage: InquiryPipelineStage;
  channel: InquiryChannel | string | null;
  sub_type: string | null;
  created_at: string;
  source_page: string | null;
  message: string | null;
  location: string | null;
  contact_pref: string | null;
  appointment_at: string | null;
  appointment_kind: string | null;
  details: Json | null;
  photo_urls: string[] | null;
  order_id: string | null;
  person_id: string | null;
  person_first_name: string | null;
  person_last_name: string | null;
  person_email: string | null;
  person_phone: string | null;
  linked_quote_id: string | null;
  linked_quote_status: string | null;
  linked_quote_total: number | string | null;
  linked_quote_created_at: string | null;
  linked_order_id: string | null;
  linked_order_status: string | null;
}

export interface InquiriesFilterState {
  channels: InquiryChannel[];
  preset: DateRangePreset;
  /** Used only when preset === custom — inclusive calendar bounds */
  customFrom: Date | null;
  customTo: Date | null;
}

export interface GetInquiriesPipelineRpcArgs {
  organizationId: string;
  channels: InquiryChannel[] | null;
  fromDateIso: string | null;
  toDateIso: string | null;
}
