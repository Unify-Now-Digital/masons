import type { Invoice } from '../types/invoicing.types';
import { computeTotals, computeDerivedStatus, type DerivedInvoiceStatus, formatGbpDecimal } from './invoiceAmounts';

// UI-friendly invoice format (for display in tables)
export interface UIInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customer: string;
  amount: string; // Formatted currency string
  status: string; // May be 'overdue' (pending + past due) or 'void' (Stripe void/uncollectible)
  dueDate: string;
  issueDate: string;
  paymentMethod: string | null;
  paymentDate: string | null;
  notes: string | null;
  daysOverdue: number; // Calculated field
  stripeStatus?: 'unpaid' | 'pending' | 'paid' | null;
  stripeInvoiceId?: string | null;
  stripeInvoiceStatus?: string | null;
  /** True when any payment has been made; editing line items is disabled */
  isLocked?: boolean;
  // Stripe amount metadata for table display
  amountPaidPence: number | null;
  amountRemainingPence: number | null;
  totalPence: number | null;
  derivedStatus: DerivedInvoiceStatus;
  hostedInvoiceUrl: string | null;
  mainProductTotal: string;
  additionalOptionsTotal: string;
  permitTotalCost: string;
}

// Mirrors isVoidedStripeInvoice in @/modules/finance/utils/invoiceRemaining — kept local
// because finance already imports from invoicing, so the reverse import would cycle.
// Keep the two in sync.
function isVoidedStripeInvoice(invoice: Pick<Invoice, 'stripe_invoice_status'>): boolean {
  return (
    invoice.stripe_invoice_status === 'void' ||
    invoice.stripe_invoice_status === 'uncollectible'
  );
}

/**
 * Transform database invoice to UI-friendly format
 */
export function transformInvoiceForUI(invoice: Invoice): UIInvoice {
  const today = new Date();
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const daysOverdue = dueDate && dueDate < today 
    ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Display status: a voided/uncollectible Stripe invoice shows 'void' (dead paper must not
  // surface under Pending/Overdue/Unpaid), except a paid invoice stays 'paid' — reachable
  // when an invoice is paid offline and its Stripe invoice is then voided to prevent
  // double-payment. Otherwise: pending + past due displays as overdue.
  const displayStatus = isVoidedStripeInvoice(invoice)
    ? invoice.status === 'paid'
      ? 'paid'
      : 'void'
    : invoice.status === 'pending' && daysOverdue > 0
      ? 'overdue'
      : invoice.status;

  const { paidPence, remainingPence, totalPence } = computeTotals(invoice);
  const derivedStatus = computeDerivedStatus(invoice);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    orderId: invoice.order_id ?? null, // Handle undefined: always string | null, never undefined
    customer: invoice.customer_name || 'No person assigned',
    amount: formatGbpDecimal(invoice.amount),
    status: displayStatus,
    dueDate: invoice.due_date,
    issueDate: invoice.issue_date,
    paymentMethod: invoice.payment_method,
    paymentDate: invoice.payment_date,
    notes: invoice.notes,
    daysOverdue,
    stripeStatus: invoice.stripe_status ?? 'unpaid',
    stripeInvoiceId: invoice.stripe_invoice_id ?? null,
    stripeInvoiceStatus: invoice.stripe_invoice_status ?? null,
    isLocked:
      (invoice.amount_paid != null && Number(invoice.amount_paid) > 0) || !!invoice.locked_at,
    amountPaidPence: paidPence,
    amountRemainingPence: remainingPence,
    totalPence,
    derivedStatus,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    mainProductTotal: formatGbpDecimal(invoice.main_product_total ?? null),
    additionalOptionsTotal: formatGbpDecimal(invoice.additional_options_total ?? null),
    permitTotalCost: formatGbpDecimal(invoice.permit_total_cost ?? null),
  };
}

/**
 * Transform array of database invoices to UI format
 */
export function transformInvoicesForUI(invoices: Invoice[]): UIInvoice[] {
  // DEV-only runtime validation to diagnose missing order_id
  if (import.meta.env.DEV && invoices && invoices.length > 0) {
    const firstInvoice = invoices[0];
    if (!('order_id' in firstInvoice)) {
      console.warn('[Invoicing] order_id missing from invoice data:', firstInvoice);
    }
    if (firstInvoice.order_id === undefined) {
      console.warn('[Invoicing] order_id is undefined (should be null or string):', firstInvoice);
    }
  }
  
  return invoices.map(transformInvoiceForUI);
}

