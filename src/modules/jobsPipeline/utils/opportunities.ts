/**
 * Karen's "best opportunities today" model (pipeline-plan.md §3, Arin's decisions 14 Oct 2026).
 * Pure + unit-tested. Read-only: every input comes from SELECTs (jobs, invoices,
 * inbox_conversations last_in/out, outbound Gmail bodies for the quote amount).
 *
 *   score = value £ × p(win) × recency × engagement
 *   - value: latest quote £ in the family's Gmail thread (org-scoped inbox, brands walled);
 *     else the existing value (invoice / form estimate), flagged; else SM median, flagged.
 *   - p(win): historic SM age curve (P(still win | reached age X)) × stage factor.
 *   - recency: 1.0 ≤7d · 0.7 ≤30d · 0.4 ≤60d (older → Revive, never in Today).
 *   - engagement: 1.5 family wrote last (waiting on us) · 1.2 they wrote ≤14d · 1.0.
 * Rows are banded by colour first (red act now → amber soon/money → blue waiting on them),
 * then ordered by score within the band, capped at 15.
 */
import type { ActionColour } from '@/shared/nextAction';
import type { NextActionKind } from '@/shared/lib/nextAction';
import type { JobInvoiceSummary, PipelineJob } from '../types/jobsPipeline.types';
import { personJobState, type PersonJobState } from '@/shared/jobState/personJobState';
import { getJobEnquiryPrice } from './display';
import { jobValue } from './pipelineView';

const DAY = 86_400_000;
export const TODAY_CAP = 15;
export const REVIVE_AFTER_DAYS = 60;
export const ABANDON_AFTER_DAYS = 90;
/** SM median open value, used only when nothing else is known (row shows "price?"). */
export const MEDIAN_VALUE = 2400;

/** Historic SM survival: jobs that reached age X with no deposit, and how many still won. */
const WIN_CURVE: [age: number, reached: number, wonAfter: number][] = [
  [0, 111, 15], [7, 105, 14], [14, 92, 10], [30, 80, 7], [60, 50, 2], [90, 27, 0],
];

function interp(age: number, col: 1 | 2): number {
  if (age >= 90) return WIN_CURVE[WIN_CURVE.length - 1][col];
  for (let i = 0; i < WIN_CURVE.length - 1; i++) {
    const [a0] = WIN_CURVE[i], [a1] = WIN_CURVE[i + 1];
    if (age >= a0 && age < a1) {
      const t = (age - a0) / (a1 - a0);
      return WIN_CURVE[i][col] + t * (WIN_CURVE[i + 1][col] - WIN_CURVE[i][col]);
    }
  }
  return WIN_CURVE[0][col];
}
/** P(win | reached this age without a deposit), from the SM history table. */
export function ageCurve(ageDays: number): number {
  const reached = interp(ageDays, 1);
  return reached > 0 ? interp(ageDays, 2) / reached : 0;
}
/** Share of a job's remaining win chance that lands within the next `days` (historic timing). */
export function closeWithin(ageDays: number, days: number): number {
  const now = interp(ageDays, 2);
  return now > 0 ? Math.max(0, now - interp(ageDays + days, 2)) / now : 0;
}

export interface Contact { lastIn: string | null; lastOut: string | null }
export interface QuoteMatch { amount: number; sentAt: string }

/** The order on this job. `total` is memorial + options + permit, not the deposit invoice. */
export interface OrderFigure {
  id: string;
  total: number;
  /** Memorial base. Falls back to `total` when the parts were not loaded. */
  memorial?: number;
  extras?: number;
  permit?: number;
  invoiceId?: string | null;
  invoiceSent: boolean;
  /** What the invoice asks for. Often the deposit, so it is not the order total. */
  invoiceAmount: number | null;
}

export interface OppInput {
  job: PipelineJob;
  inv?: JobInvoiceSummary;
  /** Present when the job has an order. Beats a deposit invoice and a guide price. */
  order?: OrderFigure | null;
  contact: Contact;
  quote: QuoteMatch | null;
}

export type ValueSource = 'order' | 'invoice' | 'gmail_quote' | 'guide' | 'median';
export type Bucket = 'today' | 'revive' | 'abandoned';

export interface Opportunity {
  job: PipelineJob;
  value: number;
  valueSource: ValueSource;
  quoteAt: string | null;
  orderId: string | null;
  pWin: number;
  score: number;
  ageDays: number;
  lastIn: string | null;
  lastOut: string | null;
  idleDays: number;
  waitingOnUs: boolean;
  neverContacted: boolean;
  bucket: Bucket;
  /** Shared stage label: Enquired, Quoted, Invoiced, Deposit paid. */
  displayStage: string;
  state: PersonJobState;
  action: { kind: Exclude<NextActionKind, 'none'>; label: string; colour: ActionColour; why: string };
}

const days = (from: string | null | undefined, now: Date) => {
  if (!from) return null;
  const t = new Date(from).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / DAY));
};
const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
const ago = (d: number) => (d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`);

/**
 * A sent quote counts even when its total equals the web-form guide (Jade, Toungporn).
 * The guide on its own, with no sent quote, is not a quote.
 */
export function quoteEchoesGuide(job: PipelineJob, quote: QuoteMatch | null): boolean {
  if (!quote) return false;
  const guide = getJobEnquiryPrice(job);
  return guide != null && Math.abs(quote.amount - guide) < 1;
}

function stateOf(i: OppInput, now: Date): PersonJobState {
  const guide = getJobEnquiryPrice(i.job);
  const order = i.order && i.order.total > 0 ? i.order : null;
  const permit = order?.permit ?? 0;
  const extras = order?.extras ?? 0;
  const memorial = order ? (order.memorial ?? Math.max(0, order.total - permit - extras)) : 0;
  const invoices = [];
  if (order?.invoiceSent || (i.inv && i.inv.count > 0)) {
    invoices.push({
      id: order?.invoiceId || `job:${i.job.id}`,
      orderId: order?.id ?? null,
      jobId: i.job.id,
      amount: order?.invoiceAmount ?? i.inv?.totalAmount ?? 0,
      status: 'pending' as string | null,
    });
  }
  return personJobState({
    jobId: i.job.id,
    jobStage: i.job.stage,
    jobExit: i.job.exit_reason,
    jobPaidAt: i.job.paid_at,
    order: order ? { id: order.id, memorial, extras, permit, invoiceId: order.invoiceId ?? null, depositDate: null } : null,
    invoices,
    sentQuote: i.quote?.amount ?? null,
    guide,
    paid: 0,
    lastIn: i.contact.lastIn,
    lastOut: i.contact.lastOut,
    now,
  });
}

export function dealValue(i: OppInput, now: Date = new Date()): { value: number; source: ValueSource } {
  const state = stateOf(i, now);
  if (state.value != null && state.valueKind !== 'unknown' && state.valueKind !== 'median') {
    return { value: state.value, source: state.valueKind };
  }
  const existing = jobValue(i.job, i.inv);
  if (existing != null && existing > 0) return { value: existing, source: 'guide' };
  return { value: MEDIAN_VALUE, source: 'median' };
}

export function winChance(i: OppInput, ageDays: number, touchDays: number): number {
  const base = ageCurve(ageDays);
  if (i.job.stage === 'invoiced') return touchDays <= 30 ? 0.6 : 0.25;
  // A sent quote roughly doubles the base (plan §2: Quoted ≈ 25% vs 13.5% base; estimate).
  // Only the Quoted stage gets the uplift: most SM enquiries get an emailed price, so the
  // historic base already includes them (a Gmail quote alone would double-count).
  if (i.job.stage === 'quoted') return Math.min(0.5, base * (0.25 / 0.135));
  return base;
}

export function buildOpportunity(i: OppInput, now: Date = new Date()): Opportunity {
  const { job } = i;
  const ageDays = days(job.created_at, now) ?? 0;
  const contactOut = i.contact.lastOut;
  // A quote's sent time can mark that we have been in touch. It must not hide a later reply.
  const lastOut = maxIso(contactOut, i.quote?.sentAt ?? null);
  const lastIn = i.contact.lastIn;
  const lastTouch = maxIso(lastIn, lastOut);
  const idleDays = days(lastTouch ?? job.created_at, now) ?? ageDays;
  const neverContacted = !lastOut;
  const waitingOnUs = !!lastIn && (!contactOut || lastIn > contactOut);
  const liveInvoice = ((i.inv?.count ?? 0) > 0 && (i.inv?.totalAmount ?? 0) > 0) || !!i.order?.invoiceSent;
  const state = stateOf(i, now);
  const value = state.value != null && state.valueKind !== 'unknown' ? state.value : dealValue(i, now).value;
  const source: ValueSource = state.valueKind !== 'unknown' && state.valueKind !== 'median' ? state.valueKind : dealValue(i, now).source;
  const pWin = winChance(i, ageDays, idleDays);
  const recency = idleDays <= 7 ? 1 : idleDays <= 30 ? 0.7 : idleDays <= 60 ? 0.4 : 0.15;
  const inDays = days(lastIn, now);
  const engagement = waitingOnUs ? 1.5 : inDays != null && inDays <= 14 ? 1.2 : 1;
  const score = value * pWin * recency * engagement;

  const bucket: Bucket =
    ageDays > ABANDON_AFTER_DAYS && idleDays > ABANDON_AFTER_DAYS ? 'abandoned'
      : idleDays > REVIVE_AFTER_DAYS ? 'revive' : 'today';

  const outDays = days(lastOut, now);
  const colour: ActionColour = state.nextKind === 'chase_deposit' || state.nextKind === 'send_quote' || state.nextKind === 'request_balance' || state.nextKind === 'follow_quote' && state.nextLabel === 'Gentle follow-up'
    ? 'amber'
    : state.nextKind === 'reply' || state.nextKind === 'first_contact' || state.nextKind === 'record_payment'
      ? 'red'
      : 'blue';
  const kind: Opportunity['action']['kind'] = state.nextKind === 'chase_deposit' || state.nextKind === 'record_payment'
    ? 'deposit'
    : state.nextKind === 'request_balance'
      ? 'balance'
      : state.nextKind === 'waiting' || (state.nextKind === 'follow_quote' && state.nextLabel !== 'Gentle follow-up')
        ? 'waiting'
        : 'follow';
  // An unpaid deposit wins over "they wrote". A reply never pastes a status label into the why.
  let action: Opportunity['action'] = {
    kind,
    label: state.nextLabel || 'Waiting',
    colour,
    why: state.nextWhy || 'Waiting',
  };
  if (neverContacted && state.nextKind !== 'chase_deposit') {
    action = { kind: 'follow', label: 'Make first contact', colour: 'red', why: lastIn ? `Enquired ${ago(days(lastIn, now)!)}, never contacted` : 'Never contacted' };
  } else if (state.nextKind === 'reply') {
    action = { ...action, label: (inDays ?? 0) >= 3 ? 'Call' : 'Reply', why: `Wrote ${ago(inDays ?? 0)}, waiting on us` };
  } else if ((job.stage === 'invoiced' || liveInvoice) && state.nextKind === 'waiting' && (outDays ?? 0) < 5) {
    action = { kind: 'waiting', label: 'Waiting on deposit', colour: 'blue', why: `Invoice sent ${ago(outDays ?? 0)}` };
  }

  return {
    job, value, valueSource: source, quoteAt: i.quote?.sentAt ?? null, orderId: state.orderId ?? i.order?.id ?? null,
    pWin, score, ageDays, lastIn, lastOut, idleDays, waitingOnUs, neverContacted, bucket, action,
    displayStage: state.stageLabel, state,
  };
}

const COLOUR_RANK: Record<ActionColour, number> = { red: 0, amber: 1, blue: 2, green: 3 };

/** Today list: red → amber → blue, then score (likelihood × value × recency). Capped. */
/** 0 = family wrote last and is waiting on our reply (ranks first); 1 = never contacted; 2 = the rest. */
export const familyWroteRank = (o: Pick<Opportunity, 'waitingOnUs' | 'neverContacted'>) => (o.waitingOnUs && !o.neverContacted ? 0 : o.neverContacted ? 1 : 2);

export function todayList(opps: Opportunity[], cap = TODAY_CAP): Opportunity[] {
  return opps
    .filter((o) => o.bucket === 'today')
    .sort((a, b) => familyWroteRank(a) - familyWroteRank(b) || COLOUR_RANK[a.action.colour] - COLOUR_RANK[b.action.colour] || b.score - a.score)
    .slice(0, cap);
}

export const byValue = (a: Opportunity, b: Opportunity) => b.value - a.value;

export interface Forecast {
  /** Σ value × p(win) over open, non-abandoned deals (lifetime). */
  weighted: number;
  expectedWins: number;
  /** This month: closed + Σ value × p(win) × P(closes before month end). */
  closedMtd: number;
  closedMtdCount: number;
  expectedMonth: number;
  expectedMonthLow: number;
  expectedMonthHigh: number;
  commit: number;
  bestCase: number;
  rawOpen: number;
  oldWeighted: number;
}

const OLD_ODDS: Record<string, number> = { enquired: 0.1, quoted: 0.4, invoiced: 0.8 };

export function forecast(opps: Opportunity[], closed: { value: number }[], now: Date = new Date()): Forecast {
  const live = opps.filter((o) => o.bucket !== 'abandoned');
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysLeft = Math.max(0, Math.ceil((monthEnd.getTime() - now.getTime()) / DAY));
  let weighted = 0, wins = 0, month = 0, variance = 0, commit = 0, best = 0, raw = 0, old = 0;
  for (const o of opps) {
    raw += o.value;
    old += o.value * (OLD_ODDS[o.job.stage] ?? 0);
  }
  for (const o of live) {
    weighted += o.value * o.pWin;
    wins += o.pWin;
    // Invoiced deals close fast (median 4d invoice → paid); others follow the age curve timing.
    const p = o.pWin * (o.job.stage === 'invoiced' ? (o.idleDays <= 30 ? 0.9 : 0.5) : closeWithin(o.ageDays, daysLeft));
    month += o.value * p;
    variance += o.value * o.value * p * (1 - p);
    if (o.job.stage === 'invoiced' && o.idleDays <= 30) commit += o.value;
    else if ((o.job.stage === 'quoted' || o.valueSource === 'gmail_quote') && o.idleDays <= 30 && o.lastIn && (now.getTime() - new Date(o.lastIn).getTime()) / DAY <= 14) best += o.value;
  }
  const closedMtd = closed.reduce((s, c) => s + c.value, 0);
  const sd = Math.sqrt(variance);
  return {
    weighted: Math.round(weighted), expectedWins: Math.round(wins * 10) / 10,
    closedMtd: Math.round(closedMtd), closedMtdCount: closed.length,
    expectedMonth: Math.round(closedMtd + month),
    expectedMonthLow: Math.round(closedMtd + Math.max(0, month - sd)),
    expectedMonthHigh: Math.round(closedMtd + month + sd),
    commit: Math.round(commit), bestCase: Math.round(commit + best), rawOpen: Math.round(raw), oldWeighted: Math.round(old),
  };
}

/**
 * Latest quoted total in one outbound email body. Ignores quoted-reply lines (">") and
 * the web-form "Guide total" (that is the estimate, not our quote). Prefers the memorial
 * "Total:" / "Total Price:" over "Total Amount Payable" (which adds the permit fee).
 */
export function extractQuoteAmount(body: string | null | undefined): number | null {
  if (!body) return null;
  const own = body.split(/\r?\n/).filter((l) => !/^\s*>/.test(l));
  // Stop at the reply header ("On Mon, ... wrote:") so older quotes in the thread are skipped.
  const cut = own.findIndex((l) => /^On .{6,120}wrote:\s*$/.test(l.trim()));
  const text = (cut >= 0 ? own.slice(0, cut) : own).join('\n');
  const money = '£\\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.([0-9]{2}))?';
  const pick = (re: RegExp) => {
    let last: number | null = null;
    for (const m of text.matchAll(re)) {
      const n = Number(m[1].replace(/,/g, '')) + (m[2] ? Number(m[2]) / 100 : 0);
      if (n >= 100 && n < 100_000) last = n;
    }
    return last;
  };
  return (
    pick(new RegExp(`(?<!guide\\s)(?<!amount payable)\\btotal(?: price| cost| quote)?\\*?\\s*[:\\-–]?\\s*\\*?\\s*${money}`, 'gi')) ??
    pick(new RegExp(`total amount payable\\*?\\s*[:\\-–]?\\s*\\*?\\s*${money}`, 'gi')) ??
    pick(new RegExp(`\\bquote(?:d)?(?: will be| would be| is| of| for| price| comes to| at)*\\s*[:\\-–]?\\s*\\*?${money}`, 'gi')) ??
    pick(new RegExp(`^\\W*memorial\\W*\\s*${money}`, 'gim'))
  );
}
