/** Route segment → pane title (moved from the removed PageShell top header). */
export const routeTitles: Record<string, string> = {
  hub: 'Hub',
  priority: 'Priority',
  logistics: 'Mapping',
  cemeteries: 'Cemeteries',
  pipeline: 'Orders pipeline',
  finance: 'Finance',
  'proof-review': 'Inscriptions',
  'permit-chase': 'Permits',
  orders: 'Orders',
  jobs: 'Jobs',
  map: 'Map of Jobs',
  inbox: 'Inbox',
  customers: 'People',
  team: 'Team Chat',
  payments: 'Payments',
  invoicing: 'Invoicing',
  'permit-tracker': 'Permit Tracker',
  'permit-forms': 'Permit Forms',
  reporting: 'Reports',
  workers: 'Workers',
  settings: 'Settings',
  'sentry-monitor': 'Monitoring',
  activity: 'Activity',
  companies: 'Companies',
  memorials: 'Products',
  inscriptions: 'Inscriptions',
  notifications: 'Notifications',
};

/** Route segment → pane subtitle (optional). */
export const routeSubtitles: Record<string, string> = {
  hub: 'Pipeline, balances and the state of the book of work.',
  priority: 'AI-flagged and manually-flagged orders that need your attention now.',
  logistics: 'Jobs on a map — route planning and cemetery clustering.',
  finance: 'All invoices in one place — balances, aging and payment status.',
  'proof-review': 'AI checks the proof against the brief and house style before it leaves.',
  'permit-chase': '5-stage pipeline with dwell-time bars and council chases.',
  pipeline: 'Every open order by stage, with counts and bottlenecks.',
  cemeteries: 'Workload grouped by cemetery — jobs, counts, last install.',
};

/** Suggested Ask-AI prompts for pages backed by the ask-ai edge function. Clicking one sends it. */
export const routeAiPrompts: Record<string, string[]> = {
  orders: ['Which orders are overdue?', 'What is blocking open orders?', 'Summarise permit status'],
  inquiries: ['How many jobs are in each stage?', 'Where is the pipeline stuck?'],
  pipeline: ['How many jobs are in each stage?', 'Where is the pipeline stuck?'],
  finance: ['What is outstanding?', 'Which invoices are overdue?', 'Balances due before install'],
};

export const DEFAULT_AI_PROMPTS: string[] = [];

export function shellSegment(pathname: string): string {
  return pathname.split('/').filter(Boolean).pop() ?? '';
}

export function titleFor(segment: string): string {
  return routeTitles[segment] ?? 'Dashboard';
}

export function aiPromptsFor(segment: string): string[] {
  return routeAiPrompts[segment] ?? DEFAULT_AI_PROMPTS;
}

/** Rail order (Mason UI phase 1): Inbox, Orders, Pipeline, Finance; the rest go under "More". */
export const RAIL_PRIMARY_ROUTES = [
  '/dashboard/inbox',
  '/dashboard/orders',
  '/dashboard/inquiries',
  '/dashboard/finance',
] as const;

interface RailItemLike {
  to: string;
  hidden?: boolean;
  requiresFinancials?: boolean;
}

/** Same visibility rules as the old sidebar (hidden / requiresFinancials), split for the rail. */
export function splitRailItems<T extends RailItemLike>(
  items: T[],
  canViewFinancials: boolean,
): { primary: T[]; more: T[] } {
  const visible = items.filter((i) => !i.hidden && (!i.requiresFinancials || canViewFinancials));
  const primary = RAIL_PRIMARY_ROUTES
    .map((to) => visible.find((i) => i.to === to))
    .filter((i): i is T => !!i);
  const more = visible.filter((i) => !(RAIL_PRIMARY_ROUTES as readonly string[]).includes(i.to));
  return { primary, more };
}

/** Rail badge text: "99+" cap so the badge never outgrows the rail item. */
export function formatBadgeCount(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 99 ? '99+' : String(Math.floor(n));
}

export type AskAiMode = 'ask-ai' | 'panel' | 'none';

/** Which Ask AI the bottom bar offers: the ask-ai function, the page's registered panel, or none (toggle hidden). */
export function resolveAskAiMode(askAiPage: string | null, hasRegisteredPanel: boolean): AskAiMode {
  if (askAiPage) return 'ask-ai';
  if (hasRegisteredPanel) return 'panel';
  return 'none';
}
