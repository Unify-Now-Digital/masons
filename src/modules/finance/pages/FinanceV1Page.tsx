import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, Hourglass, Reply } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { NextActionPill } from '@/shared/components/mason';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useConfirmedOrdersStat, useFinanceRecentPayments } from '../hooks/useFinance';
import { FinanceInvoicesTab } from './FinancePage';
import { useOwedInvoices, usePaymentsSince, useSectionOrders } from '@/modules/sections/useSectionsData';
import {
  AGE_BUCKET_LABEL, agedOwed, cashByWeek, chaseQueue, dueOnCompletion, noPaymentOrders, orderAction, toCsv, type AgeBucket,
} from '@/modules/sections/sectionsView';

type Tab = 'owed' | 'invoices' | 'payments';
const BUCKETS: AgeBucket[] = ['d90', 'd31to90', 'd8to30', 'd0to7'];
const BUCKET_BG: Record<AgeBucket, string> = {
  d90: 'bg-gardens-sem-red',
  d31to90: 'bg-gardens-sem-red opacity-70',
  d8to30: 'bg-gardens-sem-amber',
  d0to7: 'bg-gardens-sem-amber-lt',
};
const shortDate = (d: Date | string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const Section: React.FC<{ title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, aside, children, className }) => (
  <section className={cn('rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3 flex flex-col gap-2', className)}>
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">{title}</h3>
      {aside && <span className="text-[12px] text-gardens-txs">{aside}</span>}
    </div>
    {children}
  </section>
);

/** finance-v1: money owed first, a chase queue, cash in per week, money in. Invoices tab = the existing workspace. */
export const FinancePage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const deepLink = params.has('invoice') || params.has('focus');
  const [tab, setTab] = useState<Tab>(deepLink ? 'invoices' : 'owed');
  const { canViewFinancials } = useOrganization();
  const { invoices, isLoading: invLoading } = useOwedInvoices();
  const { orders } = useSectionOrders();
  const payments = usePaymentsSince(8);
  const recent = useFinanceRecentPayments();
  const confirmed = useConfirmedOrdersStat();

  const now = useMemo(() => new Date(), []);
  const aged = useMemo(() => agedOwed(invoices, now), [invoices, now]);
  const queue = useMemo(() => chaseQueue(invoices, now), [invoices, now]);
  const noPay = useMemo(() => noPaymentOrders(orders), [orders]);
  const onCompletion = useMemo(() => dueOnCompletion(orders), [orders]);
  const weeks = useMemo(() => cashByWeek(payments.data ?? [], 6, now), [payments.data, now]);
  const owedTotal = BUCKETS.reduce((s, b) => s + aged[b], 0);
  const knownCompletion = onCompletion.reduce((s, o) => s + (o.balance ?? 0), 0);
  const unknownCompletion = onCompletion.filter((o) => o.balance == null).length;
  const needYou = queue.length + noPay.length;
  const maxWeek = Math.max(1, ...weeks.map((w) => w.collected));
  const invoiceCount = invoices.length;
  const confirmedCount = confirmed.data?.count ?? null;

  const exportCsv = () => {
    const inv = toCsv(
      ['invoice', 'customer', 'issue_date', 'status', 'remaining_gbp'],
      invoices.map((i) => [i.invoiceNumber, i.customer, i.issueDate, i.status, (i.remainingPence / 100).toFixed(2)]),
    );
    const pay = toCsv(
      ['received_at', 'customer', 'order', 'amount_gbp', 'source', 'type'],
      (recent.data ?? []).map((p) => [p.receivedAt, p.customerName, p.orderNumber, p.amount.toFixed(2), p.source, p.paymentType]),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    download(`mason-invoices-${stamp}.csv`, inv);
    download(`mason-payments-${stamp}.csv`, pay);
  };

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="m-0 font-head text-xl sm:text-2xl font-semibold text-gardens-tx">Finance</h1>
          <span className="text-[13px] text-gardens-txs hidden sm:inline">Money owed to us, money in, and what to do next</span>
        </div>
        {canViewFinancials && (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gardens-bdr bg-white text-[13px] text-gardens-tx hover:bg-gardens-page"
            data-testid="finance-export"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        )}
      </div>

      <div className="flex items-center gap-1" role="tablist">
        {([
          ['owed', `Owed to us ${needYou}`],
          ['invoices', `Invoices ${invoiceCount}`],
          ['payments', 'Payments'],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn(
              'h-7 rounded-full px-3 text-xs font-semibold border',
              tab === v ? 'bg-gardens-tx text-white border-gardens-tx' : 'bg-white text-gardens-tx border-gardens-bdr hover:bg-gardens-page',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'invoices' ? (
        <FinanceInvoicesTab />
      ) : tab === 'payments' ? (
        <Section title="Money in" aside="latest payments">
          <PaymentsList rows={recent.data ?? []} loading={recent.isLoading} />
        </Section>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] flex-1 min-h-0 overflow-auto">
          <div className="flex flex-col gap-3 min-w-0">
            <Section title="Owed to us" aside="Oldest first">
              <div data-testid="finance-cue">
                <div className="font-head text-[20px] font-semibold text-gardens-tx">
                  {needYou} need{needYou === 1 ? 's' : ''} you now
                </div>
                <div className="text-[12px] text-gardens-txs">
                  <b className="text-gardens-sem-red">{formatGbpDecimal(owedTotal)} unpaid on {queue.length} invoice{queue.length === 1 ? '' : 's'}</b>
                  {noPay.length > 0 && ` · ${noPay.length} order${noPay.length === 1 ? '' : 's'} with no payment`}
                </div>
              </div>
              {owedTotal > 0 && (
                <div className="flex h-3 rounded-full overflow-hidden bg-gardens-page" aria-label="Money owed by age">
                  {BUCKETS.map((b) => (aged[b] > 0 ? <span key={b} className={BUCKET_BG[b]} style={{ width: `${(aged[b] / owedTotal) * 100}%` }} /> : null))}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[12px]">
                {BUCKETS.map((b) => (
                  <div key={b}>
                    <b className={cn('tabular-nums', b === 'd90' || b === 'd31to90' ? 'text-gardens-sem-red' : 'text-gardens-sem-amber')}>{formatGbpDecimal(aged[b])}</b>
                    <div className="text-gardens-txm-aa">{AGE_BUCKET_LABEL[b]}</div>
                  </div>
                ))}
                <div>
                  <b className="tabular-nums text-gardens-tx">{formatGbpDecimal(knownCompletion)}</b>
                  <div className="text-gardens-txm-aa">on completion{unknownCompletion > 0 ? ` · +${unknownCompletion} unknown` : ''}</div>
                </div>
              </div>
              {confirmedCount != null && confirmedCount > invoiceCount && (
                <div className="flex items-start gap-2 rounded-lg border border-gardens-bdr bg-gardens-sem-amber-lt px-3 py-2 text-[12px] text-gardens-sem-amber" data-testid="reconcile-flag">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Finance lists {invoiceCount} invoice{invoiceCount === 1 ? '' : 's'}, but Orders has {confirmedCount} confirmed. Amounts owed only count invoiced money until they match.
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-gardens-txm-aa">
                      <th className="py-1.5 font-bold">Customer</th>
                      <th className="py-1.5 font-bold">What's owed</th>
                      <th className="py-1.5 font-bold text-right">Amount</th>
                      <th className="py-1.5 font-bold">Age</th>
                      <th className="py-1.5 font-bold text-right">Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    <GroupRow icon={<Reply className="h-3 w-3" />} label="Chase now" count={queue.length + noPay.length} />
                    {invLoading && (
                      <tr><td colSpan={5} className="py-3 text-gardens-txs">Loading…</td></tr>
                    )}
                    {!invLoading && queue.length + noPay.length === 0 && (
                      <tr><td colSpan={5} className="py-3 text-gardens-txs">No invoices are owed{confirmedCount ? ' — check the reconcile flag above' : ''}.</td></tr>
                    )}
                    {queue.map((r) => (
                      <tr key={r.id} className="border-t border-gardens-bdr hover:bg-gardens-page cursor-pointer" onClick={() => navigate(`/dashboard/finance?invoice=${encodeURIComponent(r.id)}`)}>
                        <td className="py-2 font-head font-semibold text-gardens-tx">{r.customer}<div className="font-mono text-[11px] font-normal text-gardens-txm-aa">{r.invoiceNumber}</div></td>
                        <td className="py-2 text-gardens-tx">Invoice unpaid</td>
                        <td className="py-2 text-right tabular-nums font-semibold">{formatGbpDecimal(r.remainingPence / 100)}</td>
                        <td className={cn('py-2', (r.days ?? 0) > 30 ? 'text-gardens-sem-red font-semibold' : 'text-gardens-txs')}>
                          {r.days == null ? 'date not set' : `${r.days} days`}
                        </td>
                        <td className="py-2 text-right">
                          <NextActionPill action={{ kind: 'deposit', label: 'Chase payment', reason: '', tone: (r.days ?? 0) > 30 ? 'red' : 'neutral' }} />
                        </td>
                      </tr>
                    ))}
                    {noPay.map((o) => (
                      <tr key={o.id} className="border-t border-gardens-bdr hover:bg-gardens-page cursor-pointer" onClick={() => navigate(`/dashboard/orders?order=${encodeURIComponent(o.id)}`)}>
                        <td className="py-2 font-head font-semibold text-gardens-tx">{o.customer}<div className="font-mono text-[11px] font-normal text-gardens-txm-aa">{o.ref}</div></td>
                        <td className="py-2 text-gardens-tx">No payment recorded</td>
                        <td className="py-2 text-right text-gardens-txs">Not invoiced</td>
                        <td className="py-2 text-gardens-txs">—</td>
                        <td className="py-2 text-right"><NextActionPill action={{ kind: 'deposit', label: 'Request deposit', reason: '', tone: 'neutral' }} /></td>
                      </tr>
                    ))}
                    <GroupRow icon={<Hourglass className="h-3 w-3" />} label="Due on completion · not yet due" count={onCompletion.length} />
                    {onCompletion.map((o) => {
                      const a = orderAction(o, now);
                      return (
                        <tr key={o.id} className="border-t border-gardens-bdr hover:bg-gardens-page cursor-pointer" onClick={() => navigate(`/dashboard/orders?order=${encodeURIComponent(o.id)}`)}>
                          <td className="py-2 font-head font-semibold text-gardens-tx">{o.customer}<div className="font-mono text-[11px] font-normal text-gardens-txm-aa">{o.ref}</div></td>
                          <td className="py-2 text-gardens-tx">Balance on completion{o.amountPaid ? <div className="text-[11px] text-gardens-txs">paid {formatGbpDecimal(o.amountPaid)}</div> : null}</td>
                          <td className="py-2 text-right tabular-nums">{o.balance != null ? formatGbpDecimal(o.balance) : <span className="text-gardens-txs">not shown</span>}</td>
                          <td className="py-2 text-gardens-txs">not yet due</td>
                          <td className="py-2 text-right">{a.kind !== 'none' ? <NextActionPill action={a} /> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            <Section title="Cash in per week" aside="collected">
              {payments.isLoading ? (
                <div className="text-[12px] text-gardens-txs">Loading…</div>
              ) : (
                <div className="flex items-end gap-2 h-32" data-testid="cash-by-week">
                  {weeks.map((w) => (
                    <div key={w.weekStart.toISOString()} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                      <span className="text-[10px] tabular-nums text-gardens-tx">{w.collected > 0 ? `£${Math.round(w.collected).toLocaleString('en-GB')}` : '£0'}</span>
                      <span className="w-full rounded-t bg-gardens-sem-green" style={{ height: `${Math.max(2, (w.collected / maxWeek) * 90)}%` }} />
                      <span className={cn('text-[10px]', w.current ? 'font-bold text-gardens-tx' : 'text-gardens-txm-aa')}>{shortDate(w.weekStart)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="m-0 text-[11px] text-gardens-txm-aa">Expected cash is not shown: install dates and balances are not reliable enough yet.</p>
            </Section>
            <Section title="Money in" aside={recent.data ? `${recent.data.length} latest` : undefined}>
              <PaymentsList rows={(recent.data ?? []).slice(0, 6)} loading={recent.isLoading} />
            </Section>
          </div>
        </div>
      )}
    </div>
  );
};

const GroupRow: React.FC<{ icon: React.ReactNode; label: string; count: number }> = ({ icon, label, count }) => (
  <tr className="border-t border-gardens-bdr bg-gardens-page">
    <td colSpan={5} className="py-1 px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-gardens-txs">
      <span className="inline-flex items-center gap-1.5">{icon}{label} <span className="font-semibold">{count}</span></span>
    </td>
  </tr>
);

type PaymentRow = { id: string; customerName: string | null; orderNumber: number | null; amount: number; source: string; receivedAt: string | null; paymentType: string | null };
const PaymentsList: React.FC<{ rows: PaymentRow[]; loading: boolean }> = ({ rows, loading }) =>
  loading ? (
    <div className="text-[12px] text-gardens-txs">Loading…</div>
  ) : rows.length === 0 ? (
    <div className="text-[12px] text-gardens-txs">No payments recorded yet.</div>
  ) : (
    <ul className="m-0 p-0 list-none divide-y divide-gardens-bdr">
      {rows.map((p) => (
        <li key={p.id} className="py-2 flex items-center justify-between gap-2">
          <span className="min-w-0">
            <span className={cn('block font-head font-semibold truncate', p.customerName ? 'text-gardens-tx' : 'text-gardens-sem-amber')}>
              {p.customerName ?? 'Name missing'}
            </span>
            <span className="block text-[11px] text-gardens-txm-aa">
              {p.orderNumber != null ? `ORD-${String(p.orderNumber).padStart(6, '0')}` : 'no order'} · {p.paymentType ?? 'payment'}
              {p.receivedAt ? ` · ${shortDate(p.receivedAt)}` : ''}
            </span>
          </span>
          <span className="text-right shrink-0">
            <span className="block font-semibold tabular-nums">{formatGbpDecimal(p.amount)}</span>
            <span className="inline-block mt-0.5 px-1.5 rounded border border-gardens-bdr text-[11px] text-gardens-txs capitalize">{p.source}</span>
          </span>
        </li>
      ))}
    </ul>
  );
