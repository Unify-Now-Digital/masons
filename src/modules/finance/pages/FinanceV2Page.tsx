import { FinanceFlow } from '../flow/FinanceFlow';
import { useOpenOrder } from '@/shared/context/orderPanel';
import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useNow } from '@/modules/sections/useSectionsData';
import { useBrandData } from '@/modules/today/useBrandData';
import { Card, ErrorNote, H3, VerbPill } from '@/modules/today/ui';
import { gbp2, shortDate } from '@/modules/today/uiHelpers';
import { FinanceInvoicesTab } from './FinancePage';
import {
  financeKpiCards, financeKpis, paymentEvents, receivables, reconciliationFlags, type Receivable, type Source,
} from '../receivables';
import { RecordPaymentDialog } from '../components/RecordPaymentDialog';
import { RevolutReconcileList } from '../components/RevolutReconcileList';
import { isOpenRevolutItem } from '../acceptRevolut';
import { csvSafe } from '@/modules/sections/sectionsView';

type Tab = 'receivables' | 'ledger' | 'reconcile' | 'invoices';
const TAB_LABEL: Record<Tab, string> = { receivables: 'Owed to us', ledger: 'Payments', reconcile: 'Reconcile', invoices: 'Invoices' };
const SRC_LABEL: Record<Source, string> = { revolut: 'Revolut', stripe: 'Stripe', bank: 'Bank', other: 'Other' };

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${csvSafe(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const Kpi: React.FC<{ label: string; value: string; tone?: 'red' | 'amber'; testId?: string }> = ({ label, value, tone, testId }) => (
  <div className="w-[10.75rem] shrink-0 rounded-[10px] border border-gardens-bdr bg-gardens-surf px-2.5 py-2 min-[880px]:w-auto min-[880px]:min-w-0" data-testid={testId}>
    <div className="text-[11px] font-bold uppercase tracking-wide text-gardens-txm-aa">{label}</div>
    <div className={cn('font-head text-[22px] font-semibold tabular-nums leading-tight', tone === 'red' ? 'text-gardens-na-red' : tone === 'amber' ? 'text-gardens-na-amber' : 'text-gardens-tx')}>{value}</div>
  </div>
);

/** Finance v2: per-brand KPIs, one receivables list (one action per row), ledger, reconciliation. */
export const FinancePage: React.FC = () => {
  const navigate = useNavigate();
  const openOrder = useOpenOrder();
  const [params] = useSearchParams();
  const canSeeMoney = useCanSeeMoney();
  const { role, organizationName } = useOrganization();
  const deepInvoice = params.has('invoice') || params.has('focus');
  const [chosen, setTab] = useState<Tab>(deepInvoice ? 'invoices' : params.get('tab') === 'reconcile' ? 'reconcile' : 'receivables');
  const tab: Tab = canSeeMoney ? chosen : 'invoices';
  const nowDate = useNow();
  const now = nowDate.getTime();
  const q = useBrandData(canSeeMoney);
  const d = q.data?.data;
  const kpi = useMemo(() => (d ? financeKpis(d, now) : null), [d, now]);
  const rec = useMemo(() => (d ? receivables(d, now) : []), [d, now]);
  const flags = useMemo(() => (d ? reconciliationFlags(d) : []), [d]);
  const revolutWaiting = useMemo(() => (d ? d.orderPayments.filter(isOpenRevolutItem).length : 0), [d]);
  const events = useMemo(() => (d ? paymentEvents(d) : []), [d]);
  const [src, setSrc] = useState<Source | 'all'>('all');
  const [paying, setPaying] = useState<Receivable | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  const focusOrder = params.get('order');
  const moneyErr = q.isError ? (q.error as Error).message : q.data?.moneyError ?? null;

  const onAction = (r: Receivable) => {
    if (r.action === 'Record payment' || r.action === 'Request balance' || r.action === 'Match') setPaying(r);
    else if (r.action === 'Chase' && r.openInvoice) navigate(`/dashboard/finance?invoice=${r.openInvoice.id}`);
    else openOrder(r.orderId);
  };
  const shownRec = rec.filter((r) => showPaid || r.colour !== 'green');
  const ledger = events.filter((e) => src === 'all' || e.source === src);

  const cards = kpi ? financeKpiCards(kpi) : [];

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-2" data-testid="finance-v2">
      {/* xl: KPIs + flow + tabs + the active table fill one screen (no page scroll at 1280×800 / 1440×900 and wider);
          the flow takes most of the remaining height and the table the rest, scrolling inside its own box. */}
      <div className="flex min-w-0 flex-col gap-2 xl:h-[calc(100dvh-2rem)] xl:shrink-0 min-[1440px]:h-[calc(100dvh-2.5rem)]" data-testid="finance-fit">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="sr-only">Finance</h2>
        {organizationName && <span className="min-w-0 truncate text-[13px] text-gardens-txs">{organizationName}</span>}
      </div>
      {!canSeeMoney && role && (
        <ErrorNote title="Money figures are hidden for your role." message={`You're signed in as "${role}". Owed, payments and invoices totals need an admin or member role, so they are not shown as £0.`} />
      )}
      {canSeeMoney && moneyErr && <ErrorNote title="Couldn't load finance data, so no totals are shown:" message={moneyErr} />}
      {canSeeMoney && q.isLoading && <Card><p className="m-0 text-[13px] text-gardens-txs">Loading money…</p></Card>}

      {canSeeMoney && kpi && !moneyErr && (
        <div className="flex min-w-0 max-w-full shrink-0 gap-2 overflow-x-auto pb-0.5 min-[880px]:grid min-[880px]:grid-cols-5 min-[880px]:overflow-visible" data-testid="finance-kpis">
          {cards.map((c) => (
            <Kpi key={c.id} testId={c.testId} label={c.label} value={gbp2(c.value)} tone={c.tone} />
          ))}
        </div>
      )}

      {canSeeMoney && (
        <div className="flex min-w-0 flex-col xl:min-h-0 xl:flex-[5_1_0%]" data-testid="finance-flow-box">
          <FinanceFlow />
        </div>
      )}

      <div className="flex min-w-0 max-w-full shrink-0 gap-1 overflow-x-auto rounded-lg bg-gardens-page p-1" role="tablist">
        {(canSeeMoney ? (['receivables', 'ledger', 'reconcile', 'invoices'] as Tab[]) : (['invoices'] as Tab[])).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('shrink-0 rounded-md px-3 py-1.5 text-[13px]', tab === t ? 'bg-gardens-surf font-bold text-gardens-tx shadow-sm' : 'text-gardens-txs')}>
            {TAB_LABEL[t]}{t === 'reconcile' && (flags.length + revolutWaiting) ? ` · ${flags.length + revolutWaiting}` : ''}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-col xl:min-h-0 xl:flex-[2_1_0%] xl:overflow-y-auto" data-testid="finance-tab-panel">
      {tab === 'receivables' && d && (
        <Card className="min-w-0 overflow-x-auto p-2">
          <div className="flex items-baseline justify-between px-1">
            <H3>Owed to us · per order</H3>
            <label className="text-[12px] text-gardens-txs"><input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} /> show paid</label>
          </div>
          <ul className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0" data-testid="receivables">
            {shownRec.map((r) => (
              <li key={r.orderId} className={cn('flex min-w-0 flex-wrap items-center gap-2 px-1 py-2', focusOrder === r.orderId && 'bg-gardens-acc-lt')}>
                <button type="button" className="min-w-0 flex-1 basis-40 text-left" onClick={() => openOrder(r.orderId)}>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-head text-[14px] font-semibold text-gardens-tx truncate">{r.name}</span>
                    <span className="text-[11px] text-gardens-txs">{r.ref}</span>
                  </span>
                  <span className="block text-[12px] text-gardens-txs">{r.why}</span>
                  <span className="block text-[11px] text-gardens-txm-aa tabular-nums">
                    {gbp2(r.total)} · paid {gbp2(r.paid)}{r.sources.length ? ` (${r.sources.map((s) => SRC_LABEL[s]).join(', ')})` : ''} · <b className="text-gardens-tx">left {gbp2(r.remaining)}</b>
                  </span>
                </button>
                {r.action ? <VerbPill colour={r.colour} onClick={() => onAction(r)}>{r.action}</VerbPill> : <VerbPill colour={r.colour}>{r.colour === 'green' ? 'Paid' : 'On fixing'}</VerbPill>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'ledger' && (
        <Card className="min-w-0 overflow-x-auto p-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <H3>Payments ledger · {ledger.length}</H3>
            <div className="flex flex-wrap gap-1">
              {(['all', 'revolut', 'stripe', 'bank', 'other'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSrc(s)} className={cn('rounded-full border px-2 py-0.5 text-[12px]', src === s ? 'border-gardens-acc bg-gardens-acc-lt font-semibold' : 'border-gardens-bdr text-gardens-txs')}>
                  {s === 'all' ? 'All' : SRC_LABEL[s]}
                </button>
              ))}
              <button type="button" className="rounded border border-gardens-bdr px-2 py-0.5 text-[12px]" onClick={() => download(`payments-${new Date().toISOString().slice(0, 10)}.csv`, [['Date', 'Source', 'Amount', 'Type', 'Reference', 'Matched'], ...ledger.map((e) => [e.at?.slice(0, 10) ?? '', SRC_LABEL[e.source], Math.round(e.amount * 100) / 100, e.type ?? '', e.reference ?? '', e.matched ? 'yes' : 'no'])])}>CSV</button>
            </div>
          </div>
          <ul className="m-0 mt-1 min-w-[22rem] list-none divide-y divide-gardens-bdr p-0">
            {ledger.map((e) => {
              const o = d?.orders.find((x) => x.id === e.orderId);
              return (
                <li key={e.id} className="flex min-w-0 items-center gap-2 px-1 py-1.5 text-[13px]">
                  <span className="w-14 shrink-0 text-gardens-txs">{shortDate(e.at)}</span>
                  <span className="min-w-0 flex-1 truncate">{o ? `${o.person_name || o.customer_name || '—'} #${o.order_number}` : (e.counterparty || e.reference || '—')}{e.reference && e.counterparty ? <span className="text-gardens-txm-aa"> · {e.reference}</span> : null}<span className="text-gardens-txm-aa"> · {e.type ?? ''}</span></span>
                  <span className="shrink-0 rounded bg-gardens-page px-1.5 text-[11px]">{SRC_LABEL[e.source]}</span>
                  <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{gbp2(e.amount)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {tab === 'reconcile' && d && (
        <Card className="p-2 sm:p-3">
          <H3 className="px-1">Revolut · {revolutWaiting}</H3>
          <RevolutReconcileList payments={d.orderPayments} orders={d.orders} />
        </Card>
      )}

      {tab === 'reconcile' && (
        <Card className="min-w-0 overflow-x-auto p-2">
          <H3 className="px-1">Reconciliation · {flags.length}</H3>
          <ul className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0" data-testid="recon">
            {flags.map((f, n) => (
              <li key={n} className="flex min-w-[20rem] items-center gap-2 px-1 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-gardens-tx">{f.ref} · {f.name}</span>
                  <span className="block text-[12px] text-gardens-txs">{f.detail}</span>
                </span>
                <span className="text-right">
                  <VerbPill colour={f.kind === 'Barclays (unverified)' || f.kind === 'Mason vs Stripe mismatch' ? 'red' : 'amber'}>{f.kind}</VerbPill>
                  <span className="block text-[11px] tabular-nums text-gardens-txs">{gbp2(f.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'invoices' && <FinanceInvoicesTab />}
      </div>
      </div>
      {paying && <RecordPaymentDialog receivable={paying} onClose={() => setPaying(null)} />}
    </div>
  );
};
