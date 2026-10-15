/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const bag = vi.hoisted(() => ({
  query: {
    isLoading: false,
    isError: false,
    data: {
      jobs: [{
        id: 'j1', stage: 'quoted', source: 'website', created_at: new Date().toISOString(),
        exit_reason: null, paid_at: null, person_id: 'p1', person_name: 'Ada',
        conversation_id: null, last_outbound_at: null, lead_source: null, lead_channel: 'RAQ',
      }],
      enq: [] as unknown[],
      orders: [] as unknown[],
      spend: null,
      tracked: 0,
    },
  },
}));

vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => bag.query }));
vi.mock('@/shared/context/OrganizationContext', () => ({ useOrganization: () => ({ organizationId: 'org-1' }) }));
vi.mock('@/shared/context/orderPanel', () => ({ useOpenOrder: () => () => {} }));
vi.mock('@/shared/context/personPanel', () => ({ useOpenPerson: () => () => {} }));

import { FinanceFlow } from './FinanceFlow';

describe('FinanceFlow layout', () => {
  it('fills the card with a responsive canvas and sizes the side tables to their content', () => {
    const html = renderToStaticMarkup(<FinanceFlow />);
    expect(html).toContain('data-testid="finance-flow"');
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('lg:grid-cols-[minmax(0,1fr)_max-content]');
    expect(html).toContain('viewBox="0 0 720 500"');
    expect(html).not.toContain('viewBox="0 0 1160 500"');
    expect(html).toContain('font-size="14"');
    expect(html).toContain('min-w-[720px]');
    expect(html).toContain('data-testid="flow-chart-scroll"');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('data-testid="finance-by-source"');
    expect(html).toContain('data-testid="top-products"');
    expect(html).toContain('whitespace-nowrap');
    expect(html).not.toContain('min-w-[22rem]');
    expect(html).not.toContain('data-testid="scroll-box"');
    expect(html).not.toContain('xl:max-h-[45%]');
    expect(html).not.toMatch(/<h1[\s>]/);
    expect(html).toContain('<h3');
  });
});
