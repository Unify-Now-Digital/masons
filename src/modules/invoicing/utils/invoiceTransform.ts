import type { Invoice } from '../types/invoicing.types';
import { computeDerivedStatus, type DerivedInvoiceStatus, formatGbpDecimal, parsePence } from './invoiceAmounts';
// Canonical predicate/remaining home (FR-017). No import cycle: invoiceRemaining.ts
// imports only from @/shared/lib/formatters (verified 2026-09-01).
import { invoiceRemainingPence, isVoidedStripeInvoice } from '@/modules/finance/utils/invoiceRemaining';

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
  amountRemainingPence: number; // canonical remaining (invoiceRemainingPence; paid ⇒ 0)
  totalPence: number | null;
  derivedStatus: DerivedInvoiceStatus;
  hostedInvoiceUrl: string | null;
  mainProductTotal: string;
  additionalOptionsTotal: string;
  permitTotalCost: string;
}

/**
 * Locked = payments started, explicitly locked, or carrying a Stripe invoice id at all.
 * The stripe_invoice_id leg is belt-and-braces: rows finalized before locking landed
 * (incl. the 26 Aug £1 incident row) have Stripe ids but NULL locked_at.
 * Structurally typed so pence values arriving as PostgREST strings fit.
 */
export function isInvoiceLocked(invoice: {
  amount_paid?: number | string | null;
  locked_at?: string | null;
  stripe_invoice_id?: string | null;
}): boolean {
  return (
    (invoice.amount_paid != null && Number(invoice.amount_paid) > 0) ||
    !!invoice.locked_at ||
    !!invoice.stripe_invoice_id?.trim()
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

  const paidPenceRaw = parsePence(invoice.amount_paid) ?? 0;
  const remainingRaw = parsePence(invoice.amount_remaining);
  const totalPence =
    remainingRaw != null
      ? paidPenceRaw + remainingRaw
      : typeof invoice.amount === 'number' && Number.isFinite(invoice.amount)
        ? Math.round(invoice.amount * 100)
        : null;
  const remainingPence = invoiceRemainingPence(invoice); // canonical; paid ⇒ 0 folded
  const paidPence = totalPence != null ? Math.max(totalPence - remainingPence, 0) : paidPenceRaw;
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
    isLocked: isInvoiceLocked(invoice),
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

