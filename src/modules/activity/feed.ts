/** Activity feed grouping. London dates, because the workshops are in the UK. */

export interface FeedEvent {
  id: string;
  type: string;
  category: string;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  order_id: string | null;
  actor_type: string;
  title: string;
  body: string | null;
  payload: { children?: { title?: string; detail?: string; job_code?: string; from?: string; to?: string }[] } | null;
  created_at: string;
  resolved_at: string | null;
}

export type FeedFilter = 'all' | 'action' | 'sales' | 'orders' | 'supplier' | 'finance' | 'permits' | 'system';

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Needs action' },
  { id: 'sales', label: 'Sales' },
  { id: 'orders', label: 'Orders' },
  { id: 'supplier', label: 'Stone' },
  { id: 'finance', label: 'Finance' },
  { id: 'permits', label: 'Permits' },
  { id: 'system', label: 'System' },
];

export function londonDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function feedBucket(iso: string, now: Date): 'Today' | 'Yesterday' | 'Earlier' {
  const day = londonDay(iso);
  const today = londonDay(now.toISOString());
  if (!day || !today) return 'Earlier';
  if (day === today) return 'Today';
  const yesterday = londonDay(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
  if (day === yesterday) return 'Yesterday';
  return 'Earlier';
}

export function filterFeed(events: FeedEvent[], filter: FeedFilter): FeedEvent[] {
  if (filter === 'all') return events;
  if (filter === 'action') return events.filter((event) => event.priority === 'action' && !event.resolved_at);
  return events.filter((event) => event.category === filter);
}

export function unreadActionCount(events: FeedEvent[], readIds: ReadonlySet<string>): number {
  return events.filter((event) => event.priority === 'action' && !event.resolved_at && !readIds.has(event.id)).length;
}

export function groupFeed(events: FeedEvent[], now: Date): { label: 'Today' | 'Yesterday' | 'Earlier'; events: FeedEvent[] }[] {
  const groups: { label: 'Today' | 'Yesterday' | 'Earlier'; events: FeedEvent[] }[] = [
    { label: 'Today', events: [] },
    { label: 'Yesterday', events: [] },
    { label: 'Earlier', events: [] },
  ];
  for (const event of events) {
    const bucket = feedBucket(event.created_at, now);
    groups.find((group) => group.label === bucket)?.events.push(event);
  }
  return groups.filter((group) => group.events.length > 0);
}

export function eventHref(event: FeedEvent): string | null {
  if (event.order_id) return `/dashboard/orders?order=${encodeURIComponent(event.order_id)}`;
  if (event.entity_type === 'invoice' && event.entity_id) {
    return `/dashboard/finance?invoice=${encodeURIComponent(event.entity_id)}`;
  }
  if (event.entity_type === 'enquiry') return '/dashboard/inquiries';
  if (event.category === 'supplier') return '/dashboard/suppliers';
  return null;
}

export function londonTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
