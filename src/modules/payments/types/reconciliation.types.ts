/** Match candidate suggested by auto-matching logic */
export interface MatchCandidate {
  order_id: string;
  order_ref: string;
  customer_name: string;
  expected_amount: number;
  confidence: 'exact' | 'name' | 'amount';
  reason: string;
}

/** Row from order_payments table */
export interface OrderPayment {
  id: string;
  user_id: string | null;
  order_id: string | null;
  source: 'stripe' | 'revolut';
  external_id: string;
  amount: number;
  currency: string;
  payment_type: 'deposit' | 'final' | 'permit' | 'other' | null;
  reference: string | null;
  match_reason: string | null;
  match_candidates: MatchCandidate[] | null;
  matched_at: string | null;
  matched_by: string | null;
  status: 'unmatched' | 'matched' | 'pass_through' | 'dismissed';
  received_at: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  /** Joined order data (optional, from select with join) */
  orders?: {
    id: string;
    order_number: number | null;
    customer_name: string;
    person_id: string | null;
  } | null;
}

export type OrderPaymentInsert = Omit<OrderPayment, 'id' | 'created_at' | 'orders'>;
export type OrderPaymentUpdate = Partial<Omit<OrderPaymentInsert, 'external_id' | 'source'>>;

/** Row from order_extras table */
export interface OrderExtra {
  id: string;
  user_id: string | null;
  order_id: string;
  source: 'gmail' | 'whatsapp' | 'ghl' | 'phone_note';
  source_ref: string | null;
  change_type: 'photo_plaque' | 'inscription_increase' | 'colour_change' | 'vase' | 'other' | null;
  description: string;
  quote_snippet: string | null;
  quote_date: string | null;
  quote_sender: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string | null;
  suggested_amount: number | null;
  status: 'pending' | 'added_to_invoice' | 'dismissed';
  invoice_line_item_id: string | null;
  detected_at: string;
  actioned_by: string | null;
  actioned_at: string | null;
  /** Joined order data (optional) */
  orders?: {
    id: string;
    order_number: number | null;
    customer_name: string;
    person_id: string | null;
  } | null;
}

export type OrderExtraInsert = Omit<OrderExtra, 'id' | 'detected_at' | 'orders'>;
export type OrderExtraUpdate = Partial<Pick<OrderExtra, 'status' | 'suggested_amount' | 'invoice_line_item_id' | 'actioned_by' | 'actioned_at'>>;

/** Safe view of revolut_connections — excludes tokens and signing secrets.
 *  Tokens are only accessible server-side via service_role in Edge Functions. */
export interface RevolutConnection {
  id: string;
  user_id: string;
  client_id: string;
  status: 'active' | 'expired' | 'revoked';
  token_expires_at: string;
  refresh_token_expires_at: string | null;
  webhook_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Aggregated stats for summary bar */
export interface ReconciliationStats {
  received_this_month: number;
  matched_count: number;
  unmatched_count: number;
  outstanding_total: number;
}

/** Order with balance tracking (from orders_with_balance view) */
export interface OutstandingOrder {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  person_id: string | null;
  sku: string | null;
  material: string | null;
  color: string | null;
  location: string | null;
  value: number | null;
  total_order_value: number | null;
  amount_paid: number;
  balance_due: number;
  final_invoice_sent_at: string | null;
  final_invoice_id: string | null;
  deposit_date: string | null;
  due_date: string | null;
  created_at: string;
}
