import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Phone, Send, FileText } from 'lucide-react';
import type { OutstandingOrder } from '../types/reconciliation.types';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function overdueBadge(daysSinceInvoice: number | null) {
  if (daysSinceInvoice === null) return null;
  if (daysSinceInvoice >= 21) {
    return <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">
      {daysSinceInvoice} days overdue — Manual follow-up required
    </Badge>;
  }
  if (daysSinceInvoice >= 7) {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
      {daysSinceInvoice} days overdue
    </Badge>;
  }
  return null;
}

interface Props {
  order: OutstandingOrder;
  onSendReminder: (orderId: string) => void;
  onViewInvoice: (invoiceId: string) => void;
  onCallCustomer: (phone: string) => void;
}

export function OutstandingOrderCard({ order, onSendReminder, onViewInvoice, onCallCustomer }: Props) {
  const total = order.total_order_value ?? order.balance_due + order.amount_paid;
  const paid = order.amount_paid ?? 0;
  const progress = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const overdueDays = daysSince(order.final_invoice_sent_at);
  const badge = overdueBadge(overdueDays);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold truncate">{order.customer_name}</span>
              {order.order_number && (
                <span className="text-xs text-muted-foreground">#{order.order_number}</span>
              )}
              {badge}
            </div>

            {(order.sku || order.location) && (
              <div className="text-xs text-muted-foreground mb-2">
                {order.sku && <span>{order.sku}</span>}
                {order.sku && order.location && <span> &middot; </span>}
                {order.location && <span>{order.location}</span>}
              </div>
            )}

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span>{formatCurrency(paid)} paid</span>
                <span className="font-semibold text-foreground">{formatCurrency(total)} total</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-red-600">
                {formatCurrency(order.balance_due)} outstanding
              </span>
              {order.final_invoice_sent_at && (
                <span>
                  Invoice sent {daysSince(order.final_invoice_sent_at)}d ago
                </span>
              )}
              {!order.final_invoice_sent_at && order.deposit_date && (
                <span>Deposit only</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-3 pt-3 border-t">
          {order.customer_phone && (
            <Button size="sm" variant="outline" onClick={() => onCallCustomer(order.customer_phone!)}>
              <Phone className="h-3 w-3 mr-1" /> Call
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onSendReminder(order.id)}>
            <Send className="h-3 w-3 mr-1" /> Send reminder
          </Button>
          {order.final_invoice_id && (
            <Button size="sm" variant="outline" onClick={() => onViewInvoice(order.final_invoice_id!)}>
              <FileText className="h-3 w-3 mr-1" /> View invoice
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
