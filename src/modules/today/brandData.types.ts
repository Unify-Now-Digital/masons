/** Raw rows for one brand (organisation), as read by useBrandData. Money: orders/invoices in
 * pounds, invoice_payments.amount in pence, order_payments.amount in pounds. */
export interface JobRow {
  id: string; stage: string | null; created_at: string; updated_at: string | null; paid_at: string | null;
  wake_at: string | null; exit_reason: string | null; person_id: string | null; source?: string | null;
  person: { first_name: string | null; last_name: string | null; email: string | null; is_test?: boolean | null } | null;
  conversation: { id: string; last_inbound_at: string | null; last_outbound_at: string | null; ai_category: string | null; channel?: string | null; subject?: string | null; last_message_preview?: string | null } | null;
}
export interface OrderRow {
  id: string; order_number: number | null; customer_name: string | null; person_name: string | null; person_id: string | null;
  job_id: string | null; value: number | string | null; permit_cost: number | string | null;
  deposit_date: string | null; second_payment_date: string | null; installation_date: string | null;
  stone_status: string | null; inscription_status: string | null; proof_status: string | null;
  invoice_id: string | null; created_at: string; is_test: boolean | null;
  job: { stage: string | null; exit_reason: string | null; paid_at: string | null } | null;
}
export interface ConvRow { order_id: string | null; last_inbound_at: string | null; last_outbound_at: string | null; ai_category: string | null }
export interface PermitRow {
  id: string; order_id: string; permit_phase: string | null; next_action: string | null; waiting_on: string | null;
  sent_at: string | null; submitted_at: string | null; returned_at: string | null; stage_entered_at: string | null;
}
export interface OrderPaymentRow {
  id: string; order_id: string | null; source: string | null; amount: number | string; payment_type: string | null;
  status: string | null; received_at: string | null; external_id: string | null; reference: string | null;
}
export interface InvoiceRow {
  id: string; order_id: string | null; invoice_number: string | null; customer_name: string | null; amount: number | string;
  status: string | null; issue_date: string | null; due_date: string | null; stripe_invoice_status: string | null;
  stripe_invoice_id: string | null; stripe_payment_intent_id: string | null; is_test: boolean | null; paid_at: string | null; created_at: string;
}
export interface InvoicePaymentRow {
  id: string; invoice_id: string | null; amount: number | string; status: string | null;
  stripe_payment_intent_id: string | null; stripe_charge_id: string | null; created_at: string | null; received_at: string | null; source: string | null;
}
export interface EnquiryRow { person_id: string | null; channel: string | null; sub_type: string | null; created_at: string; details: { name?: string | null; type?: string | null; price?: number | string | null; size?: string | null; colour?: string | null } | null }
export interface BrandData {
  enquiries?: EnquiryRow[];
  jobs: JobRow[]; orders: OrderRow[]; convs: ConvRow[]; permits: PermitRow[];
  orderPayments: OrderPaymentRow[]; invoices: InvoiceRow[]; invoicePayments: InvoicePaymentRow[];
}
