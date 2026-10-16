/**
 * Today (Hub) model — pure, unit-tested. Operator input 14 Oct + Arin's decision (20:08):
 * ranked per brand (the caller only ever passes ONE organisation's rows, so CM and SM are
 * never mixed), five lanes, one action per row, realistic caps, stale items kept off Today.
 *
 * Action labels/colours follow the shell-v2 next-action language (red act now, amber soon,
 * green done, blue info). When src/shared/nextAction.ts lands on origin these verbs map
 * 1:1 onto its `nextActionStyle` colours.
 */
import { LANE_LIST_CAP } from '@/shared/priority/caps';
import { replySlaHours } from '@/shared/lib/replySla';
import { CALL_AFTER_HOURS, kindFor, type ActionKind } from './actionKind';

export type Lane = 'Sales' | 'CS' | 'Proofs' | 'Permits' | 'Finance';
export const LANES: Lane[] = ['Sales', 'CS', 'Proofs', 'Permits', 'Finance'];
/** Per-person daily caps from the purposes doc. Same numbers as Inbox Priority. */
export const LANE_CAPS: Record<Lane, number> = LANE_LIST_CAP;

export type Verb =
  | 'REPLY' | 'CALL' | 'CHASE' | 'QUOTE' | 'INVOICE' | 'SOFT FUP' | 'CONFIRM'
  | 'Send form' | 'Send proof' | 'Acknowledge form' | 'Submit & pay fee'
  | 'Match payment' | 'Request balance' | 'Record payment' | 'FLAG' | 'WAIT'
  // Shared-lane labels (hubLaneItems casts action.label onto Verb).
  | 'Reply' | 'Call' | 'Chase' | 'Make first contact' | 'Waiting on deposit'
  | 'Chase deposit' | 'Waiting on them' | 'Gentle follow-up' | 'Send quote'
  | 'Waiting' | 'Request deposit';

export type Colour = 'red' | 'amber' | 'green' | 'blue';

/** Rank tiers, best first (operator input): */
export enum Tier {
  IssueOrHardDate = 0, // customer issue, or a hard date within 7 days
  WaitingOnUs = 1, // a family waiting on us / chasing / promise passed
  MoneyDue = 2,
  NewEnquiry = 3, // new enquiry under 48h
  QuietQuote = 4, // quotes quiet 7+ days, highest value first
  Waiting = 5, // longest waiting
  OnHold = 6,
}
export const TIER_LABEL: Record<Tier, string> = {
  [Tier.IssueOrHardDate]: 'Issue or date this week',
  [Tier.WaitingOnUs]: 'Waiting on us',
  [Tier.MoneyDue]: 'Money due',
  [Tier.NewEnquiry]: 'New enquiry',
  [Tier.QuietQuote]: 'Quote gone quiet',
  [Tier.Waiting]: 'Longest waiting',
  [Tier.OnHold]: 'On hold',
};

export interface TodayInput {
  key: string;
  lane: Lane;
  name: string;
  ref?: string | null;
  verb: Verb;
  colour: Colour;
  tier: Tier;
  why: string;
  /** FLAG rows: who it goes to (never a bot draft). */
  flagTo?: 'Arin' | 'Matthew';
  valueGbp?: number | null;
  lastInAt?: string | null;
  /** Last OUTBOUND message/call by us (YOPA call-handling does not count). */
  lastOutAt?: string | null;
  /** Start of the waiting clock (first contact / created) when no message data exists. */
  sinceAt?: string | null;
  /** Sales items only: eligible for the Abandoned? / close-or-re-quote cut-offs. */
  staleable?: boolean;
  to: string;
  /** Order id when the row is about an order: opens the universal side panel in place. */
  orderId?: string | null;
  /** Context for the row (Hub v2): channel, what they asked, last message snippet. */
  channel?: string | null;
  subject?: string | null;
  snippet?: string | null;
  /** r2: person + conversation for the universal person panel / prepared reply. */
  personId?: string | null;
  conversationId?: string | null;
  /** r2: what they asked for (web quote form product, size/colour) and where the lead came from. */
  asked?: string | null;
  source?: string | null;
  /** Proof or permit row whose order has a fixing date. Ranking factor only. */
  blocksFixing?: boolean;
  /** Spec 11a.3 `why` list. Named `reasons` so the one-line `why` string the current page renders stays put. */
  reasons?: WhyFact[];
  factors?: string[];
  evidence?: EvidenceItem[];
  /** ≤ 28-character object phrase. Never starts with the verb. */
  short?: string;
}

export type SourceKind = 'whatsapp' | 'email' | 'stripe' | 'order' | 'pricelist' | 'rule' | 'calllog';
export interface SourceRef { kind: SourceKind; label: string }
export interface WhyFact { text: string; source: SourceRef; suggested?: boolean }
export interface EvidenceItem { source: SourceRef; at: Date; text: string; quote?: boolean; href?: string }

export type Bucket = 'late' | 'today' | 'fix' | 'old';
export type WaitingSide = 'us' | 'them' | 'record';

export interface TodayItem extends TodayInput {
  /** Whole days since our last message out (null = we never wrote). */
  daysSinceOut: number | null;
  /** Whole days since anything happened (last in, last out, or start). */
  quietDays: number;
  /** Days this item has been on the list before today (0 = new today). */
  carriedDays: number;
  kind: ActionKind;
  bucket: Bucket;
  waitingOn: WaitingSide;
  /** The event that started the clock (last inbound, else the row's since). */
  waitingSince: Date;
  /** Hours past the lane limit. Negative means time left. Null when the row has no clock. */
  lateBy: number | null;
  reasons: WhyFact[];
  factors: string[];
  evidence: EvidenceItem[];
  short: string;
}

const DAY = 86_400_000;
const t = (iso?: string | null) => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? n : null;
};
export const daysSince = (iso: string | null | undefined, now: number): number | null => {
  const n = t(iso);
  return n == null ? null : Math.max(0, Math.floor((now - n) / DAY));
};

/** Ball in our court: they wrote after our last message out (or we never replied). */
export function ballOnUs(lastInAt?: string | null, lastOutAt?: string | null): boolean {
  const i = t(lastInAt);
  if (i == null) return false;
  const o = t(lastOutAt);
  return o == null || i > o;
}

export const ABANDON_DAYS = 60;
export const CLOSE_DAYS = 90;

export interface TodayPlan {
  /** Per lane: the ranked rows that fit today's cap. */
  today: Record<Lane, TodayItem[]>;
  /** Per lane: rows beyond the cap (still ranked; they carry to tomorrow). */
  later: Record<Lane, TodayItem[]>;
  /** Quiet 60–89 days: a person confirms "Abandoned?" (never auto-closed). */
  abandoned: TodayItem[];
  /** Quiet 90+ days: close or re-quote. */
  closeOrRequote: TodayItem[];
  toDo: number;
  carried: number;
}

const HOUR = 3_600_000;
const RULE_SOURCE: SourceRef = { kind: 'rule', label: 'Business rule' };

/** Same clock as TodayPage `slaText`: last inbound, else since, against replySlaHours. Proofs has no lane of its own and uses the Sales 24h fallback. */
export function lateByHours(i: Pick<TodayInput, 'lane' | 'lastInAt' | 'sinceAt'>, now: number): number | null {
  const from = i.lastInAt ?? i.sinceAt;
  if (!from) return null;
  const start = Date.parse(from);
  if (!Number.isFinite(start)) return null;
  const age = Math.max(0, Math.floor((now - start) / HOUR));
  return age - replySlaHours(i.lane);
}

export function bucketFor(kind: ActionKind, lateBy: number | null): Bucket {
  if (kind === 'fix') return 'fix';
  if (lateBy != null && lateBy > CALL_AFTER_HOURS) return 'old';
  if (lateBy != null && lateBy > 0) return 'late';
  return 'today';
}

function waitingOnFor(kind: ActionKind): WaitingSide {
  if (kind === 'chase') return 'them';
  if (kind === 'fix') return 'record';
  return 'us';
}

function parseDate(iso: string | null | undefined, fallback: Date): Date {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? new Date(n) : fallback;
}

function formatSourceDay(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const nowYear = Number(new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'Europe/London' }).format(new Date(now)));
  if (!day || !month) return '';
  return year === nowYear ? `${day} ${month}` : `${day} ${month} ${year}`;
}

function messageSource(channel: string | null | undefined, at: string | null | undefined, now: number): SourceRef {
  const when = formatSourceDay(at, now);
  const ch = (channel ?? '').toLowerCase();
  const dated = (label: string) => (when ? `${label} · ${when}` : label);
  if (ch === 'whatsapp') return { kind: 'whatsapp', label: dated('WhatsApp') };
  if (ch === 'email') return { kind: 'email', label: dated('Email') };
  if (ch === 'phone' || ch === 'call') return { kind: 'calllog', label: dated('Call') };
  return { kind: 'rule', label: when ? `Message · ${when}` : RULE_SOURCE.label };
}

function orderSource(ref: string | null | undefined): SourceRef {
  const r = ref && ref !== '—' ? ref : null;
  return { kind: 'order', label: r ? `Order ${r}` : 'Order' };
}

function inboxHref(i: TodayInput): string | undefined {
  if (i.conversationId) return `/dashboard/inbox?conversation=${encodeURIComponent(i.conversationId)}`;
  if (i.to.includes('conversation=')) return i.to;
  return undefined;
}

/** Evidence "Open" link. A retired invoicing URL is rewritten onto the Finance invoice route. */
export function evidenceHref(to: string, orderId?: string | null): string | undefined {
  const dest = to.split('/dashboard/invoicing').join('/dashboard/finance');
  if (dest.startsWith('/dashboard/finance')) return dest;
  if (orderId) return `/dashboard/orders?order=${encodeURIComponent(orderId)}`;
  return undefined;
}

function orderHref(i: TodayInput): string | undefined {
  return evidenceHref(i.to, i.orderId);
}

/** Word for word, trimmed to 240 characters. */
export function trimQuote(text: string): string {
  const t = text.trim();
  if (t.length <= 240) return t;
  return `${t.slice(0, 239)}…`;
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function clipFactor(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= 18 ? t : t.slice(0, 18).trimEnd();
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function latenessFactor(lateBy: number | null): string | null {
  if (lateBy == null) return null;
  if (lateBy > 0) {
    if (lateBy >= 48) return `${plural(Math.max(1, Math.round(lateBy / 24)), 'day', 'days')} late`;
    return `${Math.floor(lateBy)}h late`;
  }
  const left = Math.floor(-lateBy);
  if (left <= 0) return 'Due today';
  if (left < 48) return left === 1 ? 'Due in 1 hour' : `Due in ${left} hours`;
  const days = Math.max(1, Math.round(left / 24));
  return days === 1 ? 'Due in 1 day' : `Due in ${days} days`;
}

function valueFactor(i: TodayInput): string | null {
  if (i.valueGbp == null || !Number.isFinite(i.valueGbp) || i.valueGbp <= 0) return null;
  const noun = i.lane === 'Sales' ? 'quote' : 'order';
  const label = `£${Math.round(i.valueGbp).toLocaleString('en-GB')} ${noun}`;
  if (label.length <= 18) return label;
  const bare = `£${Math.round(i.valueGbp).toLocaleString('en-GB')}`;
  return bare.length <= 18 ? bare : bare.slice(0, 18);
}

export function buildFactors(i: TodayInput, lateBy: number | null): string[] {
  const out: string[] = [];
  const late = latenessFactor(lateBy);
  if (late) out.push(late);
  const value = valueFactor(i);
  if (value) out.push(value);
  // Gender is not on the person row Today loads, so the pronoun is always "They".
  if (ballOnUs(i.lastInAt, i.lastOutAt)) out.push('They wrote last');
  if (i.blocksFixing && (i.lane === 'Proofs' || i.lane === 'Permits')) out.push('Blocks fixing');
  return out.slice(0, 4).map(clipFactor);
}

const VERB_WORD = /^(reply|call|chase|send|order|fix|confirm|quote|invoice|flag|waiting|follow|match|request|record|acknowledge|submit|soft)\b[\s:,.+\-–]*/i;

export function shortPhrase(i: Pick<TodayInput, 'asked' | 'why' | 'subject' | 'ref'>): string {
  const asked = i.asked?.split('·')[0]?.trim();
  let raw = (asked || i.why || i.subject || '').replace(VERB_WORD, '').trim();
  if (!raw) raw = i.ref && i.ref !== '—' ? i.ref : 'this';
  raw = raw.charAt(0).toLowerCase() + raw.slice(1);
  if (/^(reply|call|chase|send|order|fix)\b/i.test(raw)) raw = raw.replace(/^(reply|call|chase|send|order|fix)\b[\s:,.+\-–]*/i, '').trim();
  return clip(raw || 'this', 28);
}

function buildContent(i: TodayInput, now: number): { reasons: WhyFact[]; evidence: EvidenceItem[] } {
  const fallback = new Date(now);
  const evidence: EvidenceItem[] = [];
  const quote = i.snippet?.trim();
  if (quote) {
    const at = i.lastInAt ?? i.sinceAt;
    const row: EvidenceItem = {
      source: messageSource(i.channel, at, now),
      at: parseDate(at, fallback),
      text: trimQuote(quote),
      quote: true,
    };
    const href = inboxHref(i);
    if (href) row.href = href;
    evidence.push(row);
  }
  if (i.orderId || (i.ref && i.ref !== '—')) {
    const bits = [i.ref && i.ref !== '—' ? i.ref : null, i.asked?.trim() || null, i.why.trim() || null].filter((x): x is string => !!x);
    const row: EvidenceItem = {
      source: orderSource(i.ref),
      at: parseDate(i.sinceAt ?? i.lastOutAt ?? i.lastInAt, fallback),
      text: bits.join(' · ') || i.name,
    };
    const href = orderHref(i);
    if (href) row.href = href;
    evidence.push(row);
  } else if (/stripe/i.test(i.why)) {
    const when = formatSourceDay(i.sinceAt, now);
    evidence.push({
      source: { kind: 'stripe', label: when ? `Stripe · ${when}` : 'Stripe' },
      at: parseDate(i.sinceAt, fallback),
      text: i.why.trim() || i.name,
    });
  }
  if (!evidence.length) {
    evidence.push({
      source: RULE_SOURCE,
      at: parseDate(i.sinceAt ?? i.lastInAt ?? i.lastOutAt, fallback),
      text: i.why.trim() || i.name,
    });
  }
  const reasons: WhyFact[] = [];
  const sentence = i.why.trim() || evidence[0].text;
  // A message source is only used when the sentence is about that message. Other sentences
  // cite the order, Stripe, or the business rule — whichever evidence row actually holds them.
  const aboutMessage = /\b(replied|reply|waiting|wrote|message|asked)\b/i.test(sentence);
  const record = evidence.find((e) => e.source.kind === 'order' || e.source.kind === 'stripe');
  const sentenceSource = quote && aboutMessage ? evidence[0].source : record?.source ?? RULE_SOURCE;
  reasons.push({ text: sentence, source: sentenceSource });
  const asked = i.asked?.split('·')[0]?.trim();
  const orderEv = evidence.find((e) => e.source.kind === 'order');
  if (asked && orderEv && asked !== sentence && evidence.length > 1) {
    reasons.push({ text: asked, source: orderEv.source });
  }
  return { reasons: reasons.slice(0, 3), evidence: evidence.slice(0, 3) };
}

/** Fills reasons, evidence, factors and short from fields the rule already set. No inferred (suggested) lines. */
export function applyFacts(i: TodayInput, now: number): TodayInput {
  const lateBy = lateByHours(i, now);
  const built = i.reasons?.length && i.evidence?.length ? null : buildContent(i, now);
  const reasons = i.reasons?.length ? i.reasons : built!.reasons;
  const evidence = i.evidence?.length ? i.evidence : built!.evidence;
  const short = i.short?.trim() ? clip(i.short.trim(), 28) : shortPhrase(i);
  const factors = (i.factors?.length ? i.factors : buildFactors(i, lateBy)).slice(0, 4).map(clipFactor);
  return { ...i, reasons, evidence, short, factors };
}

export function annotateItem(i: TodayInput, now: number, carriedDays: number): TodayItem {
  const filled = applyFacts(i, now);
  const last = Math.max(t(filled.lastInAt) ?? 0, t(filled.lastOutAt) ?? 0, t(filled.sinceAt) ?? 0);
  const quietDays = last ? Math.max(0, Math.floor((now - last) / DAY)) : 0;
  const lateBy = lateByHours(filled, now);
  const kind = kindFor({ verb: filled.verb, lateBy });
  const from = filled.lastInAt ?? filled.sinceAt ?? filled.lastOutAt;
  const fromMs = from ? Date.parse(from) : NaN;
  return {
    ...filled,
    reasons: filled.reasons ?? [],
    evidence: filled.evidence ?? [],
    factors: (filled.factors ?? []).slice(0, 4).map(clipFactor),
    short: filled.short ?? shortPhrase(filled),
    daysSinceOut: daysSince(filled.lastOutAt, now),
    quietDays,
    carriedDays,
    lateBy,
    kind,
    bucket: bucketFor(kind, lateBy),
    waitingOn: waitingOnFor(kind),
    waitingSince: Number.isFinite(fromMs) ? new Date(fromMs) : new Date(now),
  };
}

const BUCKET_RANK: Record<Bucket, number> = { late: 0, today: 1, fix: 2, old: 3 };

export function compareRank(a: TodayItem, b: TodayItem): number {
  const bucketDelta = BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket];
  if (bucketDelta) return bucketDelta;
  if (a.bucket === 'today') {
    const left = (a.lateBy == null ? Number.POSITIVE_INFINITY : -a.lateBy) - (b.lateBy == null ? Number.POSITIVE_INFINITY : -b.lateBy);
    if (left) return left;
  } else if (a.bucket === 'late' || a.bucket === 'old') {
    const late = (b.lateBy ?? Number.NEGATIVE_INFINITY) - (a.lateBy ?? Number.NEGATIVE_INFINITY);
    if (late) return late;
  }
  const value = (b.valueGbp ?? Number.NEGATIVE_INFINITY) - (a.valueGbp ?? Number.NEGATIVE_INFINITY);
  if (value) return value;
  const since = a.waitingSince.getTime() - b.waitingSince.getTime();
  if (since) return since;
  return a.key.localeCompare(b.key);
}

/** One order for the queue and the "#n of N" label. `now` is the clock both share. */
export function rankToday(items: TodayItem[], now: number): TodayItem[] {
  if (!Number.isFinite(now)) return [...items];
  return [...items].sort(compareRank);
}

export interface TodayPersonGroup {
  personId: string | null;
  items: TodayItem[];
}

/** One row per person, items in rank order. The row's place is its best item. Rows with no person stay separate. */
export function groupByPerson(items: TodayItem[]): TodayPersonGroup[] {
  const ranked = rankToday(items, 0);
  const groups: TodayPersonGroup[] = [];
  const byPerson = new Map<string, TodayPersonGroup>();
  for (const item of ranked) {
    if (!item.personId) {
      groups.push({ personId: null, items: [item] });
      continue;
    }
    const existing = byPerson.get(item.personId);
    if (existing) existing.items.push(item);
    else {
      const group = { personId: item.personId, items: [item] };
      byPerson.set(item.personId, group);
      groups.push(group);
    }
  }
  return groups;
}

export function compareItems(a: TodayItem, b: TodayItem): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.tier === Tier.QuietQuote) {
    const v = (b.valueGbp ?? -1) - (a.valueGbp ?? -1);
    if (v) return v;
  }
  if (a.tier === Tier.NewEnquiry || a.tier === Tier.WaitingOnUs) {
    // Families waiting on us: newest first (team input), so fresh chases don't go cold.
    return (t(b.lastInAt) ?? 0) - (t(a.lastInAt) ?? 0);
  }
  // Longest waiting first.
  return b.quietDays - a.quietDays || a.key.localeCompare(b.key);
}

/**
 * `seen` maps item key → ISO day it first appeared on Today (persisted by the caller);
 * carriedDays = days since then. Only rows that make today's cut are counted as carried.
 */
export function buildToday(inputs: TodayInput[], now: number, seen: Record<string, string> = {}): TodayPlan {
  const today = Object.fromEntries(LANES.map((l) => [l, [] as TodayItem[]])) as TodayPlan['today'];
  const later = Object.fromEntries(LANES.map((l) => [l, [] as TodayItem[]])) as TodayPlan['later'];
  const abandoned: TodayItem[] = [];
  const closeOrRequote: TodayItem[] = [];
  const items: TodayItem[] = inputs.map((i) => {
    const first = seen[i.key];
    const carriedDays = first ? Math.max(0, daysSince(first, now) ?? 0) : 0;
    return annotateItem(i, now, carriedDays);
  });
  for (const i of items) {
    if (i.staleable && i.tier !== Tier.IssueOrHardDate) {
      if (i.quietDays >= CLOSE_DAYS) { closeOrRequote.push(i); continue; }
      if (i.quietDays >= ABANDON_DAYS) { abandoned.push(i); continue; }
    }
    later[i.lane].push(i);
  }
  let toDo = 0, carried = 0;
  for (const l of LANES) {
    const sorted = later[l].sort(compareItems);
    today[l] = sorted.slice(0, LANE_CAPS[l]);
    later[l] = sorted.slice(LANE_CAPS[l]);
    toDo += today[l].length;
    carried += today[l].filter((i) => i.carriedDays > 0).length;
  }
  abandoned.sort((a, b) => b.quietDays - a.quietDays);
  closeOrRequote.sort((a, b) => (b.valueGbp ?? 0) - (a.valueGbp ?? 0) || b.quietDays - a.quietDays);
  return { today, later, abandoned, closeOrRequote, toDo, carried };
}

/** Merge today's keys into the persisted first-seen map; drop keys no longer listed. */
export function updateSeen(prev: Record<string, string>, plan: TodayPlan, now: number): Record<string, string> {
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const iso = day.toISOString();
  const next: Record<string, string> = {};
  for (const l of LANES) for (const i of plan.today[l]) next[i.key] = prev[i.key] ?? iso;
  return next;
}

/** Plain header: "12 to do today · 3 carried over". */
export function headerText(plan: Pick<TodayPlan, 'toDo' | 'carried'>): string {
  return `${plan.toDo} to do today · ${plan.carried} carried over`;
}
