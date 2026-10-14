/** Route segment → pane title (moved from the removed PageShell top header). */
export const routeTitles: Record<string, string> = {
  hub: 'Hub',
  priority: 'Priority',
  logistics: 'Map',
  cemeteries: 'Cemeteries',
  pipeline: 'Orders pipeline',
  finance: 'Finance',
  orders: 'Orders',
  jobs: 'Jobs',
  map: 'Map of Jobs',
  inbox: 'Inbox',
  customers: 'People',
  team: 'Team Chat',
  payments: 'Payments',
  invoicing: 'Invoicing',
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
  pipeline: 'Every open order by stage, with counts and bottlenecks.',
  cemeteries: 'Workload grouped by cemetery — jobs, counts, last install.',
};

/** Suggested Ask-AI prompts for pages backed by the ask-ai edge function. Clicking one sends it. */
export const routeAiPrompts: Record<string, string[]> = {
  // Audit §3A: 1–2 chips per page, only questions not already answered on screen.
  orders: ['Balance due this month'],
  inquiries: ['Where is the pipeline stuck?', 'Quotes with no reply'],
  pipeline: ['Where is the pipeline stuck?', 'Quotes with no reply'],
  finance: ['Which invoices are overdue?', 'Balances due before install'],
};

export const DEFAULT_AI_PROMPTS: string[] = [];

/**
 * Routes whose page component already renders its own H1/H2 page title (checked by
 * rendering every /dashboard route, Oct 2026). The shell's pane title row is skipped
 * there so the title isn't shown twice.
 */
export const pagesWithOwnTitle = new Set<string>([
  'inquiries', 'map', 'jobs', 'orders', 'pipeline', 'cemeteries', 'customers', 'memorials',
  'inscriptions', 'permit-forms', 'payments', 'reporting', 'notifications',
  'workers', 'activity', 'sentry-monitor', 'settings', 'hub', 'finance',
]);

export function showsPaneTitle(segment: string): boolean {
  return !pagesWithOwnTitle.has(segment);
}

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere (most office PCs are Windows). */
export function searchShortcutLabel(platform: string | undefined | null): string {
  return /mac|iphone|ipad|ipod/i.test(platform ?? '') ? '⌘K' : 'Ctrl K';
}

export function shellSegment(pathname: string): string {
  return pathname.split('/').filter(Boolean).pop() ?? '';
}

export function titleFor(segment: string): string {
  return routeTitles[segment] ?? 'Dashboard';
}

/** Rail order (sections-v1): Hub, Inbox, Orders, Pipeline, Finance, Map; the rest go under "More". */
export const RAIL_PRIMARY_ROUTES = [
  '/dashboard/hub',
  '/dashboard/inbox',
  '/dashboard/orders',
  '/dashboard/inquiries',
  '/dashboard/finance',
  '/dashboard/logistics?tab=map',
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

export function aiPromptsFor(segment: string): string[] {
  return routeAiPrompts[segment] ?? DEFAULT_AI_PROMPTS;
}
