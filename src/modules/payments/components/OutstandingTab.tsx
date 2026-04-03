import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useOutstandingOrders, type OutstandingFilter } from '../hooks/useOutstandingOrders';
import { OutstandingTable } from './OutstandingTable';
import { useNavigate } from 'react-router-dom';

const filterButtons: { label: string; value: OutstandingFilter }[] = [
  { label: 'All orders', value: 'all' },
  { label: 'Deposit only paid', value: 'deposit_only' },
  { label: 'Final invoice sent', value: 'final_sent' },
  { label: 'Overdue 21+ days', value: 'overdue_21' },
];

export function OutstandingTab() {
  const [filter, setFilter] = useState<OutstandingFilter>('all');
  const { data: orders, isLoading } = useOutstandingOrders(filter);
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {filterButtons.map((fb) => (
          <Button
            key={fb.value}
            size="sm"
            variant={filter === fb.value ? 'default' : 'outline'}
            className="h-6 text-[11px] px-2"
            onClick={() => setFilter(fb.value)}
          >
            {fb.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <OutstandingTable
          orders={orders ?? []}
          onSendReminder={(orderId) => console.log('Send reminder for', orderId)}
          onViewInvoice={(invoiceId) => navigate(`/dashboard/invoicing?invoice=${invoiceId}`)}
          onCallCustomer={(phone) => window.open(`tel:${phone}`, '_self')}
        />
      )}
    </div>
  );
}
