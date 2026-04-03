import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ArrowRight, Building2, Ban } from 'lucide-react';
import type { OrderPayment, MatchCandidate } from '../types/reconciliation.types';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const sourceBadge = (source: string) => {
  if (source === 'stripe') {
    return <Badge className="bg-[#635bff] text-white text-xs">Stripe</Badge>;
  }
  return <Badge className="bg-gray-800 text-white text-xs">Revolut</Badge>;
};

const confidenceLabel = (confidence: MatchCandidate['confidence']) => {
  switch (confidence) {
    case 'exact':
      return <Badge variant="outline" className="border-green-500 text-green-700 text-xs">Exact match</Badge>;
    case 'name':
      return <Badge variant="outline" className="border-blue-500 text-blue-700 text-xs">Name match</Badge>;
    case 'amount':
      return <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">Amount match</Badge>;
  }
};

interface Props {
  payment: OrderPayment;
  onMatch: (paymentId: string, orderId: string) => void;
  onMatchOther: (paymentId: string) => void;
  onPassThrough: (paymentId: string) => void;
}

export function UnmatchedPaymentCard({ payment, onMatch, onMatchOther, onPassThrough }: Props) {
  const candidates = payment.match_candidates ?? [];

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {sourceBadge(payment.source)}
              <span className="text-lg font-bold">{formatCurrency(payment.amount)}</span>
              <span className="text-xs text-muted-foreground">{formatDate(payment.received_at)}</span>
            </div>
            {payment.reference && (
              <div className="text-sm text-muted-foreground mb-1">
                Reference: <span className="font-mono text-foreground">{payment.reference}</span>
              </div>
            )}
            {payment.match_reason && (
              <div className="text-xs text-red-600 mb-2">{payment.match_reason}</div>
            )}

            {candidates.length > 0 && (
              <div className="space-y-2 mt-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggested matches</div>
                {candidates.slice(0, 2).map((candidate) => (
                  <div
                    key={candidate.order_id}
                    className="flex items-center justify-between bg-white rounded-md border p-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {confidenceLabel(candidate.confidence)}
                      <span className="text-sm font-medium truncate">{candidate.customer_name}</span>
                      <span className="text-xs text-muted-foreground">#{candidate.order_ref}</span>
                      <span className="text-sm">{formatCurrency(candidate.expected_amount)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 ml-2"
                      onClick={() => onMatch(payment.id, candidate.order_id)}
                    >
                      Match <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-3 pt-3 border-t border-red-200">
          <Button size="sm" variant="outline" onClick={() => onMatchOther(payment.id)}>
            <Building2 className="h-3 w-3 mr-1" /> Match to other order
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onPassThrough(payment.id)}>
            <Ban className="h-3 w-3 mr-1" /> Permit pass-through
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
