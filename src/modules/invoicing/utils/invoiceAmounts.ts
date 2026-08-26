import type { Invoice } from '../types/invoicing.types';
import { formatGbpDecimal as sharedFormatGbpDecimal, formatGbpPence } from '@/shared/lib/formatters';

export type DerivedInvoiceStatus = 'paid' | 'partial' | 'pending' | 'unknown';

export function parsePence(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatPence(pence: number | null | undefined): string {
  return formatGbpPence(pence);
}

/** Format a GBP decimal amount (e.g. order-derived numeric totals). */
export function formatGbpDecimal(value: number | string | null | undefined): string {
  return sharedFormatGbpDecimal(value);
}

export function computeTotals(invoice: Invoice): {
  paidPence: number;
  remainingPence: number | null;
  totalPence: number | null;
} {
  const paidPence = parsePence(invoice.amount_paid) ?? 0;
  const remainingPence = parsePence(invoice.amount_remaining);

  let totalPence: number | null = null;
  if (remainingPence != null) {
    totalPence = paidPence + remainingPence;
  } else if (typeof invoice.amount === 'number' && Number.isFinite(invoice.amount)) {
    totalPence = Math.round(invoice.amount * 100);
  }

  // status='paid' with missing/zero Stripe amounts (offline-paid, legacy) must not read
  // as unpaid — trust the status: paid = total, remaining = 0. Precondition verified
  // 2026-08-26 (zero live rows with a genuinely partial amount_paid on status='paid').
  // Unusable total → invent nothing; fall through to today's null behavior.
  if (invoice.status === 'paid' && totalPence != null) {
    return { paidPence: totalPence, remainingPence: 0, totalPence };
  }

  return { paidPence, remainingPence, totalPence };
}

export function computeDerivedStatus(invoice: Invoice): DerivedInvoiceStatus {
  const { paidPence, remainingPence } = computeTotals(invoice);

  if (remainingPence === 0 && paidPence > 0) {
    return 'paid';
  }

  if (paidPence > 0 && remainingPence != null && remainingPence > 0) {
    return 'partial';
  }

  if (paidPence === 0 && remainingPence != null && remainingPence > 0) {
    return 'pending';
  }

  // Stripe amounts missing or unusable – fall back to existing "Pending" style in UI
  return 'unknown';
}

