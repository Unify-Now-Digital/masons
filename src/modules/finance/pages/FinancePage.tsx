import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Pill, Btn, Icon, AIBadge, AISuggestion } from '@/shared/components/gardens';
import { PaymentProgressBar } from '@/shared/components/PaymentProgressBar';
import { formatGbpDecimal, formatGbpPence } from '@/shared/lib/formatters';
import {
  useFinanceTotals,
  useFinanceAtRisk,
  useFinanceRecentPayments,
} from '../hooks/useFinance';
import { useFinanceInvoices } from '../hooks/useFinanceInvoices';
import { useFinanceHub } from '../hooks/useFinanceHub';
import { useOrderExtrasList } from '@/modules/payments/hooks/useOrderExtras';
import { InvoiceWorkspace, type InvoiceWorkspaceStatusTab } from '@/modules/invoicing';
import { useOrdersByInvoice } from '@/modules/orders/hooks/useOrders';
import {
  getOrderBaseValue,
  getOrderPermitCost,
  getOrderAdditionalOptionsTotal,
  getOrderTotal,
  getOrderTotalFormatted,
} from '@/modules/orders/utils/orderCalculations';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { orderLineLabel } from '@/modules/orders/utils/orderLineLabel';
import type { OrderExtra } from '@/modules/payments/types/reconciliation.types';
import type { FinanceAtRiskOrder, FinanceRecentPayment } from '../api/finance.api';
import type { FinanceHubSummary, FinanceInvoiceHorizonFilter } from '../api/finance.hub.api';
import {
  computePercentPaid,
  getDisplayStatus,
  hasStripeSection,
  isInvoiceOverdue,
  type FinanceInvoiceRow,
  type FinanceInvoiceStatusFilter,
} from '../api/finance.invoices.api';
import {
  formatInvoiceRemaining,
  getAttentionFlags,
  getInvoiceHorizonBucket,
  isHubEligibleInvoice,
  isReliableDueDate,
} from '../utils/invoiceRemaining';

type Tab = 'hub' | 'balance-chase' | 'extras' | 'payments' | 'invoices';

// Hidden 2026-07-19 per Arin — restore by flipping this flag.
const SHOW_SECONDARY_FINANCE_TABS = false;

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

const compactDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const FinancePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Invoice deep-links (?invoice= / ?focus=, e.g. via the retired /dashboard/invoicing
  // redirect) land on the Invoices tab so InvoiceWorkspace's effect can consume them.
  // Lazy init only — later tab clicks are never overridden.
  const [tab, setTab] = useState<Tab>(() =>
    searchParams.has('invoice') || searchParams.has('focus') ? 'invoices' : 'hub',
  );
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<FinanceInvoiceStatusFilter>('all');
  const [horizonFilter, setHorizonFilter] = useState<FinanceInvoiceHorizonFilter | null>(null);
  // Status tab InvoiceWorkspace should show — set by KPI cards / horizon segments.
  const [workspaceStatusFilter, setWorkspaceStatusFilter] =
    useState<InvoiceWorkspaceStatusTab | undefined>(undefined);
  // No longer reachable from the hub (attention rows now deep-link into InvoiceWorkspace
  // via ?invoice=). Kept with InvoiceDrawer below — would drive the slim InvoicesTab if restored.
  const [selectedInvoice, setSelectedInvoice] = useState<FinanceInvoiceRow | null>(null);
  const navigate = useNavigate();
  const totals = useFinanceTotals();
  const atRisk = useFinanceAtRisk();
  const payments = useFinanceRecentPayments();
  const extras = useOrderExtrasList('pending');
  const hub = useFinanceHub();
  const invoices = useFinanceInvoices(invoiceStatusFilter);

  const handleInvoiceStatusFilterChange = (f: FinanceInvoiceStatusFilter) => {
    setInvoiceStatusFilter(f);
    // Clear horizon slice when leaving Unpaid — horizon routing is Unpaid-only.
    if (f !== 'unpaid') setHorizonFilter(null);
  };

  const handleKpiNavigate = (filter: InvoiceWorkspaceStatusTab) => {
    setTab('invoices');
    setWorkspaceStatusFilter(filter);
  };

  // Horizon segments open the workspace status-filtered: Overdue → Overdue, others → Unpaid.
  // TODO: date-horizon slices (due-30 / due-later / no-date) need a filter dimension
  // InvoiceWorkspace doesn't have — until then those segments open unsliced. The
  // status/horizon state below still feeds the tab-label count (useFinanceInvoices)
  // and would drive the slim InvoicesTab if restored.
  const handleHorizonNavigate = (segment: FinanceInvoiceHorizonFilter) => {
    setTab('invoices');
    setInvoiceStatusFilter('unpaid');
    setHorizonFilter(segment);
    setWorkspaceStatusFilter(segment === 'overdue' ? 'overdue' : 'unpaid');
  };

  // Hub attention rows open the full InvoiceWorkspace detail sidebar via its
  // ?invoice= deep-link effect, instead of the slim InvoiceDrawer.
  const handleAttentionInvoiceClick = (row: FinanceInvoiceRow) => {
    setTab('invoices');
    setSearchParams(
      (params) => {
        params.set('invoice', row.id);
        return params;
      },
      { replace: false },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Totals ribbon */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <TotalTile
          label="Total order balance"
          value={totals.data ? currency(Math.round(totals.data.outstandingBalance)) : '—'}
          sub="across unpaid orders"
          icon="coins"
          emphasis={
            totals.data && totals.data.outstandingBalance > 0 ? 'warn' : undefined
          }
          onClick={() => navigate('/dashboard/orders')}
        />
        <TotalTile
          label="Invoiced & unpaid"
          value={hub.data ? currency(Math.round(hub.data.totalOutstandingGbp)) : '—'}
          sub="invoice balances owed"
          icon="coins"
          onClick={() => handleKpiNavigate('unpaid')}
        />
        <TotalTile
          label="Collected this month"
          value={totals.data ? currency(Math.round(totals.data.collectedThisMonth)) : '—'}
          sub="invoice payments"
          icon="check"
          emphasis="good"
          onClick={() => handleKpiNavigate('paid')}
        />
        <TotalTile
          label="Expected this month"
          value={totals.data ? currency(Math.round(totals.data.expectedThisMonth)) : '—'}
          sub="balance due on installs"
          icon="clock"
          onClick={() => handleKpiNavigate('all')}
        />
        <TotalTile
          label="Overdue"
          value={hub.data ? currency(Math.round(hub.data.totalOverdueGbp)) : '—'}
          secondary={
            hub.data
              ? `${hub.data.horizon.overdue.count} invoice${
                  hub.data.horizon.overdue.count === 1 ? '' : 's'
                }`
              : undefined
          }
          sub="balance past due date"
          icon="alert"
          emphasis={hub.data && hub.data.totalOverdueGbp > 0 ? 'warn' : undefined}
          onClick={() => handleKpiNavigate('overdue')}
        />
      </div>

      {/* AI banner — AI-detected order extras. Gated with the tabs: its CTA jumps to 'extras'. */}
      {SHOW_SECONDARY_FINANCE_TABS && extras.data && extras.data.length > 0 && (
        <AISuggestion
          prominent
          title={`${extras.data.length} price change${extras.data.length === 1 ? '' : 's'} detected since quote`}
          confidence={
            extras.data.filter((e) => e.confidence === 'high').length / extras.data.length * 100 | 0
          }
          body="Mason noticed inscription extensions, photo plaques and colour upgrades in customer messages that haven't been added to invoices yet. Review to fold them into the balance before chasing."
          actions={
            <Btn
              variant="ai"
              size="sm"
              icon={<Icon name="arrowRight" size={12} />}
              onClick={() => setTab('extras')}
            >
              Review changes ({extras.data.length})
            </Btn>
          }
        />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gardens-bdr overflow-x-auto scrollbar-hide">
        <TabButton label="Hub" active={tab === 'hub'} onClick={() => setTab('hub')} />
        {SHOW_SECONDARY_FINANCE_TABS && (
          <>
            <TabButton
              label={`Balance-chase${atRisk.data ? ` (${atRisk.data.length})` : ''}`}
              active={tab === 'balance-chase'}
              onClick={() => setTab('balance-chase')}
            />
            <TabButton
              label={`AI changes${extras.data ? ` (${extras.data.length})` : ''}`}
              active={tab === 'extras'}
              onClick={() => setTab('extras')}
              aiDot={extras.data && extras.data.length > 0}
            />
            <TabButton
              label="Recent payments"
              active={tab === 'payments'}
              onClick={() => setTab('payments')}
            />
          </>
        )}
        <TabButton
          label={`Invoices${invoices.data != null ? ` (${invoices.data.length})` : ''}`}
          active={tab === 'invoices'}
          onClick={() => setTab('invoices')}
        />
      </div>

      {tab === 'hub' && (
        <HubTab
          loading={hub.isLoading}
          error={hub.isError}
          summary={hub.data}
          onRetry={() => hub.refetch()}
          onSelectInvoice={handleAttentionInvoiceClick}
          onHorizonClick={handleHorizonNavigate}
        />
      )}

      {SHOW_SECONDARY_FINANCE_TABS && tab === 'balance-chase' && (
        <BalanceChaseTab
          loading={atRisk.isLoading}
          rows={atRisk.data ?? []}
          onOpenInvoicing={() => navigate('/dashboard/invoicing')}
        />
      )}

      {SHOW_SECONDARY_FINANCE_TABS && tab === 'extras' && (
        <ExtrasTab
          loading={extras.isLoading}
          rows={extras.data ?? []}
          onOpenInvoicing={() => navigate('/dashboard/invoicing')}
        />
      )}

      {SHOW_SECONDARY_FINANCE_TABS && tab === 'payments' && (
        <PaymentsTab
          loading={payments.isLoading}
          rows={payments.data ?? []}
          onOpenPayments={() => navigate('/dashboard/payments')}
        />
      )}

      {tab === 'invoices' && <InvoiceWorkspace initialStatusFilter={workspaceStatusFilter} />}

      {selectedInvoice && (
        <InvoiceDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
};

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  aiDot?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, onClick, aiDot }) => (
  <button
    onClick={onClick}
    className="relative flex items-center gap-2"
    style={{
      padding: '10px 16px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--g-ff-body)',
      fontSize: 13,
      fontWeight: 600,
      color: active ? 'var(--g-tx)' : 'var(--g-txs)',
      borderBottom: active ? '2px solid var(--g-acc)' : '2px solid transparent',
      marginBottom: -1,
    }}
  >
    {label}
    {aiDot && (
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--g-acc)',
        }}
      />
    )}
  </button>
);

interface TotalTileProps {
  label: string;
  value: string;
  sub: string;
  /** Optional second line between value and sub, same styling as sub. */
  secondary?: string;
  icon: string;
  emphasis?: 'warn' | 'good';
  onClick?: () => void;
}

const EMPHASIS_BG: Record<'warn' | 'good', string> = {
  warn: 'var(--g-amb-lt)',
  good: 'var(--g-grn-lt)',
};
const EMPHASIS_FG: Record<'warn' | 'good', string> = {
  warn: 'var(--g-acc)',
  good: 'var(--g-grn-dk)',
};

const TotalTile: React.FC<TotalTileProps> = ({ label, value, sub, secondary, icon, emphasis, onClick }) => (
  <Card
    padded
    style={{ padding: 16 }}
    onClick={onClick}
    className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : undefined}
  >
    <div className="flex items-center gap-2 mb-3">
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: emphasis ? EMPHASIS_BG[emphasis] : 'var(--g-surf2)',
          color: emphasis ? EMPHASIS_FG[emphasis] : 'var(--g-txm)',
        }}
      >
        <Icon name={icon} size={11} />
      </span>
      <div className="text-[11px] font-semibold text-gardens-txs">{label}</div>
    </div>
    <div className="font-head text-[28px] font-semibold text-gardens-tx leading-none tracking-[-0.02em]">
      {value}
    </div>
    {secondary && (
      <div className="mt-2 text-[11px] text-gardens-txm italic truncate">{secondary}</div>
    )}
    <div className="mt-2 text-[11px] text-gardens-txm italic truncate">{sub}</div>
  </Card>
);

const HUB_HORIZON_SEGMENTS: {
  key: FinanceInvoiceHorizonFilter;
  label: string;
  summaryKey: keyof FinanceHubSummary['horizon'];
}[] = [
  { key: 'overdue', label: 'Overdue', summaryKey: 'overdue' },
  { key: 'due-30', label: 'Due within 30 days', summaryKey: 'due30' },
  { key: 'due-later', label: 'Due later', summaryKey: 'dueLater' },
  { key: 'no-date', label: 'No reliable date', summaryKey: 'noDate' },
];

const HubTab: React.FC<{
  loading: boolean;
  error: boolean;
  summary: FinanceHubSummary | undefined;
  onRetry: () => void;
  onSelectInvoice: (row: FinanceInvoiceRow) => void;
  onHorizonClick: (segment: FinanceInvoiceHorizonFilter) => void;
}> = ({ loading, error, summary, onRetry, onSelectInvoice, onHorizonClick }) => {
  const hubErrorBlock = error ? (
    <div className="flex flex-col gap-2 mb-4">
      <div className="text-[12px] text-gardens-red-dk">Could not load invoice hub.</div>
      <Btn variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Btn>
    </div>
  ) : null;

  if (loading) {
    return (
      <Card padded>
        <div className="text-[12px] text-gardens-txs">Loading…</div>
      </Card>
    );
  }

  const allHorizonZero =
    summary != null &&
    HUB_HORIZON_SEGMENTS.every(({ summaryKey }) => summary.horizon[summaryKey].count === 0);

  return (
    <div className="flex flex-col gap-4">
      {hubErrorBlock}

      {!error && summary && summary.unpaidCount === 0 && (
        <div className="text-[12px] text-gardens-txs">All invoices are paid up. Nothing to chase.</div>
      )}

      <Card padded>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-head text-[17px] font-semibold text-gardens-tx m-0">Needs attention</h3>
            <div className="text-[11.5px] text-gardens-txs">
              Partial payments and overdue balances — second payments first
            </div>
          </div>
        </div>
        {error ? null : !summary || summary.attentionList.length === 0 ? (
          <div className="text-[12px] text-gardens-txs">No outstanding invoices need attention.</div>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--g-bdr)' }}>
            {summary.attentionList.map((row) => {
              const { partial, overdue } = getAttentionFlags(row);
              const pct = computePercentPaid(row);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectInvoice(row)}
                  className="py-3 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 w-full text-left bg-transparent border-0 cursor-pointer"
                  style={{ fontFamily: 'var(--g-ff-body)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="text-[12px] text-gardens-tx"
                        style={{ fontFamily: 'ui-monospace, monospace' }}
                      >
                        {row.invoice_number}
                      </span>
                      <span className="text-[13px] font-semibold text-gardens-tx truncate">
                        {row.customer_name}
                      </span>
                      {partial && (
                        <Pill tone="amber" dot>
                          PARTIAL
                        </Pill>
                      )}
                      {overdue && (
                        <Pill tone="red" dot>
                          OVERDUE
                        </Pill>
                      )}
                    </div>
                    <div className="text-[11px] text-gardens-txs">
                      Due{' '}
                      {isReliableDueDate(row.due_date)
                        ? compactDate(row.due_date)
                        : 'No date'}
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col justify-center gap-1 min-w-0">
                    <div className="text-[10px] text-gardens-txs tabular-nums">{pct}% paid</div>
                    <PaymentProgressBar percent={pct} />
                  </div>
                  <div className="hidden md:block text-right min-w-0">
                    <div className="text-[10px] uppercase text-gardens-txs">Total</div>
                    <div className="text-[12px] text-gardens-tx tabular-nums">
                      {formatGbpDecimal(row.amount)}
                    </div>
                  </div>
                  <div className="hidden md:block text-right min-w-0">
                    <div className="text-[10px] uppercase text-gardens-txs">Paid</div>
                    <div className="text-[12px] text-gardens-tx tabular-nums">
                      {formatGbpPence(row.amount_paid)}
                    </div>
                  </div>
                  <div
                    className="font-head text-[15px] font-semibold text-gardens-tx tabular-nums text-right"
                    style={{ color: overdue ? 'var(--g-red-dk)' : undefined }}
                  >
                    {formatInvoiceRemaining(row)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card padded>
        <div className="mb-3">
          <h3 className="font-head text-[17px] font-semibold text-gardens-tx m-0">Due horizon</h3>
          <div className="text-[11.5px] text-gardens-txs">
            Click a segment to open the matching invoice list
          </div>
        </div>
        {error ? null : allHorizonZero ? (
          <div className="text-[12px] text-gardens-txs">No outstanding invoices in any horizon.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {HUB_HORIZON_SEGMENTS.map(({ key, label, summaryKey }) => {
              const seg = summary?.horizon[summaryKey];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onHorizonClick(key)}
                  disabled={!seg || seg.count === 0}
                  className="text-left p-3 rounded-lg border transition-colors"
                  style={{
                    borderColor: 'var(--g-bdr)',
                    background: 'var(--g-surf2)',
                    opacity: seg && seg.count > 0 ? 1 : 0.55,
                    cursor: seg && seg.count > 0 ? 'pointer' : 'default',
                  }}
                >
                  <div className="text-[11px] font-semibold text-gardens-txs mb-1">{label}</div>
                  <div className="font-head text-[22px] font-semibold text-gardens-tx">
                    {seg?.count ?? 0}
                  </div>
                  {seg && seg.balanceGbp > 0 && (
                    <div className="text-[11px] text-gardens-txm mt-1">
                      {currency(Math.round(seg.balanceGbp))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

const BalanceChaseTab: React.FC<{
  loading: boolean;
  rows: FinanceAtRiskOrder[];
  onOpenInvoicing: () => void;
}> = ({ loading, rows, onOpenInvoicing }) => (
  <Card padded>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="font-head text-[17px] font-semibold text-gardens-tx m-0">Balance-chase</h3>
        <div className="text-[11.5px] text-gardens-txs">
          Installs due in the next 21 days with an unpaid balance
        </div>
      </div>
      <Pill tone={rows.length > 0 ? 'red' : 'green'} dot>
        {rows.length} at risk
      </Pill>
    </div>
    {loading ? (
      <div className="text-[12px] text-gardens-txs">Loading…</div>
    ) : rows.length === 0 ? (
      <div className="text-[12px] text-gardens-txs">
        All upcoming installs are paid up. Nothing to chase.
      </div>
    ) : (
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--g-bdr)' }}>
        {rows.map((r) => {
          const urgent = r.daysToInstall != null && r.daysToInstall <= 7;
          return (
            <div key={r.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13.5px] font-semibold text-gardens-tx truncate">
                    {r.customerName}
                  </span>
                  <span
                    className="text-[10.5px] text-gardens-txm"
                    style={{ fontFamily: 'ui-monospace, monospace' }}
                  >
                    OR-{r.orderNumber ?? '—'}
                  </span>
                </div>
                <div className="text-[11px] text-gardens-txs">
                  Installs {compactDate(r.installDate)} · paid {currency(r.amountPaid)} of{' '}
                  {currency(r.totalValue)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="font-head text-[15px] font-semibold text-gardens-tx">
                  {currency(r.balanceDue)}
                </div>
                {urgent ? (
                  <Pill tone="red" dot>
                    {r.daysToInstall}d to install
                  </Pill>
                ) : (
                  <span className="text-[10.5px] text-gardens-txs">
                    {r.daysToInstall}d to install
                  </span>
                )}
              </div>
              <Btn variant="secondary" size="sm" onClick={onOpenInvoicing}>
                Chase
              </Btn>
            </div>
          );
        })}
      </div>
    )}
  </Card>
);

const EXTRA_TYPE_LABEL: Record<string, string> = {
  photo_plaque: 'Photo plaque',
  inscription_increase: 'Inscription extension',
  colour_change: 'Colour upgrade',
  vase: 'Vase',
  other: 'Other',
};

const CONFIDENCE_TONE: Record<OrderExtra['confidence'], 'green' | 'amber' | 'neutral'> = {
  high: 'green',
  medium: 'amber',
  low: 'neutral',
};

const ExtrasTab: React.FC<{
  loading: boolean;
  rows: OrderExtra[];
  onOpenInvoicing: () => void;
}> = ({ loading, rows, onOpenInvoicing }) => (
  <Card padded>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <AIBadge label="AI-DETECTED" size="sm" variant="ghost" />
        <div>
          <h3 className="font-head text-[17px] font-semibold text-gardens-tx m-0">
            Changes since quote
          </h3>
          <div className="text-[11.5px] text-gardens-txs">
            Add-ons and upgrades spotted in customer messages that aren't on an invoice yet
          </div>
        </div>
      </div>
      <Pill tone={rows.length > 0 ? 'accent' : 'green'} dot>
        {rows.length} pending
      </Pill>
    </div>
    {loading ? (
      <div className="text-[12px] text-gardens-txs">Loading…</div>
    ) : rows.length === 0 ? (
      <div className="text-[12px] text-gardens-txs">
        Nothing detected. Mason is watching inbound messages for price-relevant changes.
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {rows.map((extra) => (
          <div
            key={extra.id}
            className="p-3 flex flex-col gap-2"
            style={{ background: 'var(--g-surf2)', border: '1px solid var(--g-bdr)', borderRadius: 8 }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold text-gardens-tx">
                {extra.orders?.customer_name ?? 'Unknown customer'}
              </span>
              <span
                className="text-[10.5px] text-gardens-txm"
                style={{ fontFamily: 'ui-monospace, monospace' }}
              >
                OR-{extra.orders?.order_number ?? '—'}
              </span>
              <Pill tone={CONFIDENCE_TONE[extra.confidence]} dot>
                {extra.confidence} confidence
              </Pill>
              <Pill tone="neutral">
                {extra.change_type ? EXTRA_TYPE_LABEL[extra.change_type] ?? extra.change_type : 'Change'}
              </Pill>
              <div className="flex-1" />
              {extra.suggested_amount != null && (
                <span className="font-head text-[15px] font-semibold text-gardens-tx">
                  +{currency(extra.suggested_amount)}
                </span>
              )}
            </div>
            <div className="text-[12.5px] text-gardens-tx leading-snug">{extra.description}</div>
            {extra.quote_snippet && (
              <div
                className="text-[11.5px] text-gardens-txs italic border-l-2 pl-2"
                style={{ borderColor: 'var(--g-acc)' }}
              >
                "{extra.quote_snippet}"
                {extra.quote_sender && (
                  <span className="not-italic text-gardens-txm"> — {extra.quote_sender}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Btn
                variant="primary"
                size="sm"
                icon={<Icon name="plus" size={12} stroke={2} />}
                onClick={onOpenInvoicing}
              >
                Add to invoice
              </Btn>
              <Btn variant="ghost" size="sm">
                Dismiss
              </Btn>
              <span className="text-[10.5px] text-gardens-txm italic ml-auto">
                via {extra.source} · {compactDate(extra.detected_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);

const PAYMENT_STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  matched: 'green',
  pass_through: 'green',
  unmatched: 'amber',
  dismissed: 'neutral',
};

const INVOICE_STATUS_PILL_TONE: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  paid: 'green',
  pending: 'amber',
  overdue: 'red',
  draft: 'neutral',
  cancelled: 'neutral',
};

const INVOICE_FILTER_OPTIONS: { value: FinanceInvoiceStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

const INVOICE_EMPTY_MESSAGE: Record<FinanceInvoiceStatusFilter, string> = {
  all: 'No invoices yet.',
  unpaid: 'No unpaid invoices.',
  overdue: 'No overdue invoices.',
  paid: 'No paid invoices.',
};

function formatPaidColumn(amountPaid: number | null): string {
  const pence = amountPaid ?? 0;
  if (pence <= 0) return '—';
  return formatGbpPence(pence);
}

// Slim read-only tab superseded by InvoiceWorkspace 2026-07-19 — kept unused per the
// SHOW_SECONDARY_FINANCE_TABS flag pattern above; restore by swapping it back into the
// `tab === 'invoices'` branch.
const InvoicesTab: React.FC<{
  loading: boolean;
  error: boolean;
  rows: FinanceInvoiceRow[];
  statusFilter: FinanceInvoiceStatusFilter;
  horizonFilter: FinanceInvoiceHorizonFilter | null;
  onStatusFilterChange: (f: FinanceInvoiceStatusFilter) => void;
  onRetry: () => void;
  onSelectRow: (row: FinanceInvoiceRow) => void;
}> = ({
  loading,
  error,
  rows,
  statusFilter,
  horizonFilter,
  onStatusFilterChange,
  onRetry,
  onSelectRow,
}) => {
  const displayRows =
    horizonFilter != null
      ? rows.filter(
          (row) =>
            isHubEligibleInvoice(row) &&
            getInvoiceHorizonBucket(row) === horizonFilter,
        )
      : rows;

  return (
  <Card padded>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="font-head text-[17px] font-semibold text-gardens-tx m-0">Invoices</h3>
        <div className="text-[11.5px] text-gardens-txs">
          All invoices for your organisation, oldest due first
        </div>
      </div>
    </div>

    <div className="flex flex-wrap gap-2 mb-4">
      {INVOICE_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onStatusFilterChange(opt.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--g-ff-body)',
            cursor: 'pointer',
            border: '1px solid var(--g-bdr)',
            background: statusFilter === opt.value ? 'var(--g-acc)' : 'var(--g-surf2)',
            color: statusFilter === opt.value ? '#fff' : 'var(--g-txs)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>

    {loading ? (
      <div className="text-[12px] text-gardens-txs">Loading…</div>
    ) : error ? (
      <div className="flex flex-col gap-2">
        <div className="text-[12px] text-gardens-red-dk">Could not load invoices.</div>
        <Btn variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Btn>
      </div>
    ) : displayRows.length === 0 ? (
      <div className="text-[12px] text-gardens-txs">
        {horizonFilter
          ? 'No invoices match this horizon filter.'
          : INVOICE_EMPTY_MESSAGE[statusFilter]}
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 720 }}>
          <thead>
            <tr className="text-left text-[10.5px] font-semibold text-gardens-txs uppercase tracking-wide border-b" style={{ borderColor: 'var(--g-bdr)' }}>
              <th className="py-2 pr-3">Invoice #</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Issued</th>
              <th className="py-2 pr-3">Due</th>
              <th className="py-2 pr-3 text-right">Total</th>
              <th className="py-2 pr-3 text-right">Paid</th>
              <th className="py-2 pr-3 text-right">Remaining</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const displayStatus = getDisplayStatus(row);
              const overdue = isInvoiceOverdue(row);
              const sent = !!row.hosted_invoice_url?.trim();
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectRow(row)}
                  className="border-b cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--g-bdr)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--g-surf2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td className="py-2.5 pr-3 text-[12px] text-gardens-tx" style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {row.invoice_number}
                  </td>
                  <td className="py-2.5 pr-3 text-[12.5px] font-medium text-gardens-tx max-w-[140px] truncate">
                    {row.customer_name}
                  </td>
                  <td className="py-2.5 pr-3 text-[12px] text-gardens-txs">{compactDate(row.issue_date)}</td>
                  <td
                    className="py-2.5 pr-3 text-[12px]"
                    style={{ color: overdue ? 'var(--g-red-dk)' : 'var(--g-txs)' }}
                  >
                    {compactDate(row.due_date)}
                  </td>
                  <td className="py-2.5 pr-3 text-[12.5px] font-semibold text-gardens-tx text-right tabular-nums">
                    {formatGbpDecimal(row.amount)}
                  </td>
                  <td className="py-2.5 pr-3 text-[12px] text-gardens-txs text-right tabular-nums">
                    {formatPaidColumn(row.amount_paid)}
                  </td>
                  <td
                    className="py-2.5 pr-3 text-[12.5px] font-semibold text-right tabular-nums"
                    style={{ color: overdue ? 'var(--g-red-dk)' : 'var(--g-tx)' }}
                  >
                    {formatInvoiceRemaining(row, { zeroDisplay: 'gbp' })}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Pill tone={INVOICE_STATUS_PILL_TONE[displayStatus] ?? 'neutral'} dot>
                      {displayStatus}
                    </Pill>
                  </td>
                  <td className="py-2.5 text-center">
                    {sent && (
                      <span
                        title="Payment link sent"
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--g-grn)',
                        }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </Card>
  );
};

const InvoiceDrawer: React.FC<{
  invoice: FinanceInvoiceRow;
  onClose: () => void;
}> = ({ invoice, onClose }) => {
  const navigate = useNavigate();
  const { data: linkedOrders, isLoading: ordersLoading } = useOrdersByInvoice(invoice.id);
  const displayStatus = getDisplayStatus(invoice);
  const overdue = isInvoiceOverdue(invoice);
  const percentPaid = computePercentPaid(invoice);
  const showStripe = hasStripeSection(invoice);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const progressColor =
    displayStatus === 'paid' ? 'var(--g-grn)' : overdue ? 'var(--g-red-dk)' : 'var(--g-acc)';

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 z-50 h-full flex flex-col shadow-2xl overflow-y-auto"
        style={{
          width: 'min(420px, 100vw)',
          background: 'var(--g-surf)',
          borderLeft: '1px solid var(--g-bdr)',
        }}
        role="dialog"
        aria-labelledby="invoice-drawer-title"
      >
        <header
          className="flex items-start justify-between gap-3 p-4 border-b shrink-0"
          style={{ borderColor: 'var(--g-bdr)' }}
        >
          <div className="min-w-0">
            <h2
              id="invoice-drawer-title"
              className="font-head text-[17px] font-semibold text-gardens-tx m-0"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              {invoice.invoice_number}
            </h2>
            <p className="text-[13px] text-gardens-tx mt-1 truncate">{invoice.customer_name}</p>
            <div className="mt-2">
              <Pill tone={INVOICE_STATUS_PILL_TONE[displayStatus] ?? 'neutral'} dot>
                {displayStatus}
              </Pill>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-2 rounded-md"
            style={{ color: 'var(--g-txs)' }}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="p-4 flex flex-col gap-5">
          <section>
            <div className="text-[11px] font-semibold text-gardens-txs mb-2">Payment progress</div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--g-surf2)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${percentPaid}%`, background: progressColor }}
              />
            </div>
            <div className="text-[11px] text-gardens-txm mt-1">{percentPaid}% paid</div>
          </section>

          <section>
            <div className="text-[11px] font-semibold text-gardens-txs mb-2">Invoice total</div>
            <DrawerRow label="Total" value={formatGbpDecimal(invoice.amount)} />
            <DrawerRow label="Paid" value={formatPaidColumn(invoice.amount_paid)} />
            <DrawerRow
              label="Remaining"
              value={formatInvoiceRemaining(invoice, { zeroDisplay: 'gbp' })}
              valueStyle={overdue ? { color: 'var(--g-red-dk)' } : undefined}
            />
          </section>

          {linkedOrders && linkedOrders.length > 0 && (
            <section>
              <div className="text-[11px] font-semibold text-gardens-txs mb-2">Cost breakdown</div>
              {linkedOrders.map((order, index) => {
                const productLineLabel =
                  order.order_type === 'Renovation' ? 'Renovation' : 'Main product';
                const permitCost = getOrderPermitCost(order);
                const optionsTotal = getOrderAdditionalOptionsTotal(order);
                return (
                  <React.Fragment key={order.id}>
                    {index > 0 && (
                      <div className="border-t my-3" style={{ borderColor: 'var(--g-bdr)' }} />
                    )}
                    <div className="text-[11px] font-semibold uppercase text-gardens-txs mb-2">
                      {getOrderDisplayId(order)} — {orderLineLabel(order)}
                    </div>
                    <DrawerRow
                      label={productLineLabel}
                      value={formatGbpDecimal(getOrderBaseValue(order))}
                    />
                    {permitCost > 0 && (
                      <DrawerRow label="Permit" value={formatGbpDecimal(permitCost)} />
                    )}
                    {optionsTotal > 0 && (
                      <DrawerRow
                        label="Additional options"
                        value={formatGbpDecimal(optionsTotal)}
                      />
                    )}
                    <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--g-bdr)' }}>
                      <DrawerRow
                        label="Order total"
                        value={formatGbpDecimal(getOrderTotal(order))}
                        valueStyle={{ fontWeight: 600 }}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
            </section>
          )}

          <section>
            <div className="text-[11px] font-semibold text-gardens-txs mb-2">Dates</div>
            <DrawerRow label="Issued" value={compactDate(invoice.issue_date)} />
            <DrawerRow
              label="Due"
              value={compactDate(invoice.due_date)}
              valueStyle={overdue ? { color: 'var(--g-red-dk)' } : undefined}
            />
          </section>

          <section>
            <div className="text-[11px] font-semibold text-gardens-txs mb-2">Orders</div>
            {ordersLoading ? (
              <p className="text-[12px] text-gardens-txs">Loading orders…</p>
            ) : !linkedOrders || linkedOrders.length === 0 ? (
              <p className="text-[12px] text-gardens-txs">No orders for this invoice</p>
            ) : (
              <div className="flex flex-col gap-2">
                {linkedOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      navigate(`/dashboard/orders?order=${order.id}`);
                      onClose();
                    }}
                    className="border border-gardens-bdr rounded-md p-3 w-full text-left hover:bg-gardens-page transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gardens-tx">{order.customer_name}</div>
                        <div className="text-[12px] text-gardens-txs">{order.order_type}</div>
                      </div>
                      <div className="text-[12.5px] font-medium text-gardens-tx shrink-0">
                        {getOrderTotalFormatted(order)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {showStripe && (
            <section>
              <div className="text-[11px] font-semibold text-gardens-txs mb-2">Stripe</div>
              {invoice.stripe_invoice_status && (
                <DrawerRow label="Status" value={invoice.stripe_invoice_status} />
              )}
              {invoice.hosted_invoice_url && (
                <DrawerRow
                  label="Payment link"
                  value={
                    <a
                      href={invoice.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] underline"
                      style={{ color: 'var(--g-acc)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open in new tab
                    </a>
                  }
                />
              )}
              {invoice.locked_at && (
                <DrawerRow label="Locked at" value={compactDate(invoice.locked_at.slice(0, 10))} />
              )}
            </section>
          )}
        </div>
      </aside>
    </>
  );
};

const DrawerRow: React.FC<{
  label: string;
  value: React.ReactNode;
  valueStyle?: React.CSSProperties;
}> = ({ label, value, valueStyle }) => (
  <div className="flex items-center justify-between gap-2 py-1.5 text-[12.5px]">
    <span className="text-gardens-txs">{label}</span>
    <span className="font-medium text-gardens-tx text-right" style={valueStyle}>
      {value}
    </span>
  </div>
);

const PaymentsTab: React.FC<{
  loading: boolean;
  rows: FinanceRecentPayment[];
  onOpenPayments: () => void;
}> = ({ loading, rows, onOpenPayments }) => (
  <Card padded>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="font-head text-[17px] font-semibold text-gardens-tx m-0">
          Recent payments
        </h3>
        <div className="text-[11.5px] text-gardens-txs">
          Stripe + Revolut receipts, newest first
        </div>
      </div>
      <Btn variant="ghost" size="sm" icon={<Icon name="arrowRight" size={12} />} onClick={onOpenPayments}>
        Open reconciliation
      </Btn>
    </div>
    {loading ? (
      <div className="text-[12px] text-gardens-txs">Loading…</div>
    ) : rows.length === 0 ? (
      <div className="text-[12px] text-gardens-txs">No payments yet.</div>
    ) : (
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--g-bdr)' }}>
        {rows.map((p) => (
          <div key={p.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[13px] font-semibold text-gardens-tx truncate">
                  {p.customerName ?? 'Unlinked payment'}
                </span>
                {p.orderNumber && (
                  <span
                    className="text-[10.5px] text-gardens-txm"
                    style={{ fontFamily: 'ui-monospace, monospace' }}
                  >
                    OR-{p.orderNumber}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gardens-txs flex items-center gap-2">
                <span>{p.source}</span>
                <span>·</span>
                <span>{compactDate(p.receivedAt)}</span>
                {p.paymentType && (
                  <>
                    <span>·</span>
                    <span>{p.paymentType}</span>
                  </>
                )}
                <Pill tone={PAYMENT_STATUS_TONE[p.status] ?? 'neutral'}>
                  {p.status.replace(/_/g, ' ')}
                </Pill>
              </div>
            </div>
            <div className="font-head text-[15px] font-semibold text-gardens-tx">
              {currency(p.amount)}
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);
