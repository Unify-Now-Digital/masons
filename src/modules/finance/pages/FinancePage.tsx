import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn } from '@/shared/components/gardens';
import { useFinanceTotals } from '../hooks/useFinance';
import { InvoiceWorkspace, useInvoicesList } from '@/modules/invoicing';
import {
  buildFinanceSummary,
  isVoidedStripeInvoice,
  type TileFilter,
} from '../utils/invoiceRemaining';

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

// C4c: chip labels, All first — rendered by InvoiceWorkspace's toolbar (counts computed here).
const FILTER_CHIPS: { key: TileFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'd7', label: '≤7d' },
  { key: 'd7to30', label: '7–30d' },
  { key: 'd30plus', label: '30+' },
  { key: 'notYetDue', label: 'Not yet due' },
];

export const FinancePage: React.FC = () => {
  // C2 merge (FR-001): one flow — summary ribbon → aging tiles (the ONLY list filter,
  // FR-002) → invoice table. ?invoice=/?focus= deep-links need no tab routing any more:
  // InvoiceWorkspace is always mounted and consumes them via its own URL effects (FR-005).
  const [activeTile, setActiveTile] = useState<TileFilter>('all');
  // C4b (FR-010): page-local, not persisted; owned here so the working set changes
  // BEFORE bucketing (spec A-1) — tiles and table stay on one identical set.
  const [showVoidedInvoices, setShowVoidedInvoices] = useState(false);
  const navigate = useNavigate();
  const totals = useFinanceTotals();
  const invoicesQuery = useInvoicesList();

  // Working set: void invoices (display status 'void' — isVoidedStripeInvoice and not
  // status='paid', invoiceTransform.ts:69-75; same predicate as the FR-018 badge and the
  // row dim) hidden unless the toggle reveals them, applied BEFORE bucketing (spec A-1).
  // Zero tile/ribbon effect — void rows are hub-ineligible and never bucket — but tiles
  // and table stay on one set. Enquiry INV-WEB- predicate retired 2026-09-02: closed set
  // of 4 rows, all void; the website enquiry flow now creates Pipeline jobs, not invoices.
  const workingSet = useMemo(() => {
    const rows = invoicesQuery.data ?? [];
    if (showVoidedInvoices) return rows;
    return rows.filter((row) => !(isVoidedStripeInvoice(row) && row.status !== 'paid'));
  }, [invoicesQuery.data, showVoidedInvoices]);

  // Ribbon values + tile aggregates, re-fed from the unified row set with semantics
  // preserved from the retired Hub summary (quickstart step-0 ribbon baseline).
  const summary = useMemo(
    () => (invoicesQuery.data ? buildFinanceSummary(workingSet, new Date()) : undefined),
    [invoicesQuery.data, workingSet],
  );

  // C4c: chip data — single source for counts; the workspace renders chips, never computes.
  const tiles = useMemo(
    () => ({
      items: FILTER_CHIPS.map(({ key, label }) => ({
        key,
        label,
        count: key === 'all' ? workingSet.length : summary?.buckets[key]?.count ?? 0,
        totalPence: key === 'all' ? 0 : summary?.buckets[key]?.totalPence ?? 0,
      })),
      allZero: summary?.allZero ?? false,
    }),
    [workingSet.length, summary],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Stat strip (C4c) — five stats, one row, no card chrome. Values/semantics
          unchanged; Total order balance keeps its Orders navigate. */}
      <div className="flex flex-wrap items-stretch">
        <StatItem
          first
          label="Total order balance"
          value={totals.data ? currency(Math.round(totals.data.outstandingBalance)) : '—'}
          caption="across unpaid orders"
          onClick={() => navigate('/dashboard/orders')}
        />
        <StatItem
          label="Invoiced & unpaid"
          value={summary ? currency(Math.round(summary.invoicedUnpaidGbp)) : '—'}
          caption="invoice balances owed"
        />
        <StatItem
          label="Collected this month"
          value={totals.data ? currency(Math.round(totals.data.collectedThisMonth)) : '—'}
          caption="invoice payments"
        />
        <StatItem
          label="Expected this month"
          value={totals.data ? currency(Math.round(totals.data.expectedThisMonth)) : '—'}
          caption="balance due on installs"
        />
        <StatItem
          label="Overdue"
          value={summary ? currency(Math.round(summary.overdueGbp)) : '—'}
          valueColor={summary && summary.overdueCount > 0 ? 'var(--g-acc)' : undefined}
          caption={
            summary
              ? `${summary.overdueCount} invoice${summary.overdueCount === 1 ? '' : 's'} · balance past due date`
              : 'balance past due date'
          }
        />
      </div>

      {/* FR-014 / SC-002 invariant: InvoiceWorkspace is mounted exactly ONCE, below, and is
          never given a `key` — tile changes arrive as the activeTile prop and the table
          filters in memory. The two gates above it are initial-fetch-only: isLoading is
          true only before first data; the error branch additionally requires data-absent,
          so a failed background refetch keeps the workspace mounted on stale data. No
          filter state ever unmounts it. */}
      {invoicesQuery.isLoading ? (
        <Card padded>
          <div className="text-[12px] text-gardens-txs">Loading invoices…</div>
        </Card>
      ) : invoicesQuery.isError && !invoicesQuery.data ? (
        <Card padded>
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-gardens-red-dk">Could not load invoices.</div>
            <Btn variant="secondary" size="sm" onClick={() => invoicesQuery.refetch()}>
              Retry
            </Btn>
          </div>
        </Card>
      ) : (
        <InvoiceWorkspace
          invoices={workingSet}
          activeTile={activeTile}
          tiles={tiles}
          onActiveTileChange={(key) => setActiveTile((cur) => (cur === key && key !== 'all' ? 'all' : key))}
          showVoidedInvoices={showVoidedInvoices}
          onShowVoidedInvoicesChange={setShowVoidedInvoices}
        />
      )}
    </div>
  );
};

// C4c stat-strip item — replaces the ribbon cards. Small muted label over a large
// value, optional caption below; thin border-l dividers between items.
interface StatItemProps {
  label: string;
  value: string;
  caption?: string;
  /** Value-only colour override (e.g. warn on Overdue when count > 0). */
  valueColor?: string;
  onClick?: () => void;
  first?: boolean;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, caption, valueColor, onClick, first }) => {
  const inner = (
    <>
      <div className="text-[11px] font-semibold text-gardens-txs">{label}</div>
      <div
        className="font-head text-[22px] font-semibold text-gardens-tx leading-tight"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {caption && <div className="text-[11px] text-gardens-txm">{caption}</div>}
    </>
  );
  const cls = `flex-1 min-w-[150px] px-4 py-2 text-left${first ? ' pl-0' : ''}`;
  const style = first ? undefined : { borderLeft: '1px solid var(--g-bdr)' };
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${cls} rounded-md transition-colors hover:bg-gardens-surf2`}
      style={style}
    >
      {inner}
    </button>
  ) : (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
};
