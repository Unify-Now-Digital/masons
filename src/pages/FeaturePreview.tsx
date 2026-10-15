/**
 * Fixture preview for the supplier column and the activity feed.
 * No live organisation data. Open /preview/features.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpDown, Columns, Plus, Search } from 'lucide-react';
import { getDefaultState } from '@/shared/tableViewPresets/utils/columnState';
import { OrdersBoard } from '@/modules/orders/components/OrdersBoard';
import type { UIOrder } from '@/modules/orders/utils/orderTransform';
import { ORDER_KPI_HINT, ORDER_KPI_LABEL, ORDER_KPI_ORDER } from '@/modules/orders/utils/orderKpis';
import { SUPPLIER_FILTER_VALUES } from '@/modules/orders/utils/orderColumnFilters';
import { ORDERS_AFTER_PAYMENT_TABS } from '@/modules/orders/utils/orderGrouping';
import { formatStageLabel } from '@/modules/jobsPipeline';
import { OrdersSupplierCell, SupplierDetailCard } from '@/modules/supplier/components/SupplierStatusLabel';
import { ActivityFeedView } from '@/modules/activity/components/ActivityFeed';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import type { SupplierRollup } from '../../supabase/functions/_shared/supplierStatus';
import type { FeedEvent } from '@/modules/activity/feed';

const NOW = new Date('2026-10-15T18:00:00Z');

const linked: SupplierRollup = {
  kind: 'linked',
  status: 'transit',
  statusLabel: 'In transit',
  tone: 'transit',
  otherParts: 2,
  deliveryDate: '2026-11-15',
  deliveryEstimate: null,
  stale: false,
  syncedAt: '2026-10-15T08:00:00Z',
  jobCodes: ['M245R0601'],
  batchCodes: ['B-14'],
  containerCodes: [],
  parts: [
    { description: 'Headstone', jobCode: 'M245R0601', statusLabel: 'In transit', tone: 'transit', drives: true },
    { description: 'Base', jobCode: 'M245R0601', statusLabel: 'In production', tone: 'production', drives: false },
    { description: 'Kerbs', jobCode: 'M245R0601', statusLabel: 'Waiting', tone: 'waiting', drives: false },
  ],
  suggestions: [],
};

const noDate: SupplierRollup = {
  ...linked,
  kind: 'suggested',
  deliveryDate: null,
  deliveryEstimate: 'MPL242 - In Transit - HASU1349483 - Roughly Docking 2nd Week',
  status: null,
  statusLabel: 'Possible match · confirm?',
  tone: 'possible',
  otherParts: 1,
  parts: [],
};

function order(partial: Partial<UIOrder> & Pick<UIOrder, 'id' | 'customer'>): UIOrder {
  return {
    order_number: 233,
    deceasedName: 'Recorded name',
    type: 'New Memorial',
    stoneStatus: 'Ordered',
    createdAt: '2026-08-01T00:00:00Z',
    permitStatus: 'approved',
    proofStatus: 'Approved',
    dueDate: '',
    depositDate: '2026-08-01',
    secondPaymentDate: null,
    installationDate: null,
    value: '£2,400',
    total: 2400,
    location: '',
    progress: 40,
    assignedTo: '',
    priority: 'normal',
    sku: '',
    material: 'Dark grey',
    color: '',
    timelineWeeks: 12,
    quoteId: null,
    isTest: true,
    group: 'unassigned',
    jobStage: null,
    leadSource: null,
    leadChannel: null,
    jobPaidAt: null,
    jobExitReason: null,
    invoiceLocked: false,
    amountPaid: 1200,
    supplierLoaded: true,
    ...partial,
  };
}

const events: FeedEvent[] = [
  {
    id: '1',
    type: 'invoice.paid',
    category: 'finance',
    priority: 'fyi',
    entity_type: 'invoice',
    entity_id: null,
    order_id: null,
    actor_type: 'stripe',
    title: 'Invoice paid',
    body: null,
    payload: null,
    created_at: '2026-10-15T16:00:00Z',
    resolved_at: null,
  },
  {
    id: '2',
    type: 'stone.digest',
    category: 'supplier',
    priority: 'fyi',
    entity_type: null,
    entity_id: null,
    order_id: null,
    actor_type: 'supplier',
    title: 'Ogee: 1 job changed',
    body: null,
    payload: { children: [{ job_code: 'M245R0601', from: 'In production', to: 'In transit' }] },
    created_at: '2026-10-14T09:00:00Z',
    resolved_at: null,
  },
];

const TABS = ['invoiced', ...ORDERS_AFTER_PAYMENT_TABS, 'all'] as const;

const KPI_FIXTURE: Record<(typeof ORDER_KPI_ORDER)[number], { count: number; sub: string }> = {
  permit: { count: 0, sub: '' },
  stone: { count: 0, sub: '' },
  proof: { count: 1, sub: '· 1 no inscription' },
  fixing: { count: 0, sub: 'No fixing dates set' },
  balance: { count: 1, sub: '£3,705 to collect' },
};

/** Same shell widths as PageShell: 72px rail from md, bottom bar under 768, content padding p-3 / sm:p-4. */
export default function FeaturePreview() {
  const [params] = useSearchParams();
  const panel = params.get('panel') !== '0';
  const orders = [
    order({ id: 'linked', customer: 'Sample family', supplier: linked }),
    order({ id: 'nodate', customer: 'Second order', order_number: 201, supplier: noDate }),
    order({ id: 'absent', customer: 'Third order', order_number: 188, supplier: null }),
  ];
  const chipOff = 'bg-gardens-surf2 border-gardens-bdr text-gardens-txs';
  return (
    <div className="flex h-screen overflow-hidden bg-gardens-page text-gardens-tx">
      <aside
        className="hidden md:flex w-[72px] flex-shrink-0 flex-col items-center gap-1 border-r border-gardens-bdr bg-gardens-surf py-3"
        data-testid="preview-rail"
        aria-label="Main"
      >
        <span className="flex h-14 w-[60px] flex-col items-center justify-center rounded-xl bg-gardens-acc-lt text-[11px] font-bold text-gardens-acc-dk">
          Orders
        </span>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden pb-14 md:pb-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gardens-page p-3 sm:p-4" data-testid="shell-content">
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="sr-only">Orders</h1>
            <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-3 xl:grid-cols-5" data-testid="orders-kpis">
              {ORDER_KPI_ORDER.map((k) => {
                const v = KPI_FIXTURE[k];
                return (
                  <button
                    key={k}
                    type="button"
                    data-testid={`orders-kpi-${k}`}
                    title={ORDER_KPI_HINT[k]}
                    className="flex min-w-0 flex-col items-start gap-1 rounded-lg border border-gardens-bdr bg-gardens-surf px-3 py-2 text-left"
                  >
                    <span className="max-w-full break-words text-[11px] font-semibold uppercase tracking-wide text-gardens-txs">{ORDER_KPI_LABEL[k]}</span>
                    <span className="font-head text-[20px] font-semibold leading-none tabular-nums text-gardens-tx">{v.count}</span>
                    {v.sub && <span className="max-w-full break-words text-[12px] text-gardens-txs tabular-nums">{v.sub}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-gardens-bdr pb-2" data-testid="orders-toolbar">
              <div className="flex min-w-0 flex-wrap items-center gap-1" role="tablist" aria-label="Order status">
                {TABS.map((tab, i) => (
                  <React.Fragment key={tab}>
                    {i === TABS.length - 1 && <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-gardens-bdr" />}
                    <button
                      type="button"
                      role="tab"
                      className={cn(
                        'h-8 shrink-0 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold',
                        tab === 'confirmed' ? 'bg-gardens-acc text-white' : 'text-gardens-txs',
                      )}
                    >
                      {tab === 'all' ? 'All' : formatStageLabel(tab)}
                      <span className="ml-1 tabular-nums">{tab === 'confirmed' ? 1 : 0}</span>
                    </button>
                  </React.Fragment>
                ))}
                <Link to="/dashboard/inquiries" className="ml-1 inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap px-2 text-[13px] font-semibold text-gardens-acc-dk">
                  Pipeline <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <button type="button" className={cn('h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold', chipOff)}>
                Unassigned <span className="tabular-nums">0</span>
              </button>
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
                <div className="relative min-w-[120px] flex-1 sm:w-56">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gardens-txm" />
                  <Input placeholder="Search name, ref, deceased" className="h-8 border-gardens-bdr bg-gardens-surf2 pl-8 text-[13px]" readOnly />
                </div>
                <Button variant="outline" size="sm" className="h-8 shrink-0" type="button">
                  <Columns className="mr-1 h-4 w-4" />Columns
                </Button>
                <label className="shrink-0">
                  <span className="sr-only">Group by</span>
                  <select className="h-8 rounded-lg border border-gardens-bdr bg-gardens-surf2 px-2 text-[13px]" defaultValue="priority" data-testid="orders-groupby">
                    <option value="priority">Group: Priority</option>
                  </select>
                </label>
                <label className="flex shrink-0 items-center gap-1 text-[12px] text-gardens-txs">
                  <ArrowUpDown className="h-4 w-4" aria-hidden /><span className="sr-only">Sort</span>
                  <select className="h-8 rounded-lg border border-gardens-bdr bg-gardens-surf2 px-2 text-[13px]" defaultValue="priority" data-testid="orders-sort">
                    <option value="priority">Priority</option>
                    <option value="eta">Supplier ETA</option>
                  </select>
                </label>
                <button type="button" className={cn('h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold', chipOff)}>
                  Archived
                </button>
                <Button size="sm" className="h-8 shrink-0 bg-gardens-acc text-white hover:bg-gardens-acc-dk" type="button">
                  <Plus className="mr-1 h-4 w-4" />New order
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Supplier">
              {SUPPLIER_FILTER_VALUES.map((value) => (
                <button key={value} type="button" className={cn('h-7 shrink-0 rounded-full border px-3 text-xs font-semibold', chipOff)}>
                  {value}
                </button>
              ))}
            </div>
            <div className={cn('min-w-0', panel && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start lg:gap-3')}>
              <div className="min-w-0">
                <OrdersBoard orders={orders} columnState={getDefaultState('orders')} groupBy="priority" now={NOW} />
              </div>
              {panel && (
                <aside className="flex h-[calc(100dvh-6rem)] min-w-0 flex-col overflow-hidden rounded-lg border border-gardens-bdr bg-gardens-surf max-lg:fixed max-lg:inset-x-0 max-lg:bottom-14 max-lg:top-0 max-lg:z-50 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-6rem)] lg:self-start" data-testid="preview-order-detail">
                  <div className="flex items-start justify-between gap-2 border-b border-gardens-bdr bg-gardens-surf px-6 pb-3.5 pt-4">
                    <div className="min-w-0">
                      <p className="m-0 text-[12px] text-gardens-txs">ORD-000233 · £6,650.00</p>
                      <h2 className="m-0 font-head text-[17px] font-semibold">Sample family</h2>
                    </div>
                    <button type="button" className="h-11 w-11 shrink-0" aria-label="Close">×</button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
                    <div className="min-w-0">
                      <OrdersSupplierCell rollup={noDate} loaded />
                    </div>
                    <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wide text-gardens-txs">Supplier</h3>
                    <SupplierDetailCard rollup={linked} loaded />
                    <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wide text-gardens-txs">No match</h3>
                    <SupplierDetailCard rollup={null} loaded />
                  </div>
                </aside>
              )}
            </div>
            <section className="mt-2 max-w-md overflow-hidden rounded-lg border border-gardens-bdr bg-gardens-surf" data-testid="preview-activity">
              <h2 className="m-0 border-b border-gardens-bdr px-4 py-3 font-head text-base">Activity</h2>
              <ActivityFeedView
                events={events}
                readIds={new Set()}
                filter="all"
                onFilter={() => {}}
                now={NOW}
              />
            </section>
          </div>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gardens-bdr bg-gardens-surf px-1 py-1 md:hidden" aria-label="Mobile">
        <span className="flex flex-1 flex-col items-center py-1 text-[11px] font-semibold text-gardens-acc-dk">Orders</span>
      </nav>
    </div>
  );
}
