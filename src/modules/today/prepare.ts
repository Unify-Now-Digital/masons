/**
 * Prepared action for one Today row. Returns null when there is no draft,
 * template, or complete field set — the pane then shows the open-in-panel fallback.
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
  | { type: 'fields'; title: string; target: 'permit' | 'stone' | 'payments'; fields: PreparedField[]; uses: string[]; primary: string }
  | { type: 'call'; to: string; notes: string[]; uses: string[]; outcomes: string[] };

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

function prepareMessage(item: TodayItem): Prepared | null {
  const channel = messageChannel(item.channel);
  if (!channel) return null;
  const drafted = peekPrimedDraft(item.conversationId)?.trim();
  let paragraphs: string[] | null = null;
  const uses: string[] = [];
  if (drafted) {
    paragraphs = drafted.split(/\n{2,}/);
    uses.push('Saved draft');
  } else {
    const bucket = item.orderId ? 'order' as const : 'enquiry' as const;
    const options = buildChaseOptions(bucket, item.name);
    const deposit = /deposit/i.test(`${item.why} ${item.short}`);
    const pick = deposit ? options.find((o) => o.id === 'order-deposit-reminder') ?? options[0] : options[0];
    if (!pick?.body.trim()) return null;
    paragraphs = pick.body.split(/\n{2,}/);
    uses.push(pick.label);
  }
  if (!pricesAreSubset(paragraphs.join('\n\n'), uses)) return null;
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
  return { type: 'fields', title: 'Permit form', target: 'permit', fields, uses: ['Order'], primary: 'Send for signature & next' };
}

function prepareStone(item: TodayItem, data: BrandData | null): Prepared | null {
  if (item.kind !== 'order') return null;
  const order = findOrder(item, data);
  if (!order) return null;
  const product = order.custom_product_name?.trim() ?? '';
  const material = order.material?.trim() ?? '';
  const size = (data?.enquiries ?? []).find((e) => item.personId && e.person_id === item.personId && e.details?.size?.trim())?.details?.size?.trim() ?? '';
  const needed = order.installation_date?.trim() ?? '';
  if (!product || !material || !size || !needed) return null;
  const when = new Date(needed.length === 10 ? `${needed}T12:00:00` : needed);
  const neededLabel = Number.isNaN(when.getTime()) ? needed : when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return {
    type: 'fields',
    title: 'Stone order',
    target: 'stone',
    fields: [
      { label: 'Product', value: product, note: 'from order' },
      { label: 'Material', value: material, note: 'from order' },
      { label: 'Size', value: size, note: 'from order' },
      { label: 'Needed by', value: neededLabel, note: 'suggested' },
    ],
    uses: ['Order'],
    primary: 'Send order & next',
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
  return { type: 'call', to: item.name, notes, uses, outcomes: [...CALL_OUTCOMES] };
}

export function prepare(item: TodayItem, data: BrandData | null): Prepared | null {
  if (item.kind === 'call') return prepareCall(item, data);
  if (item.kind === 'reply' || item.kind === 'chase') return prepareMessage(item);
  if (item.kind === 'order') return prepareStone(item, data);
  if (item.kind === 'fix') return prepareFix(item, data);
  if (item.kind === 'send') return preparePermit(item, data);
  return null;
}
