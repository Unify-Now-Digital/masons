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
      color: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      label: 'Matched',
      value: String(stats?.matched_count ?? 0),
      color: 'text-green-700 bg-green-50 border-green-200',
    },
    {
      label: 'Unmatched — need review',
      value: String(stats?.unmatched_count ?? 0),
      color: stats?.unmatched_count ? 'text-red-700 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200',
    },
    {
      label: 'Outstanding balances',
      value: formatCurrency(stats?.outstanding_total ?? 0),
      color: 'text-amber-700 bg-amber-50 border-amber-200',
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
