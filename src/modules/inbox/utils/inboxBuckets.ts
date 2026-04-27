import type { InboxConversation } from '@/modules/inbox/types/inbox.types';
import type { Order } from '@/modules/orders/types/orders.types';
import type { Cemetery } from '@/modules/permitTracker/types/permitTracker.types';
import type { EnquiryExtractionRow } from '@/modules/inbox/hooks/useEnquiryExtractions';

/**
 * Workflow bucket a conversation belongs to.
 * - `enquiry`: incoming lead, no order yet (or unlinked).
 * - `order`: existing customer with an open order.
 * - `cemetery`: cemetery / council / authority correspondence (paperwork side).
 */
export type InboxBucket = 'enquiry' | 'order' | 'cemetery';

export const BUCKET_LABEL: Record<InboxBucket, string> = {
  enquiry: 'New enquiry',
  order: 'Existing order',
  cemetery: 'Cemetery',
};

/**
 * SLA in milliseconds for each bucket, split by who currently owes a reply.
 * Cemetery thresholds align with the permit tracker's existing model
 * (15d = chase_this_week / amber, 29d = action_needed / red).
 */
const DAY = 24 * 60 * 60 * 1000;

interface BucketSla {
  /** When ball is with us: red threshold (we owe a reply). Amber = half. */
  usOwesMs: number;
  /** When ball is with them: amber threshold (early-warning chase). */
  themOwesAmberMs: number;
  /** When ball is with them: red threshold (definitely time to chase). */
  themOwesRedMs: number;
}

export const BUCKET_SLA: Record<InboxBucket, BucketSla> = {
  enquiry: {
    usOwesMs: 4 * 60 * 60 * 1000, // 4h — first-response SLA on leads.
    themOwesAmberMs: 3 * DAY,
    themOwesRedMs: 5 * DAY,
  },
  order: {
    usOwesMs: 24 * 60 * 60 * 1000,
    themOwesAmberMs: 3 * DAY,
    themOwesRedMs: 5 * DAY,
  },
  cemetery: {
    usOwesMs: 24 * 60 * 60 * 1000,
    themOwesAmberMs: 15 * DAY, // matches permit tracker chase_this_week
    themOwesRedMs: 29 * DAY, // matches permit tracker action_needed
  },
};

// ----------------------------------------------------------------------------
// Open-order helper
// ----------------------------------------------------------------------------

/**
 * An order is considered "open" until it has been installed AND the second
 * payment recorded. A returning customer whose old job is fully closed should
 * not be classified as an existing-order conversation.
 */
export function isOrderOpen(order: Order): boolean {
  if (!order.installation_date) return true;
  const installed = Date.parse(order.installation_date);
  if (Number.isNaN(installed)) return true;
  if (installed > Date.now()) return true; // future install
  return !order.second_payment_date;
}

// ----------------------------------------------------------------------------
// Classifier
// ----------------------------------------------------------------------------

/** Inputs the classifier needs; all derived once at the page level. */
export interface ClassificationContext {
  /** Lower-cased set of cemetery contact emails (cemeteries.primary_email + orders.permit_cemetery_email). */
  cemeteryEmails: Set<string>;
  /** Set of permit gmail thread ids from open orders. */
  permitThreadIds: Set<string>;
  /** True iff conversation.person_id has at least one OPEN order. */
  personHasOpenOrders: boolean;
  /** Latest AI extraction row for this conversation, if any. */
  extraction: EnquiryExtractionRow | null;
  /** Looked-up order (by `c.order_id`) when present. */
  linkedOrder: Order | null;
}

/** Confidence floor for trusting an AI extraction's order_type. */
const EXTRACTION_TRUST_CONFIDENCE = 70;

function normalizeEmail(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * Decide which bucket a conversation belongs to. Order of precedence is
 * deliberate: authoritative DB links beat AI guesses beat substring fallbacks.
 */
export function classifyConversation(
  c: InboxConversation,
  ctx: ClassificationContext
): InboxBucket {
  const handle = normalizeEmail(c.primary_handle);

  // 1. Authoritative cemetery signals first (these never lie).
  if (handle && ctx.cemeteryEmails.has(handle)) return 'cemetery';
  if (c.external_thread_id && ctx.permitThreadIds.has(c.external_thread_id)) return 'cemetery';

  // 2. Linked order whose permit phase is still active and the other side IS the cemetery.
  if (ctx.linkedOrder) {
    const cemEmail = normalizeEmail(ctx.linkedOrder.permit_cemetery_email);
    if (cemEmail && cemEmail === handle) return 'cemetery';
    // Otherwise: the conversation is about this order (customer side).
    return 'order';
  }

  // 3. AI extraction (only when confident enough).
  const ex = ctx.extraction;
  if (ex && (ex.confidence ?? 0) >= EXTRACTION_TRUST_CONFIDENCE) {
    if (ex.linked_order_id) return 'order';
    switch (ex.order_type) {
      case 'additional_inscription':
      case 'status_query':
        return 'order';
      case 'new_memorial':
      case 'quote':
      case 'trade':
        return 'enquiry';
    }
  }

  // 4. Person has an open order → existing-order conversation.
  if (c.person_id && ctx.personHasOpenOrders) return 'order';

  // 5. Fallback: enquiry.
  return 'enquiry';
}

// ----------------------------------------------------------------------------
// Ball-in-court + aging
// ----------------------------------------------------------------------------

export type Side = 'us' | 'them';
export type AgingLevel = 'fresh' | 'amber' | 'red';

export interface BallInCourt {
  side: Side;
  /** Time since the ball moved to this side. */
  sinceMs: number;
}

/**
 * Returns who currently owes a reply, or null if we can't tell.
 * "Us owes" means an inbound is the most recent direction.
 */
export function deriveBallInCourt(
  c: Pick<InboxConversation, 'last_inbound_at' | 'last_outbound_at' | 'last_message_at' | 'unread_count'>,
  now: number = Date.now()
): BallInCourt | null {
  const inb = c.last_inbound_at ? Date.parse(c.last_inbound_at) : NaN;
  const out = c.last_outbound_at ? Date.parse(c.last_outbound_at) : NaN;
  const haveInb = !Number.isNaN(inb);
  const haveOut = !Number.isNaN(out);

  if (haveInb && haveOut) {
    if (inb >= out) return { side: 'us', sinceMs: Math.max(0, now - inb) };
    return { side: 'them', sinceMs: Math.max(0, now - out) };
  }
  if (haveInb) return { side: 'us', sinceMs: Math.max(0, now - inb) };
  if (haveOut) return { side: 'them', sinceMs: Math.max(0, now - out) };

  // Pre-migration fallback: if directional columns are absent, infer from unread.
  // Unread inbound implies us-owes; otherwise we have no signal.
  const last = c.last_message_at ? Date.parse(c.last_message_at) : NaN;
  if (!Number.isNaN(last) && (c.unread_count ?? 0) > 0) {
    return { side: 'us', sinceMs: Math.max(0, now - last) };
  }
  return null;
}

export interface AgingInfo {
  ball: BallInCourt;
  level: AgingLevel;
  isStuck: boolean;
  shortLabel: string;
}

export function computeAging(
  ball: BallInCourt | null,
  bucket: InboxBucket
): AgingInfo | null {
  if (!ball) return null;
  const sla = BUCKET_SLA[bucket];
  let level: AgingLevel = 'fresh';
  if (ball.side === 'us') {
    if (ball.sinceMs >= sla.usOwesMs) level = 'red';
    else if (ball.sinceMs >= sla.usOwesMs / 2) level = 'amber';
  } else {
    if (ball.sinceMs >= sla.themOwesRedMs) level = 'red';
    else if (ball.sinceMs >= sla.themOwesAmberMs) level = 'amber';
  }
  return {
    ball,
    level,
    isStuck: level === 'red',
    shortLabel: formatShortAge(ball.sinceMs),
  };
}

function formatShortAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ----------------------------------------------------------------------------
// Badge styling
// ----------------------------------------------------------------------------

export interface AgingBadgeStyle {
  container: string;
  tail: string;
}

export const AGING_LEVEL_STYLES: Record<AgingLevel, AgingBadgeStyle> = {
  fresh: {
    container: 'bg-gardens-grn-lt text-gardens-grn-dk border-gardens-grn-lt',
    tail: 'text-gardens-grn-dk/70',
  },
  amber: {
    container: 'bg-gardens-amb-lt text-gardens-amb-dk border-gardens-amb-lt',
    tail: 'text-gardens-amb-dk/70',
  },
  red: {
    container: 'bg-gardens-red-lt text-gardens-red-dk border-gardens-red-lt',
    tail: 'text-gardens-red-dk/70',
  },
};

// ----------------------------------------------------------------------------
// Context builder helpers (called once at the page level)
// ----------------------------------------------------------------------------

/**
 * Build the lower-cased set of cemetery contact emails from the cemeteries
 * directory plus any per-order overrides.
 */
export function buildCemeteryEmailSet(cemeteries: Cemetery[], orders: Order[]): Set<string> {
  const set = new Set<string>();
  for (const cem of cemeteries) {
    const e = normalizeEmail(cem.primary_email ?? null);
    if (e) set.add(e);
  }
  for (const o of orders) {
    const e = normalizeEmail(o.permit_cemetery_email ?? null);
    if (e) set.add(e);
  }
  return set;
}

/** Build the set of Gmail thread ids that are known to be permit threads on open orders. */
export function buildPermitThreadIdSet(orders: Order[]): Set<string> {
  const set = new Set<string>();
  for (const o of orders) {
    if (!isOrderOpen(o)) continue;
    if (o.permit_gmail_thread_id) set.add(o.permit_gmail_thread_id);
  }
  return set;
}

/** Set of person ids with at least one open order. */
export function buildPersonHasOpenOrdersSet(orders: Order[]): Set<string> {
  const set = new Set<string>();
  for (const o of orders) {
    if (!o.person_id) continue;
    if (isOrderOpen(o)) set.add(o.person_id);
  }
  return set;
}

/** Map of orderId -> Order, for quick linkedOrder lookup by `conversation.order_id`. */
export function buildOrderById(orders: Order[]): Map<string, Order> {
  const map = new Map<string, Order>();
  for (const o of orders) map.set(o.id, o);
  return map;
}
