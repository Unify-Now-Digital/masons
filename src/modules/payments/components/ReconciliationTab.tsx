import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { useUnmatchedPayments } from '../hooks/useUnmatchedPayments';
import { useMatchedPayments } from '../hooks/useMatchedPayments';
import { useMatchPayment, useMarkPassThrough } from '../hooks/useMatchPayment';
import { UnmatchedPaymentCard } from './UnmatchedPaymentCard';
import { MatchedPaymentRow } from './MatchedPaymentRow';
import { MatchModal } from './MatchModal';

type SourceFilter = 'all' | 'stripe' | 'revolut';

export function ReconciliationTab() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [matchModalPaymentId, setMatchModalPaymentId] = useState<string | null>(null);

  const { data: unmatched, isLoading: unmatchedLoading } = useUnmatchedPayments();
  const { data: matched, isLoading: matchedLoading } = useMatchedPayments(
    sourceFilter === 'all' ? undefined : sourceFilter
  );

  const matchMutation = useMatchPayment();
  const passThruMutation = useMarkPassThrough();

  const matchModalPayment = unmatched?.find((p) => p.id === matchModalPaymentId) ?? null;

  const handleMatch = (paymentId: string, orderId: string, paymentType?: string) => {
    matchMutation.mutate({
      paymentId,
      orderId,
      paymentType: (paymentType ?? 'deposit') as 'deposit' | 'final' | 'permit' | 'other',
      matchedBy: 'manual',
    });
  };

  const handlePassThrough = (paymentId: string) => {
    passThruMutation.mutate({ paymentId });
  };

  const filterButtons: { label: string; value: SourceFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Stripe', value: 'stripe' },
    { label: 'Revolut', value: 'revolut' },
  ];

  return (
    <div className="space-y-6">
      {/* Unmatched queue */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
            Unmatched — need review ({unmatched?.length ?? 0})
          </h3>
        </div>

        {unmatchedLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !unmatched?.length ? (
          <div className="text-sm text-muted-foreground bg-green-50 border border-green-200 rounded-md p-4 text-center">
            All payments matched. Nothing to review.
          </div>
        ) : (
          <div className="space-y-3">
            {unmatched.map((payment) => (
              <UnmatchedPaymentCard
                key={payment.id}
                payment={payment}
                onMatch={(pId, oId) => handleMatch(pId, oId)}
                onMatchOther={(pId) => setMatchModalPaymentId(pId)}
                onPassThrough={handlePassThrough}
              />
            ))}
          </div>
        )}
      </div>

      {/* Matched payments feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Matched payments
          </h3>
          <div className="flex gap-1">
            {filterButtons.map((fb) => (
              <Button
                key={fb.value}
                size="sm"
                variant={sourceFilter === fb.value ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setSourceFilter(fb.value)}
              >
                {fb.label}
              </Button>
            ))}
          </div>
        </div>

        {matchedLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !matched?.length ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No matched payments yet.
          </div>
        ) : (
          <div className="divide-y">
            {matched.map((payment) => (
              <MatchedPaymentRow key={payment.id} payment={payment} />
            ))}
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
    </div>
  );
}
