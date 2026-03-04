import type { Invoice } from '../types/invoicing.types';
import { computeTotals, computeDerivedStatus, type DerivedInvoiceStatus } from './invoiceAmounts';

// UI-friendly invoice format (for display in tables)
export interface UIInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customer: string;
  amount: string; // Formatted currency string
  status: string; // May be 'overdue' if pending and past due
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
  
  // Calculate display status: if pending and overdue, show as overdue
  const displayStatus = invoice.status === 'pending' && daysOverdue > 0 
    ? 'overdue' 
    : invoice.status;

  const { paidPence, remainingPence, totalPence } = computeTotals(invoice);
  const derivedStatus = computeDerivedStatus(invoice);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    orderId: invoice.order_id ?? null, // Handle undefined: always string | null, never undefined
    customer: invoice.customer_name || 'No person assigned',
    amount: `$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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

