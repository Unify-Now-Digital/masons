/**
 * Recent activity for the Today dock. Existing records only.
 * Email opens are included only when a message already stores an open time.
 */

export type ActivityIcon = 'message' | 'mail' | 'file' | 'card' | 'proof';

export interface ActivityEvent {
  id: string;
  at: string;
  when: string;
  title: string;
  quote?: string;
  detail?: string;
  href?: string;
  icon: ActivityIcon;
}

export interface ActivityMessage {
  id: string;
  at: string;
  direction: string;
  channel: string;
  body: string;
  conversationId: string;
  meta?: unknown;
}

export interface ActivityQuote {
  id: string;
  at: string;
  number: number | string;
  sentAt?: string | null;
  paidAt?: string | null;
}

export interface ActivityInvoice {
  id: string;
  at: string;
  number: string;
  sentAt?: string | null;
  paidAt?: string | null;
}

export interface ActivityOrderEvent {
  id: string;
  at: string;
  summary: string;
  detail?: string | null;
  orderId: string;
}

export interface ActivityProof {
  id: string;
  at: string;
  orderId: string;
  label?: string;
}

export interface RecentInput {
  messages?: ActivityMessage[];
  quotes?: ActivityQuote[];
  invoices?: ActivityInvoice[];
  orderEvents?: ActivityOrderEvent[];
  proofs?: ActivityProof[];
}

const OPEN_KEYS = ['opened_at', 'openedAt', 'email_opened_at'] as const;

/** A stored open time. Missing or blank means we do not invent one. */
export function storedOpenAt(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const bag = meta as Record<string, unknown>;
  for (const key of OPEN_KEYS) {
    const value = bag[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function formatActivityWhen(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function inboxHref(conversationId: string): string {
  return `/dashboard/inbox?conversation=${encodeURIComponent(conversationId)}`;
}

function orderHref(orderId: string): string {
  return `/dashboard/orders?order=${encodeURIComponent(orderId)}`;
}

interface RawEvent {
  id: string;
  at: string;
  title: string;
  quote?: string;
  detail?: string;
  href?: string;
  icon: ActivityIcon;
}

function messageIcon(channel: string): ActivityIcon {
  return channel.toLowerCase() === 'email' || channel.toLowerCase() === 'gmail' ? 'mail' : 'message';
}

/** Newest first, at most `limit` events. Opens appear only from stored open times. */
export function recentActivity(input: RecentInput, now: Date = new Date(), limit = 4): ActivityEvent[] {
  const raw: RawEvent[] = [];

  for (const message of input.messages ?? []) {
    const inbound = message.direction.toLowerCase() !== 'outbound';
    const body = clip(message.body);
    raw.push({
      id: message.id,
      at: message.at,
      title: inbound ? 'They wrote' : 'We wrote',
      quote: body || undefined,
      href: inboxHref(message.conversationId),
      icon: messageIcon(message.channel),
    });
    const opened = storedOpenAt(message.meta);
    if (opened) {
      raw.push({
        id: `${message.id}:open`,
        at: opened,
        title: 'Email opened',
        href: inboxHref(message.conversationId),
        icon: 'mail',
      });
    }
  }

  for (const quote of input.quotes ?? []) {
    const ref = `Q-${quote.number}`;
    raw.push({ id: `${quote.id}:created`, at: quote.at, title: `Quote ${ref} created`, icon: 'file' });
    if (quote.sentAt) raw.push({ id: `${quote.id}:sent`, at: quote.sentAt, title: `Quote ${ref} sent`, icon: 'file' });
    if (quote.paidAt) raw.push({ id: `${quote.id}:paid`, at: quote.paidAt, title: `Quote ${ref} paid`, icon: 'card' });
  }

  for (const invoice of input.invoices ?? []) {
    const ref = invoice.number;
    raw.push({
      id: `${invoice.id}:created`,
      at: invoice.at,
      title: `Invoice ${ref} created`,
      href: `/dashboard/finance?invoice=${encodeURIComponent(invoice.id)}`,
      icon: 'card',
    });
    if (invoice.sentAt) {
      raw.push({
        id: `${invoice.id}:sent`,
        at: invoice.sentAt,
        title: `Invoice ${ref} sent`,
        href: `/dashboard/finance?invoice=${encodeURIComponent(invoice.id)}`,
        icon: 'card',
      });
    }
    if (invoice.paidAt) {
      raw.push({
        id: `${invoice.id}:paid`,
        at: invoice.paidAt,
        title: `Invoice ${ref} paid`,
        href: `/dashboard/finance?invoice=${encodeURIComponent(invoice.id)}`,
        icon: 'card',
      });
    }
  }

  for (const event of input.orderEvents ?? []) {
    raw.push({
      id: event.id,
      at: event.at,
      title: event.summary,
      detail: event.detail?.trim() || undefined,
      href: orderHref(event.orderId),
      icon: 'file',
    });
  }

  for (const proof of input.proofs ?? []) {
    raw.push({
      id: proof.id,
      at: proof.at,
      title: proof.label?.trim() || 'Proof sent',
      href: orderHref(proof.orderId),
      icon: 'proof',
    });
  }

  return raw
    .filter((event) => Number.isFinite(Date.parse(event.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : -1))
    .slice(0, limit)
    .map((event) => ({ ...event, when: formatActivityWhen(event.at, now) }));
}
