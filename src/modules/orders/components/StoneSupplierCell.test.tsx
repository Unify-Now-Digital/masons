/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';
import { SupplierMatchCard } from './StoneSupplierCell';

function board(partial: Partial<SupplierRollup> = {}): SupplierRollup {
  return {
    kind: 'suggested',
    status: 'production',
    statusLabel: 'In production',
    tone: 'possible',
    otherParts: 0,
    deliveryDate: null,
    deliveryEstimate: null,
    stale: false,
    syncedAt: null,
    jobCodes: [],
    batchCodes: ['MPL245'],
    containerCodes: [],
    parts: [{ description: 'Kerbs', jobCode: null, statusLabel: 'In production', tone: 'production', drives: true }],
    suggestions: [{ linkId: 'link-1', confidence: 'low', rule: 'number', jobCode: null, reference: 'OTHER FAMILY' }],
    ...partial,
  };
}

describe('SupplierMatchCard', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });

  function render(onConfirm = vi.fn(), onReject = vi.fn()) {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <SupplierMatchCard
          order={{
            deceasedName: 'Eve Mason',
            customer: 'Ada Mason',
            dimensions: '30 × 20 × 3in',
            material: 'Granite',
            stoneStatus: 'NA',
          }}
          board={board()}
          onConfirm={onConfirm}
          onReject={onReject}
        />,
      );
    });
    return { onConfirm, onReject };
  }

  it('hides matches when the supplier line differs, and writes confirm or reject', () => {
    const { onConfirm, onReject } = render();
    const card = host.querySelector('[data-testid="supplier-match-card"]');
    expect(card?.textContent).toContain('Match?');
    expect(card?.textContent).toContain('Supplier board · batch MPL245');
    expect(card?.textContent).toContain('Their name');
    expect(card?.textContent).not.toMatch(/\bmatches\b/);
    const confirm = host.querySelector('[data-testid="supplier-match-confirm"]') as HTMLButtonElement;
    const reject = host.querySelector('[data-testid="supplier-match-reject"]') as HTMLButtonElement;
    act(() => confirm.click());
    act(() => reject.click());
    expect(onConfirm).toHaveBeenCalledWith('link-1');
    expect(onReject).toHaveBeenCalledWith('link-1');
  });
});
