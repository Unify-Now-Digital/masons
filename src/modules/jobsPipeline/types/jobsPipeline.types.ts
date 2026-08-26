// Local types for the jobs pipeline module. The shared Supabase client is
// intentionally `createClient<any>` (see src/shared/lib/supabase.ts), so these
// hand-written types — not database.types.ts — are the operative contract.
// Source of truth: supabase/migrations/20260801210000_jobs_pipeline_schema.sql.

export type JobStage =
  | 'enquired'
  | 'quoted'
  | 'invoiced'
  | 'confirmed'
  | 'in_production'
  | 'fixed'
  | 'complete';

export const BEFORE_PAID_STAGES = ['enquired', 'quoted', 'invoiced'] as const;
export type BeforePaidStage = (typeof BEFORE_PAID_STAGES)[number];

// Sibling axis, not an extension: the two ordered lists partition the seven-stage
// vocabulary, and move adjacency is only defined within one axis.
export const AFTER_PAID_STAGES = ['confirmed', 'in_production', 'fixed', 'complete'] as const;
export type AfterPaidStage = (typeof AFTER_PAID_STAGES)[number];

export type JobExitReason = 'lost' | 'closed' | 'dormant' | 'on_hold' | 'cancelled';

/** Exit reasons offered pre-paid (on_hold/cancelled are post-paid exits). */
export type PrePaidExitReason = 'lost' | 'closed' | 'dormant';

/** Exit reasons offered post-paid; the phase split is UI policy (DB CHECK permits all five). */
export type PostPaidExitReason = 'on_hold' | 'cancelled';

export type JobSource = 'website' | 'email' | 'whatsapp' | 'ghl' | 'manual' | 'sms';

export interface JobPersonSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export interface JobConversationSummary {
  id: string;
  primary_handle: string;
  channel: string;
}

/**
 * Embedded from enquiries!enquiry_id. `price`/`permit_fee` are `details->>key`
 * projections — PostgREST returns them as text or null, never the whole blob.
 * A price is meaningful only when `channel === 'quote'`.
 * Declared as a type alias (not interface) so it is assignable to `Json` for
 * `detailsNumber` (interfaces lack the implicit index signature).
 */
export type JobEnquirySummary = {
  id: string;
  channel: string | null;
  price: string | null;
  permit_fee: string | null;
};

/** Row shape returned by the board + exited queries (embedded relations). */
export interface PipelineJob {
  id: string;
  organization_id: string;
  person_id: string | null;
  conversation_id: string | null;
  enquiry_id: string | null;
  source: JobSource;
  stage: JobStage;
  /** Free text (backfill rows carry 'pending', new intake 'uncontacted') — render as-is. */
  stage_status: string | null;
  paid_at: string | null;
  exit_reason: JobExitReason | null;
  exited_at: string | null;
  wake_at: string | null;
  created_at: string;
  updated_at: string;
  person: JobPersonSummary | null;
  conversation: JobConversationSummary | null;
  /** Null when the job has no enquiry_id, or the embed resolves to no row. */
  enquiry: JobEnquirySummary | null;
}

/** invoices reduced per job for the Invoiced gate + card total. */
export interface JobInvoiceSummary {
  /** Non-deleted invoices with this job_id. */
  count: number;
  /** Sum of invoices.amount — decimal GBP pounds, NOT pence. */
  totalAmount: number;
}
