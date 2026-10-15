/**
 * Today (Hub) model — pure, unit-tested. Operator input 14 Oct + Arin's decision (20:08):
 * ranked per brand (the caller only ever passes ONE organisation's rows, so CM and SM are
 * never mixed), five lanes, one action per row, realistic caps, stale items kept off Today.
 *
 * Action labels/colours follow the shell-v2 next-action language (red act now, amber soon,
 * green done, blue info). When src/shared/nextAction.ts lands on origin these verbs map
 * 1:1 onto its `nextActionStyle` colours.
 */
export type Lane = 'Sales' | 'CS' | 'Proofs' | 'Permits' | 'Finance';
export const LANES: Lane[] = ['Sales', 'CS', 'Proofs', 'Permits', 'Finance'];
/** Per-person daily caps (team input): Sales ~15, CS ~8-10, Proofs 10, Permits ~7, Finance ~5. */
export const LANE_CAPS: Record<Lane, number> = { Sales: 15, CS: 10, Proofs: 10, Permits: 7, Finance: 5 };

export type Verb =
  | 'REPLY' | 'CALL' | 'CHASE' | 'QUOTE' | 'INVOICE' | 'SOFT FUP' | 'CONFIRM'
  | 'Send form' | 'Send proof' | 'Acknowledge form' | 'Submit & pay fee'
  | 'Match payment' | 'Request balance' | 'Record payment' | 'FLAG' | 'WAIT';

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
}

export interface TodayItem extends TodayInput {
  /** Whole days since our last message out (null = we never wrote). */
  daysSinceOut: number | null;
  /** Whole days since anything happened (last in, last out, or start). */
  quietDays: number;
  /** Days this item has been on the list before today (0 = new today). */
  carriedDays: number;
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
    const last = Math.max(t(i.lastInAt) ?? 0, t(i.lastOutAt) ?? 0, t(i.sinceAt) ?? 0);
    const quietDays = last ? Math.max(0, Math.floor((now - last) / DAY)) : 0;
    const first = seen[i.key];
    const carriedDays = first ? Math.max(0, daysSince(first, now) ?? 0) : 0;
    return { ...i, daysSinceOut: daysSince(i.lastOutAt, now), quietDays, carriedDays };
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
