/**
 * Ensures a Stripe invoice exists for a billable Mason invoice.
 * Guards prevent duplicate creation; in-flight Map coalesces concurrent calls.
 */

import type { QueryClient } from '@tanstack/react-query';
import { createStripeInvoice } from '../api/stripe.api';
import type { CreateStripeInvoiceResponse } from '../api/stripe.api';
import { invoicesKeys } from '../hooks/useInvoices';

export interface EnsureStripeInvoiceInput {
  id: string;
  amount?: number | null;
  stripe_invoice_id?: string | null;
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
  data?: CreateStripeInvoiceResponse;
}

/** In-flight promises keyed by invoice id to prevent duplicate concurrent calls */
const inFlight = new Map<string, Promise<EnsureStripeInvoiceResult>>();

/**
 * Ensures a Stripe invoice exists for the given invoice when it is billable.
 * Returns without calling createStripeInvoice if already has Stripe invoice, amount <= 0, or no orders.
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
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return { created: false };
  }

  const existingStripeId =
    stripe_invoice_id != null && typeof stripe_invoice_id === 'string'
      ? stripe_invoice_id.trim()
      : '';
  if (existingStripeId) {
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
