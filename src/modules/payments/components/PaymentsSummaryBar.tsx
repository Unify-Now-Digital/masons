import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { useReconciliationStats } from '../hooks/useReconciliationStats';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

export function PaymentsSummaryBar() {
  const { data: stats } = useReconciliationStats();

  const chips = [
    {
      label: 'Received this month',
      value: formatCurrency(stats?.received_this_month ?? 0),
      color: 'text-gardens-blu-dk bg-gardens-blu-lt border-gardens-blu-lt',
    },
    {
      label: 'Matched',
      value: String(stats?.matched_count ?? 0),
      color: 'text-gardens-grn-dk bg-gardens-grn-lt border-gardens-grn-lt',
    },
    {
      label: 'Unmatched — need review',
      value: String(stats?.unmatched_count ?? 0),
      color: stats?.unmatched_count ? 'text-gardens-red-dk bg-gardens-red-lt border-gardens-red-lt' : 'text-gardens-grn-dk bg-gardens-grn-lt border-gardens-grn-lt',
    },
    {
      label: 'Outstanding balances',
      value: formatCurrency(stats?.outstanding_total ?? 0),
      color: 'text-gardens-amb-dk bg-gardens-amb-lt border-gardens-amb-lt',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      {chips.map((chip) => (
        <Card key={chip.label} className={`border ${chip.color}`}>
          <CardContent className="p-2">
            <div className="text-xl font-bold">{chip.value}</div>
            <div className="text-[11px] font-medium mt-0.5 opacity-80">{chip.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
