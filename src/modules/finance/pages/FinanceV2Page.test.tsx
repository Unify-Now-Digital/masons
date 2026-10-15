/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { BrandData } from '@/modules/today/brandData.types';

const NOW = Date.parse('2026-10-14T12:00:00Z');

const bag = vi.hoisted(() => ({
  data: null as BrandData | null,
  loading: false,
  pending: false,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('@/app/components/useCanSeeMoney', () => ({ useCanSeeMoney: () => true }));
vi.mock('@/shared/context/OrganizationContext', () => ({
  useOrganization: () => ({ role: 'admin', organizationName: 'Acme Masonry', canViewFinancials: true }),
}));
vi.mock('@/shared/context/orderPanel', () => ({ useOpenOrder: () => () => {} }));
vi.mock('@/modules/sections/useSectionsData', () => ({ useNow: () => new Date(NOW) }));
vi.mock('@/modules/today/useBrandData', () => ({
  useBrandData: () => ({
    data: bag.loading || bag.pending ? undefined : { data: bag.data, moneyError: null },
    isError: false,
    isLoading: bag.loading,
    isPending: bag.loading || bag.pending,
    isFetching: bag.loading,
    error: null,
  }),
}));
vi.mock('../flow/FinanceFlow', () => ({
  FinanceFlow: () => <section data-testid="finance-flow" />,
}));
vi.mock('./FinancePage', () => ({
  FinanceInvoicesTab: () => <div data-testid="invoices-tab" />,
}));
vi.mock('../components/RecordPaymentDialog', () => ({ RecordPaymentDialog: () => null }));
vi.mock('../components/RevolutReconcileList', () => ({ RevolutReconcileList: () => null }));
vi.mock('@/modules/payments/components/MatchModal', () => ({ MatchModal: () => null }));
vi.mock('@/modules/payments/hooks/useMatchPayment', () => ({
  useMatchPayment: () => ({ mutate: () => {}, isPending: false }),
  AmountMismatchError: class AmountMismatchError extends Error {},
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

import { FinancePage } from './FinanceV2Page';

const empty: BrandData = { jobs: [], orders: [], convs: [], permits: [], orderPayments: [], invoices: [], invoicePayments: [] };

describe('FinancePage KPI strip', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    bag.loading = false;
    bag.pending = false;
    bag.data = {
      ...empty,
      invoices: [
        { id: 'recent', order_id: null, invoice_number: 'recent', customer_name: 'A', amount: 120, status: 'pending', issue_date: '2026-10-12', due_date: null, stripe_invoice_status: 'open', stripe_invoice_id: 'in_r', stripe_payment_intent_id: null, is_test: false, paid_at: null, created_at: '2026-10-12T00:00:00Z' },
        { id: 'old', order_id: null, invoice_number: 'old', customer_name: 'B', amount: 800, status: 'pending', issue_date: '2026-08-01', due_date: null, stripe_invoice_status: 'open', stripe_invoice_id: 'in_o', stripe_payment_intent_id: null, is_test: false, paid_at: null, created_at: '2026-08-01T00:00:00Z' },
        { id: 'voided', order_id: null, invoice_number: 'voided', customer_name: 'C', amount: 14000, status: 'pending', issue_date: '2026-10-13', due_date: null, stripe_invoice_status: 'void', stripe_invoice_id: 'in_v', stripe_payment_intent_id: null, is_test: false, paid_at: null, created_at: '2026-10-13T00:00:00Z' },
      ],
    };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  it('shows five cards in order, last-7-day unpaid only, with no sub-lines', async () => {
    await act(async () => { root.render(<FinancePage />); });
    const ids = [...host.querySelectorAll('[data-testid^="kpi-"]')].map((el) => el.getAttribute('data-testid'));
    expect(ids).toEqual(['kpi-mtd', 'kpi-today', 'kpi-invoices', 'kpi-balances', 'kpi-owed']);

    const invoices = host.querySelector('[data-testid="kpi-invoices"]')!;
    expect(invoices.querySelectorAll('div')).toHaveLength(2);
    expect(invoices.textContent).toContain('Unpaid · 7 days');
    expect(invoices.textContent).toContain('£120');
    expect(invoices.textContent).not.toMatch(/£\d[\d,]*\.\d/);
    expect(invoices.textContent).not.toContain('800');
    expect(invoices.textContent).not.toContain('14,000');
    expect(invoices.querySelector('div:last-child')!.className).toContain('text-gardens-na-red');
    expect(host.querySelector('[data-testid="kpi-owed"] div:last-child')!.className).toContain('text-gardens-na-amber');

    const strip = host.querySelector('[data-testid="finance-kpis"]')!;
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.className).toContain('sm:grid-cols-6');
    expect(strip.className).toContain('xl:grid-cols-5');
    expect(strip.className).not.toContain('grid-cols-2');
    expect(strip.className).not.toContain('md:grid-cols-5');
    expect(strip.className).not.toContain('lg:grid-cols-5');
    expect(host.querySelector('[data-testid="kpi-owed"]')!.className).toContain('col-span-2');
    expect(host.querySelector('[data-testid="finance-kpi-skeleton"]')).toBeNull();
    expect(host.querySelector('[data-testid="finance-v2"]')!.className).toContain('min-w-0');
    expect(host.querySelector('[data-testid="finance-fit"]')!.className).not.toMatch(/100dvh|overflow-y-auto|overflow-hidden/);
    expect(host.querySelector('[data-testid="finance-tab-panel"]')!.className).not.toMatch(/overflow-y-auto|overflow-hidden/);
    expect(host.querySelector('[data-testid="finance-queue-filters"]')!.className).toContain('sticky');
    expect(host.querySelector('h1')).toBeNull();
    expect(host.querySelector('h2')!.className).toContain('sr-only');
    expect(host.textContent).not.toContain('void in Stripe');
  });

  it('reserves the KPI row with a skeleton while money is loading', async () => {
    bag.loading = true;
    bag.data = null;
    await act(async () => { root.render(<FinancePage />); });
    const skeleton = host.querySelector('[data-testid="finance-kpi-skeleton"]')!;
    expect(skeleton.className).toContain('overflow-x-auto');
    expect(skeleton.className).toContain('sm:grid-cols-6');
    expect(skeleton.className).toContain('xl:grid-cols-5');
    expect(skeleton.className).not.toContain('grid-cols-2');
    expect(skeleton.querySelectorAll(':scope > div')).toHaveLength(5);
    expect(skeleton.querySelector(':scope > div:last-child')!.className).toContain('col-span-2');
    expect(host.querySelector('[data-testid^="kpi-"]')).toBeNull();
    expect(host.textContent).not.toContain('Loading money…');
    expect(host.textContent).toContain('Cash in this month');
  });

  it('shows the skeleton on the first pending paint, before fetching is flagged', async () => {
    bag.loading = false;
    bag.pending = true;
    bag.data = null;
    await act(async () => { root.render(<FinancePage />); });
    expect(host.querySelector('[data-testid="finance-kpi-skeleton"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="finance-kpis"]')).toBeNull();
  });
});
