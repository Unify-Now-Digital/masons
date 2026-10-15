/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FinanceQueue } from './FinanceQueue';
import type { FinanceQueueRow } from '../queue';

function row(id: string): FinanceQueueRow {
  return {
    id, chip: 'Done', colour: 'blue', name: `Person ${id}`, ref: null,
    what: 'Balance', amount: 10, ageLabel: '2d', overdue: false, button: 'Open',
    orderId: null, paymentId: null, invoiceId: null, filters: ['needs'],
  };
}

describe('FinanceQueue paging', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  it('shows 50 rows, then the rest after Show more, and resets when the filter changes', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => row(String(i)));
    const props = {
      rows,
      filter: 'needs' as const,
      onFilter: () => {},
      showInvoices: false,
      onToggleInvoices: () => {},
      onOpen: () => {},
      onAction: () => {},
    };
    await act(async () => { root.render(<FinanceQueue {...props} />); });
    expect(host.querySelectorAll('[data-testid="finance-queue-row"]')).toHaveLength(50);
    expect(host.querySelector('[data-testid="finance-queue-more"]')!.textContent).toContain('Show more');
    expect(host.querySelector('[data-testid="finance-queue-filters"]')!.className).toContain('sticky');

    await act(async () => { host.querySelector<HTMLButtonElement>('[data-testid="finance-queue-more"]')!.click(); });
    expect(host.querySelectorAll('[data-testid="finance-queue-row"]')).toHaveLength(51);
    expect(host.querySelector('[data-testid="finance-queue-more"]')).toBeNull();

    await act(async () => { root.render(<FinanceQueue {...props} filter="all" />); });
    expect(host.querySelectorAll('[data-testid="finance-queue-row"]')).toHaveLength(50);
  });
});
