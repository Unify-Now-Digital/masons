import { describe, expect, it } from 'vitest';
import { DASHBOARD_ALIAS_REDIRECTS, redirectTarget, SIGNED_IN_HOME, TOP_LEVEL_REDIRECTS } from './redirects';

describe('top-level redirects', () => {
  it('sends the short paths to the dashboard routes, and / to Today', () => {
    expect(SIGNED_IN_HOME).toBe('/dashboard/hub');
    expect(Object.fromEntries(TOP_LEVEL_REDIRECTS.map((r) => [r.path, r.to]))).toEqual({
      '/orders': '/dashboard/orders',
      '/finance': '/dashboard/finance',
      '/today': '/dashboard/hub',
      '/inbox': '/dashboard/inbox',
      '/pipeline': '/dashboard/inquiries',
      '/map': '/dashboard/logistics?tab=map',
    });
  });

  it('keeps an incoming deep link and the target query', () => {
    expect(redirectTarget('/dashboard/orders', '?order=abc')).toBe('/dashboard/orders?order=abc');
    expect(redirectTarget('/dashboard/logistics?tab=map', '?order=abc')).toBe('/dashboard/logistics?tab=map&order=abc');
    expect(redirectTarget('/dashboard/logistics?tab=map', '')).toBe('/dashboard/logistics?tab=map');
  });

  it('sends /dashboard/today to Today', () => {
    expect(DASHBOARD_ALIAS_REDIRECTS).toEqual([{ path: 'today', to: '/dashboard/hub' }]);
  });
});
