import React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Phone, Send, FileText } from 'lucide-react';
import type { OutstandingOrder } from '../types/reconciliation.types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function statusBadge(order: OutstandingOrder) {
  const daysSinceInvoice = daysSince(order.final_invoice_sent_at);

  if (daysSinceInvoice !== null && daysSinceInvoice >= 21) {
    return <Badge className="bg-gardens-red-lt text-gardens-red-dk border-gardens-red-lt text-[10px] px-1.5 py-0">{daysSinceInvoice}d overdue</Badge>;
  }
  if (daysSinceInvoice !== null && daysSinceInvoice >= 7) {
    return <Badge className="bg-gardens-amb-lt text-gardens-amb-dk border-gardens-amb-lt text-[10px] px-1.5 py-0">Sent {daysSinceInvoice}d ago</Badge>;
  }
  if (daysSinceInvoice !== null) {
    return <Badge className="bg-gardens-blu-lt text-gardens-blu-dk border-gardens-blu-lt text-[10px] px-1.5 py-0">Sent {daysSinceInvoice}d ago</Badge>;
  }
  if (order.amount_paid > 0) {
    return <Badge className="bg-gardens-grn-lt text-gardens-grn-dk border-gardens-grn-lt text-[10px] px-1.5 py-0">Deposit only</Badge>;
  }
  return <Badge className="bg-gardens-page text-gardens-txs border-gardens-bdr text-[10px] px-1.5 py-0">No payment</Badge>;
}

interface Props {
  orders: OutstandingOrder[];
  onSendReminder: (orderId: string) => void;
  onViewInvoice: (invoiceId: string) => void;
  onCallCustomer: (phone: string) => void;
}

export function OutstandingTable({ orders, onSendReminder, onViewInvoice, onCallCustomer }: Props) {
  if (!orders.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6 bg-gardens-grn-lt border border-gardens-grn-lt rounded-md">
        No outstanding balances. All orders are fully paid.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead className="w-52">Progress</TableHead>
            <TableHead className="w-28">Balance</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="text-right w-28">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const total = o.total_order_value ?? o.balance_due + o.amount_paid;
            const pct = total > 0 ? Math.min((o.amount_paid / total) * 100, 100) : 0;
            const isOverdue = daysSince(o.final_invoice_sent_at) !== null && daysSince(o.final_invoice_sent_at)! >= 21;

            return (
              <TableRow key={o.id} className={isOverdue ? 'bg-gardens-red-lt/40' : ''}>
                <TableCell className="py-2">
                  <div className="font-medium text-sm">{o.customer_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.order_number && `#${o.order_number}`}{o.sku && ` · ${o.sku}`}
                  </div>
                </TableCell>
                <TableCell className="py-2 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground truncate max-w-[180px] block">{o.location ?? '—'}</span>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    <span>{fmt(o.amount_paid)}</span>
                    <div className="flex-1 h-1 bg-gardens-bdr rounded-full overflow-hidden min-w-[60px]">
                      <div className="h-full bg-gardens-blu rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-muted-foreground">{fmt(total)}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2 font-semibold text-gardens-red-dk tabular-nums text-sm">
                  {fmt(o.balance_due)}
                </TableCell>
                <TableCell className="py-2">
                  {statusBadge(o)}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    {o.customer_phone && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCallCustomer(o.customer_phone!)}>
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSendReminder(o.id)}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    {o.final_invoice_id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewInvoice(o.final_invoice_id!)}>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
