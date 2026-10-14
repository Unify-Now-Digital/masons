import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, Hourglass, Reply } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { NextActionPill } from '@/shared/components/mason';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { formatOrderNumber } from '@/modules/orders/utils/orderDisplayId';
import { useConfirmedOrdersStat, useFinanceRecentPayments } from '../hooks/useFinance';
import { FinanceInvoicesTab } from './FinancePage';
import { PaymentsLedgerTab } from '@/modules/ledger/components/PaymentsLedgerTab';
import {
  dayStartIso, fetchPaymentLedger, useLiveInvoiceCount, useNow, useOwedInvoices, usePaymentsSince, useSectionOrders,
} from '@/modules/sections/useSectionsData';
import {
  AGE_BUCKET_LABEL, agedOwed, cashByWeek, dueOnCompletion, financeNeedsYou, orderAction, shortDayMonth, toCsv, type AgeBucket,
} from '@/modules/sections/sectionsView';

type Tab = 'owed' | 'invoices' | 'payments';
const BUCKETS: AgeBucket[] = ['d90', 'd31to90', 'd8to30', 'd0to7', 'noDate'];
const BUCKET_BG: Record<AgeBucket, string> = {
  d90: 'bg-gardens-sem-red',
  d31to90: 'bg-gardens-act-balance',
  d8to30: 'bg-gardens-sem-amber',
  d0to7: 'bg-gardens-sem-amber-lt',
  noDate: 'bg-gardens-sem-grey',
};
const shortDate = shortDayMonth;
const TABS: Tab[] = ['owed', 'invoices', 'payments'];

/** One CSV download; the object URL is revoked after the click has been handled. */
function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
  const canSeeMoney = useCanSeeMoney();
  const [chosenTab, setTab] = useState<Tab>(deepLink ? 'invoices' : 'owed');
  // Money tabs only for roles that can view financials; others keep the invoices workspace.
  const tab: Tab = canSeeMoney ? chosenTab : 'invoices';
  const { organizationId } = useOrganization();
  const { invoices, isLoading: invLoading } = useOwedInvoices();
  const { orders } = useSectionOrders();
  const now = useNow();
  const payments = usePaymentsSince(8, now);
  const recent = useFinanceRecentPayments();
  const confirmed = useConfirmedOrdersStat();
  const liveInvoices = useLiveInvoiceCount();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const aged = useMemo(() => agedOwed(invoices, now), [invoices, now]);
  // Same definition as the Hub Finance tile.
  const fin = useMemo(() => financeNeedsYou(invoices, orders, now), [invoices, orders, now]);
  const queue = fin.queue;
  const notDue = queue.notDue;
  const noPay = fin.noPay;
  const onCompletion = useMemo(() => dueOnCompletion(orders), [orders]);
  const weeks = useMemo(() => cashByWeek(payments.data ?? [], 6, now), [payments.data, now]);
  const owedTotal = fin.owedTotal;
  const knownCompletion = onCompletion.reduce((s, o) => s + (o.balance ?? 0), 0);
  const unknownCompletion = onCompletion.filter((o) => o.balance == null).length;
  const estimatedCompletion = onCompletion.filter((o) => o.balanceEstimated).length;
  const needYou = fin.count;
  const maxWeek = Math.max(1, ...weeks.map((w) => Math.abs(w.collected)));
  const invoiceCount = liveInvoices.data ?? null;
  const confirmedCount = confirmed.data?.count ?? null;

  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState(() => isoDay(new Date(now.getFullYear(), now.getMonth() - 3, 1)));
  const [exportTo, setExportTo] = useState(() => isoDay(now));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /** One combined CSV: owed invoices now + every payment in the chosen date range. */
  const exportCsv = async () => {
    if (!organizationId || !exportFrom || !exportTo || exportFrom > exportTo) return;
    setExporting(true);
    setExportError(null);
    try {
      const [fy, fm, fd] = exportFrom.split('-').map(Number);
      const [ty, tm, td] = exportTo.split('-').map(Number);
      const since = new Date(fy!, fm! - 1, fd!).toISOString();
      const until = new Date(ty!, tm! - 1, td! + 1).toISOString();
      const ledger = await fetchPaymentLedger(organizationId, since, until);
      const csv = toCsv(
        ['section', 'date', 'customer', 'reference', 'amount_gbp', 'status_or_source', 'type', 'issue_date', 'due_date'],
        [
          ...invoices.map((i) => ['owed', isoDay(now), i.customer, i.invoiceNumber, (i.remainingPence / 100).toFixed(2), i.status, 'remaining', i.issueDate, i.dueDate ?? null]),
          ...ledger.map((p) => ['payment', p.at, p.customer, p.reference, p.amount.toFixed(2), p.source, p.type, null, null]),
        ],
      );
      download(`mason-finance-${exportFrom}_to_${exportTo}.csv`, csv);
      setExportOpen(false);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[n]!);
    tabRefs.current[n]?.focus();
  };

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="m-0 font-head text-xl sm:text-2xl font-semibold text-gardens-tx">Finance</h1>
          <span className="text-[13px] text-gardens-txs hidden sm:inline">Money owed to us, money in, and what to do next</span>
        </div>
        {canSeeMoney && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              aria-expanded={exportOpen}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gardens-bdr bg-white text-[13px] text-gardens-tx hover:bg-gardens-page"
              data-testid="finance-export"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-gardens-bdr bg-white p-3 shadow-md flex flex-col gap-2 text-[12px]" role="dialog" aria-label="Export finance CSV">
                <p className="m-0 text-gardens-txs">One CSV: money owed now, plus every payment received in the range.</p>
                <label className="flex items-center justify-between gap-2">From <input type="date" value={exportFrom} max={exportTo} onChange={(e) => setExportFrom(e.target.value)} className="h-7 rounded border border-gardens-bdr px-1" /></label>
                <label className="flex items-center justify-between gap-2">To <input type="date" value={exportTo} min={exportFrom} onChange={(e) => setExportTo(e.target.value)} className="h-7 rounded border border-gardens-bdr px-1" /></label>
                {exportError && <p className="m-0 text-gardens-sem-red">{exportError}</p>}
                <button type="button" disabled={exporting || !exportFrom || !exportTo || exportFrom > exportTo} onClick={() => void exportCsv()} className="h-8 rounded-lg bg-gardens-tx text-white font-semibold disabled:opacity-50" data-testid="finance-export-download">
                  {exporting ? 'Preparing…' : 'Download CSV'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {canSeeMoney && <div className="flex items-center gap-1" role="tablist" aria-label="Finance views">
        {([
          ['owed', `Owed to us ${needYou}`],
          ['invoices', invoiceCount != null ? `Invoices ${invoiceCount}` : 'Invoices'],
          ['payments', 'Payments'],
        ] as const).map(([v, label], i) => (
          <button
            key={v}
            ref={(el) => (tabRefs.current[i] = el)}
            type="button"
            role="tab"
            id={`finance-tab-${v}`}
            aria-controls={`finance-panel-${v}`}
            aria-selected={tab === v}
            tabIndex={tab === v ? 0 : -1}
            onKeyDown={(e) => onTabKey(e, i)}
            onClick={() => setTab(v)}
            className={cn(
              'h-7 rounded-full px-3 text-xs font-semibold border',
              tab === v ? 'bg-gardens-tx text-white border-gardens-tx' : 'bg-white text-gardens-tx border-gardens-bdr hover:bg-gardens-page',
            )}
          >
            {label}
          </button>
        ))}
      </div>}

      {tab === 'invoices' ? (
        <div role="tabpanel" id="finance-panel-invoices" aria-labelledby="finance-tab-invoices" className="flex flex-col flex-1 min-h-0">
          <FinanceInvoicesTab />
        </div>
      ) : tab === 'payments' ? (
        <div role="tabpanel" id="finance-panel-payments" aria-labelledby="finance-tab-payments">
          <PaymentsLedgerTab
            fallback={
              <Section title="Money in" aside="latest payments">
                <PaymentsList rows={recent.data ?? []} loading={recent.isLoading} />
              </Section>
            }
          />
        </div>
      ) : (
        <div role="tabpanel" id="finance-panel-owed" aria-labelledby="finance-tab-owed" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] flex-1 min-h-0 overflow-auto">
          <div className="flex flex-col gap-3 min-w-0">
            <Section title="Owed to us" aside="Oldest first">
              <div data-testid="finance-cue">
                <div className="font-head text-[20px] font-semibold text-gardens-tx">
                  {needYou} need{needYou === 1 ? 's' : ''} you now
                </div>
                <div className="text-[12px] text-gardens-txs">
                  <b className="text-gardens-sem-red">{formatGbpDecimal(owedTotal)} unpaid on {fin.owedCount} invoice{fin.owedCount === 1 ? '' : 's'}</b>
                  {notDue.length > 0 && ` · ${notDue.length} not due yet`}
                  {noPay.length > 0 && ` · ${noPay.length} order${noPay.length === 1 ? '' : 's'} with no payment`}
                </div>
              </div>
              {owedTotal > 0 && (
                <div className="flex h-3 rounded-full overflow-hidden bg-gardens-page" aria-label="Money owed by age">
                  {BUCKETS.map((b) => (aged[b] > 0 ? <span key={b} className={BUCKET_BG[b]} style={{ width: `${(aged[b] / owedTotal) * 100}%` }} /> : null))}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[12px]">
                {BUCKETS.map((b) => (
                  <div key={b}>
                    <b className={cn('tabular-nums', b === 'd90' || b === 'd31to90' ? 'text-gardens-sem-red' : b === 'noDate' ? 'text-gardens-tx' : 'text-gardens-sem-amber')}>{formatGbpDecimal(aged[b])}</b>
                    <div className="text-gardens-txm-aa">{AGE_BUCKET_LABEL[b]}</div>
                  </div>
                ))}
                <div>
                  <b className="tabular-nums text-gardens-tx">{formatGbpDecimal(knownCompletion)}</b>
                  <div className="text-gardens-txm-aa">on completion{estimatedCompletion > 0 ? ` · ${estimatedCompletion} estimated` : ''}{unknownCompletion > 0 ? ` · +${unknownCompletion} unknown` : ''}</div>
                </div>
              </div>
              {confirmedCount != null && invoiceCount != null && confirmedCount > invoiceCount && (
                <div className="flex items-start gap-2 rounded-lg border border-gardens-bdr bg-gardens-sem-amber-lt px-3 py-2 text-[12px] text-gardens-tx" data-testid="reconcile-flag">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gardens-sem-amber" />
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
                    {queue.map((r) => {
                      const late = (r.overdueDays ?? r.days ?? 0) > 30;
                      return (
                        <tr key={r.id} className="border-t border-gardens-bdr hover:bg-gardens-page cursor-pointer" onClick={() => navigate(invoiceHref(r.id))}>
                          <td className="py-2 font-head font-semibold text-gardens-tx">
                            <Link to={invoiceHref(r.id)} onClick={(e) => e.stopPropagation()} className="hover:underline focus-visible:underline">{r.customer}</Link>
                            <div className="font-mono text-[11px] font-normal text-gardens-txm-aa">{r.invoiceNumber}</div>
                          </td>
                          <td className="py-2 text-gardens-tx">Invoice unpaid</td>
                          <td className="py-2 text-right tabular-nums font-semibold">{formatGbpDecimal(r.remainingPence / 100)}</td>
                          <td className={cn('py-2', late ? 'text-gardens-sem-red font-semibold' : 'text-gardens-txs')}>
                            {r.overdueDays != null ? `${r.overdueDays} days overdue` : r.days == null ? 'no issue date' : `${r.days} days · no due date`}
                          </td>
                          <td className="py-2 text-right">
                            <NextActionPill action={{ kind: 'deposit', label: 'Chase payment', reason: '', tone: late ? 'red' : 'neutral' }} />
                          </td>
                        </tr>
                      );
                    })}
                    {noPay.map((o) => (
                      <tr key={o.id} className="border-t border-gardens-bdr hover:bg-gardens-page cursor-pointer" onClick={() => navigate(orderHref(o.id))}>
                        <td className="py-2 font-head font-semibold text-gardens-tx"><Link to={orderHref(o.id)} onClick={(e) => e.stopPropagation()} className="hover:underline focus-visible:underline">{o.customer}</Link><div className="font-mono text-[11px] font-normal text-gardens-txm-aa">{o.ref}</div></td>
                        <td className="py-2 text-gardens-tx">No payment recorded</td>
                        <td className="py-2 text-right text-gardens-txs">Not invoiced</td>
                        <td className="py-2 text-gardens-txs">—</td>
                        <td className="py-2 text-right"><NextActionPill action={{ kind: 'deposit', label: 'Request deposit', reason: '', tone: 'neutral' }} /></td>
                      </tr>
                    ))}
                    {notDue.length > 0 && <GroupRow icon={<Hourglass className="h-3 w-3" />} label="Invoiced · not due yet" count={notDue.length} />}
                    {notDue.map((r) => (
                      <tr key={r.id} className="border-t border-gardens-bdr hover:bg-gardens-page cursor-pointer" onClick={() => navigate(invoiceHref(r.id))}>
                        <td className="py-2 font-head font-semibold text-gardens-tx"><Link to={invoiceHref(r.id)} onClick={(e) => e.stopPropagation()} className="hover:underline focus-visible:underline">{r.customer}</Link><div className="font-mono text-[11px] font-normal text-gardens-txm-aa">{r.invoiceNumber}</div></td>
                        <td className="py-2 text-gardens-tx">Invoice sent</td>
                        <td className="py-2 text-right tabular-nums">{formatGbpDecimal(r.remainingPence / 100)}</td>
                        <td className="py-2 text-gardens-txs">due {shortDate(r.due!)}</td>
                        <td className="py-2 text-right text-gardens-txs">not due</td>
                      </tr>
                    ))}
                    <GroupRow icon={<Hourglass className="h-3 w-3" />} label="Due on completion · not yet due" count={onCompletion.length} />
                    {onCompletion.map((o) => {
                      const a = orderAction(o, now);
                      return (
                        <tr key={o.id} className="border-t border-gardens-bdr hover:bg-gardens-page cursor-pointer" onClick={() => navigate(orderHref(o.id))}>
                          <td className="py-2 font-head font-semibold text-gardens-tx"><Link to={orderHref(o.id)} onClick={(e) => e.stopPropagation()} className="hover:underline focus-visible:underline">{o.customer}</Link><div className="font-mono text-[11px] font-normal text-gardens-txm-aa">{o.ref}</div></td>
                          <td className="py-2 text-gardens-tx">Balance on completion{o.amountPaidPence ? <div className="text-[11px] text-gardens-txs">paid {formatGbpDecimal(o.amountPaidPence / 100)}</div> : null}</td>
                          <td className="py-2 text-right tabular-nums">
                            {o.balance != null ? formatGbpDecimal(o.balance) : <span className="text-gardens-txs">not shown</span>}
                            {o.balanceEstimated && <div className="text-[11px] text-gardens-txs">estimate · no invoice</div>}
                          </td>
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
                      <span className="text-[10px] tabular-nums text-gardens-tx">{w.collected !== 0 ? formatGbpDecimal(w.collected) : '—'}</span>
                      {w.collected !== 0 ? (
                        <span className={cn('w-full rounded-t', w.collected > 0 ? 'bg-gardens-sem-green' : 'bg-gardens-sem-red')} style={{ height: `${Math.max(2, (Math.abs(w.collected) / maxWeek) * 90)}%` }} title={w.collected < 0 ? 'Net refunds' : undefined} />
                      ) : (
                        <span className="w-full h-px bg-gardens-bdr" aria-hidden />
                      )}
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

const invoiceHref = (id: string) => `/dashboard/finance?invoice=${encodeURIComponent(id)}`;
const orderHref = (id: string) => `/dashboard/orders?order=${encodeURIComponent(id)}`;

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
              {p.orderNumber != null ? formatOrderNumber(p.orderNumber) : 'no order'} · {p.paymentType ?? 'payment'}
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
