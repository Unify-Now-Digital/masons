import type { LedgerPaymentRow, MatchStatus } from '../api/ledger.api';
import { orderRef } from '@/modules/orders/utils/orderDisplayId';

/** Pure view helpers for Finance › Payments (unit-tested). */
export type LedgerGroup = 'review' | 'matched' | 'waiting' | 'ignored';

export function groupOf(status: MatchStatus, needsReview = false): LedgerGroup {
  if (needsReview && status !== 'ignored') return 'review';
  if (status === 'unmatched' || status === 'suggested') return 'review';
  if (status === 'matched') return 'matched';
  if (status === 'pending') return 'waiting';
  return 'ignored';
}

export interface LedgerViewFilters {
  status?: 'all' | LedgerGroup;
  type?: 'all' | 'deposit' | 'balance' | 'permit' | 'refund';
  search?: string;
  minPence?: number | null;
  maxPence?: number | null;
}

export function filterRows(rows: LedgerPaymentRow[], f: LedgerViewFilters): LedgerPaymentRow[] {
  const q = (f.search ?? '').trim().toLowerCase();
  const qDigits = q.replace(/^(ord|or|inv)[\s#:-]*/i, '').replace(/^0+/, '');
  return rows.filter((r) => {
    if (f.status && f.status !== 'all' && groupOf(r.status, r.needsReview) !== f.status) return false;
    if (f.type && f.type !== 'all') {
      if (f.type === 'refund') { if (r.grossPence >= 0) return false; }
      else if (!r.allocations.some((a) => a.type === f.type)) return false;
    }
    const abs = Math.abs(r.grossPence);
    if (f.minPence != null && abs < f.minPence) return false;
    if (f.maxPence != null && abs > f.maxPence) return false;
    if (q) {
      const hay = [
        r.payerName, r.customerName, r.reference, r.payerEmail,
        ...r.allocations.flatMap((a) => [a.invoiceNumber, a.orderNumber != null ? orderRef(a.orderNumber) : null, a.orderNumber != null ? String(a.orderNumber) : null]),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q) && !(qDigits && /^\d+$/.test(qDigits) && r.allocations.some((a) => String(a.orderNumber ?? '') === qDigits))) return false;
    }
    return true;
  });
}

const GROUP_ORDER: Record<LedgerGroup, number> = { review: 0, matched: 1, waiting: 2, ignored: 3 };

/** Needs review first (unmatched before suggested), then matched, then waiting; newest first inside. */
export function sortRows(rows: LedgerPaymentRow[]): LedgerPaymentRow[] {
  return [...rows].sort((a, b) => {
    const g = GROUP_ORDER[groupOf(a.status, a.needsReview)] - GROUP_ORDER[groupOf(b.status, b.needsReview)];
    if (g) return g;
    if (a.status !== b.status) return a.status === 'unmatched' ? -1 : b.status === 'unmatched' ? 1 : 0;
    return b.receivedAt.localeCompare(a.receivedAt);
  });
}

const TYPE_LABEL: Record<string, string> = { deposit: 'Deposit', balance: 'Balance', permit: 'Permit fee', extra: 'Extra', credit: 'Credit' };

/** "ORD-000123 · Deposit" for each allocation. */
export function allocationLabel(r: LedgerPaymentRow): string {
  if (!r.allocations.length) return '—';
  return r.allocations.map((a) => {
    const id = a.orderNumber != null ? orderRef(a.orderNumber) : a.invoiceNumber ?? 'invoice';
    return `${id} · ${TYPE_LABEL[a.type] ?? a.type}`;
  }).join(', ');
}

export type PrimaryAction = 'confirm' | 'match' | 'menu' | 'reviewed' | null;
export function primaryAction(r: LedgerPaymentRow): PrimaryAction {
  if (r.needsReview && r.status === 'matched') return 'reviewed';
  if (r.status === 'suggested' && r.suggestions.length > 0) return 'confirm';
  if (r.status === 'unmatched' || r.status === 'suggested') return 'match';
  if (r.status === 'matched') return 'menu';
  return null;
}
