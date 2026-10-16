/**
 * Fixture preview for the supplier column and the activity feed.
 * No live organisation data. Open /preview/features.
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { SUPPLIER_FILTER_VALUES } from '@/modules/orders/utils/orderColumnFilters';
import { getDefaultState } from '@/shared/tableViewPresets/utils/columnState';
import { OrdersBoard } from '@/modules/orders/components/OrdersBoard';
import { OrdersToolbar } from '@/modules/orders/components/OrdersToolbar';
import type { UIOrder } from '@/modules/orders/utils/orderTransform';
import { OrdersSupplierCell, SupplierDetailCard } from '@/modules/supplier/components/SupplierStatusLabel';
import { ActivityFeedView } from '@/modules/activity/components/ActivityFeed';
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

const none: SupplierRollup = {
  ...linked,
  kind: 'none',
  status: null,
  statusLabel: 'Not on supplier board',
  tone: 'waiting',
  otherParts: 0,
  deliveryDate: null,
  batchCodes: [],
  parts: [],
  suggestions: [],
};

/** Same shell widths as PageShell: 72px rail from md, bottom bar under 768, content padding p-3 / sm:p-4. */
export default function FeaturePreview() {
  const [params] = useSearchParams();
  const panel = params.get('panel') !== '0';
  const orders = [
    order({
      id: 'late',
      customer: 'Carolyn Bennett',
      deceasedName: 'Carolyn Bennett',
      stoneStatus: 'NA',
      depositDate: '2026-09-01',
      amountPaid: 0,
      group: 'confirmed',
      jobStage: 'confirmed',
      supplier: none,
    }),
    order({
      id: 'match',
      customer: 'Jennifer Lawrence',
      deceasedName: 'David Parson',
      stoneStatus: 'NA',
      depositDate: '2026-09-01',
      amountPaid: 0,
      order_number: 267,
      group: 'confirmed',
      jobStage: 'confirmed',
      supplier: { ...noDate, batchCodes: ['MPL245'], suggestions: [{ linkId: 'link-1', confidence: 'medium', rule: 'surname', jobCode: 'M245R0601', reference: '267 PARSON SM' }] },
    }),
    order({
      id: 'linked',
      customer: 'Margaret Ellison',
      deceasedName: 'Arthur Ellison',
      stoneStatus: 'Ordered',
      order_number: 251,
      group: 'confirmed',
      jobStage: 'confirmed',
      supplier: linked,
    }),
    order({
      id: 'absent',
      customer: 'Henry Obuabang',
      deceasedName: '',
      stoneStatus: 'Ordered',
      stoneOrderedAt: '2026-10-02',
      order_number: 274,
      amountPaid: 1480,
      group: 'confirmed',
      jobStage: 'confirmed',
      supplier: none,
    }),
  ];
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
            <OrdersToolbar
              tabs={[
                { value: 'confirmed', label: 'Confirmed', count: orders.length },
                { value: 'invoiced', label: 'Invoiced', count: 0 },
                { value: 'all', label: 'All', count: orders.length },
              ]}
              moreTabs={[
                { value: 'enquired', label: 'Enquired', count: 0 },
                { value: 'quoted', label: 'Quoted', count: 0 },
                { value: 'in_production', label: 'In production', count: 0 },
                { value: 'fixed', label: 'Fixed', count: 0 },
                { value: 'complete', label: 'Complete', count: 0 },
              ]}
              activeTab="confirmed"
              kpiActive={false}
              onTab={() => {}}
              search=""
              onSearch={() => {}}
              groupBy="priority"
              onGroup={() => {}}
              sortMode="priority"
              onSort={() => {}}
              unassignedOnly={false}
              unassignedCount={0}
              onUnassigned={() => {}}
              includeArchived={false}
              onArchived={() => {}}
              onColumns={() => {}}
              onNewOrder={() => {}}
              attention={[
                { key: 'permit', label: 'Permit blocked', count: 2, overdue: false, pressed: false },
                { key: 'stone', label: 'Stone not ordered', count: 2, overdue: true, pressed: false },
                { key: 'proof', label: 'Proof awaiting', count: 1, overdue: false, pressed: false },
                { key: 'balance', label: 'Balance due', count: 3, overdue: false, pressed: false },
              ]}
              onAttention={() => {}}
              supplierFilters={SUPPLIER_FILTER_VALUES.map((value) => ({ value, on: false }))}
              onSupplierFilter={() => {}}
            />
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
