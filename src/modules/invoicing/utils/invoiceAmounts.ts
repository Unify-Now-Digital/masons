import type { Invoice } from '../types/invoicing.types';

export type DerivedInvoiceStatus = 'paid' | 'partial' | 'pending' | 'unknown';

export function parsePence(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatPence(pence: number | null | undefined): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

