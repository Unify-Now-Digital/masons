/**
 * Pure helpers for the shared order panel (orders-v10 drawer / inbox-v11 side
 * panel) and the inbox-v11 conversation header. Everything is derived from
 * existing order / job / invoice fields; anything not stored reads "Unknown".
 */
import type { StepState } from '@/shared/components/mason/stepState';
import { permitStep, proofStep } from '@/shared/components/mason/stepState';

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
  /** invoices.amount_paid for the linked invoice; null when there is no invoice. */
  amountPaid: number | null;
}

export interface TrackStep {
  stage: 'Stone' | 'Permit' | 'Proof' | 'Lettering' | 'Install';
  state: StepState;
  word: string;
}

const PERMIT_WORD: Record<string, string> = {
  not_started: 'Not started',
  form_sent: 'Form sent',
  customer_completed: 'Form signed',
  pending: 'With cemetery',
  approved: 'Approved',
};
const PROOF_WORD: Record<string, string> = {
  Not_Received: 'Not received',
  Received: 'Received',
  In_Progress: 'Drafting',
  Sent: 'Sent',
  Revision: 'Revision',
  Approved: 'Approved',
  Lettered: 'Lettered',
  NA: 'Not needed',
};

export const hasDeposit = (o: Pick<PanelOrderInput, 'jobPaidAt' | 'depositDate' | 'amountPaid'>) =>
  !!o.jobPaidAt || !!o.depositDate || (o.amountPaid ?? 0) > 0;

/** Five-step track (✓ ◐ ! ○ ?). Lettering has no stored status, so it is always Unknown. */
export function progressTrack(o: PanelOrderInput, now: Date = new Date()): TrackStep[] {
  const stone: TrackStep =
    o.stoneStatus === 'In Stock'
      ? { stage: 'Stone', state: 'done', word: 'In stock' }
      : o.stoneStatus === 'Ordered'
        ? { stage: 'Stone', state: 'progress', word: 'Ordered' }
        : o.stoneStatus === 'NA'
          ? { stage: 'Stone', state: 'todo', word: 'Not ordered' }
          : { stage: 'Stone', state: 'unknown', word: 'Unknown' };
  const permit: TrackStep = {
    stage: 'Permit',
    state: permitStep(o.permitStatus, hasDeposit(o)),
    word: (o.permitStatus && PERMIT_WORD[o.permitStatus]) || 'Unknown',
  };
  const proof: TrackStep = {
    stage: 'Proof',
    state: proofStep(o.proofStatus),
    word: (o.proofStatus && PROOF_WORD[o.proofStatus]) || 'Unknown',
  };
  const lettering: TrackStep = { stage: 'Lettering', state: 'unknown', word: 'Unknown' };
  let install: TrackStep = { stage: 'Install', state: 'todo', word: 'No date' };
  if (o.installationDate) {
    const d = new Date(o.installationDate);
    const word = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    install = { stage: 'Install', state: d.getTime() <= now.getTime() ? 'done' : 'progress', word };
  }
  return [stone, permit, proof, lettering, install];
}

export interface MoneyCard {
  label: string;
  amount: number | null;
  sub: string;
  tone: 'green' | 'amber' | 'neutral';
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Deposit + balance cards. Paid amounts come only from invoices.amount_paid; the
 * deposit amount due is not stored, so an unpaid deposit shows no figure.
 */
export function moneyCards(o: PanelOrderInput): { deposit: MoneyCard; balance: MoneyCard } {
  const paid = o.amountPaid != null && o.amountPaid > 0 ? o.amountPaid : null;
  const depositDateIso = o.depositDate || o.jobPaidAt;
  const deposit: MoneyCard = hasDeposit(o)
    ? {
        label: 'Deposit paid',
        amount: paid,
        sub: depositDateIso ? shortDate(depositDateIso) : 'amount paid on invoice',
        tone: 'green',
      }
    : { label: 'Deposit due', amount: null, sub: o.amountPaid == null ? 'no invoice yet' : 'on invoice · not paid', tone: 'amber' };
  const balance: MoneyCard = o.secondPaymentDate
    ? { label: 'Balance paid', amount: null, sub: shortDate(o.secondPaymentDate), tone: 'green' }
    : {
        label: 'Balance',
        amount: paid != null && o.total > 0 ? Math.max(0, Math.round((o.total - paid) * 100) / 100) : null,
        sub: 'on completion',
        tone: 'neutral',
      };
  return { deposit, balance };
}

export interface HeaderStatusInput {
  linked: boolean;
  /** Most recent active job's stage, or null when there is none. */
  jobStage: string | null;
  hasInvoice: boolean;
  depositPaid: boolean;
}

/** inbox-v11 header: the name plus ONE quiet status line. */
export function conversationStatusLine(s: HeaderStatusInput): string {
  if (!s.linked) return 'Not linked to a customer';
  if (!s.jobStage) return 'No job yet';
  if (s.jobStage === 'enquired') return 'Enquiry, not quoted';
  if (s.jobStage === 'quoted') return s.hasInvoice ? 'Invoice sent, deposit not paid' : 'Quote sent';
  if (s.jobStage === 'invoiced') return s.depositPaid ? 'Deposit paid' : 'Invoice sent, deposit not paid';
  if (s.jobStage === 'complete') return 'Job complete';
  return s.depositPaid ? 'Deposit paid, in production' : 'Confirmed';
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
    body: `${firstName || 'They'} already ha${firstName ? 's' : 've'} ${what}${desc}${more}. Start a new job only for a different memorial. Messages stay linked to ${what}.`,
  };
}
