/**
 * One reading of a person's job: stage, money, what to do next, and the invoice.
 * Today, Inbox, Pipeline, Orders and Finance all call this. They must not
 * invent a second stage or a second total.
 *
 * Order total = memorial + additional options + permit.
 * Deposit = half the memorial and the options, plus the whole permit.
 * A deposit date with no matched payment is not "deposit paid".
 * An invoice counts when invoices.order_id, invoices.job_id, or orders.invoice_id links it.
 */
import { depositPoundsFromTotal } from '@/shared/lib/deposit';

export type WorkStage = 'enquired' | 'quoted' | 'invoiced' | 'deposit_paid' | 'confirmed' | 'complete' | 'none';

export type ValueKind = 'order' | 'invoice' | 'gmail_quote' | 'guide' | 'median' | 'unknown';

export interface JobInvoiceFact {
  id: string;
  orderId: string | null;
  jobId: string | null;
  amount: number;
  status: string | null;
  deleted?: boolean;
}

export interface JobOrderFact {
  id: string;
  /** Memorial base, excluding permit and additional options. */
  memorial: number;
  extras: number;
  permit: number;
  invoiceId: string | null;
  depositDate: string | null;
}

export interface PersonJobInput {
  jobId?: string | null;
  jobStage?: string | null;
  jobExit?: string | null;
  jobPaidAt?: string | null;
  order?: JobOrderFact | null;
  invoices?: JobInvoiceFact[];
  /** A quote we actually sent (Gmail Total, or a quotes row). Not the web-form guide. */
  sentQuote?: number | null;
  /** Web-form guide price. Not a quote. */
  guide?: number | null;
  /** Matched payments, in pounds. */
  paid?: number;
  lastIn?: string | null;
  lastOut?: string | null;
  now?: Date;
}

export interface PersonJobState {
  stage: WorkStage;
  stageLabel: string;
  orderId: string | null;
  orderTotal: number | null;
  /** Half the memorial and options, plus the permit. Null when there is no order. */
  depositDue: number | null;
  paid: number;
  /** Order total minus matched payments. */
  balance: number | null;
  /** What to collect now: the deposit until it is in, then the balance. */
  dueNow: number | null;
  dueLabel: 'deposit due' | 'balance due' | 'paid' | null;
  /** Why the total and the deposit differ, when that needs saying. */
  moneyNote: string | null;
  invoiceId: string | null;
  invoiceLink: string | null;
  value: number | null;
  valueKind: ValueKind;
  /** Deposit date or job.paid_at is set, but no matched payment. */
  depositMarkedUnrecorded: boolean;
  nextLabel: string;
  nextKind: 'chase_deposit' | 'reply' | 'send_quote' | 'follow_quote' | 'waiting' | 'record_payment' | 'request_balance' | 'first_contact' | 'none';
  nextWhy: string;
}

const STAGE_LABEL: Record<WorkStage, string> = {
  none: 'No job yet',
  enquired: 'Enquired',
  quoted: 'Quoted',
  invoiced: 'Invoiced',
  deposit_paid: 'Deposit paid',
  confirmed: 'Confirmed',
  complete: 'Complete',
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function liveInvoice(input: PersonJobInput): JobInvoiceFact | null {
  const invoices = (input.invoices ?? []).filter((i) => !i.deleted && i.status !== 'void');
  const linked = (i: JobInvoiceFact) =>
    (!!input.order && (i.orderId === input.order.id || i.id === input.order.invoiceId))
    || (!!input.jobId && !!i.jobId && i.jobId === input.jobId);
  const open = invoices.find((i) => linked(i) && i.status !== 'paid');
  return open ?? invoices.find(linked) ?? null;
}

function moneyOf(order: JobOrderFact, paid: number): {
  orderTotal: number;
  depositDue: number;
  balance: number;
  depositPaid: boolean;
  note: string | null;
} {
  const memorial = Math.max(0, order.memorial);
  const extras = Math.max(0, order.extras);
  const permit = Math.max(0, order.permit);
  const orderTotal = r2(memorial + extras + permit);
  const depositDue = r2(depositPoundsFromTotal(orderTotal, permit));
  const balance = r2(Math.max(0, orderTotal - paid));
  const depositPaid = depositDue > 0 ? paid + 0.009 >= depositDue : paid > 0.009;
  const parts = [`memorial ${gbp(memorial)}`];
  if (extras > 0.009) parts.push(`options ${gbp(extras)}`);
  if (permit > 0.009) parts.push(`permit ${gbp(permit)}`);
  const note = extras > 0.009 || permit > 0.009
    ? `Order ${gbp(orderTotal)} = ${parts.join(' + ')}. Deposit is half the memorial and options, plus the permit (${gbp(depositDue)}).`
    : null;
  return { orderTotal, depositDue, balance, depositPaid, note };
}

const ago = (iso: string | null | undefined, now: Date): string => {
  if (!iso) return 'recently';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'recently';
  const d = Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
};

/**
 * Status sentences ("Wrote today, waiting on us") are not topics for a draft.
 * Callers that build a message must use a template, never this why text.
 */
export function isStatusPhrase(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return /wrote\b|replied\b|waiting on|deposit unpaid|invoice sent|quote sent|quote quiet|no quote yet|never contacted|enquired\b/i.test(t);
}

export function personJobState(input: PersonJobInput): PersonJobState {
  const now = input.now ?? new Date();
  const paid = r2(Math.max(0, input.paid ?? 0));
  const invoice = liveInvoice(input);
  const order = input.order ?? null;
  const money = order ? moneyOf(order, paid) : null;
  const sentQuote = input.sentQuote != null && input.sentQuote > 0 ? input.sentQuote : null;
  const guide = input.guide != null && input.guide > 0 ? input.guide : null;
  const stageRaw = (input.jobStage ?? '').toLowerCase();
  const depositMarkedUnrecorded = !!order?.depositDate && paid <= 0.009 && !money?.depositPaid;

  const inProduction = stageRaw === 'confirmed' || stageRaw === 'in_production' || stageRaw === 'fixed';
  let stage: WorkStage = 'none';
  if (input.jobExit) stage = 'none';
  else if (stageRaw === 'complete') stage = 'complete';
  else if (money?.depositPaid) stage = 'deposit_paid';
  else if (inProduction) stage = 'confirmed';
  else if (invoice || stageRaw === 'invoiced') stage = 'invoiced';
  else if (sentQuote != null || stageRaw === 'quoted') stage = 'quoted';
  else if (stageRaw === 'enquired' || guide != null || input.jobId) stage = 'enquired';

  const valueKind: ValueKind = money && money.orderTotal > 0
    ? 'order'
    : invoice && invoice.amount > 0
      ? 'invoice'
      : sentQuote != null
        ? 'gmail_quote'
        : guide != null
          ? 'guide'
          : 'unknown';
  const value = valueKind === 'order' ? money!.orderTotal
    : valueKind === 'invoice' ? invoice!.amount
      : valueKind === 'gmail_quote' ? sentQuote
        : valueKind === 'guide' ? guide
          : null;

  const dueLabel: PersonJobState['dueLabel'] = !money ? null
    : money.balance <= 0.009 ? 'paid'
      : money.depositPaid ? 'balance due'
        : 'deposit due';
  const dueNow = !money ? null : dueLabel === 'paid' ? 0 : dueLabel === 'deposit due' ? money.depositDue : money.balance;

  const lastIn = input.lastIn ?? null;
  const lastOut = input.lastOut ?? null;
  const waitingOnUs = !!lastIn && (!lastOut || lastIn > lastOut);
  const neverContacted = !lastOut;

  let nextKind: PersonJobState['nextKind'] = 'none';
  let nextLabel = 'Waiting';
  let nextWhy = 'Nothing due';

  if (input.jobExit || stage === 'complete' || stage === 'none') {
    nextKind = 'none';
    nextLabel = '';
    nextWhy = '';
  } else if (depositMarkedUnrecorded) {
    nextKind = 'record_payment';
    nextLabel = 'Record payment';
    nextWhy = `Deposit marked ${order!.depositDate}, no amount recorded`;
  } else if (stage === 'invoiced' && dueLabel === 'deposit due') {
    nextKind = 'chase_deposit';
    nextLabel = 'Chase deposit';
    nextWhy = `Deposit unpaid${invoice ? '' : ', no invoice linked'}`;
  } else if (stage === 'deposit_paid' && dueLabel === 'balance due') {
    nextKind = 'request_balance';
    nextLabel = 'Request balance';
    nextWhy = 'Balance due on completion';
  } else if (neverContacted && stage === 'enquired') {
    nextKind = 'first_contact';
    nextLabel = 'Make first contact';
    nextWhy = 'Never contacted';
  } else if (stage === 'quoted' && waitingOnUs) {
    nextKind = 'reply';
    nextLabel = 'Reply';
    nextWhy = `Replied ${ago(lastIn, now)}`;
  } else if (stage === 'quoted') {
    const sentDays = lastOut ? Math.floor((now.getTime() - Date.parse(lastOut)) / 86_400_000) : 99;
    const quiet = !Number.isFinite(sentDays) || sentDays >= 7;
    nextKind = 'follow_quote';
    nextLabel = quiet ? 'Gentle follow-up' : 'Waiting on them';
    nextWhy = quiet ? `Quote quiet ${Number.isFinite(sentDays) ? sentDays : '?'}d` : `Quote sent ${ago(lastOut, now)}`;
  } else if (stage === 'enquired' && !sentQuote) {
    nextKind = waitingOnUs ? 'reply' : 'send_quote';
    nextLabel = waitingOnUs ? 'Reply' : 'Send quote';
    nextWhy = waitingOnUs ? `Replied ${ago(lastIn, now)}` : 'Enquiry, no quote yet';
  } else if (waitingOnUs) {
    nextKind = 'reply';
    nextLabel = 'Reply';
    nextWhy = `Replied ${ago(lastIn, now)}`;
  } else {
    nextKind = 'waiting';
    nextLabel = 'Waiting on them';
    nextWhy = lastOut ? `We wrote ${ago(lastOut, now)}` : 'Waiting';
  }

  return {
    stage,
    stageLabel: STAGE_LABEL[stage],
    orderId: order?.id ?? null,
    orderTotal: money?.orderTotal ?? null,
    depositDue: money?.depositDue ?? null,
    paid,
    balance: money?.balance ?? null,
    dueNow,
    dueLabel,
    moneyNote: money?.note ?? null,
    invoiceId: invoice?.id ?? null,
    invoiceLink: invoice ? `/dashboard/finance?invoice=${encodeURIComponent(invoice.id)}` : null,
    value,
    valueKind,
    depositMarkedUnrecorded,
    nextLabel,
    nextKind,
    nextWhy,
  };
}
