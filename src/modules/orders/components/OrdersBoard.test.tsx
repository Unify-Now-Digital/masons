/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getDefaultState } from '@/shared/tableViewPresets/utils/columnState';
import type { UIOrder } from '../utils/orderTransform';

const openOrder = vi.hoisted(() => vi.fn());

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: () => ({}) } }));
vi.mock('@/shared/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/shared/context/orderPanel', () => ({ useOpenOrder: () => openOrder }));

import { OrdersBoard } from './OrdersBoard';

const NOW = new Date('2026-10-15T12:00:00Z');

function row(partial: Partial<UIOrder> & Pick<UIOrder, 'id'>): UIOrder {
  return {
    order_number: 12,
    customer: 'Ada Mason',
    deceasedName: 'Eve Mason',
    type: 'New Memorial',
    stoneStatus: 'In Stock',
    createdAt: '2026-08-01T00:00:00Z',
    permitStatus: 'approved',
    proofStatus: 'Approved',
    dueDate: '',
    depositDate: '2026-08-01',
    secondPaymentDate: null,
    installationDate: null,
    value: '£1,000',
    total: 1000,
    location: '',
    progress: 40,
    assignedTo: '',
    priority: 'normal',
    sku: '',
    material: 'Granite',
    color: '',
    timelineWeeks: 12,
    quoteId: null,
    isTest: false,
    group: 'confirmed',
    jobStage: 'confirmed',
    leadSource: null,
    leadChannel: null,
    jobPaidAt: '2026-08-01',
    jobExitReason: null,
    invoiceLocked: false,
    amountPaid: 400,
    inscriptionText: 'In loving memory',
    productName: 'Ogee',
    ...partial,
  };
}

describe('OrdersBoard', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    openOrder.mockReset();
  });

  function render(orders: UIOrder[]) {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <OrdersBoard
          orders={orders}
          columnState={getDefaultState('orders')}
          groupBy="priority"
          now={NOW}
        />,
      );
    });
  }

  it('shows the default columns and no gap marker on a partly paid row', () => {
    render([row({ id: 'paid' })]);
    const headers = [...host.querySelectorAll('[data-testid^="orders-col-"]')].map((el) => el.getAttribute('data-testid'));
    expect(headers).toEqual([
      'orders-col-customer',
      'orders-col-nextStep',
      'orders-col-product',
      'orders-col-permit',
      'orders-col-stoneStatus',
      'orders-col-proof',
      'orders-col-progress',
    ]);
    expect(host.textContent).not.toContain('£?');
    expect(host.textContent).toContain('£400 / £1,000');
  });

  it('marks a received deposit with no amount, and only then', () => {
    render([row({ id: 'gap', amountPaid: 0, depositDate: '2026-10-01', stoneStatus: 'Ordered' })]);
    expect(host.textContent).toContain('Deposit · amount missing');
    expect(host.textContent).not.toContain('£?');
  });

  it('mutes archived rows, tags them, and places them after active rows', () => {
    render([
      row({ id: 'old', customer: 'Old Row', archivedAt: '2026-09-01T00:00:00Z' }),
      row({ id: 'live', customer: 'Live Row' }),
    ]);
    const rows = [...host.querySelectorAll('[data-testid="orders-row"]')];
    expect(rows.map((el) => el.getAttribute('data-archived'))).toEqual(['false', 'true']);
    expect(rows[1].className).toContain('opacity-60');
    expect(rows[1].textContent).toContain('Archived');
    expect(host.querySelector('[data-testid="orders-group-Archived"]')).not.toBeNull();
  });

  it('shows weeks over target in red and Not started at week 0', () => {
    const daysBefore = (days: number) => {
      const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    render([
      row({ id: 'over', depositDate: daysBefore(112), timelineWeeks: 12, amountPaid: 200 }),
      row({ id: 'zero', depositDate: '2026-11-01', amountPaid: 200 }),
    ]);
    expect(host.textContent).toContain('16 wk · 4 over');
    expect(host.textContent).toContain('Not started');
    expect(host.textContent).not.toMatch(/wk \d+\/\d+/);
    const over = [...host.querySelectorAll('[data-testid="order-progress"]')]
      .find((el) => el.textContent?.includes('16 wk · 4 over'));
    expect(over?.innerHTML).toContain('text-gardens-na-red');
  });

  it('shows the overdue stone pill only for that group and opens the stage panel', () => {
    render([
      row({ id: 'late', stoneStatus: 'NA', depositDate: '2026-09-01', amountPaid: 200 }),
      row({ id: 'fine', stoneStatus: 'In Stock', amountPaid: 200 }),
    ]);
    const bulk = host.querySelector('[data-testid="orders-bulk-Overdue"]');
    expect(bulk?.textContent).toBe('Order 1 overdue stone');
    expect(host.querySelector('[data-testid="orders-bulk-On track"]')).toBeNull();
    const permit = host.querySelector('[data-testid="stage-pill-permit"]') as HTMLButtonElement;
    act(() => permit.click());
    expect(openOrder).toHaveBeenCalledWith('late', { section: 'permit' });
  });
});
