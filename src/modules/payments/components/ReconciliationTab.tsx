import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { useUnmatchedPayments } from '../hooks/useUnmatchedPayments';
import { useMatchedPayments } from '../hooks/useMatchedPayments';
import { useMatchPayment, useMarkPassThrough, AmountMismatchError } from '../hooks/useMatchPayment';
import { UnmatchedPaymentsTable } from './UnmatchedPaymentsTable';
import { MatchModal } from './MatchModal';
import type { OrderPayment } from '../types/reconciliation.types';

type SourceFilter = 'all' | 'stripe' | 'revolut';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface PendingMatch {
  paymentId: string;
  orderId: string;
  paymentType: 'deposit' | 'final' | 'permit' | 'other';
}

export function ReconciliationTab() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [matchModalPaymentId, setMatchModalPaymentId] = useState<string | null>(null);
  const [mismatchConfirm, setMismatchConfirm] = useState<{
    open: boolean;
    message: string;
    pending: PendingMatch | null;
  }>({ open: false, message: '', pending: null });

  const { data: unmatched, isLoading: unmatchedLoading } = useUnmatchedPayments();
  const { data: matched, isLoading: matchedLoading } = useMatchedPayments(
    sourceFilter === 'all' ? undefined : sourceFilter
  );

  const matchMutation = useMatchPayment();
  const passThruMutation = useMarkPassThrough();

  const matchModalPayment = unmatched?.find((p) => p.id === matchModalPaymentId) ?? null;

  const handleMatch = (paymentId: string, orderId: string, paymentType?: string) => {
    const pt = (paymentType ?? 'deposit') as 'deposit' | 'final' | 'permit' | 'other';
    matchMutation.mutate(
      { paymentId, orderId, paymentType: pt, matchedBy: 'manual' },
      {
        onError: (error) => {
          if (error instanceof AmountMismatchError) {
            setMismatchConfirm({
              open: true,
              message: error.message,
              pending: { paymentId, orderId, paymentType: pt },
            });
          }
        },
      }
    );
  };

  const handleForceMatch = () => {
    const pending = mismatchConfirm.pending;
    if (!pending) return;
    matchMutation.mutate({ ...pending, matchedBy: 'manual', forceMatch: true });
    setMismatchConfirm({ open: false, message: '', pending: null });
  };

  const filterButtons: { label: string; value: SourceFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Stripe', value: 'stripe' },
    { label: 'Revolut', value: 'revolut' },
  ];

  return (
    <div className="space-y-5">
      {/* Unmatched queue */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide">
            Unmatched — need review ({unmatched?.length ?? 0})
          </h3>
        </div>
        {unmatchedLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <UnmatchedPaymentsTable
            payments={unmatched ?? []}
            onMatch={(pId, oId) => handleMatch(pId, oId)}
            onMatchOther={(pId) => setMatchModalPaymentId(pId)}
            onPassThrough={(pId) => passThruMutation.mutate({ paymentId: pId })}
          />
        )}
      </div>

      {/* Matched payments feed */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Matched payments ({matched?.length ?? 0})
          </h3>
          <div className="flex gap-1">
            {filterButtons.map((fb) => (
              <Button
                key={fb.value}
                size="sm"
                variant={sourceFilter === fb.value ? 'default' : 'outline'}
                className="h-6 text-[11px] px-2"
                onClick={() => setSourceFilter(fb.value)}
              >
                {fb.label}
              </Button>
            ))}
          </div>
        </div>
        {matchedLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !matched?.length ? (
          <div className="text-sm text-muted-foreground text-center py-4">No matched payments yet.</div>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-28 text-right">Amount</TableHead>
                  <TableHead className="w-36 text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matched.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="py-1.5 px-3">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.source === 'stripe' ? '#635bff' : '#0D0D0D' }}
                        title={p.source === 'stripe' ? 'Stripe' : 'Revolut'}
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span className="text-sm font-medium">{p.orders?.customer_name ?? 'Unknown'}</span>
                      {p.orders?.order_number && (
                        <span className="text-xs text-muted-foreground ml-1.5">#{p.orders.order_number}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {p.payment_type === 'deposit' ? 'Deposit' : p.payment_type === 'final' ? 'Final' : p.payment_type === 'permit' ? 'Permit' : 'Payment'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-right font-semibold tabular-nums text-sm">{fmt(p.amount)}</TableCell>
                    <TableCell className="py-1.5 text-right text-xs text-muted-foreground">{fmtDate(p.received_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Match modal */}
      {matchModalPayment && (
        <MatchModal
          open={!!matchModalPaymentId}
          onClose={() => setMatchModalPaymentId(null)}
          paymentId={matchModalPayment.id}
          paymentAmount={matchModalPayment.amount}
          onMatch={(pId, oId, pType) => {
            handleMatch(pId, oId, pType);
            setMatchModalPaymentId(null);
          }}
        />
      )}

      {/* Amount mismatch confirmation */}
      <AlertDialog open={mismatchConfirm.open} onOpenChange={(open) => { if (!open) setMismatchConfirm({ open: false, message: '', pending: null }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Amount mismatch detected</AlertDialogTitle>
            <AlertDialogDescription>{mismatchConfirm.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceMatch} className="bg-amber-600 hover:bg-amber-700">Match anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
