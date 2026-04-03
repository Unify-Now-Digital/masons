import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import type { OrderPayment } from '../types/reconciliation.types';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const paymentTypeLabel = (type: string | null) => {
  switch (type) {
    case 'deposit': return 'Deposit';
    case 'final': return 'Final payment';
    case 'permit': return 'Permit';
    default: return 'Payment';
  }
};

interface Props {
  payment: OrderPayment;
}

export function MatchedPaymentRow({ payment }: Props) {
  const isStripe = payment.source === 'stripe';

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/50 rounded-md transition-colors">
      {/* Source dot */}
      <div
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: isStripe ? '#635bff' : '#0D0D0D' }}
        title={isStripe ? 'Stripe' : 'Revolut'}
      />

      {/* Customer + order */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate">
          {payment.orders?.customer_name ?? 'Unknown'}
        </span>
        {payment.orders?.order_number && (
          <span className="text-xs text-muted-foreground ml-2">
            #{payment.orders.order_number}
          </span>
        )}
      </div>

      {/* Payment type */}
      <Badge variant="outline" className="text-xs shrink-0">
        {paymentTypeLabel(payment.payment_type)}
      </Badge>

      {/* Amount */}
      <span className="text-sm font-semibold tabular-nums w-24 text-right">
        {formatCurrency(payment.amount)}
      </span>

      {/* Timestamp */}
      <span className="text-xs text-muted-foreground w-28 text-right shrink-0">
        {formatDate(payment.received_at)}
      </span>
    </div>
  );
}
