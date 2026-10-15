/**
 * Universal right-hand context panel (Inbox panel, Orders drawer, mobile sheet), Oct 2026.
 * Arin: "side bar structure should be universal, sections easy to identify".
 * Fixed section order — every surface renders through ContextPanel in this order.
 */
import { depositPoundsFromTotal } from '@/shared/lib/deposit';

export const CONTEXT_PANEL_SECTIONS = [
  'next', 'money', 'progress', 'details', 'contact', 'orders',
] as const;
export type ContextPanelSection = (typeof CONTEXT_PANEL_SECTIONS)[number] | 'enquiry' | 'history' | 'messages';

export interface PanelPayment { amount: number | string | null; status?: string | null }

export interface PanelMoney {
  /** Order value incl. permit and extras (getOrderTotal), pounds. */
  total: number;
  /** SM deposit rule: 50% memorial + 100% permit. */
  depositTarget: number;
  /** Sum of matched order_payments (pounds). */
  paid: number;
  /** total − paid, never below 0. */
  balanceDue: number;
  depositPaid: boolean;
  /** Deposit still to collect (depositTarget − paid, ≥ 0). */
  depositOutstanding: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Money for the panel: balance due = order value + permit_cost − sum(order_payments).
 * `total` already includes the permit (getOrderTotal = base + permit + extras).
 * Only `matched` payments count (unmatched / dismissed / pass_through are not the order's money).
 */
export function panelMoney(total: number, permit: number, payments: PanelPayment[]): PanelMoney {
  const paid = r2(
    payments
      .filter((p) => (p.status ?? 'matched') === 'matched')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0),
  );
  const t = r2(Number(total) || 0);
  const depositTarget = t > 0 ? depositPoundsFromTotal(t, Number(permit) || 0) : 0;
  return {
    total: t,
    depositTarget,
    paid,
    balanceDue: Math.max(0, r2(t - paid)),
    depositPaid: depositTarget > 0 && paid >= depositTarget - 0.005,
    depositOutstanding: Math.max(0, r2(depositTarget - paid)),
  };
}

const STORE_KEY = 'mason.contextPanel.sections.v1';
/** Defaults: everything open except the long tail. */
const DEFAULT_OPEN: Partial<Record<ContextPanelSection, boolean>> = { history: false, messages: false };

export function readSectionState(): Partial<Record<ContextPanelSection, boolean>> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
    return { ...DEFAULT_OPEN, ...(raw ? (JSON.parse(raw) as Record<string, boolean>) : {}) };
  } catch {
    return { ...DEFAULT_OPEN };
  }
}

export function writeSectionState(s: Partial<Record<ContextPanelSection, boolean>>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode: state just isn't remembered */
  }
}
