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
    const needs = host.querySelector('[data-testid="queue-filter-needs"]')!;
    expect(needs.getAttribute('aria-pressed')).toBe('true');
    expect(needs.className).toContain('h-7');
    expect(needs.className).not.toContain('h-11');
    expect(host.querySelector('[data-testid="finance-queue-select"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="queue-filter-all"]')!.className).toContain('bg-gardens-surf2');

    await act(async () => { host.querySelector<HTMLButtonElement>('[data-testid="finance-queue-more"]')!.click(); });
    expect(host.querySelectorAll('[data-testid="finance-queue-row"]')).toHaveLength(51);
    expect(host.querySelector('[data-testid="finance-queue-more"]')).toBeNull();

    await act(async () => { root.render(<FinanceQueue {...props} filter="all" />); });
    expect(host.querySelectorAll('[data-testid="finance-queue-row"]')).toHaveLength(50);

    const filters = host.querySelector('[data-testid="finance-queue-filters"]')!;
    expect(filters.textContent).toContain('Customer');
    expect(filters.className).toContain('-top-3');
    const queueRow = host.querySelector('[data-testid="finance-queue-row"]')!;
    expect(queueRow.className).toContain('scroll-mt-20');
    expect(host.querySelector('[data-testid="finance-queue-rows"]')!.className).toContain('pt-4');
    const card = queueRow.firstElementChild as HTMLElement;
    expect(card.className).toContain('grid-cols-[auto_minmax(0,1fr)_auto]');
    const placed = [...card.querySelectorAll('[class]')].map((el) => (el as HTMLElement).className).join(' ');
    expect(placed).toContain('max-[479px]:row-start-1');
    expect(placed).toContain('max-[479px]:row-start-2');
    const action = queueRow.querySelector('button')!;
    expect(action.className).toContain('max-[479px]:h-8');
    expect(action.className).toContain('max-[479px]:w-auto');
    expect(action.className).toContain('min-w-11');
    expect(filters.className).not.toContain('overflow-x-auto');
    expect(filters.querySelector('[role="tablist"]')!.className).toContain('flex-wrap');
    expect(host.querySelector('[data-testid="finance-queue-head"]')!.className).toContain('lg:grid');
  });

  it('does not offer Show more at 44 or at 50 rows', async () => {
    const props = {
      filter: 'all' as const,
      onFilter: () => {},
      showInvoices: false,
      onToggleInvoices: () => {},
      onOpen: () => {},
      onAction: () => {},
    };
    await act(async () => { root.render(<FinanceQueue {...props} rows={Array.from({ length: 44 }, (_, i) => row(String(i)))} />); });
    expect(host.querySelectorAll('[data-testid="finance-queue-row"]')).toHaveLength(44);
    expect(host.querySelector('[data-testid="finance-queue-more"]')).toBeNull();

    await act(async () => { root.render(<FinanceQueue {...props} rows={Array.from({ length: 50 }, (_, i) => row(String(i)))} />); });
    expect(host.querySelectorAll('[data-testid="finance-queue-row"]')).toHaveLength(50);
    expect(host.querySelector('[data-testid="finance-queue-more"]')).toBeNull();
  });
});
