import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
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
import { countThisVsLast, dueOnCompletion, financeNeedsYou, installTray, orderAction, sumThisVsLast, weekStart } from '@/modules/sections/sectionsView';
import { buildPlan, GROUP_LABEL, TEAM_CAPS, type PlanGroup, type PlanInput, type Team } from '../utils/hubPlan';

const DAY = 86_400_000;
const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <section className={cn('rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3', className)}>{children}</section>
);
const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">{children}</h3>
);
/** Unconfigured features stay out of the way: one small "coming soon" toggle per card. */
const ComingSoon: React.FC<{ items: string[] }> = ({ items }) => (
  <details className="mt-2 text-[11px] text-gardens-txm-aa">
    <summary className="cursor-pointer select-none inline-flex rounded border border-dashed border-gardens-bdr2 px-1.5 font-semibold">Coming soon</summary>
    <ul className="m-0 mt-1 pl-4 list-disc">{items.map((i) => <li key={i}>{i}</li>)}</ul>
  </details>
);
const ageDays = (iso: string | null | undefined, now: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, now - t) : 0;
};

/** hub-v3 "Today" (mockups/hub-v3.html): Today's plan, Money, Pipeline flow, Inbox, Installs, Activity. */
export const HubPage: React.FC = () => {
  const navigate = useNavigate();
  const nowDate = useNow();
  const now = nowDate.getTime();
  const canSeeMoney = useCanSeeMoney();
  const unread = useInboxUnreadCount();
  const { orders } = useSectionOrders();
  const { invoices } = useOwedInvoices();
  const pipeline = useJobsPipeline();
  const stages = useHubPipeline();
  const totals = useFinanceTotals();
  const payments = usePaymentsSince(8, nowDate);
  const [team, setTeam] = useState<Team | 'All'>('All');

  const openOrders = useMemo(() => orders.filter((o) => !o.jobExitReason && o.jobStage !== 'complete'), [orders]);
  const jobs = useMemo(() => [...pipeline.columns.enquired, ...pipeline.columns.quoted, ...pipeline.columns.invoiced], [pipeline.columns]);
  const fin = useMemo(() => financeNeedsYou(invoices, orders, nowDate), [invoices, orders, nowDate]);
  const completion = useMemo(() => dueOnCompletion(orders), [orders]);
  const tray = useMemo(() => installTray(orders), [orders]);

  const plan = useMemo(() => {
    const items: PlanInput[] = [];
    for (const o of openOrders) {
      const a = orderAction(o, nowDate);
      if (!needsUs(a)) continue;
      const t: Team = a.kind === 'deposit' || a.kind === 'balance' ? 'Finance' : 'CS';
      items.push({
        key: `o-${o.id}`, team: t, name: o.customer, context: `${o.ref} · ${t}`, explanation: a.reason, action: a,
        to: `/dashboard/orders?order=${encodeURIComponent(o.id)}`, deadlineAt: o.installationDate,
        waitingMs: ageDays(o.depositDate ?? o.jobPaidAt, now), ball: 'us',
      });
    }
    for (const j of jobs) {
      const a = jobNextStep(j, pipeline.invoiceSummaries.get(j.id), nowDate);
      if (!needsUs(a) && !isGoneQuiet(j, nowDate)) continue;
      items.push({
        key: `p-${j.id}`, team: 'Sales', name: getJobDisplayName(j), context: `Sales · ${j.stage}`, explanation: a.reason || 'Gone quiet',
        action: a, to: '/dashboard/inquiries', waitingMs: ageDays(j.created_at, now), ball: needsUs(a) ? 'us' : 'customer',
      });
    }
    if (canSeeMoney)
      for (const i of fin.queue)
        items.push({
          key: `f-${i.id}`, team: 'Finance', name: i.customer, context: `Finance · ${i.invoiceNumber}`,
          explanation: `${formatGbpDecimal(i.remainingPence / 100)} unpaid.`,
          action: { kind: 'deposit', label: 'Chase payment', reason: '', tone: 'amber' },
          to: `/dashboard/finance?invoice=${encodeURIComponent(i.id)}`, waitingMs: ageDays(i.issueDate, now), ball: 'customer',
        });
    return buildPlan(items, now);
  }, [openOrders, jobs, pipeline.invoiceSummaries, fin.queue, canSeeMoney, nowDate, now]);

  const shown = plan.today.filter((i) => team === 'All' || i.team === team);
  const groups = (['deadline', 'promise', 'waiting', 'ready', 'hold'] as PlanGroup[])
    .map((g) => ({ g, rows: shown.filter((i) => i.group === g) }))
    .filter((x) => x.rows.length);
  const oldestTomorrow = plan.tomorrow.reduce((m, i) => Math.max(m, i.waitingMs), 0);

  const yStart = new Date(nowDate); yStart.setHours(0, 0, 0, 0); yStart.setDate(yStart.getDate() - 1);
  const paidSinceY = (payments.data ?? []).filter((p) => p.at && Date.parse(p.at) >= yStart.getTime());
  const depositsToInvoice = openOrders.filter((o) => orderAction(o, nowDate).kind === 'deposit' && !o.hasInvoice);
  const enquiries = countThisVsLast(jobs.map((j) => j.created_at), nowDate);
  const deposits = sumThisVsLast(payments.data ?? [], nowDate);
  const wk = weekStart(nowDate).getTime();
  const bookedThisWeek = orders.filter((o) => o.installationDate && Date.parse(o.installationDate) >= wk && Date.parse(o.installationDate) < wk + 7 * DAY).length;

  return (
    <div className="flex flex-col gap-3" data-testid="hub-v3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="m-0 font-head text-xl sm:text-2xl font-semibold text-gardens-tx">Today</h1>
        <span className="text-[13px] text-gardens-txs">{nowDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <span className="text-[12px] text-gardens-txs">
          {plan.hardDeadlines > 0 && <b className="text-gardens-sem-red">{plan.hardDeadlines} hard deadline · </b>}
          {plan.today.length} planned today · {plan.tomorrow.length} roll to tomorrow
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <Card>
          <div className="flex items-baseline justify-between">
            <div className="font-head text-[18px] font-semibold text-gardens-tx">Today's plan</div>
            <span className="text-[11px] text-gardens-txm-aa">Capped per team · overflow rolls to tomorrow with its age</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Team">
            {(['All', ...Object.keys(TEAM_CAPS)] as (Team | 'All')[]).map((t) => {
              const n = t === 'All' ? plan.today.length : plan.byTeam[t].planned;
              return (
                <button key={t} type="button" role="radio" aria-checked={team === t} onClick={() => setTeam(t)}
                  className={cn('rounded-full border px-2.5 py-0.5 text-[12px]', team === t ? 'border-gardens-acc bg-gardens-acc-lt font-semibold text-gardens-acc-dk' : 'border-gardens-bdr text-gardens-txs')}>
                  {t} <b className="tabular-nums">{n}</b>{t !== 'All' && <span className="text-gardens-txm-aa">/{plan.byTeam[t].total}</span>}
                </button>
              );
            })}
          </div>
          {groups.length === 0 ? (
            <p className="mt-3 text-[13px] text-gardens-txs">Nothing planned for this team today.</p>
          ) : (
            groups.map(({ g, rows }) => (
              <div key={g} className="mt-3">
                <div className={cn('text-[11px] font-bold uppercase tracking-wide', g === 'deadline' ? 'text-gardens-sem-red' : 'text-gardens-txs')}>
                  {GROUP_LABEL[g]} · {rows.length}
                </div>
                <ol className="m-0 mt-1 p-0 list-none divide-y divide-gardens-bdr">
                  {rows.slice(0, 8).map((t) => (
                    <li key={t.key}>
                      <button type="button" onClick={() => navigate(t.to)} className="w-full text-left py-2 px-2 flex items-center gap-3 hover:bg-gardens-page">
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="font-head text-[14px] font-semibold text-gardens-tx truncate">{t.name}</span>
                            <span className="text-[11px] text-gardens-txs truncate">{t.context}</span>
                          </span>
                          <span className="block text-[12px] text-gardens-txs truncate">{t.explanation}</span>
                          <span className="block text-[11px] text-gardens-txm-aa">
                            <span className={cn('rounded px-1 font-semibold', t.ball === 'us' ? 'bg-gardens-sem-amber-lt text-amber-800' : 'bg-gardens-sem-grey-lt')}>Ball: {t.ball}</span>
                            {' '}· waiting {Math.floor(t.waitingMs / DAY)}d
                          </span>
                        </span>
                        <NextActionPill action={t.action} />
                      </button>
                    </li>
                  ))}
                </ol>
                {rows.length > 8 && <div className="text-[11px] text-gardens-txm-aa px-2">+{rows.length - 8} more</div>}
              </div>
            ))
          )}
          {plan.tomorrow.length > 0 && (
            <p className="mt-2 text-[12px] text-gardens-txs border-t border-gardens-bdr pt-2">
              {plan.tomorrow.length} roll to tomorrow (oldest {Math.floor(oldestTomorrow / DAY)}d) · joins chase list{' '}
              {new Date(now + DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-3">
          {canSeeMoney && (
            <Card>
              <div className="flex items-baseline justify-between">
                <H3>Money</H3>
                <button type="button" onClick={() => navigate('/dashboard/finance')} className="text-[12px] underline text-gardens-tx">Open Finance</button>
              </div>
              <dl className="m-0 mt-2 flex flex-col gap-2 text-[13px]">
                <Row label={`Payments in since yesterday · ${paidSinceY.length} matched`} value={formatGbpDecimal(paidSinceY.reduce((s, p) => s + p.amount, 0))} />
                <Row label={`Deposits to invoice today · ${Math.min(2, depositsToInvoice.length)} of ${depositsToInvoice.length}`} sub="50% memorial · cap 2/day" value={String(Math.min(2, depositsToInvoice.length))} />
                <Row label={`Invoices open · ${fin.owedCount}`} value={formatGbpDecimal(fin.owedTotal)} />
                <Row label={`Balances due on fixing · ${completion.length} orders`} value={formatGbpDecimal(completion.reduce((s, o) => s + (o.balance ?? 0), 0))} />
                <Row label="Money in · this month" value={totals.data ? formatGbpDecimal(totals.data.collectedThisMonth) : '—'} />
              </dl>
              <ComingSoon items={['Unmatched payments', 'Void in Stripe · one-click Fix', 'Mason vs Stripe value mismatch', 'Money in by source (Stripe / Revolut)']} />
            </Card>
          )}
          <Card>
            <div className="flex items-baseline justify-between">
              <H3>Inbox</H3>
              <button type="button" onClick={() => navigate('/dashboard/inbox')} className="text-[12px] underline text-gardens-tx">Open</button>
            </div>
            <div className="mt-1 text-[13px] text-gardens-txs"><b className="font-head text-[20px] text-gardens-tx">{unread}</b> unread</div>
            <ComingSoon items={['Customer chases waiting on us']} />
          </Card>
          <Card>
            <div className="flex items-baseline justify-between">
              <H3>Installs</H3>
              <button type="button" onClick={() => navigate('/dashboard/logistics?tab=map')} className="text-[12px] underline text-gardens-tx">Open Map</button>
            </div>
            <div className="mt-1 text-[13px] text-gardens-txs"><b className="font-head text-[20px] text-gardens-tx">{bookedThisWeek}</b> booked this week · {tray.ready.length} ready to book</div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <H3>Pipeline flow</H3>
          <span className="text-[11px] text-gardens-txm-aa">Click a stage to open its list</span>
        </div>
        <FlowRow title={`Sales · ${jobs.length} open jobs`} cells={[
          { n: pipeline.columns.enquired.length, l: 'New enquiry', to: '/dashboard/inquiries' },
          { n: pipeline.columns.quoted.length, l: 'Quoted', to: '/dashboard/inquiries' },
          { n: pipeline.columns.invoiced.length, l: 'Invoice sent', to: '/dashboard/inquiries' },
        ]} onGo={navigate} />
        {/* Permit/proof tracking removed (Oct 2026): hide the Proof and Permit production pills. */}
        <FlowRow title="Production" cells={(stages.data ?? []).filter((s) => s.stage !== 'proof' && s.stage !== 'permit').map((s) => ({ n: s.count, l: s.label, to: '/dashboard/orders' }))} onGo={navigate} />
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <H3>This week so far</H3>
          <div className="mt-1 text-[13px] text-gardens-txs">
            New enquiries <b className="text-gardens-tx">{enquiries.thisWeek}</b> vs {enquiries.lastWeek}
            {canSeeMoney && <> · Deposits <b className="text-gardens-tx">{formatGbpDecimal(deposits.thisWeek)}</b> vs {formatGbpDecimal(deposits.lastWeek)}</>}
          </div>
        </Card>
        <Card>
          <H3>Activity today</H3>
          <ComingSoon items={['Dials out (target 20)', 'Emails · SMS · WhatsApp out', 'Touches (target 60)', 'Inbound, YOPA calls counted separately', 'First reply, median', 'Day score · done / planned']} />
        </Card>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="flex items-baseline justify-between gap-2">
    <dt className="text-gardens-txs min-w-0">{label}{sub && <span className="block text-[11px] text-gardens-txm-aa">{sub}</span>}</dt>
    <dd className="m-0 font-head text-[16px] font-semibold text-gardens-tx whitespace-nowrap">{value}</dd>
  </div>
);

const FlowRow: React.FC<{ title: string; cells: { n: number | null; l: string; sub?: string; to: string }[]; onGo: (to: string) => void }> = ({ title, cells, onGo }) => (
  <div className="mt-2">
    <div className="text-[12px] font-semibold text-gardens-tx">{title}</div>
    <div className="mt-1 flex gap-1.5 overflow-x-auto">
      {cells.map((c) => (
        <button key={c.l} type="button" onClick={() => onGo(c.to)} className="min-w-[96px] text-left rounded-lg border border-gardens-bdr bg-white px-2 py-1 hover:bg-gardens-page">
          <div className="font-head text-[18px] font-semibold text-gardens-tx">{c.n ?? '—'}</div>
          <div className="text-[11px] text-gardens-txs">{c.l}</div>
          {c.sub && <div className="text-[10.5px] text-gardens-txm-aa">{c.sub}</div>}
        </button>
      ))}
    </div>
  </div>
);
