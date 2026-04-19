import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Pill, Btn, Icon, AIBadge, AISuggestion } from '@/shared/components/gardens';
import {
  useFinanceTotals,
  useFinanceAtRisk,
  useFinanceRecentPayments,
} from '../hooks/useFinance';
import { useOrderExtrasList } from '@/modules/payments/hooks/useOrderExtras';
import type { OrderExtra } from '@/modules/payments/types/reconciliation.types';
import type { FinanceAtRiskOrder, FinanceRecentPayment } from '../api/finance.api';

type Tab = 'balance-chase' | 'extras' | 'payments';

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

const compactDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const FinancePage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('balance-chase');
  const navigate = useNavigate();
  const totals = useFinanceTotals();
  const atRisk = useFinanceAtRisk();
  const payments = useFinanceRecentPayments();
  const extras = useOrderExtrasList('pending');

  return (
    <div className="flex flex-col gap-4">
      {/* Totals ribbon */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <TotalTile
          label="Outstanding"
          value={totals.data ? currency(Math.round(totals.data.outstandingBalance)) : '—'}
          sub="across unpaid orders"
          icon="coins"
          emphasis={
            totals.data && totals.data.outstandingBalance > 0 ? 'warn' : undefined
          }
        />
        <TotalTile
          label="Collected this month"
          value={totals.data ? currency(Math.round(totals.data.collectedThisMonth)) : '—'}
          sub="invoice payments"
          icon="check"
          emphasis="good"
        />
        <TotalTile
          label="Expected this month"
          value={totals.data ? currency(Math.round(totals.data.expectedThisMonth)) : '—'}
          sub="balance due on installs"
          icon="clock"
        />
        <TotalTile
          label="Overdue invoices"
          value={totals.data ? String(totals.data.overdueInvoices) : '—'}
          sub={totals.data ? currency(Math.round(totals.data.overdueValue)) + ' owed' : '—'}
          icon="alert"
          emphasis={totals.data && totals.data.overdueInvoices > 0 ? 'warn' : undefined}
        />
      </div>

      {/* AI banner — AI-detected order extras */}
      {extras.data && extras.data.length > 0 && (
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
      <div className="flex items-center gap-1 border-b border-gardens-bdr">
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
      </div>

      {tab === 'balance-chase' && (
        <BalanceChaseTab
          loading={atRisk.isLoading}
          rows={atRisk.data ?? []}
          onOpenInvoicing={() => navigate('/dashboard/invoicing')}
        />
      )}

      {tab === 'extras' && (
        <ExtrasTab
          loading={extras.isLoading}
          rows={extras.data ?? []}
          onOpenInvoicing={() => navigate('/dashboard/invoicing')}
        />
      )}

      {tab === 'payments' && (
        <PaymentsTab
          loading={payments.isLoading}
          rows={payments.data ?? []}
          onOpenPayments={() => navigate('/dashboard/payments')}
        />
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
  icon: string;
  emphasis?: 'warn' | 'good';
}

const EMPHASIS_BG: Record<'warn' | 'good', string> = {
  warn: 'var(--g-amb-lt)',
  good: 'var(--g-grn-lt)',
};
const EMPHASIS_FG: Record<'warn' | 'good', string> = {
  warn: 'var(--g-acc)',
  good: 'var(--g-grn-dk)',
};

const TotalTile: React.FC<TotalTileProps> = ({ label, value, sub, icon, emphasis }) => (
  <Card padded style={{ padding: 16 }}>
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
    <div className="mt-2 text-[11px] text-gardens-txm italic truncate">{sub}</div>
  </Card>
);

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
