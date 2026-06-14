import { supabase } from '@/shared/lib/supabase';
import type { FinanceInvoiceRow } from './finance.invoices.api';
import {
  compareAttentionList,
  getAttentionFlags,
  getInvoiceHorizonBucket,
  hubOwedSqlOrFilter,
  invoiceRemainingPence,
  isHubEligibleInvoice,
  MIN_HUB_INVOICE_AMOUNT_GBP,
} from '../utils/invoiceRemaining';

export type FinanceInvoiceHorizonFilter = 'overdue' | 'due-30' | 'due-later' | 'no-date';

export interface HorizonSegmentSummary {
  count: number;
  balanceGbp: number;
}

export interface FinanceHubSummary {
  totalOutstandingGbp: number;
  unpaidCount: number;
  totalOverdueGbp: number;
  horizon: {
    overdue: HorizonSegmentSummary;
    due30: HorizonSegmentSummary;
    dueLater: HorizonSegmentSummary;
    noDate: HorizonSegmentSummary;
  };
  attentionList: FinanceInvoiceRow[];
}

const HUB_INVOICES_SELECT =
  'id, organization_id, invoice_number, customer_name, issue_date, due_date, amount, amount_paid, amount_remaining, status, hosted_invoice_url, stripe_invoice_status, locked_at, main_product_total, additional_options_total, permit_total_cost';

function emptyHorizon(): FinanceHubSummary['horizon'] {
  const zero = { count: 0, balanceGbp: 0 };
  return { overdue: { ...zero }, due30: { ...zero }, dueLater: { ...zero }, noDate: { ...zero } };
}

function addToSegment(
  horizon: FinanceHubSummary['horizon'],
  bucket: ReturnType<typeof getInvoiceHorizonBucket>,
  balanceGbp: number,
): void {
  switch (bucket) {
    case 'overdue':
      horizon.overdue.count += 1;
      horizon.overdue.balanceGbp += balanceGbp;
      break;
    case 'due-30':
      horizon.due30.count += 1;
      horizon.due30.balanceGbp += balanceGbp;
      break;
    case 'due-later':
      horizon.dueLater.count += 1;
      horizon.dueLater.balanceGbp += balanceGbp;
      break;
    case 'no-date':
      horizon.noDate.count += 1;
      horizon.noDate.balanceGbp += balanceGbp;
      break;
  }
}

/**
 * Hub population: SQL prefilter (pending + amount floor + owed column gate) then
 * client `isHubEligibleInvoice` — same owed definition as `isInvoiceOwed`.
 */
export async function fetchFinanceHubInvoices(organizationId: string): Promise<FinanceInvoiceRow[]> {
  const { data, error } = await supabase
    .from('invoices_with_breakdown')
    .select(HUB_INVOICES_SELECT)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .eq('status', 'pending')
    .gte('amount', MIN_HUB_INVOICE_AMOUNT_GBP)
    .or(hubOwedSqlOrFilter())
    .order('due_date', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as FinanceInvoiceRow[]).filter(isHubEligibleInvoice);
}

export function buildFinanceHubSummary(rows: FinanceInvoiceRow[]): FinanceHubSummary {
  const today = new Date();
  const owed = rows.filter(isHubEligibleInvoice);
  const horizon = emptyHorizon();

  let totalOutstandingGbp = 0;
  let totalOverdueGbp = 0;

  for (const row of owed) {
    const pence = invoiceRemainingPence(row);
    const balanceGbp = pence / 100;
    totalOutstandingGbp += balanceGbp;

    const { overdue } = getAttentionFlags(row, today);
    if (overdue) totalOverdueGbp += balanceGbp;

    addToSegment(horizon, getInvoiceHorizonBucket(row, today), balanceGbp);
  }

  const attentionList = [...owed].sort((a, b) => compareAttentionList(a, b, today));

  return {
    totalOutstandingGbp,
    unpaidCount: owed.length,
    totalOverdueGbp,
    horizon,
    attentionList,
  };
}
