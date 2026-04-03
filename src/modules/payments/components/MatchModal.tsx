import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Search, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

interface Props {
  open: boolean;
  onClose: () => void;
  paymentId: string;
  paymentAmount: number;
  onMatch: (paymentId: string, orderId: string, paymentType: string) => void;
}

interface OrderSearchResult {
  id: string;
  order_number: number | null;
  customer_name: string;
  value: number | null;
  total_order_value: number | null;
  amount_paid: number;
}

export function MatchModal({ open, onClose, paymentId, paymentAmount, onMatch }: Props) {
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<string>('deposit');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', 'search-for-match', search],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('id, order_number, customer_name, value, total_order_value, amount_paid')
        .order('created_at', { ascending: false })
        .limit(20);

      if (search.trim()) {
        // Search by customer name or order number
        const term = search.trim();
        const asNum = Number(term);
        if (!isNaN(asNum) && asNum > 0) {
          query = query.eq('order_number', asNum);
        } else {
          query = query.ilike('customer_name', `%${term}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderSearchResult[];
    },
    enabled: open,
  });

  const filteredOrders = useMemo(() => orders ?? [], [orders]);

  const handleMatch = () => {
    if (!selectedOrderId) return;
    onMatch(paymentId, selectedOrderId, paymentType);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Match payment to order</DialogTitle>
          <DialogDescription>
            Payment of {formatCurrency(paymentAmount)} — search for the order to match it to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name or order number..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : filteredOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No orders found
              </div>
            ) : (
              filteredOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selectedOrderId === order.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{order.customer_name}</span>
                      {order.order_number && (
                        <span className="text-xs text-muted-foreground ml-2">#{order.order_number}</span>
                      )}
                    </div>
                    <div className="text-sm tabular-nums">
                      {formatCurrency(order.total_order_value ?? order.value ?? 0)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Paid: {formatCurrency(order.amount_paid ?? 0)} / {formatCurrency(order.total_order_value ?? order.value ?? 0)}
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedOrderId && (
            <div className="flex items-center gap-3">
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="final">Final payment</SelectItem>
                  <SelectItem value="permit">Permit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleMatch} className="flex-1">
                Match to order <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
