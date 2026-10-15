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
  useBrandData: () => ({ data: { data: bag.data, moneyError: null }, isError: false, isLoading: false, error: null }),
}));
vi.mock('../flow/FinanceFlow', () => ({
  FinanceFlow: () => <section data-testid="finance-flow" />,
}));
vi.mock('./FinancePage', () => ({
  FinanceInvoicesTab: () => <div data-testid="invoices-tab" />,
}));
vi.mock('../components/RecordPaymentDialog', () => ({ RecordPaymentDialog: () => null }));
vi.mock('../components/RevolutReconcileList', () => ({ RevolutReconcileList: () => null }));

import { FinancePage } from './FinanceV2Page';

const empty: BrandData = { jobs: [], orders: [], convs: [], permits: [], orderPayments: [], invoices: [], invoicePayments: [] };

describe('FinancePage KPI strip', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
    expect(invoices.textContent).toContain('Invoices unpaid · last 7 days');
    expect(invoices.textContent).toContain('£120.00');
    expect(invoices.textContent).not.toContain('800');
    expect(invoices.textContent).not.toContain('14,000');
    expect(invoices.querySelector('div:last-child')!.className).toContain('text-gardens-na-red');
    expect(host.querySelector('[data-testid="kpi-owed"] div:last-child')!.className).toContain('text-gardens-na-amber');

    const strip = host.querySelector('[data-testid="finance-kpis"]')!;
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.className).toContain('min-[880px]:grid-cols-5');
    expect(host.querySelector('[data-testid="finance-v2"]')!.className).toContain('min-w-0');
    expect(host.querySelector('h1')).toBeNull();
    expect(host.querySelector('h2')!.className).toContain('sr-only');
    expect(host.textContent).not.toContain('void in Stripe');
  });
});
