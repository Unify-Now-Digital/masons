import { supabase } from '@/shared/lib/supabase';
import { invoiceRemainingPence } from '../utils/invoiceRemaining';

export type FinanceInvoiceStatusFilter = 'all' | 'unpaid' | 'overdue' | 'paid';

export type FinanceInvoiceDbStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

export type FinanceInvoiceDisplayStatus = FinanceInvoiceDbStatus | 'overdue';

export interface FinanceInvoiceRow {
  id: string;
  organization_id: string;
  invoice_number: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  amount: number;
  amount_paid: number | null;
  amount_remaining: number | null;
  status: FinanceInvoiceDbStatus;
  hosted_invoice_url: string | null;
  stripe_invoice_status: string | null;
  locked_at: string | null;
  main_product_total: number | null;
  additional_options_total: number | null;
  permit_total_cost: number | null;
}

const INVOICES_SELECT =
  'id, organization_id, invoice_number, customer_name, issue_date, due_date, amount, amount_paid, amount_remaining, status, hosted_invoice_url, stripe_invoice_status, locked_at, main_product_total, additional_options_total, permit_total_cost';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parsePence(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isPastDue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

/** Display status: pending + past due → overdue (matches invoicing module). */
export function getDisplayStatus(row: Pick<FinanceInvoiceRow, 'status' | 'due_date'>): FinanceInvoiceDisplayStatus {
  if (row.status === 'pending' && isPastDue(row.due_date)) {
    return 'overdue';
  }
  return row.status;
}

export function isInvoiceOverdue(row: Pick<FinanceInvoiceRow, 'status' | 'due_date'>): boolean {
  return getDisplayStatus(row) === 'overdue';
}

export function computePercentPaid(row: FinanceInvoiceRow): number {
  const paidPence = parsePence(row.amount_paid);
  const remainingPence = invoiceRemainingPence(row);
  const totalPence = paidPence + remainingPence;

  if (totalPence <= 0) return 0;
  return Math.min(100, Math.round((paidPence / totalPence) * 100));
}

export function hasStripeSection(row: FinanceInvoiceRow): boolean {
  return !!(
    row.stripe_invoice_status?.trim() ||
    row.hosted_invoice_url?.trim() ||
    row.locked_at
  );
}

export async function fetchFinanceInvoices(
  organizationId: string,
  filter: FinanceInvoiceStatusFilter,
): Promise<FinanceInvoiceRow[]> {
  let query = supabase
    .from('invoices_with_breakdown')
    .select(INVOICES_SELECT)
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  const today = todayIsoDate();

  switch (filter) {
    case 'unpaid':
      query = query.eq('status', 'pending');
      break;
    case 'overdue':
      query = query.or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`);
      break;
    case 'paid':
      query = query.eq('status', 'paid');
      break;
    case 'all':
    default:
      break;
  }

  const { data, error } = await query.order('due_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FinanceInvoiceRow[];
}
