import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { orderRef } from '@/modules/orders/utils/orderDisplayId';
import { shortDayMonth } from '@/modules/sections/sectionsView';
import { londonMonthRange } from '@/shared/utils/londonTime';
import { LedgerUnavailable, searchOpenInvoices, type LedgerPaymentRow, type PaymentSource } from '../api/ledger.api';
import {
  useAllocatePayment, useConfirmSuggestion, useIgnorePayment, useLedgerPayments, useLedgerTotals, useUnmatchPayment, useMarkReviewed,
} from '../hooks/useLedger';
import { allocationLabel, filterRows, groupOf, primaryAction, sortRows, type LedgerGroup, type LedgerViewFilters } from './ledgerView';

const gbp = (pence: number) => formatGbpDecimal(pence / 100);

const SOURCE_CHIP: Record<PaymentSource, string> = {
  stripe: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  revolut: 'border-sky-200 bg-sky-50 text-sky-800',
  manual: 'border-gardens-bdr bg-gardens-page text-gardens-txs',
};
const STATUS_CHIP: Record<string, string> = {
  unmatched: 'bg-gardens-sem-red text-white',
  suggested: 'bg-gardens-sem-amber text-gardens-tx',
  matched: 'bg-gardens-sem-green text-white',
  pending: 'bg-gardens-sem-grey text-white',
  ignored: 'bg-gardens-page text-gardens-txs border border-gardens-bdr',
};
const GROUP_LABEL: Record<LedgerGroup, string> = { review: 'Needs review', matched: 'Matched', waiting: 'Waiting', ignored: 'Ignored' };

/** Shown when the ledger migration is not applied on this database (e.g. the preview on prod). */
export const LedgerNotSetUp: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col gap-3">
    <div role="status" data-testid="ledger-not-set-up" className="rounded-lg border border-gardens-sem-amber bg-gardens-sem-amber-lt px-3 py-2 text-[12px] text-gardens-tx">
      <b>The payments ledger isn&rsquo;t set up on this database yet.</b> Matching, fees and totals appear here once the
      ledger migration is applied. Until then this shows the latest payments from the old tables (read-only).
    </div>
    {children}
  </div>
);

export const PaymentsLedgerTab: React.FC<{ fallback?: React.ReactNode }> = ({ fallback }) => {
  const month = londonMonthRange();
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [source, setSource] = useState<'all' | PaymentSource>('all');
  const [view, setView] = useState<LedgerViewFilters>({ status: 'all', type: 'all', search: '' });
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [matching, setMatching] = useState<LedgerPaymentRow | null>(null);

  const payments = useLedgerPayments({ from, to, source });
  const totals = useLedgerTotals(from, to);
  const confirm = useConfirmSuggestion();
  const unmatch = useUnmatchPayment();
  const reviewed = useMarkReviewed();

  const rows = useMemo(() => sortRows(filterRows(payments.data ?? [], {
    ...view,
    minPence: minAmt ? Math.round(Number(minAmt) * 100) : null,
    maxPence: maxAmt ? Math.round(Number(maxAmt) * 100) : null,
  })), [payments.data, view, minAmt, maxAmt]);
  const reviewCount = (payments.data ?? []).filter((r) => groupOf(r.status, r.needsReview) === 'review').length;

  if (payments.error instanceof LedgerUnavailable || totals.error instanceof LedgerUnavailable) {
    return <LedgerNotSetUp>{fallback}</LedgerNotSetUp>;
  }

  const t = totals.data;
  let lastGroup: LedgerGroup | null = null;

  return (
    <div className="flex flex-col gap-3" data-testid="payments-ledger">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="ledger-totals">
        {[
          ['Received', t?.receivedPence],
          ['Stripe fees', t?.feesPence],
          ['Net', t?.netPence],
          ['Pass-through (permits)', t?.passThroughPence],
          ['Unallocated', t?.unallocatedPence],
        ].map(([label, v]) => (
          <div key={label as string} className="rounded-lg border border-gardens-bdr bg-white px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.06em] text-gardens-txs">{label}</div>
            <div className="font-head text-[16px] font-semibold tabular-nums">{v == null ? '—' : gbp(v as number)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 text-[12px]">
        <label className="flex flex-col">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded border border-gardens-bdr px-1" /></label>
        <label className="flex flex-col">To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-8 rounded border border-gardens-bdr px-1" /></label>
        <label className="flex flex-col">Source
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="h-8 rounded border border-gardens-bdr px-1">
            <option value="all">All</option><option value="stripe">Stripe</option><option value="revolut">Revolut</option><option value="manual">Manual</option>
          </select>
        </label>
        <label className="flex flex-col">Status
          <select value={view.status} onChange={(e) => setView({ ...view, status: e.target.value as LedgerViewFilters['status'] })} className="h-8 rounded border border-gardens-bdr px-1">
            <option value="all">All</option><option value="review">Needs review</option><option value="matched">Matched</option><option value="waiting">Waiting</option><option value="ignored">Ignored</option>
          </select>
        </label>
        <label className="flex flex-col">Type
          <select value={view.type} onChange={(e) => setView({ ...view, type: e.target.value as LedgerViewFilters['type'] })} className="h-8 rounded border border-gardens-bdr px-1">
            <option value="all">All</option><option value="deposit">Deposit</option><option value="balance">Balance</option><option value="permit">Permit fee</option><option value="refund">Refund</option>
          </select>
        </label>
        <label className="flex flex-col">£ min<input inputMode="decimal" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} className="h-8 w-20 rounded border border-gardens-bdr px-1" /></label>
        <label className="flex flex-col">£ max<input inputMode="decimal" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} className="h-8 w-20 rounded border border-gardens-bdr px-1" /></label>
        <label className="flex flex-col flex-1 min-w-[160px]">Search
          <input type="search" placeholder="Payer, reference, ORD-000123" value={view.search} onChange={(e) => setView({ ...view, search: e.target.value })} className="h-8 rounded border border-gardens-bdr px-2" />
        </label>
        {reviewCount > 0 && (
          <span className="ml-auto self-center rounded-full bg-gardens-sem-red px-2 py-0.5 text-[11px] font-semibold text-white" data-testid="ledger-review-count">
            {reviewCount} need{reviewCount === 1 ? 's' : ''} review
          </span>
        )}
      </div>

      {payments.isLoading ? (
        <div className="text-[12px] text-gardens-txs">Loading…</div>
      ) : payments.error ? (
        <div className="text-[12px] text-gardens-sem-red">Couldn&rsquo;t load payments. Try again in a moment.</div>
      ) : rows.length === 0 ? (
        <div className="text-[12px] text-gardens-txs">No payments in this range.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-gardens-txs">
                <th className="py-1 px-1">Date</th><th className="px-1">Payer</th><th className="px-1">Reference</th><th className="px-1">Source</th>
                <th className="px-1 text-right">Amount</th><th className="px-1 text-right">Fee</th><th className="px-1">Allocated to</th>
                <th className="px-1">Status</th><th className="px-1" aria-label="Action" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = groupOf(r.status, r.needsReview);
                const header = g !== lastGroup;
                lastGroup = g;
                const action = primaryAction(r);
                const top = r.suggestions[0];
                return (
                  <React.Fragment key={r.id}>
                    {header && (
                      <tr className="border-t border-gardens-bdr bg-gardens-page">
                        <td colSpan={9} className="py-1 px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-gardens-txs">{GROUP_LABEL[g]}</td>
                      </tr>
                    )}
                    <tr className="border-t border-gardens-bdr align-top" data-testid="ledger-row">
                      <td className="py-1.5 px-1 whitespace-nowrap">{shortDayMonth(r.receivedAt)}</td>
                      <td className="px-1 min-w-[140px]">
                        <span className="block font-semibold text-gardens-tx">{r.customerName ?? r.payerName ?? 'Payer unknown'}</span>
                        {r.customerName && r.payerName && r.payerName.toLowerCase() !== r.customerName.toLowerCase() && (
                          <span className="block text-[11px] text-gardens-txs">paid by {r.payerName}</span>
                        )}
                        {r.memorialName && <span className="block text-[11px] text-gardens-txm-aa">for {r.memorialName}</span>}
                      </td>
                      <td className="px-1 font-mono text-[11px] break-all max-w-[180px]">{r.reference ?? '—'}</td>
                      <td className="px-1"><span className={cn('inline-block rounded border px-1.5 text-[11px] capitalize', SOURCE_CHIP[r.source])}>{r.source}</span></td>
                      <td className={cn('px-1 text-right tabular-nums font-semibold whitespace-nowrap', r.grossPence < 0 && 'text-gardens-sem-red')}>
                        {r.grossPence < 0 ? `−${gbp(-r.grossPence)}` : gbp(r.grossPence)}
                      </td>
                      <td className="px-1 text-right tabular-nums text-gardens-txs whitespace-nowrap">{r.feePence ? gbp(r.feePence) : '—'}</td>
                      <td className="px-1">
                        {allocationLabel(r)}
                        {r.isPassThrough && <span className="block text-[11px] text-gardens-txs">pass-through, not revenue</span>}
                      </td>
                      <td className="px-1">
                        <span className={cn('inline-block rounded px-1.5 text-[11px] capitalize', STATUS_CHIP[r.status])}>{r.status === 'pending' ? 'waiting' : r.status}</span>
                        {r.matchReason && <span className="block text-[11px] text-gardens-txs">{r.matchReason}</span>}
                        {r.needsReview && <span className="block text-[11px] font-semibold text-gardens-sem-amber">Needs a check{r.reviewReason ? `: ${r.reviewReason}` : ''}</span>}
                      </td>
                      <td className="px-1 text-right whitespace-nowrap">
                        {action === 'confirm' && top && (
                          <button type="button" disabled={confirm.isPending}
                            onClick={() => confirm.mutate({ paymentId: r.id, invoiceId: top.invoiceId, orderId: top.orderId })}
                            title={`${top.invoiceNumber ?? (top.orderNumber != null ? orderRef(top.orderNumber) : '')} · ${top.reasons.join(', ')}`}
                            className="h-7 rounded-lg bg-gardens-tx px-2 font-semibold text-white disabled:opacity-50">
                            Confirm {top.orderNumber != null ? orderRef(top.orderNumber) : top.invoiceNumber}
                          </button>
                        )}
                        {action === 'match' && (
                          <button type="button" onClick={() => setMatching(r)} className="h-7 rounded-lg bg-gardens-tx px-2 font-semibold text-white">Match</button>
                        )}
                        {action === 'confirm' && (
                          <button type="button" onClick={() => setMatching(r)} className="ml-1 h-7 rounded-lg border border-gardens-bdr px-2 text-gardens-txs">Other…</button>
                        )}
                        {action === 'reviewed' && (
                          <button type="button" disabled={reviewed.isPending}
                            onClick={() => {
                              const note = window.prompt('What did you check? (kept in the audit log)');
                              if (note && note.trim()) reviewed.mutate({ paymentId: r.id, note: note.trim() });
                            }}
                            className="h-7 rounded-lg bg-gardens-tx px-2 font-semibold text-white disabled:opacity-50">Mark checked</button>
                        )}
                        {(action === 'menu' || action === 'reviewed') && (
                          <button type="button" aria-label="Unmatch" title="Unmatch"
                            onClick={() => {
                              const reason = window.prompt('Why unmatch this payment? (kept in the audit log)');
                              if (reason && reason.trim()) unmatch.mutate({ paymentId: r.id, reason: reason.trim() });
                            }}
                            className="h-7 rounded-lg border border-gardens-bdr px-2 text-gardens-txs">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(confirm.error || unmatch.error || reviewed.error) && (
        <div className="text-[12px] text-gardens-sem-red">That change wasn&rsquo;t saved: {String((confirm.error ?? unmatch.error ?? reviewed.error as Error)?.message ?? '')}</div>
      )}
      {matching && <MatchPanel payment={matching} onClose={() => setMatching(null)} />}
    </div>
  );
};

/** Manual match: pick a suggestion or search open invoices, optionally split the amount. */
const MatchPanel: React.FC<{ payment: LedgerPaymentRow; onClose: () => void }> = ({ payment, onClose }) => {
  const { organizationId } = useOrganization();
  const [search, setSearch] = useState(payment.reference ?? '');
  const [picked, setPicked] = useState<Record<string, string>>({}); // invoiceId -> £ amount
  const allocate = useAllocatePayment();
  const ignore = useIgnorePayment();
  const options = useQuery({
    queryKey: ['ledger', 'open-invoices', organizationId, search],
    queryFn: () => searchOpenInvoices(organizationId!, search),
    enabled: !!organizationId,
  });
  const unallocated = payment.grossPence - payment.allocations.reduce((s, a) => s + a.amountPence, 0);
  const chosen = Object.entries(picked).map(([invoiceId, v]) => ({ invoiceId, amountPence: Math.round(Number(v) * 100) })).filter((a) => a.amountPence > 0);
  const chosenTotal = chosen.reduce((s, a) => s + a.amountPence, 0);
  const over = chosenTotal > unallocated;

  return (
    <div role="dialog" aria-modal="true" aria-label="Match payment" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl flex flex-col gap-3 text-[12px]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-head text-[16px] font-semibold">Match {gbp(payment.grossPence)} from {payment.payerName ?? 'unknown payer'}</div>
            <div className="text-gardens-txs">{shortDayMonth(payment.receivedAt)} · <span className="font-mono">{payment.reference ?? 'no reference'}</span> · {gbp(unallocated)} unallocated</div>
          </div>
          <button type="button" onClick={onClose} className="text-gardens-txs" aria-label="Close">✕</button>
        </div>
        {payment.suggestions.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.06em] text-gardens-txs mb-1">Suggestions</div>
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {payment.suggestions.map((s) => (
                <li key={`${s.invoiceId}-${s.orderId}`} className="flex items-center justify-between gap-2 rounded border border-gardens-bdr px-2 py-1">
                  <span>{s.orderNumber != null ? orderRef(s.orderNumber) : ''} {s.invoiceNumber ?? ''} · {s.customerName ?? '—'}<span className="block text-[11px] text-gardens-txs">{s.reasons.join(', ')} · score {s.score}</span></span>
                  {s.invoiceId && (
                    <button type="button" className="h-7 rounded border border-gardens-bdr px-2"
                      onClick={() => setPicked({ ...picked, [s.invoiceId!]: String(Math.min(unallocated, s.remainingPence ?? unallocated) / 100) })}>Use</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="flex flex-col">Find an open invoice
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="INV-000123, ORD-000123 or customer" className="h-8 rounded border border-gardens-bdr px-2" />
        </label>
        <ul className="m-0 p-0 list-none max-h-56 overflow-auto divide-y divide-gardens-bdr">
          {(options.data ?? []).map((o) => (
            <li key={o.invoiceId} className="flex items-center justify-between gap-2 py-1">
              <span>{o.invoiceNumber}{o.orderNumber != null && ` · ${orderRef(o.orderNumber)}`} · {o.customerName ?? '—'}
                <span className="block text-[11px] text-gardens-txs">{o.invoiceType ?? 'invoice'} · {gbp(o.remainingPence)} left</span></span>
              <input aria-label={`Amount for ${o.invoiceNumber}`} inputMode="decimal" placeholder="£"
                value={picked[o.invoiceId] ?? ''} onChange={(e) => setPicked({ ...picked, [o.invoiceId]: e.target.value })}
                onFocus={() => { if (!picked[o.invoiceId]) setPicked({ ...picked, [o.invoiceId]: String(Math.min(unallocated - chosenTotal, o.remainingPence) / 100) }); }}
                className="h-7 w-24 rounded border border-gardens-bdr px-1 text-right" />
            </li>
          ))}
          {options.data?.length === 0 && <li className="py-1 text-gardens-txs">No open invoices match.</li>}
        </ul>
        {over && <div className="text-gardens-sem-red">That is more than the {gbp(unallocated)} left on this payment.</div>}
        {(allocate.error || ignore.error) && <div className="text-gardens-sem-red">Not saved: {String(((allocate.error ?? ignore.error) as Error)?.message ?? '')}</div>}
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="h-8 rounded-lg border border-gardens-bdr px-3 text-gardens-txs"
            onClick={() => {
              const reason = window.prompt('Why ignore this payment? (e.g. not a customer payment)');
              if (reason && reason.trim()) ignore.mutate({ paymentId: payment.id, reason: reason.trim() }, { onSuccess: onClose });
            }}>Not a customer payment</button>
          <button type="button" disabled={!chosen.length || over || allocate.isPending}
            onClick={() => allocate.mutate({ paymentId: payment.id, allocations: chosen }, { onSuccess: onClose })}
            className="h-8 rounded-lg bg-gardens-tx px-3 font-semibold text-white disabled:opacity-50">
            Save match{chosen.length > 1 ? ` (${chosen.length} invoices)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
