import { describe, expect, it } from 'vitest';
import { mapFinanceTotals } from './financeTotals';

describe('mapFinanceTotals', () => {
  it('maps the owner RPC keys onto the page totals', () => {
    expect(mapFinanceTotals({
      outstanding_balance: 1200.5,
      collected_this_month: 400,
      expected_this_month: 800,
      overdue_invoices: 2,
      overdue_value: 90.25,
    })).toEqual({
      outstandingBalance: 1200.5,
      collectedThisMonth: 400,
      expectedThisMonth: 800,
      overdueInvoices: 2,
      overdueValue: 90.25,
    });
  });

  it('treats a missing payload as zeros', () => {
    expect(mapFinanceTotals(null)).toEqual({
      outstandingBalance: 0,
      collectedThisMonth: 0,
      expectedThisMonth: 0,
      overdueInvoices: 0,
      overdueValue: 0,
    });
  });
});
