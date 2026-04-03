import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useOutstandingOrders, type OutstandingFilter } from '../hooks/useOutstandingOrders';
import { OutstandingOrderCard } from './OutstandingOrderCard';
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

  const handleSendReminder = (orderId: string) => {
    // TODO: integrate with email template sending
    console.log('Send reminder for order', orderId);
  };

  const handleViewInvoice = (invoiceId: string) => {
    navigate(`/dashboard/invoicing?invoice=${invoiceId}`);
  };

  const handleCallCustomer = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {filterButtons.map((fb) => (
          <Button
            key={fb.value}
            size="sm"
            variant={filter === fb.value ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setFilter(fb.value)}
          >
            {fb.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : !orders?.length ? (
        <div className="text-sm text-muted-foreground text-center py-8 bg-green-50 border border-green-200 rounded-md">
          No outstanding balances. All orders are fully paid.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OutstandingOrderCard
              key={order.id}
              order={order}
              onSendReminder={handleSendReminder}
              onViewInvoice={handleViewInvoice}
              onCallCustomer={handleCallCustomer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
