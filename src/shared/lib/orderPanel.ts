/**
 * Pure helpers for the shared order panel (orders-v10 drawer / inbox-v11 side
 * panel) and the inbox-v11 conversation header. Everything is derived from
 * existing order / job / invoice fields; anything not stored reads "Unknown".
 */
import type { StepState } from '@/shared/components/mason/stepState';
import { invoiceRemainingPence } from '@/modules/finance/utils/invoiceRemaining';
import { depositPoundsFromTotal } from '@/shared/lib/deposit';

export interface PanelOrderInput {
  stoneStatus: string | null;
  permitStatus: string | null;
  proofStatus: string | null;
  installationDate: string | null;
  depositDate: string | null;
  jobPaidAt: string | null;
  secondPaymentDate: string | null;
  /** Order total (base + permit + options), GBP pounds. */
  total: number;
  /** Permit fee included in `total`, GBP pounds (deposit rule: 50% memorial + 100% permit). */
  permit?: number | null;
  /** invoices.amount_paid (PENCE) for the linked invoice; null when there is no invoice. */
  amountPaidPence: number | null;
  /** The invoice's own remaining balance (PENCE, invoiceRemainingPence); null when there is no invoice. */
  remainingPence: number | null;
}

/** Embedded invoice → pence figures. `amount` is pounds; amount_paid / amount_remaining are pence. */
export function orderInvoicePence(
  inv: { amount?: number | string | null; amount_paid?: number | string | null; amount_remaining?: number | string | null; status?: string | null } | null | undefined,
): { amountPaidPence: number | null; remainingPence: number | null } {
  if (!inv) return { amountPaidPence: null, remainingPence: null };
  const paid = Number(inv.amount_paid ?? 0);
  const amountPaidPence = Number.isFinite(paid) ? Math.max(0, Math.round(paid)) : 0;
  const hasTotals = inv.amount != null || inv.amount_remaining != null || inv.status === 'paid';
  const remainingPence = hasTotals
    ? invoiceRemainingPence({
        amount: Number(inv.amount ?? 0),
        amount_paid: amountPaidPence,
        amount_remaining: inv.amount_remaining == null ? null : Number(inv.amount_remaining),
        status: inv.status ?? null,
      })
    : null;
  return { amountPaidPence, remainingPence };
}

export interface TrackStep {
  stage: 'Stone' | 'Lettering' | 'Install';
  state: StepState;
  word: string;
}

export const hasDeposit = (o: Pick<PanelOrderInput, 'jobPaidAt' | 'depositDate' | 'amountPaidPence'>) =>
  !!o.jobPaidAt || !!o.depositDate || (o.amountPaidPence ?? 0) > 0;

/** Three-step track (✓ ◐ ! ○ ?); Permit and Proof steps removed Oct 2026. Lettering has no stored status, so it is always Unknown. */
export function progressTrack(o: PanelOrderInput, now: Date = new Date()): TrackStep[] {
  const stone: TrackStep =
    o.stoneStatus === 'In Stock'
      ? { stage: 'Stone', state: 'done', word: 'In stock' }
      : o.stoneStatus === 'Ordered'
        ? { stage: 'Stone', state: 'progress', word: 'Ordered' }
        : o.stoneStatus === 'NA'
          ? { stage: 'Stone', state: 'todo', word: 'Not ordered yet' }
          : { stage: 'Stone', state: 'unknown', word: 'Unknown' };
  const lettering: TrackStep = { stage: 'Lettering', state: 'unknown', word: 'Unknown' };
  let install: TrackStep = { stage: 'Install', state: 'todo', word: 'No date' };
  if (o.installationDate) {
    const d = localDay(o.installationDate);
    const word = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    // Done only once the install day has passed (local calendar), not at 00:00 UTC on the day.
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    install = { stage: 'Install', state: d.getTime() < today.getTime() ? 'done' : 'progress', word };
  }
  return [stone, lettering, install];
}

export interface MoneyCard {
  label: string;
  amount: number | null;
  sub: string;
  tone: 'green' | 'amber' | 'neutral';
}

/** A date-only (or timestamp) value as a local calendar day. */
export function localDay(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Deposit + balance cards. Paid amounts come only from invoices.amount_paid; an unpaid
 * deposit shows the SM rule figure (50% memorial + 100% permit) from the order total.
 */
export function moneyCards(o: PanelOrderInput): { deposit: MoneyCard; balance: MoneyCard } {
  const paid = o.amountPaidPence != null && o.amountPaidPence > 0 ? Math.round(o.amountPaidPence) / 100 : null;
  const depositDateIso = o.depositDate || o.jobPaidAt;
  const deposit: MoneyCard = hasDeposit(o)
    ? {
        label: 'Deposit paid',
        amount: paid,
        sub: depositDateIso ? shortDate(depositDateIso) : 'amount paid on invoice',
        tone: 'green',
      }
    : {
        label: 'Deposit due',
        // SM rule (2026-10-14): 50% of the memorial + 100% of the permit fee.
        amount: o.total > 0 ? depositPoundsFromTotal(o.total, o.permit ?? 0) : null,
        sub: o.amountPaidPence == null ? '50% + permit · no invoice yet' : '50% + permit · not paid',
        tone: 'amber',
      };
  const balance: MoneyCard = o.secondPaymentDate
    ? { label: 'Balance paid', amount: null, sub: shortDate(o.secondPaymentDate), tone: 'green' }
    : {
        label: 'Balance',
        // The invoice's own remaining balance; never order total − paid (discounts, VAT, edits differ).
        amount: o.remainingPence != null ? Math.round(o.remainingPence) / 100 : null,
        sub: o.remainingPence != null ? 'on completion · from invoice' : 'on completion · no invoice yet',
        tone: 'neutral',
      };
  return { deposit, balance };
}

export interface HeaderStatusInput {
  linked: boolean;
  /** Furthest open job stage, or null when there is none. */
  jobStage: string | null;
  hasInvoice: boolean;
  depositPaid: boolean;
  /** A real quote exists (quote row or quoted stage), not a form guide price. */
  hasQuote?: boolean;
  hasOrder?: boolean;
}

const OPEN_STAGE_RANK: Record<string, number> = {
  enquired: 1,
  quoted: 2,
  invoiced: 3,
  confirmed: 4,
  in_production: 5,
  fixing: 6,
  fixed: 7,
  complete: 8,
};

/** Furthest stage among the person's open jobs. A newer enquiry must not hide an invoice. */
export function bestOpenJobStage(stages: (string | null | undefined)[]): string | null {
  const present = stages.filter((stage): stage is string => !!stage);
  const open = present.filter((stage) => stage !== 'complete');
  const pool = open.length > 0 ? open : present;
  let best: string | null = null;
  let rank = 0;
  for (const stage of pool) {
    const next = OPEN_STAGE_RANK[stage] ?? 0;
    if (next > rank) {
      rank = next;
      best = stage;
    }
  }
  return best;
}

/** inbox-v11 header: the name plus ONE quiet status line. */
export function conversationStatusLine(s: HeaderStatusInput): string {
  if (!s.linked) return 'Not linked to a customer';
  const stage = s.jobStage;
  if (s.hasInvoice || stage === 'invoiced') return s.depositPaid ? 'Deposit paid' : 'Invoice sent, deposit not paid';
  if (stage === 'complete') return 'Job complete';
  if (s.hasQuote || stage === 'quoted') return 'Quote sent';
  if (stage && stage !== 'enquired') return s.depositPaid ? 'Deposit paid, in production' : 'Confirmed';
  if (!stage && !s.hasOrder && !s.hasQuote) return 'No job yet';
  return 'Enquiry, not quoted';
}

export interface OpenJobRef {
  /** Order display id when the job has an order, else null. */
  orderRef: string | null;
  /** Short description: product + stage, e.g. "The Knebworth, invoice sent". */
  description: string | null;
}

/** Copy for the New job confirm step (duplicate check). */
export function newJobConfirmCopy(firstName: string, openJobs: OpenJobRef[]): { title: string; body: string } {
  const title = `Start a new job for ${firstName || 'this customer'}?`;
  if (openJobs.length === 0) {
    return { title, body: 'This adds a new job to the pipeline for this conversation.' };
  }
  const first = openJobs[0]!;
  const what = first.orderRef ?? 'an open job';
  const desc = first.description ? ` (${first.description})` : '';
  const more = openJobs.length > 1 ? ` and ${openJobs.length - 1} more open job${openJobs.length > 2 ? 's' : ''}` : '';
  return {
    title,
    body: `${firstName ? `${firstName} already has` : 'This customer already has'} ${what}${desc}${more}. Start a new job only for a different memorial. Messages stay linked to ${what}.`,
  };
}
