/**
 * Prepared action for one Today row. A draft is prepared for every task type
 * when one can be built without inventing a price. Returns null only when a
 * saved draft quotes a £ amount that is not in its sources.
 * No new AI call. A message body may not contain a price that is absent from `uses`.
 */
import { buildChaseOptions } from '@/modules/inbox/utils/chaseTemplates';
import { peekPrimedDraft } from '@/modules/inbox/utils/primedDraft';
import type { BrandData, InvoicePaymentRow, OrderPaymentRow, OrderRow } from './brandData.types';
import type { TodayItem } from './todayModel';

export interface PreparedField {
  label: string;
  value: string;
  note: string;
}

export type Prepared =
  | { type: 'message'; channel: 'whatsapp' | 'email'; to: string; body: string[]; uses: string[]; primary: string }
  | { type: 'fields'; title: string; target: 'permit' | 'stone' | 'payments' | 'open'; fields: PreparedField[]; uses: string[]; primary: string }
  | { type: 'call'; to: string; notes: string[]; uses: string[]; outcomes: string[]; primary: string };

export const CALL_OUTCOMES = ['Spoke · update order', 'No answer · try tomorrow', 'Left voicemail'] as const;

const DAY = 86_400_000;
const PRICE = /£\s?\d[\d,]*(?:\.\d{1,2})?/g;

export function pricesIn(text: string): string[] {
  return [...text.matchAll(PRICE)].map((m) => m[0].replace(/\s+/g, ''));
}

/** Every £ amount in `body` also appears in one of `sources`. */
export function pricesAreSubset(body: string, sources: string[]): boolean {
  const allowed = new Set(sources.flatMap(pricesIn));
  return pricesIn(body).every((p) => allowed.has(p));
}

function messageChannel(channel: string | null | undefined): 'whatsapp' | 'email' | null {
  const c = (channel ?? '').toLowerCase();
  if (c === 'whatsapp') return 'whatsapp';
  if (c === 'email' || c === 'gmail') return 'email';
  return null;
}

function findOrder(item: TodayItem, data: BrandData | null): OrderRow | null {
  const orders = data?.orders ?? [];
  if (item.orderId) return orders.find((o) => o.id === item.orderId) ?? null;
  if (item.personId) return orders.find((o) => o.person_id === item.personId) ?? null;
  return null;
}

function anchorMs(iso: string): number {
  return Date.parse(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

function sameName(a: string | null | undefined, b: string): boolean {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
}

/** Stripe payments for this customer within ±3 days of the marked-paid date. Invoice amounts are pence. */
export function stripeDepositMatches(
  item: Pick<TodayItem, 'name' | 'sinceAt'>,
  data: BrandData,
  order: OrderRow | null,
): { amount: number; at: string }[] {
  const anchorIso = order?.deposit_date || item.sinceAt || null;
  if (!anchorIso) return [];
  const anchor = anchorMs(anchorIso);
  if (!Number.isFinite(anchor)) return [];
  const hits: { amount: number; at: string }[] = [];
  const invoices = (data.invoices ?? []).filter((inv) => (order ? inv.order_id === order.id : sameName(inv.customer_name, item.name)));
  const invoiceIds = new Set(invoices.map((inv) => inv.id));
  for (const pay of data.invoicePayments ?? []) {
    if (!isStripeInvoice(pay) || !pay.invoice_id || !invoiceIds.has(pay.invoice_id)) continue;
    const at = pay.received_at ?? pay.created_at;
    if (!at || Math.abs(anchorMs(at) - anchor) > 3 * DAY) continue;
    const invoice = invoices.find((inv) => inv.id === pay.invoice_id);
    const who = invoice?.customer_name || order?.customer_name;
    if (who && !sameName(who, item.name)) continue;
    const pounds = Number(pay.amount) / 100;
    if (Number.isFinite(pounds)) hits.push({ amount: pounds, at });
  }
  for (const pay of data.orderPayments ?? []) {
    if (!isStripeOrder(pay)) continue;
    if (order && pay.order_id !== order.id) continue;
    if (!order && !sameName(pay.counterparty_name, item.name)) continue;
    const at = pay.received_at;
    if (!at || Math.abs(anchorMs(at) - anchor) > 3 * DAY) continue;
    const who = pay.counterparty_name || order?.customer_name || item.name;
    if (!sameName(who, item.name)) continue;
    const pounds = Number(pay.amount);
    if (Number.isFinite(pounds)) hits.push({ amount: pounds, at });
  }
  return hits;
}

function isStripeInvoice(pay: InvoicePaymentRow): boolean {
  return (pay.source ?? '').toLowerCase() === 'stripe' || !!pay.stripe_payment_intent_id || !!pay.stripe_charge_id;
}

function isStripeOrder(pay: OrderPaymentRow): boolean {
  return (pay.source ?? '').toLowerCase() === 'stripe';
}

function greetingName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/** A price-free note when no chase template applies. Never invents a £ amount. */
function fallbackMessage(item: TodayItem, channel: 'whatsapp' | 'email'): Prepared {
  const about = (item.short || item.why || 'your memorial').replace(PRICE, '').replace(/\s+/g, ' ').trim() || 'your memorial';
  return {
    type: 'message',
    channel,
    to: item.name,
    body: [`Hi ${greetingName(item.name)},\n\nJust a note about ${about}. Happy to help with anything you need.\n\nKind regards,`],
    uses: [item.short || item.why || 'Business rule'],
    primary: 'Send & next',
  };
}

function proofMessage(item: TodayItem, channel: 'whatsapp' | 'email'): Prepared {
  return {
    type: 'message',
    channel,
    to: item.name,
    body: [`Hi ${greetingName(item.name)},\n\nThe proof for your memorial is ready. Please have a look and tell me if anything needs changing before we go ahead.\n\nKind regards,`],
    uses: ['Proof'],
    primary: 'Send & next',
  };
}

/**
 * Message draft for a reply, chase, or send. A saved draft that quotes a price
 * we cannot ground returns null — we do not swap in a different body.
 * With no saved draft, a chase template (or a price-free fallback) is always prepared.
 */
function prepareMessage(item: TodayItem): Prepared | null {
  const channel = messageChannel(item.channel) ?? 'email';
  const drafted = peekPrimedDraft(item.conversationId)?.trim();
  if (drafted) {
    const paragraphs = drafted.split(/\n{2,}/);
    const uses = ['Saved draft'];
    if (!pricesAreSubset(paragraphs.join('\n\n'), uses)) return null;
    return { type: 'message', channel, to: item.name, body: paragraphs, uses, primary: 'Send & next' };
  }
  if (item.lane === 'Proofs' || /proof/i.test(`${item.verb} ${item.why}`)) return proofMessage(item, channel);
  const bucket = item.orderId ? 'order' as const : 'enquiry' as const;
  const options = buildChaseOptions(bucket, item.name);
  const deposit = /deposit/i.test(`${item.why} ${item.short}`);
  const pick = deposit ? options.find((o) => o.id === 'order-deposit-reminder') ?? options[0] : options[0];
  if (!pick?.body.trim()) return fallbackMessage(item, channel);
  const paragraphs = pick.body.split(/\n{2,}/);
  const uses = [pick.label];
  if (!pricesAreSubset(paragraphs.join('\n\n'), uses)) return fallbackMessage(item, channel);
  return { type: 'message', channel, to: item.name, body: paragraphs, uses, primary: 'Send & next' };
}

function preparePermit(item: TodayItem, data: BrandData | null): Prepared | null {
  if (item.kind !== 'send') return null;
  const permit = item.lane === 'Permits' || /form|permit/i.test(item.verb);
  if (!permit) return null;
  const order = findOrder(item, data);
  if (!order) return null;
  const fields: PreparedField[] = [];
  if (order.sku?.trim()) fields.push({ label: 'Plot', value: order.sku.trim(), note: 'from order' });
  if (order.custom_product_name?.trim()) fields.push({ label: 'Memorial', value: order.custom_product_name.trim(), note: 'from order' });
  if (order.inscription_text?.trim()) fields.push({ label: 'Inscription', value: order.inscription_text.trim(), note: 'from order' });
  if (order.inscription_status?.trim()) fields.push({ label: 'Inscription status', value: order.inscription_status.trim(), note: 'from order' });
  fields.push({ label: 'Owner signature', value: '', note: 'missing' });
  fields.push({ label: 'Deed number', value: '', note: 'missing' });
  return { type: 'fields', title: 'Permit form', target: 'permit', fields, uses: ['Order'], primary: 'Send & next' };
}

function prepareStone(item: TodayItem, data: BrandData | null): Prepared | null {
  if (item.kind !== 'order') return null;
  const order = findOrder(item, data);
  const product = order?.custom_product_name?.trim() ?? '';
  const material = order?.material?.trim() ?? '';
  const size = (data?.enquiries ?? []).find((e) => item.personId && e.person_id === item.personId && e.details?.size?.trim())?.details?.size?.trim() ?? '';
  const needed = order?.installation_date?.trim() ?? '';
  const when = needed ? new Date(needed.length === 10 ? `${needed}T12:00:00` : needed) : null;
  const neededLabel = when && !Number.isNaN(when.getTime())
    ? when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : needed;
  return {
    type: 'fields',
    title: 'Stone order',
    target: 'stone',
    fields: [
      { label: 'Product', value: product, note: product ? 'from order' : 'missing' },
      { label: 'Material', value: material, note: material ? 'from order' : 'missing' },
      { label: 'Size', value: size, note: size ? 'from order' : 'missing' },
      { label: 'Needed by', value: neededLabel, note: needed ? 'suggested' : 'missing' },
    ],
    uses: ['Order'],
    primary: 'Send & next',
  };
}

function prepareFix(item: TodayItem, data: BrandData | null): Prepared | null {
  if (item.kind !== 'fix') return null;
  if (!/payment|deposit/i.test(`${item.verb} ${item.why} ${item.short}`)) return null;
  const order = findOrder(item, data);
  const matches = data ? stripeDepositMatches(item, data, order) : [];
  const one = matches.length === 1 ? matches[0] : null;
  const amount = one
    ? `£${one.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '';
  return {
    type: 'fields',
    title: 'Record deposit',
    target: 'payments',
    fields: [{ label: 'Amount', value: amount, note: one ? 'from Stripe' : 'missing' }],
    uses: one ? [`Stripe £${one.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`] : ['Order'],
    primary: one ? 'Save & next' : 'Choose payment',
  };
}

function prepareCall(item: TodayItem, data: BrandData | null): Prepared {
  const notes: string[] = [];
  const uses = ['Business rule'];
  if (item.lateBy != null && item.lateBy > 168) notes.push('This has waited more than a week. Start with an apology.');
  const question = item.snippet?.trim() || item.why?.trim() || item.short;
  if (question) notes.push(question);
  const order = (data?.orders ?? []).find((o) => item.personId && o.person_id === item.personId && !o.deposit_date);
  if (order && item.kind === 'call') {
    const ref = order.order_number != null ? `ORD-${String(order.order_number).padStart(6, '0')}` : 'the order';
    notes.push(`Deposit is not recorded on ${ref}.`);
    uses.push('Order');
  }
  return { type: 'call', to: item.name, notes, uses, outcomes: [...CALL_OUTCOMES], primary: 'Logged & next' };
}

/** Office note for a row that is not a customer message (void invoices, flags, unmatched). */
function prepareNote(item: TodayItem): Prepared {
  const title = item.flagTo ? `For ${item.flagTo}` : 'Check the record';
  const what = (item.why || item.short || 'Review this record').trim();
  return {
    type: 'fields',
    title,
    target: 'open',
    fields: [{ label: 'What to do', value: what, note: 'from the list' }],
    uses: [what],
    primary: 'Open & next',
  };
}

export function prepare(item: TodayItem, data: BrandData | null): Prepared | null {
  if (item.kind === 'call') return prepareCall(item, data);
  if (item.kind === 'reply' || item.kind === 'chase') return prepareMessage(item);
  if (item.kind === 'order') return prepareStone(item, data);
  if (item.kind === 'fix') return prepareFix(item, data) ?? prepareNote(item);
  if (item.kind === 'send') return preparePermit(item, data) ?? prepareMessage(item);
  return prepareNote(item);
}
