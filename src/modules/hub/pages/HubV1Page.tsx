import React, { useMemo } from 'react';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Columns3, FileText, Inbox, MapPin, Truck, Wallet, AlertTriangle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { NextActionPill } from '@/shared/components/mason';
import { needsUs } from '@/shared/lib/nextAction';
import { useInboxUnreadCount } from '@/components/layout/useInboxUnreadCount';
import { useJobsPipeline } from '@/modules/jobsPipeline/hooks/useJobsPipeline';
import { getJobDisplayName } from '@/modules/jobsPipeline/utils/display';
import { isGoneQuiet, jobNextStep } from '@/modules/jobsPipeline/utils/pipelineView';
import { useFinanceTotals } from '@/modules/finance/hooks/useFinance';
import { useHubPipeline } from '../hooks/useHub';
import { useNow, useOwedInvoices, usePaymentsSince, useSectionOrders } from '@/modules/sections/useSectionsData';
import {
  countThisVsLast, financeNeedsYou, localDay, dueOnCompletion, installTray, orderAction, sumThisVsLast, topTodos, weekBoard, weekStart, type TodoItem,
} from '@/modules/sections/sectionsView';

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <section className={cn('rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3', className)}>{children}</section>
);

/** hub-v1 "Today": tasks first, then section tiles, money, bottlenecks, installs, this week vs last. Same counts as the sections. */
export const HubPage: React.FC = () => {
  const navigate = useNavigate();
  const now = useNow();
  const canSeeMoney = useCanSeeMoney();
  const unread = useInboxUnreadCount();
  const { orders } = useSectionOrders();
  const { invoices } = useOwedInvoices();
  const pipeline = useJobsPipeline();
  const stages = useHubPipeline();
  const totals = useFinanceTotals();
  // Same 8-week window as Finance → one shared cache entry.
  const payments = usePaymentsSince(8, now);

  const openOrders = useMemo(() => orders.filter((o) => !o.jobExitReason && o.jobStage !== 'complete'), [orders]);
  const orderActions = useMemo(() => openOrders.map((o) => ({ o, a: orderAction(o, now) })), [openOrders, now]);
  const ordersNeedUs = orderActions.filter((x) => needsUs(x.a));
  const ordersWaiting = orderActions.filter((x) => x.a.kind === 'waiting');
  const jobs = useMemo(() => [...pipeline.columns.enquired, ...pipeline.columns.quoted, ...pipeline.columns.invoiced], [pipeline.columns]);
  const quietJobs = jobs.filter((j) => isGoneQuiet(j, now));
  // Same definition as Finance's "Owed to us" tab count.
  const fin = useMemo(() => financeNeedsYou(invoices, orders, now), [invoices, orders, now]);
  const queue = fin.queue;
  const owed = fin.owedTotal;
  const tray = useMemo(() => installTray(orders), [orders]);
  const completion = useMemo(() => dueOnCompletion(orders), [orders]);
  const completionKnown = completion.reduce((s, o) => s + (o.balance ?? 0), 0);
  const completionEstimated = completion.some((o) => o.balanceEstimated);
  const board = useMemo(() => weekBoard(orders, weekStart(now)), [orders, now]);

  const todos: TodoItem[] = [
    ...ordersNeedUs.map(({ o, a }) => ({
      key: `o-${o.id}`, section: 'Orders' as const, name: o.customer, why: a.reason, action: a,
      to: `/dashboard/orders?order=${encodeURIComponent(o.id)}`, rank: a.tone === 'red' ? 300 : 200,
    })),
    ...(canSeeMoney ? queue : []).slice(0, 5).map((i) => ({
      key: `f-${i.id}`, section: 'Finance' as const, name: i.customer, why: `${formatGbpDecimal(i.remainingPence / 100)} unpaid · ${i.overdueDays != null ? `${i.overdueDays} days overdue` : i.days != null ? `${i.days} days old` : 'no issue date'}`,
      action: { kind: 'deposit' as const, label: 'Chase payment', reason: '', tone: 'red' as const },
      to: `/dashboard/finance?invoice=${encodeURIComponent(i.id)}`, rank: 250 + Math.min(49, (i.overdueDays ?? i.days ?? 0) / 10),
    })),
    ...quietJobs.slice(0, 5).map((j) => ({
      key: `p-${j.id}`, section: 'Pipeline' as const, name: getJobDisplayName(j), why: 'Gone quiet', action: jobNextStep(j, pipeline.invoiceSummaries.get(j.id), now),
      to: '/dashboard/inquiries', rank: 150,
    })),
    ...tray.ready.map((o) => ({
      key: `m-${o.id}`, section: 'Map' as const, name: o.customer, why: 'Ready to book', action: { kind: 'balance' as const, label: 'Book install', reason: '', tone: 'neutral' as const },
      to: '/dashboard/planner', rank: 100,
    })),
  ];
  const first = topTodos(todos, 3);

  const enquiries = countThisVsLast(jobs.map((j) => j.created_at), now);
  const deposits = sumThisVsLast(payments.data ?? [], now);
  const installsDone = countThisVsLast(
    orders.map((o) => {
      if (!o.installationDate) return null;
      const d = localDay(o.installationDate);
      return d <= now ? d.toISOString() : null;
    }),
    now,
  );
  const stageTotal = (stages.data ?? []).reduce((s, x) => s + x.count, 0);

  const tiles = [
    { label: 'Inbox', icon: Inbox, to: '/dashboard/inbox', count: unread, unit: 'unread', sub: null },
    { label: 'Orders', icon: FileText, to: '/dashboard/orders', count: ordersNeedUs.length, unit: 'need us', sub: `${ordersWaiting.length} waiting on others` },
    { label: 'Pipeline', icon: Columns3, to: '/dashboard/inquiries', count: quietJobs.length, unit: 'gone quiet', sub: `${jobs.length} open jobs` },
    ...(canSeeMoney
      ? [{ label: 'Finance', icon: Wallet, to: '/dashboard/finance', count: fin.count, unit: 'need you', sub: `${formatGbpDecimal(owed)} unpaid` }]
      : []),
    { label: 'Map', icon: MapPin, to: '/dashboard/planner', count: tray.ready.length, unit: 'ready to book', sub: `${tray.blocked.length} more blocked on deposit` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h1 className="m-0 font-head text-xl sm:text-2xl font-semibold text-gardens-tx">Today</h1>
        <span className="text-[13px] text-gardens-txs">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <Card>
          <div className="flex items-baseline justify-between" data-testid="hub-cue">
            <div className="font-head text-[20px] font-semibold text-gardens-tx">{first.length} to do first</div>
            <span className="text-[11px] text-gardens-txm-aa">The rest is in the tiles below</span>
          </div>
          {first.length === 0 ? (
            <p className="text-[13px] text-gardens-txs">Nothing urgent across Orders, Pipeline, Finance and Map.</p>
          ) : (
            <ol className="m-0 mt-2 p-0 list-none divide-y divide-gardens-bdr">
              {first.map((t, i) => (
                <li key={t.key}>
                  <button type="button" onClick={() => navigate(t.to)} className={cn('w-full text-left py-2.5 px-2 flex items-center gap-3 hover:bg-gardens-page', i === 0 && 'bg-gardens-acc-lt border-l-[3px] border-gardens-acc')}>
                    <span className="font-head text-[18px] text-gardens-txs w-4">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-head text-[15px] font-semibold text-gardens-tx truncate">{t.name}</span>
                        <span className="text-[11px] px-1.5 rounded border border-gardens-bdr text-gardens-txs">{t.section}</span>
                      </span>
                      <span className="block text-[13px] text-gardens-txs truncate">{t.why}</span>
                    </span>
                    <NextActionPill action={t.action} solid={i === 0} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {canSeeMoney && <Card>
          <div className="flex items-baseline justify-between">
            <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">Money</h3>
            <button type="button" onClick={() => navigate('/dashboard/finance')} className="text-[12px] underline text-gardens-tx">Open Finance</button>
          </div>
          <dl className="m-0 mt-2 flex flex-col gap-2 text-[13px]">
            <div className="flex items-baseline justify-between"><dt className="text-gardens-txs">Money in · this month</dt><dd className="m-0 font-head text-[18px] font-semibold text-gardens-sem-green">{totals.data ? formatGbpDecimal(totals.data.collectedThisMonth) : '—'}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-gardens-txs">Owed now · {fin.owedCount} invoice{fin.owedCount === 1 ? '' : 's'}</dt><dd className="m-0 font-head text-[18px] font-semibold text-gardens-sem-red">{formatGbpDecimal(owed)}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-gardens-txs">Due on completion · {completion.length} orders</dt><dd className="m-0 font-head text-[18px] font-semibold text-gardens-tx">{formatGbpDecimal(completionKnown)}{completionEstimated ? <span className="text-[11px] font-normal text-gardens-txs"> incl. estimates</span> : null}</dd></div>
          </dl>
        </Card>}
      </div>

      <div className={cn('grid gap-3 grid-cols-2', canSeeMoney ? 'md:grid-cols-5' : 'md:grid-cols-4')}>
        {tiles.map((t) => (
          <button key={t.label} type="button" onClick={() => navigate(t.to)} className="text-left rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3 hover:bg-gardens-page">
            <span className="flex items-center justify-between text-[12px] font-semibold text-gardens-tx"><span className="inline-flex items-center gap-1.5"><t.icon className="h-3.5 w-3.5" />{t.label}</span><ArrowRight className="h-3.5 w-3.5 text-gardens-txs" /></span>
            <span className="block mt-1"><b className="font-head text-[24px] text-gardens-tx">{t.count}</b> <span className="text-[13px] text-gardens-txs">{t.unit}</span></span>
            {t.sub && <span className="block text-[12px] text-gardens-txs truncate">{t.sub}</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <Card>
          <div className="flex items-baseline justify-between">
            <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Bottlenecks</h3>
            <span className="text-[12px] text-gardens-txs">{stageTotal} open orders by stage</span>
          </div>
          {stageTotal > 0 && (
            <div className="mt-2 flex h-5 rounded overflow-hidden" aria-label="Orders by stage">
              {(stages.data ?? []).map((s, i) =>
                s.count > 0 ? (
                  <span key={s.stage} className={cn('text-[10px] text-white px-1 truncate', ['bg-gardens-acc', 'bg-gardens-act-proof', 'bg-gardens-act-order', 'bg-gardens-act-permit', 'bg-gardens-sem-green'][i % 5])} style={{ width: `${(s.count / stageTotal) * 100}%` }}>
                    {s.label} {s.count}
                  </span>
                ) : null,
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 text-[12px] text-gardens-txs">
            {(stages.data ?? []).map((s) => <span key={s.stage}><b className="text-gardens-tx">{s.count}</b> {s.label}</span>)}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Card>
            <div className="flex items-baseline justify-between">
              <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa inline-flex items-center gap-1.5"><Truck className="h-3 w-3" /> Installs this week</h3>
              <button type="button" onClick={() => navigate('/dashboard/planner')} className="text-[12px] underline text-gardens-tx">Open Map</button>
            </div>
            <ul className="m-0 mt-2 p-0 list-none flex flex-col gap-1 text-[13px]">
              {board.map(({ day, bookings }) => (
                <li key={day.toISOString()} className="flex gap-3">
                  <span className="w-16 text-gardens-txs">{day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</span>
                  <span className="text-gardens-tx truncate">{bookings.length ? bookings.map((b) => b.customer).join(', ') : <span className="text-gardens-txm-aa">No installs</span>}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="flex items-baseline justify-between">
              <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa inline-flex items-center gap-1.5"><BarChart3 className="h-3 w-3" /> This week vs last</h3>
              <span className="text-[11px] text-gardens-txm-aa">replaces Reporting</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2" data-testid="hub-week-strip">
              <Stat label="Enquiries" v={enquiries.thisWeek} last={enquiries.lastWeek} note="open jobs only" />
              <Stat label="Quotes sent" v={null} last={null} note="not tracked yet" />
              {canSeeMoney && <Stat label="Deposits taken" v={deposits.thisWeek} last={deposits.lastWeek} money />}
              <Stat label="Installs done" v={installsDone.thisWeek} last={installsDone.lastWeek} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; v: number | null; last: number | null; money?: boolean; note?: string }> = ({ label, v, last, money, note }) => {
  const fmt = (n: number) => (money ? formatGbpDecimal(n) : String(n));
  const diff = v != null && last != null ? v - last : null;
  return (
    <div className="rounded-lg border border-gardens-bdr bg-white p-2">
      <div className="text-[11px] text-gardens-txs">{label}</div>
      <div className="font-head text-[18px] font-semibold text-gardens-tx">{v == null ? '—' : fmt(v)}</div>
      <div className={cn('text-[11px]', diff == null ? 'text-gardens-txm-aa' : diff > 0 ? 'text-gardens-sem-green' : diff < 0 ? 'text-gardens-sem-red' : 'text-gardens-txm-aa')}>
        {diff == null ? note : `${diff > 0 ? '▲' : diff < 0 ? '▼' : '='} ${fmt(Math.abs(diff))} vs last week`}
        {diff != null && note ? ` · ${note}` : ''}
      </div>
    </div>
  );
};
