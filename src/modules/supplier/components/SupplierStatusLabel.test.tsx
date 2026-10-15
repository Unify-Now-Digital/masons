/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: () => ({}) } }));
vi.mock('@/shared/context/OrganizationContext', () => ({ useOrganization: () => ({ organizationId: null }) }));

import { OrdersSupplierCell } from './SupplierStatusLabel';

const linked: SupplierRollup = {
  kind: 'linked',
  status: 'transit',
  statusLabel: 'In transit',
  tone: 'transit',
  otherParts: 2,
  deliveryDate: '2026-11-15',
  deliveryEstimate: null,
  stale: false,
  syncedAt: '2026-10-15T00:00:00Z',
  jobCodes: ['M245R0601'],
  batchCodes: [],
  containerCodes: [],
  parts: [],
  suggestions: [],
};

function mount(node: React.ReactNode) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(node); });
  return { host, root };
}

describe('OrdersSupplierCell', () => {
  let root: Root | null = null;
  afterEach(() => {
    act(() => { root?.unmount(); });
    document.body.innerHTML = '';
    root = null;
  });

  it('shows the status label, the other-parts hint, and the confirmed date', () => {
    const view = mount(<OrdersSupplierCell rollup={linked} loaded />);
    root = view.root;
    expect(view.host.querySelector('[data-testid="supplier-status"]')?.textContent).toBe('In transit');
    expect(view.host.querySelector('[data-testid="supplier-parts"]')?.textContent).toBe('+2 parts');
    expect(view.host.querySelector('[data-testid="supplier-delivery"]')?.textContent).toContain('15 Nov');
  });

  it('says est. when a linked job has no confirmed date', () => {
    const view = mount(<OrdersSupplierCell rollup={{ ...linked, deliveryDate: null }} loaded />);
    root = view.root;
    expect(view.host.querySelector('[data-testid="supplier-delivery"]')?.textContent).toBe('est.');
  });

  it('shows a subtle empty state only after the board has loaded', () => {
    const missing = mount(<OrdersSupplierCell rollup={null} loaded />);
    root = missing.root;
    expect(missing.host.textContent).toContain('Not on supplier board');
    act(() => { root?.unmount(); });
    const pending = mount(<OrdersSupplierCell rollup={null} loaded={false} />);
    root = pending.root;
    expect(pending.host.textContent).not.toContain('Not on supplier board');
    expect(pending.host.querySelector('[data-testid="supplier-pending"]')).toBeTruthy();
  });

  it('keeps status and date on one row when compact', () => {
    const view = mount(<OrdersSupplierCell rollup={linked} loaded compact />);
    root = view.root;
    expect(view.host.textContent).toContain('In transit');
    expect(view.host.textContent).toContain('15 Nov');
  });
});
