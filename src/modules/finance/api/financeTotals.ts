export interface MappedFinanceTotals {
  outstandingBalance: number;
  collectedThisMonth: number;
  expectedThisMonth: number;
  overdueInvoices: number;
  overdueValue: number;
}

/** Map public.finance_totals jsonb onto the Finance page shape. Pure. */
export function mapFinanceTotals(raw: unknown): MappedFinanceTotals {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const n = (key: string) => {
    const value = Number(row[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    outstandingBalance: n('outstanding_balance'),
    collectedThisMonth: n('collected_this_month'),
    expectedThisMonth: n('expected_this_month'),
    overdueInvoices: n('overdue_invoices'),
    overdueValue: n('overdue_value'),
  };
}
