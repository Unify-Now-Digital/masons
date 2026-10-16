/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { Order } from '../types/orders.types';

vi.mock('@/app/components/useCanSeeMoney', () => ({ useCanSeeMoney: () => true }));
vi.mock('@/modules/customers/hooks/useCustomers', () => ({ useCustomer: () => ({ data: undefined }) }));
vi.mock('@/modules/orders/hooks/useOrders', () => ({ useOrdersByPersonId: () => ({ data: [] }) }));
vi.mock('@/modules/payments/hooks/useOrderPaymentsByOrder', () => ({ useOrderPaymentsByOrder: () => ({ data: [] }) }));
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: () => ({}) } }));
vi.mock('@/modules/supplier/components/SupplierStatusLabel', () => ({
  SupplierOrderSection: () => null,
  OrdersSupplierCell: () => null,
}));
vi.mock('./FixingDateField', () => ({ FixingDateField: () => null }));

import { OrderContextPanel } from './OrderContextPanel';
import type { ActivityEvent } from '@/modules/today/recentActivity';

function order(): Order {
  return {
    id: 'ord-1',
    order_number: 245,
    invoice_id: null,
    job_id: null,
    permit_form_id: null,
    person_id: 'p1',
    person_name: 'Dean .',
    customer_name: 'Dean .',
    customer_email: 'dean@example.com',
    customer_phone: '07700900123',
    order_type: 'New Memorial',
    sku: 'A1',
    material: 'Grey granite',
    color: 'Light',
    stone_status: 'NA',
    permit_status: 'not_started',
    proof_status: 'NA',
    deposit_date: null,
    second_payment_date: null,
    due_date: null,
    installation_date: null,
    location: 'Sutton',
    latitude: null,
    longitude: null,
    value: 1200,
    permit_cost: 0,
    product_photo_url: null,
    geocode_status: null,
    geocode_error: null,
    geocoded_at: null,
    geocode_place_id: null,
    progress: 0,
    assigned_to: null,
    priority: 'medium',
    timeline_weeks: 12,
    notes: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    custom_product_name: 'Ogee',
    quote_id: null,
    job: { stage: 'in_progress', paid_at: null, exit_reason: null },
  } as unknown as Order;
}

const events: ActivityEvent[] = [{
  id: 'm1',
  at: '2026-10-09T10:00:00Z',
  when: '9 Oct',
  title: 'They wrote',
  quote: 'Please send the proof.',
  href: '/dashboard/inbox?conversation=c1',
  icon: 'message',
}];

describe('OrderContextPanel docked', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
  });

  it('has no backdrop and no close button, and recent activity comes first', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <OrderContextPanel
            variant="docked"
            order={order()}
            dockBlocker="stone"
            activity={events}
            customerOrders={[{ ...order(), id: 'ord-2', order_number: 100, created_at: '2026-09-01T00:00:00Z' } as Order]}
            onOpenFull={() => {}}
          />
        </MemoryRouter>,
      );
    });
    const panel = host.querySelector('[data-testid="order-context-panel"]') as HTMLElement;
    expect(panel.getAttribute('data-variant')).toBe('docked');
    expect(panel.className).not.toMatch(/fixed|inset-0/);
    expect(panel.querySelector('[aria-label="Close"]')).toBeNull();
    expect(panel.textContent).not.toContain('Next action');
    expect(panel.textContent).toContain('Dean (no surname)');
    const sections = [...panel.querySelectorAll('section')].map((node) => node.getAttribute('data-section'));
    expect(sections).toEqual(['recent', 'record', 'contact', 'others']);
    expect(panel.querySelector('[data-section="contact"]')?.textContent).toContain('dean@example.com');
    expect(panel.querySelector('[data-section="recent"]')?.textContent).toContain('They wrote');
    expect(panel.querySelector('[data-section="record"]')?.textContent).toContain('Stone');
    expect(panel.querySelector('[data-section="record"]')?.textContent).toContain('Not ordered');
    expect(panel.querySelector('[data-section="others"]')?.textContent).toContain('1 · ORD-000100');
    const open = host.querySelector('[data-testid="today-open-full"]');
    expect(open?.textContent).toContain('Open order');
    expect(panel.querySelector('[data-testid="panel-header"]')?.textContent).not.toContain('dean@example.com');
  });
});

describe('OrderContextPanel inbox header', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
  });

  it('puts Open order under the name when the inbox panel has no edit action', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <OrderContextPanel order={order()} showOpenFullOrder customerOrders={[]} />
        </MemoryRouter>,
      );
    });
    const header = host.querySelector('[data-testid="panel-header"]') as HTMLElement;
    const open = [...header.querySelectorAll('button')].find((button) => button.textContent?.includes('Open order'));
    expect(open).toBeTruthy();
    expect(header.textContent).not.toContain('dean@example.com');
  });
});
