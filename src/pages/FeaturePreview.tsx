/**
 * Fixture preview for the supplier column and the activity feed.
 * No live organisation data. Open /preview/features.
 */
import React from 'react';
import { getDefaultState } from '@/shared/tableViewPresets/utils/columnState';
import { OrdersBoard } from '@/modules/orders/components/OrdersBoard';
import type { UIOrder } from '@/modules/orders/utils/orderTransform';
import { OrdersSupplierCell, SupplierDetailCard } from '@/modules/supplier/components/SupplierStatusLabel';
import { ActivityFeedView } from '@/modules/activity/components/ActivityFeed';
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
    { description: 'Ogee top', jobCode: 'M245R0601', statusLabel: 'In transit', tone: 'transit', drives: true },
    { description: 'Base', jobCode: 'M245R0601', statusLabel: 'In production', tone: 'production', drives: false },
    { description: 'Kerb', jobCode: 'M245R0601', statusLabel: 'Waiting', tone: 'waiting', drives: false },
  ],
  suggestions: [],
};

const noDate: SupplierRollup = {
  ...linked,
  deliveryDate: null,
  status: 'production',
  statusLabel: 'In production',
  tone: 'production',
  otherParts: 0,
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

export default function FeaturePreview() {
  const orders = [
    order({ id: 'linked', customer: 'Sample family', supplier: linked }),
    order({ id: 'nodate', customer: 'Second order', order_number: 201, supplier: noDate }),
    order({ id: 'absent', customer: 'Third order', order_number: 188, supplier: null }),
  ];
  return (
    <div className="min-h-screen bg-gardens-page p-4 text-gardens-tx">
      <h1 className="mb-3 font-head text-xl font-semibold">Orders · supplier</h1>
      <OrdersBoard orders={orders} columnState={getDefaultState('orders')} groupBy="none" now={NOW} />
      <section className="mt-6 max-w-md rounded-lg border border-gardens-bdr bg-gardens-surf p-4" data-testid="preview-order-detail">
        <h2 className="m-0 font-head text-[17px] font-semibold">Sample family</h2>
        <div className="mt-2">
          <OrdersSupplierCell rollup={linked} loaded compact />
        </div>
        <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wide text-gardens-txs">Supplier</h3>
        <SupplierDetailCard rollup={linked} loaded />
        <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wide text-gardens-txs">No match</h3>
        <SupplierDetailCard rollup={null} loaded />
      </section>
      <section className="mt-6 max-w-md overflow-hidden rounded-lg border border-gardens-bdr bg-gardens-surf" data-testid="preview-activity">
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
  );
}
