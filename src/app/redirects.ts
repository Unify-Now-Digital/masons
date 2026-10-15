/** Top-level paths that used to 404. Each lands on the dashboard route staff already use. */
export const TOP_LEVEL_REDIRECTS: { path: string; to: string }[] = [
  { path: '/orders', to: '/dashboard/orders' },
  { path: '/finance', to: '/dashboard/finance' },
  { path: '/today', to: '/dashboard/hub' },
  { path: '/inbox', to: '/dashboard/inbox' },
  { path: '/pipeline', to: '/dashboard/inquiries' },
  { path: '/map', to: '/dashboard/logistics?tab=map' },
];

/** Signed-in landing page: Today. */
export const SIGNED_IN_HOME = '/dashboard/hub';

/** Keep a deep-link query (`?order=`) and the target's own query (`?tab=map`). */
export function redirectTarget(to: string, search: string): string {
  const url = new URL(to, 'http://mason.local');
  const incoming = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  incoming.forEach((value, key) => {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  });
  const q = url.searchParams.toString();
  return `${url.pathname}${q ? `?${q}` : ''}`;
}
