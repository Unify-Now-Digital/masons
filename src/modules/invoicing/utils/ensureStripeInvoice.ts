/**
 * Ensures a Stripe invoice exists for a billable Mason invoice.
 * Guards prevent duplicate creation; in-flight Map coalesces concurrent calls.
 * NOTE (T5b, 2026-09-01): zero production callers — the last one (ReviseInvoiceModal) was removed
 * so revise ends in an editable draft. Kept deliberately for the C3 mismatch tripwire + C4 tests
 * (see docs/handoff.md T-block). Do not re-wire into revise/create flows.
 */

import type { QueryClient } from '@tanstack/react-query';
import { createStripeInvoice } from '../api/stripe.api';
import type { CreateStripeInvoiceResponse } from '../api/stripe.api';
import { invoicesKeys } from '../hooks/useInvoices';

export interface EnsureStripeInvoiceInput {
  id: string;
  amount?: number | null;
  stripe_invoice_id?: string | null;
  /** Stored Stripe-derived totals (pence; PostgREST may return strings). Enables the finalized-mismatch tripwire. */
  amount_paid?: number | string | null;
  amount_remaining?: number | string | null;
  /** When false, skips creation (no orders attached). Omit or true when invoice has orders. */
  hasOrders?: boolean;
}

export interface EnsureStripeInvoiceOptions {
  queryClient?: QueryClient;
  onSuccess?: (data: CreateStripeInvoiceResponse) => void;
  organizationId?: string;
}

export interface EnsureStripeInvoiceResult {
  created: boolean;
  /** Set when an existing finalized Stripe invoice's total no longer matches the current amount. */
  mismatch?: boolean;
  data?: CreateStripeInvoiceResponse;
}

/** In-flight promises keyed by invoice id to prevent duplicate concurrent calls */
const inFlight = new Map<string, Promise<EnsureStripeInvoiceResult>>();

/**
 * Ensures a Stripe invoice exists for the given invoice when it is billable.
 * Returns without calling createStripeInvoice if already has Stripe invoice, amount <= 0, or no orders.
 * When called on an already-finalized invoice it warns; if the stored Stripe totals no longer match
 * the current amount it returns { mismatch: true } (tripwire only — never auto-voids or revises).
 * Coalesces concurrent calls for the same invoice id.
 */
export async function ensureStripeInvoice(
  invoice: EnsureStripeInvoiceInput,
  options?: EnsureStripeInvoiceOptions
): Promise<EnsureStripeInvoiceResult> {
  const { id, amount, stripe_invoice_id, hasOrders = true } = invoice;

  if (!id) {
    return { created: false };
  }

  if (hasOrders === false) {
    return { created: false };
  }

  const amountNum = amount != null ? Number(amount) : 0;

  const existingStripeId =
    stripe_invoice_id != null && typeof stripe_invoice_id === 'string'
      ? stripe_invoice_id.trim()
      : '';
  if (existingStripeId) {
    // Tripwire (26 Aug £1 incident class): a finalized Stripe invoice is never updated here,
    // so a drifted Mason amount means the customer would be charged the stale Stripe total.
    const paid = invoice.amount_paid != null ? Number(invoice.amount_paid) : null;
    const remaining = invoice.amount_remaining != null ? Number(invoice.amount_remaining) : null;
    const stripeTotalPence =
      paid != null && remaining != null && Number.isFinite(paid) && Number.isFinite(remaining)
        ? paid + remaining
        : null;
    if (stripeTotalPence != null && amount != null && Number.isFinite(amountNum)) {
      if (Math.round(amountNum * 100) !== stripeTotalPence) {
        console.warn(
          '[ensureStripeInvoice] amount mismatch vs finalized Stripe invoice — use Revise',
          { id, amount: amountNum, stripeTotalPence }
        );
        return { created: false, mismatch: true };
      }
    } else {
      console.warn('[ensureStripeInvoice] called on already-finalized invoice; skipping', id);
    }
    return { created: false };
  }

  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return { created: false };
  }

  const existing = inFlight.get(id);
  if (existing) {
    return existing;
  }

  const promise = (async (): Promise<EnsureStripeInvoiceResult> => {
    try {
      const data = await createStripeInvoice(id);
      options?.queryClient?.invalidateQueries({ queryKey: invoicesKeys.all });
      if (options?.organizationId) {
        options.queryClient.invalidateQueries({
          queryKey: invoicesKeys.detail(id, options.organizationId),
        });
      }
      options?.onSuccess?.(data);
      return { created: true, data };
    } catch (err) {
      console.warn('[ensureStripeInvoice] Stripe invoice creation failed', id, err);
      throw err;
    } finally {
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, promise);
  return promise;
}
