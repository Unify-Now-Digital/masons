import { describe, expect, it } from 'vitest';
import { isInvoiceLocked, transformInvoiceForUI } from './invoiceTransform';
import type { Invoice } from '../types/invoicing.types';

/** The 26 Aug incident row (INV-000133) shape: finalized on Stripe, zero paid, never locked. */
const finalizedUnpaid: Invoice = {
  id: 'inv-fixture-000133',
  order_id: null,
  person_id: null,
  organization_id: 'org-fixture',
  invoice_number: 'INV-000133',
  customer_name: 'Fixture Customer',
  amount: 1200,
  status: 'pending',
  due_date: '2026-09-25',
  issue_date: '2026-08-26',
  payment_method: null,
  payment_date: null,
  notes: null,
  created_at: '2026-08-26T08:57:46Z',
  updated_at: '2026-08-26T08:58:11Z',
  stripe_status: 'unpaid',
  stripe_invoice_id: 'in_fixture133',
  stripe_invoice_status: 'open',
  amount_paid: 0, // pence
  amount_remaining: 100, // pence — the £1 the Stripe invoice was finalized at
  locked_at: null,
};

describe('isInvoiceLocked', () => {
  it('locks finalized-but-unpaid (stripe id set, amount_paid 0, locked_at null)', () => {
    expect(isInvoiceLocked(finalizedUnpaid)).toBe(true);
  });

  it('locks on locked_at alone', () => {
    expect(
      isInvoiceLocked({ amount_paid: 0, locked_at: '2026-09-01T00:00:00Z', stripe_invoice_id: null })
    ).toBe(true);
  });

  it('locks on payment alone (pence arriving as PostgREST string)', () => {
    expect(isInvoiceLocked({ amount_paid: '100', locked_at: null, stripe_invoice_id: null })).toBe(true);
  });

  it('does not lock a draft with no Stripe invoice', () => {
    expect(isInvoiceLocked({ amount_paid: 0, locked_at: null, stripe_invoice_id: null })).toBe(false);
    expect(isInvoiceLocked({ amount_paid: null, locked_at: null, stripe_invoice_id: '   ' })).toBe(false);
  });
});

describe('transformInvoiceForUI', () => {
  it('marks the INV-000133 shape isLocked', () => {
    expect(transformInvoiceForUI(finalizedUnpaid).isLocked).toBe(true);
  });

  it('leaves a no-Stripe draft unlocked', () => {
    const draft: Invoice = {
      ...finalizedUnpaid,
      stripe_invoice_id: null,
      stripe_invoice_status: null,
      amount_paid: null,
      amount_remaining: null,
      amount: 1,
    };
    expect(transformInvoiceForUI(draft).isLocked).toBe(false);
  });
});
