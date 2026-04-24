import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Pill,
  AIBadge,
  AISuggestion,
  Btn,
  Icon,
} from '@/shared/components/gardens';
import {
  useHubSummary,
  useHubPipeline,
  useHubKpis,
  useHubAtRisk,
  useHubRecentPayments,
} from '../hooks/useHub';
import type { DerivedOrderStage, HubAtRiskOrder, HubRecentPayment } from '../api/hub.api';

const STAGE_ROUTE: Record<DerivedOrderStage, string> = {
  design: '/dashboard/orders',
  proof: '/dashboard/proofs',
  lettering: '/dashboard/orders',
  permit: '/dashboard/permit-tracker',
  install_ready: '/dashboard/jobs',
};

const STAGE_ICON: Record<DerivedOrderStage, string> = {
  design: 'inscription',
  proof: 'doc',
  lettering: 'inscription',
  permit: 'stamp',
  install_ready: 'stone',
};

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

const compactDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const HubPage: React.FC = () => {
  const navigate = useNavigate();
  const summary = useHubSummary();
  const pipeline = useHubPipeline();
  const kpis = useHubKpis();
  const atRisk = useHubAtRisk();
  const recent = useHubRecentPayments();

  return (
    <div className="flex flex-col gap-4">
      {/* AI headline — at-risk balances if any */}
      {atRisk.data && atRisk.data.length > 0 && (
        <AISuggestion
          prominent
          title={`${atRisk.data.length} installation${atRisk.data.length === 1 ? '' : 's'} with outstanding balance`}
          body="Installs booked in the next 3 weeks where the balance invoice hasn't cleared. Chase now so the stone doesn't leave the yard unpaid."
          actions={
            <>
              <Btn variant="ai" size="sm" icon={<Icon name="arrowRight" size={12} />} onClick={() => navigate('/dashboard/invoicing')}>
                Review in Finance
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => navigate('/dashboard/payments')}>
                See payment reconciliation
              </Btn>
            </>
          }
        />
      )}

      {/* Header row */}
      <div className="flex items-baseline gap-3">
        <h2 className="font-head text-[15px] font-semibold text-gardens-tx">Business pulse</h2>
        <span className="text-[11.5px] text-gardens-txs">live snapshot</span>
      </div>

      {/* KPIs */}
      <KpiStrip />

      {/* Pipeline */}
      <Card padded>
        <div className="flex items-baseline justify-between mb-3 gap-3">
          <div className="flex items-baseline gap-3">
            <h3 className="font-head text-[15px] font-semibold text-gardens-tx m-0">Pipeline</h3>
            <span className="text-[11.5px] text-gardens-txs">
              Open orders, earliest bottleneck stage
            </span>
          </div>
          <Btn variant="ghost" size="sm" icon={<Icon name="arrowRight" size={11} />} onClick={() => navigate('/dashboard/orders')}>
            Open orders list
          </Btn>
        </div>
        {pipeline.isLoading ? (
          <PlaceholderStrip />
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {(pipeline.data ?? []).map((s) => (
              <button
                key={s.stage}
                onClick={() => navigate(STAGE_ROUTE[s.stage])}
                className="text-left"
                style={{
                  background: 'var(--g-surf2)',
                  border: '1px solid var(--g-bdr)',
                  borderRadius: 8,
                  padding: 12,
                  cursor: 'pointer',
                  transition: 'border-color .12s, background .12s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--g-acc)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--g-bdr)';
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center justify-center"
                    style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--g-page)', color: 'var(--g-txm)' }}
                  >
                    <Icon name={STAGE_ICON[s.stage]} size={11} />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gardens-txm">
                    {s.label}
                  </span>
                </div>
                <div className="font-head text-[28px] font-semibold text-gardens-tx leading-none">
                  {s.count}
                </div>
                <div className="mt-2 text-[11px] text-gardens-txs min-h-[18px] truncate">
                  {s.sampleCustomers.length ? s.sampleCustomers.join(' · ') : 'Nothing here'}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Summary tiles */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Open orders" value={summary.data?.totalOpen ?? '—'} icon="sum" />
        <SummaryTile
          label="Ready for install"
          value={summary.data?.readyForInstall ?? '—'}
          icon="stone"
          tone="green"
        />
        <SummaryTile label="Overdue" value={summary.data?.overdue ?? '—'} icon="alert" tone="red" />
        <SummaryTile
          label="Pending approval"
          value={summary.data?.pendingApproval ?? '—'}
          icon="clock"
          tone="amber"
        />
      </div>

      {/* Two-column: at-risk + recent payments */}
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        <AtRiskCard rows={atRisk.data ?? []} loading={atRisk.isLoading} />
        <RecentPaymentsCard rows={recent.data ?? []} loading={recent.isLoading} />
      </div>

      <div className="flex items-center gap-2 text-[11px] text-gardens-txm">
        <AIBadge label="HUB · LIVE" size="sm" variant="ghost" />
        <span>
          Counts derived from open orders, invoices and payments. Install-ready requires stone in
          stock · permit approved · proof lettered.
        </span>
      </div>
    </div>
  );
};

const KpiStrip: React.FC = () => {
  const kpis = useHubKpis();
  const data = kpis.data;
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Jobs open" value={data ? String(data.jobsOpen) : '—'} sub="active orders" icon="sum" />
      <KpiCard
        label="Avg job value"
        value={data ? currency(Math.round(data.avgJobValue)) : '—'}
        sub="open orders"
        icon="coins"
      />
      <KpiCard
        label="Outstanding"
        value={data ? currency(Math.round(data.outstandingBalance)) : '—'}
        sub="across unpaid orders"
        icon="coins"
        emphasis={data && data.outstandingBalance > 0 ? 'warn' : undefined}
      />
      <KpiCard
        label="Collected this month"
        value={data ? currency(Math.round(data.collectedThisMonth)) : '—'}
        sub="invoice payments"
        icon="check"
      />
    </div>
  );
};

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  icon: string;
  emphasis?: 'warn';
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, emphasis }) => (
  <Card padded style={{ padding: 16 }}>
    <div className="flex items-center gap-2 mb-3">
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: 'var(--g-surf2)',
          color: emphasis === 'warn' ? 'var(--g-acc)' : 'var(--g-txm)',
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

interface SummaryTileProps {
  label: string;
  value: number | string;
  icon: string;
  tone?: 'green' | 'red' | 'amber';
}

const TONE_BG: Record<NonNullable<SummaryTileProps['tone']>, string> = {
  green: 'var(--g-grn-lt)',
  red: 'var(--g-red-lt)',
  amber: 'var(--g-amb-lt)',
};
const TONE_FG: Record<NonNullable<SummaryTileProps['tone']>, string> = {
  green: 'var(--g-grn-dk)',
  red: 'var(--g-red-dk)',
  amber: 'var(--g-amb-dk)',
};

const SummaryTile: React.FC<SummaryTileProps> = ({ label, value, icon, tone }) => (
  <Card padded style={{ padding: 16 }}>
    <div className="flex items-center justify-between">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gardens-txm">
        {label}
      </div>
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: tone ? TONE_BG[tone] : 'var(--g-surf2)',
          color: tone ? TONE_FG[tone] : 'var(--g-txm)',
        }}
      >
        <Icon name={icon} size={11} />
      </span>
    </div>
    <div className="font-head text-[30px] font-semibold text-gardens-tx leading-none mt-3 tracking-[-0.02em]">
      {value}
    </div>
  </Card>
);

const PlaceholderStrip: React.FC = () => (
  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className="animate-pulse"
        style={{
          height: 86,
          borderRadius: 8,
          background: 'var(--g-surf2)',
          border: '1px solid var(--g-bdr)',
        }}
      />
    ))}
  </div>
);

const AtRiskCard: React.FC<{ rows: HubAtRiskOrder[]; loading: boolean }> = ({ rows, loading }) => (
  <Card padded>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="font-head text-[15px] font-semibold text-gardens-tx m-0">Balance-chase</h3>
        <div className="text-[11.5px] text-gardens-txs">Installs due ≤ 21d with unpaid balance</div>
      </div>
      <Pill tone={rows.length > 0 ? 'red' : 'green'} dot>
        {rows.length} at risk
      </Pill>
    </div>
    {loading ? (
      <div className="text-[12px] text-gardens-txs">Loading…</div>
    ) : rows.length === 0 ? (
      <div className="text-[12px] text-gardens-txs">All upcoming installs are paid up.</div>
    ) : (
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--g-bdr)' }}>
        {rows.map((r) => (
          <div key={r.id} className="py-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-gardens-tx truncate">
                {r.customerName}
              </div>
              <div className="text-[11px] text-gardens-txs font-mono">
                OR-{r.orderNumber ?? '—'} · installs {compactDate(r.installDate)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-head text-[14px] font-semibold text-gardens-tx">
                {currency(r.balanceDue)}
              </div>
              <div className="text-[10.5px] text-gardens-txs">
                {r.daysToInstall != null && r.daysToInstall <= 7 ? (
                  <Pill tone="red" dot>
                    {r.daysToInstall}d to install
                  </Pill>
                ) : (
                  <span>{r.daysToInstall}d to install</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);

const RecentPaymentsCard: React.FC<{ rows: HubRecentPayment[]; loading: boolean }> = ({
  rows,
  loading,
}) => (
  <Card padded>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="font-head text-[15px] font-semibold text-gardens-tx m-0">Recent payments</h3>
        <div className="text-[11.5px] text-gardens-txs">Latest matched receipts</div>
      </div>
      <Pill tone="green">Live</Pill>
    </div>
    {loading ? (
      <div className="text-[12px] text-gardens-txs">Loading…</div>
    ) : rows.length === 0 ? (
      <div className="text-[12px] text-gardens-txs">No payments yet.</div>
    ) : (
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--g-bdr)' }}>
        {rows.map((p) => (
          <div key={p.id} className="py-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-gardens-tx truncate">
                {p.customerName ?? 'Unlinked payment'}
              </div>
              <div className="text-[11px] text-gardens-txs font-mono">
                {p.orderNumber ? `OR-${p.orderNumber} · ` : ''}
                {p.source} · {compactDate(p.receivedAt)}
                {p.paymentType ? ` · ${p.paymentType}` : ''}
              </div>
            </div>
            <div className="font-head text-[14px] font-semibold text-gardens-tx">
              {currency(p.amount)}
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);
