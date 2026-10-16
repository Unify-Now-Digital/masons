import { FinanceFlow } from '../flow/FinanceFlow';
import { useOpenOrder } from '@/shared/context/orderPanel';
import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/shared/lib/utils';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useNow } from '@/modules/sections/useSectionsData';
import { useBrandData } from '@/modules/today/useBrandData';
import { Card, ErrorNote } from '@/modules/today/ui';
import { gbp0 } from '@/modules/today/uiHelpers';
import { FinanceInvoicesTab } from './FinancePage';
import { financeKpiCards, financeKpis, receivables, type Receivable } from '../receivables';
import { RecordPaymentDialog } from '../components/RecordPaymentDialog';
import { RevolutReconcileList } from '../components/RevolutReconcileList';
import { isOpenRevolutItem } from '../acceptRevolut';
import { FinanceQueue } from '../components/FinanceQueue';
import { buildFinanceQueue, type FinanceQueueRow, type QueueFilter } from '../queue';
import { MatchModal } from '@/modules/payments/components/MatchModal';
import { AmountMismatchError, useMatchPayment } from '@/modules/payments/hooks/useMatchPayment';

type PayType = 'deposit' | 'final' | 'permit' | 'other';

function payType(value: string): PayType {
  return value === 'final' || value === 'permit' || value === 'other' ? value : 'deposit';
}

/** One row on a phone (scroll sideways). Five columns only once they fit, from 1280px. */
const KPI_GRID = 'flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-0.5 xl:grid xl:grid-cols-5 xl:overflow-visible xl:pb-0';
const KPI_CARD = 'w-[8.5rem] shrink-0 rounded-lg border border-gardens-bdr bg-gardens-surf px-2.5 py-1.5 xl:w-auto xl:min-w-0 xl:shrink';
const KPI_SKELETON = ['Cash in this month', 'Cash in today', 'Unpaid · 7 days', 'Balances due on fixing', 'Owed to us'];

const Kpi: React.FC<{ label: string; value: string; tone?: 'red' | 'amber'; testId?: string; className?: string }> = ({ label, value, tone, testId, className }) => (
  <div className={cn(KPI_CARD, className)} data-testid={testId}>
    <div className="text-[11px] font-bold uppercase tracking-wide text-gardens-txm-aa">{label}</div>
    <div className={cn('font-head text-[18px] font-semibold tabular-nums leading-tight sm:text-[22px]', tone === 'red' ? 'text-gardens-na-red' : tone === 'amber' ? 'text-gardens-na-amber' : 'text-gardens-tx')}>{value}</div>
  </div>
);

const KpiSkeleton: React.FC = () => (
  <div className={KPI_GRID} data-testid="finance-kpi-skeleton" aria-busy="true">
    <span className="sr-only">Loading money</span>
    {KPI_SKELETON.map((label) => (
      <div key={label} className={KPI_CARD} aria-hidden>
        <div className="text-[11px] font-bold uppercase tracking-wide text-gardens-txm-aa">{label}</div>
        <div className="relative font-head text-[22px] font-semibold leading-tight">
          <span className="invisible">£0,000</span>
          <span className="absolute inset-x-0 bottom-1 top-1 animate-pulse rounded bg-gardens-bdr" />
        </div>
      </div>
    ))}
  </div>
);

/** Finance: KPIs, lead flow, and one queue (needs action first). Revolut Accept/Ignore stays for unmatched Revolut. */
export const FinancePage: React.FC = () => {
  const navigate = useNavigate();
  const openOrder = useOpenOrder();
  const qc = useQueryClient();
  const matchMutation = useMatchPayment();
  const [params] = useSearchParams();
  const canSeeMoney = useCanSeeMoney();
  const { role, organizationName } = useOrganization();
  const deepInvoice = params.has('invoice') || params.has('focus');
  const [filter, setFilter] = useState<QueueFilter>(params.get('tab') === 'reconcile' ? 'unmatched' : 'needs');
  const [showInvoices, setShowInvoices] = useState(deepInvoice);
  const nowDate = useNow();
  const now = nowDate.getTime();
  const q = useBrandData(canSeeMoney);
  const d = q.data?.data;
  const kpi = useMemo(() => (d ? financeKpis(d, now) : null), [d, now]);
  const rows = useMemo(() => (d ? buildFinanceQueue(d, now) : []), [d, now]);
  const revolutWaiting = useMemo(() => (d ? d.orderPayments.filter(isOpenRevolutItem).length : 0), [d]);
  const byOrder = useMemo(() => {
    const map = new Map<string, Receivable>();
    if (d) for (const r of receivables(d, now)) map.set(r.orderId, r);
    return map;
  }, [d, now]);
  const [paying, setPaying] = useState<Receivable | null>(null);
  const [matching, setMatching] = useState<FinanceQueueRow | null>(null);
  const [mismatch, setMismatch] = useState<{ message: string; paymentId: string; orderId: string; paymentType: PayType } | null>(null);
  const focusOrder = params.get('order');
  const moneyErr = q.isError ? (q.error as Error).message : q.data?.moneyError ?? null;

  const showRevolut = canSeeMoney && !!d && revolutWaiting > 0 && !showInvoices && (filter === 'needs' || filter === 'unmatched');

  const openRow = (row: FinanceQueueRow) => {
    if (row.orderId) openOrder(row.orderId, { section: 'payments' });
    else if (row.invoiceId) navigate(`/dashboard/finance?invoice=${row.invoiceId}`);
  };

  const runMatch = (paymentId: string, orderId: string, paymentType: PayType, force = false) => {
    matchMutation.mutate(
      { paymentId, orderId, paymentType, matchedBy: 'manual', ...(force ? { forceMatch: true } : {}) },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['brand-data'] });
          setMatching(null);
          setMismatch(null);
        },
        onError: (error) => {
          if (error instanceof AmountMismatchError) {
            setMismatch({ message: error.message, paymentId, orderId, paymentType });
          }
        },
      },
    );
  };

  const onAction = (row: FinanceQueueRow) => {
    if (row.button === 'Record payment' && row.orderId) {
      const receivable = byOrder.get(row.orderId);
      if (receivable) setPaying(receivable);
      else openRow(row);
      return;
    }
    if (row.button === 'Match' && row.paymentId) {
      setMatching(row);
      return;
    }
    if (row.button === 'Send reminder') {
      if (row.invoiceId) navigate(`/dashboard/finance?invoice=${row.invoiceId}`);
      else openRow(row);
      return;
    }
    openRow(row);
  };

  const cards = kpi ? financeKpiCards(kpi) : [];

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-2" data-testid="finance-v2">
      <div className="flex min-w-0 flex-col gap-2" data-testid="finance-fit">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="sr-only">Finance</h2>
        {organizationName && <span className="min-w-0 truncate text-[13px] text-gardens-txs">{organizationName}</span>}
      </div>
      {!canSeeMoney && role && (
        <ErrorNote title="Money figures are hidden for your role." message={`You're signed in as "${role}". Owed, payments and invoices totals need an admin or member role, so they are not shown as £0.`} />
      )}
      {canSeeMoney && moneyErr && <ErrorNote title="Couldn't load finance data, so no totals are shown:" message={moneyErr} />}
      {canSeeMoney && !kpi && !moneyErr && (q.isPending || q.isLoading || q.isFetching) && <KpiSkeleton />}

      {canSeeMoney && kpi && !moneyErr && (
        <div className={KPI_GRID} data-testid="finance-kpis">
          {cards.map((c) => (
            <Kpi key={c.id} testId={c.testId} label={c.label} value={gbp0(c.value)} tone={c.tone} />
          ))}
        </div>
      )}

      {canSeeMoney && (
        <div className="min-w-0" data-testid="finance-flow-box">
          <FinanceFlow />
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2" data-testid="finance-tab-panel">
        {showRevolut && d && (
          <Card className="p-2 sm:p-3" data-testid="revolut-reconcile">
            <p className="m-0 px-1 text-[13px] font-semibold text-gardens-tx">Revolut · {revolutWaiting} to review</p>
            <RevolutReconcileList payments={d.orderPayments} orders={d.orders} />
          </Card>
        )}
        {canSeeMoney && d && (
          <FinanceQueue
            rows={rows}
            filter={filter}
            onFilter={(next) => { setFilter(next); setShowInvoices(false); }}
            showInvoices={showInvoices}
            onToggleInvoices={() => setShowInvoices((on) => !on)}
            onOpen={openRow}
            onAction={onAction}
            focusOrderId={focusOrder}
            invoices={<FinanceInvoicesTab />}
          />
        )}
        {!canSeeMoney && <FinanceInvoicesTab />}
      </div>
      </div>
      {paying && canSeeMoney && <RecordPaymentDialog receivable={paying} onClose={() => setPaying(null)} />}
      {matching?.paymentId && (
        <MatchModal
          open
          onClose={() => setMatching(null)}
          paymentId={matching.paymentId}
          paymentAmount={matching.amount}
          onMatch={(paymentId, orderId, paymentType) => runMatch(paymentId, orderId, payType(paymentType))}
        />
      )}
      {mismatch && (
        <div role="alertdialog" aria-label="Amount mismatch" className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" data-testid="amount-mismatch">
          <div className="w-full max-w-md rounded-lg border border-gardens-bdr bg-gardens-surf p-4">
            <p className="m-0 text-[14px] font-semibold text-gardens-tx">Amount mismatch</p>
            <p className="m-0 mt-1 text-[13px] text-gardens-txs">{mismatch.message}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="inline-flex h-11 items-center rounded-md border border-gardens-bdr px-3 text-[13px] lg:h-8" onClick={() => setMismatch(null)}>Cancel</button>
              <button type="button" className="inline-flex h-11 items-center rounded-md bg-gardens-acc px-3 text-[13px] font-semibold text-white lg:h-8" onClick={() => runMatch(mismatch.paymentId, mismatch.orderId, mismatch.paymentType, true)}>Match anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
