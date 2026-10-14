import { FinanceFlow } from '../flow/FinanceFlow';
import { useOpenOrder } from '@/shared/context/OrderPanelContext';
import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useNow } from '@/modules/sections/useSectionsData';
import { useBrandData } from '@/modules/today/useBrandData';
import { Card, ErrorNote, gbp0, gbp2, H3, shortDate, VerbPill } from '@/modules/today/ui';
import { FinanceInvoicesTab } from './FinancePage';
import {
  AGE_BUCKETS, financeKpis, paymentEvents, receivables, reconciliationFlags, type Receivable, type Source,
} from '../receivables';
import { RecordPaymentDialog } from '../components/RecordPaymentDialog';

type Tab = 'receivables' | 'ledger' | 'reconcile' | 'invoices';
const TAB_LABEL: Record<Tab, string> = { receivables: 'Owed to us', ledger: 'Payments', reconcile: 'Reconcile', invoices: 'Invoices' };
const SRC_LABEL: Record<Source, string> = { revolut: 'Revolut', stripe: 'Stripe', bank: 'Bank', other: 'Other' };

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const Kpi: React.FC<{ label: string; value: string; sub?: React.ReactNode; tone?: 'red' | 'amber'; testId?: string }> = ({ label, value, sub, tone, testId }) => (
  <div className="min-w-0 rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3" data-testid={testId}>
    <div className="text-[11px] font-bold uppercase tracking-wide text-gardens-txm-aa">{label}</div>
    <div className={cn('font-head text-[20px] font-semibold tabular-nums', tone === 'red' ? 'text-gardens-sem-red' : tone === 'amber' ? 'text-amber-700' : 'text-gardens-tx')}>{value}</div>
    {sub && <div className="text-[11.5px] text-gardens-txs">{sub}</div>}
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

  return (
    <div className="flex flex-col gap-3" data-testid="finance-v2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="sr-only">Finance</h1>
        {organizationName && <span className="text-[13px] text-gardens-txs">{organizationName}</span>}
      </div>
      {!canSeeMoney && role && (
        <ErrorNote title="Money figures are hidden for your role." message={`You're signed in as "${role}". Owed, payments and invoices totals need an admin or member role, so they are not shown as £0.`} />
      )}
      {canSeeMoney && moneyErr && <ErrorNote title="Couldn't load finance data, so no totals are shown:" message={moneyErr} />}
      {canSeeMoney && q.isLoading && <Card><p className="m-0 text-[13px] text-gardens-txs">Loading money…</p></Card>}

      {canSeeMoney && kpi && !moneyErr && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5" data-testid="finance-kpis">
          <Kpi testId="kpi-today" label="Cash in today" value={gbp2(kpi.today.total)} sub={`Revolut ${gbp0(kpi.today.revolut)} · Stripe ${gbp0(kpi.today.stripe)}${kpi.lastPayment ? ` · last ${shortDate(kpi.lastPayment.at)} ${gbp0(kpi.lastPayment.amount)} ${SRC_LABEL[kpi.lastPayment.source]}` : ''}`} />
          <Kpi testId="kpi-mtd" label="Cash in this month" value={gbp2(kpi.mtd.total)} sub={`Revolut ${gbp2(kpi.mtd.revolut)} · Stripe ${gbp2(kpi.mtd.stripe)}${kpi.mtd.other ? ` · other ${gbp2(kpi.mtd.other)}` : ''}`} />
          <Kpi testId="kpi-owed" label="Owed to us" value={gbp2(kpi.owed.total)} sub={`${kpi.owed.count} orders · value + permit − payments${kpi.balances.unknownDepositCount ? ` · incl. ${kpi.balances.unknownDepositCount} with a deposit not yet recorded` : ''}`} tone="amber" />
          <Kpi testId="kpi-invoices" label="Invoices unpaid" value={gbp2(kpi.invoices.live.total)}
            sub={<>{kpi.invoices.live.count} live · {AGE_BUCKETS.map((b) => `${b} ${kpi.invoices.live.buckets[b].count}`).join(' · ')}
              {kpi.invoices.voidInStripe.count > 0 && <><br /><b className="text-gardens-sem-red">+{kpi.invoices.voidInStripe.count} void in Stripe ({gbp2(kpi.invoices.voidInStripe.total)})</b></>}</>}
            tone={kpi.invoices.voidInStripe.count ? 'red' : undefined} />
          <Kpi testId="kpi-balances" label="Balances due on fixing" value={gbp2(kpi.balances.total)} sub={`${kpi.balances.count} orders · ${kpi.balances.next30Count} with fixing ≤30d${kpi.balances.unknownDepositCount ? ` · ${kpi.balances.unknownDepositCount} more need the deposit recorded first` : ''}`} />
        </div>
      )}

      {canSeeMoney && <FinanceFlow />}

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-gardens-page p-1" role="tablist">
        {(canSeeMoney ? (['receivables', 'ledger', 'reconcile', 'invoices'] as Tab[]) : (['invoices'] as Tab[])).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('shrink-0 rounded-md px-3 py-1.5 text-[13px]', tab === t ? 'bg-gardens-surf font-bold text-gardens-tx shadow-sm' : 'text-gardens-txs')}>
            {TAB_LABEL[t]}{t === 'reconcile' && flags.length ? ` · ${flags.length}` : ''}
          </button>
        ))}
      </div>

      {tab === 'receivables' && d && (
        <Card className="p-2 sm:p-3">
          <div className="flex items-baseline justify-between px-1">
            <H3>Owed to us · per order</H3>
            <label className="text-[12px] text-gardens-txs"><input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} /> show paid</label>
          </div>
          <ul className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0" data-testid="receivables">
            {shownRec.map((r) => (
              <li key={r.orderId} className={cn('flex items-center gap-2 px-1 py-2', focusOrder === r.orderId && 'bg-gardens-acc-lt')}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openOrder(r.orderId)}>
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
        <Card className="p-2 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <H3>Payments ledger · {ledger.length}</H3>
            <div className="flex flex-wrap gap-1">
              {(['all', 'revolut', 'stripe', 'bank', 'other'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSrc(s)} className={cn('rounded-full border px-2 py-0.5 text-[12px]', src === s ? 'border-gardens-acc bg-gardens-acc-lt font-semibold' : 'border-gardens-bdr text-gardens-txs')}>
                  {s === 'all' ? 'All' : SRC_LABEL[s]}
                </button>
              ))}
              <button type="button" className="rounded border border-gardens-bdr px-2 py-0.5 text-[12px]" onClick={() => download(`payments-${new Date().toISOString().slice(0, 10)}.csv`, [['Date', 'Source', 'Amount', 'Type', 'Reference', 'Matched'], ...ledger.map((e) => [e.at?.slice(0, 10) ?? '', SRC_LABEL[e.source], e.amount.toFixed(2), e.type ?? '', e.reference ?? '', e.matched ? 'yes' : 'no'])])}>CSV</button>
            </div>
          </div>
          <ul className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0">
            {ledger.map((e) => {
              const o = d?.orders.find((x) => x.id === e.orderId);
              return (
                <li key={e.id} className="flex items-center gap-2 px-1 py-1.5 text-[13px]">
                  <span className="w-14 shrink-0 text-gardens-txs">{shortDate(e.at)}</span>
                  <span className="min-w-0 flex-1 truncate">{o ? `${o.person_name || o.customer_name || '—'} #${o.order_number}` : e.reference ?? '—'}<span className="text-gardens-txm-aa"> · {e.type ?? ''}</span></span>
                  <span className="shrink-0 rounded bg-gardens-page px-1.5 text-[11px]">{SRC_LABEL[e.source]}</span>
                  <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{gbp2(e.amount)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {tab === 'reconcile' && (
        <Card className="p-2 sm:p-3">
          <H3 className="px-1">Reconciliation · {flags.length}</H3>
          <ul className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0" data-testid="recon">
            {flags.map((f, n) => (
              <li key={n} className="flex items-center gap-2 px-1 py-2">
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
      {paying && <RecordPaymentDialog receivable={paying} onClose={() => setPaying(null)} />}
    </div>
  );
};
