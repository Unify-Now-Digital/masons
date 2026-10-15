/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { OrderPaymentRow } from '@/modules/today/brandData.types';

vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }));
vi.mock('../acceptRevolutWrite', () => ({
  acceptRevolutPayment: vi.fn(),
  ignoreRevolutPayment: vi.fn(),
}));
vi.mock('@/shared/context/OrganizationContext', () => ({
  useOrganization: () => ({ organizationId: 'org-1' }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
  useMutation: () => ({ mutate: () => {}, isPending: false, isError: false, error: null }),
}));

import { RevolutReconcileList } from './RevolutReconcileList';

function pay(id: string): OrderPaymentRow {
  return {
    id,
    order_id: null,
    source: 'revolut',
    amount: 25,
    payment_type: null,
    status: 'unmatched',
    received_at: '2026-10-01',
    external_id: id,
    reference: `REF-${id}`,
    counterparty_name: `Payer ${id}`,
    provider_state: 'completed',
    match_candidates: null,
  };
}

describe('RevolutReconcileList', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  it('shows a compact single line and collapses to the first three', async () => {
    await act(async () => { root.render(<RevolutReconcileList payments={[pay('1'), pay('2'), pay('3'), pay('4')]} orders={[]} />); });
    expect(host.querySelectorAll('[data-testid="revolut-reconcile-row"]')).toHaveLength(3);
    const row = host.querySelector('[data-testid="revolut-reconcile-row"]')!.firstElementChild as HTMLElement;
    expect(row.className).toContain('lg:flex-nowrap');
    expect(row.className).not.toContain('flex-col');
    const showAll = host.querySelector<HTMLButtonElement>('[data-testid="revolut-show-all"]')!;
    expect(showAll.textContent).toBe('Show all');
    await act(async () => { showAll.click(); });
    expect(host.querySelectorAll('[data-testid="revolut-reconcile-row"]')).toHaveLength(4);
    expect(host.querySelector('[data-testid="revolut-show-all"]')!.textContent).toBe('Show less');
    await act(async () => { root.unmount(); });
  });
});
