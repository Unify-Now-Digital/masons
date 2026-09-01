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

export function computeDerivedStatus(invoice: Invoice): DerivedInvoiceStatus {
  // status='paid' ⇒ settled (FR-017; mirrors invoiceRemainingPence's fold).
  // Live check 2026-09-01: zero live-org rows with status='paid' and unusable/absent amounts.
  if (invoice.status === 'paid') return 'paid';

  const paidPence = parsePence(invoice.amount_paid) ?? 0;
  const remainingPence = parsePence(invoice.amount_remaining);

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

