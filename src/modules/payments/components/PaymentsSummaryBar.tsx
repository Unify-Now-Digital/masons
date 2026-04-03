import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useReconciliationStats } from '../hooks/useReconciliationStats';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

export function PaymentsSummaryBar() {
  const { data: stats, isLoading } = useReconciliationStats();

  const chips = [
    {
      label: 'Received this month',
      value: stats ? formatCurrency(stats.received_this_month) : '-',
      color: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      label: 'Matched',
      value: stats ? String(stats.matched_count) : '-',
      color: 'text-green-700 bg-green-50 border-green-200',
    },
    {
      label: 'Unmatched — need review',
      value: stats ? String(stats.unmatched_count) : '-',
      color: 'text-red-700 bg-red-50 border-red-200',
    },
    {
      label: 'Outstanding balances',
      value: stats ? formatCurrency(stats.outstanding_total) : '-',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {chips.map((chip) => (
        <Card key={chip.label} className={`border ${chip.color}`}>
          <CardContent className="p-3">
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{chip.value}</div>
            )}
            <div className="text-xs font-medium mt-1 opacity-80">{chip.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
