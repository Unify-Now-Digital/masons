import React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ArrowRight, Building2, Ban } from 'lucide-react';
import type { OrderPayment } from '../types/reconciliation.types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const sourceDot = (s: string) => (
  <div
    className="h-2.5 w-2.5 rounded-full shrink-0"
    style={{ backgroundColor: s === 'stripe' ? '#635bff' : '#0D0D0D' }}
    title={s === 'stripe' ? 'Stripe' : 'Revolut'}
  />
);

const confBadge = (c: string) => {
  const map: Record<string, string> = {
    exact: 'border-gardens-grn text-gardens-grn-dk',
    name: 'border-gardens-blu text-gardens-blu-dk',
    amount: 'border-gardens-amb text-gardens-amb-dk',
  };
  return <Badge variant="outline" className={`text-[10px] px-1 py-0 ${map[c] ?? ''}`}>{c}</Badge>;
};

interface Props {
  payments: OrderPayment[];
  onMatch: (paymentId: string, orderId: string) => void;
  onMatchOther: (paymentId: string) => void;
  onPassThrough: (paymentId: string) => void;
}

export function UnmatchedPaymentsTable({ payments, onMatch, onMatchOther, onPassThrough }: Props) {
  if (!payments.length) {
    return (
      <div className="text-sm text-muted-foreground bg-gardens-grn-lt border border-gardens-grn-lt rounded-md p-3 text-center">
        All payments matched. Nothing to review.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <Table>
        <TableHeader>
          <TableRow className="bg-gardens-red-lt/50">
            <TableHead className="w-8" />
            <TableHead className="w-28">Amount</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="w-36 hidden md:table-cell">Received</TableHead>
            <TableHead className="hidden sm:table-cell">Best match</TableHead>
            <TableHead className="text-right w-48">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => {
            const topCandidate = p.match_candidates?.[0] ?? null;
            return (
              <TableRow key={p.id} className="bg-gardens-red-lt/20 hover:bg-gardens-red-lt/40">
                <TableCell className="py-2 px-3">{sourceDot(p.source)}</TableCell>
                <TableCell className="py-2 font-semibold tabular-nums">{fmt(p.amount)}</TableCell>
                <TableCell className="py-2">
                  <span className="font-mono text-xs truncate max-w-[180px] block">{p.reference ?? '—'}</span>
                  {p.match_reason && (
                    <span className="text-[10px] text-gardens-red-dk block truncate max-w-[220px]">{p.match_reason}</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell">{fmtDate(p.received_at)}</TableCell>
                <TableCell className="py-2 hidden sm:table-cell">
                  {topCandidate ? (
                    <div className="flex items-center gap-1.5">
                      {confBadge(topCandidate.confidence)}
                      <span className="text-sm truncate max-w-[140px]">{topCandidate.customer_name}</span>
                      <span className="text-xs text-muted-foreground">#{topCandidate.order_ref}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No suggestions</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {topCandidate && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => onMatch(p.id, topCandidate.order_id)}
                      >
                        Match <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => onMatchOther(p.id)}
                    >
                      <Building2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2 text-muted-foreground"
                      onClick={() => onPassThrough(p.id)}
                    >
                      <Ban className="h-3 w-3" />
                    </Button>
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
