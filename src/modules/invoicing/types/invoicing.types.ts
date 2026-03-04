export interface Invoice {
  id: string;
  order_id: string | null;
  invoice_number: string;
  customer_name: string;
  amount: number;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  issue_date: string;
  payment_method: string | null;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Stripe Checkout Session ID from creation */
  stripe_checkout_session_id?: string | null;
  /** Stripe Payment Intent ID when payment completes */
  stripe_payment_intent_id?: string | null;
  /** Stripe lifecycle: unpaid | pending | paid */
  stripe_status?: 'unpaid' | 'pending' | 'paid' | null;
  /** When Stripe payment completed (webhook) */
  paid_at?: string | null;
  /** Stripe Invoice object ID (Stripe Invoicing API flow) */
  stripe_invoice_id?: string | null;
  /** Stripe Invoice status mirror (open, paid, payment_failed, void, uncollectible, etc.) */
  stripe_invoice_status?: string | null;
  /** Hosted invoice page URL (payments via Stripe only) */
  hosted_invoice_url?: string | null;
  /** Total paid in smallest currency unit (pence) */
  amount_paid?: number | null;
  /** Remaining in smallest currency unit (pence) */
  amount_remaining?: number | null;
  /** Set when created via Revise; links to previous invoice */
  revised_from_invoice_id?: string | null;
  /** Set when first payment received; editing disabled */
  locked_at?: string | null;
  /** Invoice owner (for RLS) */
  user_id?: string | null;
}

/** One row per payment against a Stripe invoice (from webhook) */
export interface InvoicePayment {
  id: string;
  invoice_id: string;
  user_id: string | null;
  stripe_invoice_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount: number;
  status: string;
  created_at: string;
}

export type InvoiceInsert = Omit<Invoice, 'id' | 'created_at' | 'updated_at'>;
export type InvoiceUpdate = Partial<InvoiceInsert>;

