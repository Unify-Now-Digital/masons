import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

// Break the useInvoices → invoicing.api → supabase import chain: the supabase client
// module throws at load without VITE_SUPABASE_* env. Only invoicesKeys is consumed here.
vi.mock('../hooks/useInvoices', () => ({
  invoicesKeys: {
    all: ['invoices'] as const,
    detail: (id: string, orgId: string) => ['invoices', id, orgId] as const,
  },
}));

import { ensureStripeInvoice } from './ensureStripeInvoice';

describe('ensureStripeInvoice with an existing stripe_invoice_id', () => {
  const fetchSpy = vi.fn();
  let warnSpy: MockInstance;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    warnSpy.mockRestore();
    fetchSpy.mockReset();
  });

  it('never attempts a network call', async () => {
    const result = await ensureStripeInvoice({
      id: 'inv-1',
      amount: 1200,
      stripe_invoice_id: 'in_fixture133',
      amount_paid: 0,
      amount_remaining: 100,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
  });

  it('flags the incident mismatch: Mason £1200 vs Stripe total 100 pence', async () => {
    const result = await ensureStripeInvoice({
      id: 'inv-1',
      amount: 1200,
      stripe_invoice_id: 'in_fixture133',
      amount_paid: '0',
      amount_remaining: '100',
    });
    expect(result).toEqual({ created: false, mismatch: true });
    expect(warnSpy).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes the matching case: Mason £1 vs Stripe total 100 pence', async () => {
    const result = await ensureStripeInvoice({
      id: 'inv-1',
      amount: 1,
      stripe_invoice_id: 'in_fixture133',
      amount_paid: 0,
      amount_remaining: 100,
    });
    expect(result.mismatch).toBeUndefined();
    expect(result.created).toBe(false);
  });

  it('degrades to skip-warn when amount is null (no mismatch report)', async () => {
    const result = await ensureStripeInvoice({
      id: 'inv-1',
      amount: null,
      stripe_invoice_id: 'in_fixture133',
      amount_paid: 0,
      amount_remaining: 100,
    });
    expect(result.mismatch).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
