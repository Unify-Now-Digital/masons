/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
    },
  },
}));
vi.mock('@/shared/context/OrganizationContext', () => ({
  useOrganization: () => ({
    role: 'admin',
    canViewFinancials: true,
    organizationId: 'org-1',
    organizationName: 'Acme',
    memberships: [{ organizationId: 'org-1', name: 'Acme' }],
    setActiveOrganizationId: () => {},
  }),
}));
vi.mock('./useInboxUnreadCount', () => ({ useInboxUnreadCount: () => 3 }));
vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to, className, ...rest }: { children?: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className} {...rest}>{children}</a>
  ),
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: '/dashboard/finance' }),
}));

import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('stays expanded and has no collapse control', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    await act(async () => { root.render(<Sidebar />); });
    const rail = host.querySelector('[data-testid="app-rail"]')!;
    expect(host.querySelector('[data-testid="rail-compact-toggle"]')).toBeNull();
    expect(host.textContent).not.toContain('Collapse navigation');
    expect(rail.getAttribute('data-expanded')).toBe('true');
    expect(rail.className).toContain('w-[72px]');
    expect(rail.className).not.toContain('w-14');
    expect(host.textContent).toContain('Settings');
    expect(host.textContent).toContain('Finance');
    await act(async () => { root.unmount(); });
  });
});
