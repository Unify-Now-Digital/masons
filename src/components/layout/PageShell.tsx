import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { LogOut, Activity as ActivityIcon } from 'lucide-react';
import { Sidebar, MobileMenuButton } from './Sidebar';
import { AdminProvider } from '@/app/layout/AdminContext';
import { useOrganization } from '@/shared/context/OrganizationContext';

/* Route → topbar title mapping */
const routeTitles: Record<string, string> = {
  hub: 'Hub',
  logistics: 'Logistics',
  finance: 'Finance',
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
  'permit-agent': 'Permit Agent',
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

/** Route → topbar subtitle (optional) */
const routeSubtitles: Record<string, string> = {
  hub: 'Pipeline, balances and the state of the book of work.',
  logistics: 'Where jobs are, and how the week drives.',
  finance: 'Balance-chase, AI-detected changes, invoices and payments.',
};

/** Pages that manage their own full-bleed layout (no shell padding). */
const fullBleedRoutes = new Set(['inbox']);

export const PageShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const organization = useOrganization();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  // Derive title + full-bleed check from current route
  const segment = location.pathname.split('/').filter(Boolean).pop() ?? '';
  const title = routeTitles[segment] ?? 'Dashboard';
  const subtitle = routeSubtitles[segment];
  const isFullBleed = fullBleedRoutes.has(segment);

  if (organization.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gardens-page text-gardens-tx">
        <p className="font-body text-sm">Loading workspace…</p>
      </div>
    );
  }

  if (!organization.organizationId || organization.error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gardens-page px-6 text-center">
        <p className="font-head text-lg text-gardens-tx">No organisation access</p>
        <p className="font-body text-sm text-gardens-txm max-w-md">
          {organization.error?.message ??
            'Your account is not linked to a workspace. Ask an administrator to add you to an organisation.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* TopBar */}
        <header className="h-[52px] flex-shrink-0 bg-gardens-surf border-b border-gardens-bdr flex items-center px-3 md:px-[22px] gap-2 md:gap-3.5">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />

          <div className="flex-1 min-w-0">
            <div className="font-head text-base md:text-[19px] font-semibold text-gardens-tx tracking-[-0.01em] truncate leading-tight">
              {title}
            </div>
            {subtitle && (
              <div className="hidden md:block text-[11.5px] text-gardens-txs truncate mt-0.5">
                {subtitle}
              </div>
            )}
          </div>

          {/* Search — hidden on small screens */}
          <div className="hidden sm:flex items-center gap-[7px] bg-gardens-page border border-gardens-bdr rounded-lg px-[11px] py-1.5 w-[220px]">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#A89A86" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="7" cy="7" r="4.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
            <input
              type="text"
              placeholder="Search orders, customers..."
              className="border-none bg-transparent outline-none font-body text-xs text-gardens-tx w-full placeholder:text-gardens-txm"
            />
          </div>

          {/* Notification bell */}
          <button
            onClick={() => navigate('/dashboard/notifications')}
            className="w-8 h-8 rounded-[7px] border border-gardens-bdr bg-transparent flex items-center justify-center text-gardens-txs relative hover:bg-gardens-page"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2a3.5 3.5 0 0 0-3.5 3.5C4.5 8.5 3 10 3 10h10s-1.5-1.5-1.5-4.5A3.5 3.5 0 0 0 8 2z" />
              <line x1="6.5" y1="12.5" x2="9.5" y2="12.5" />
            </svg>
            <div className="absolute top-[5px] right-[5px] w-[7px] h-[7px] rounded-full bg-gardens-red border-[1.5px] border-gardens-surf" />
          </button>

          {/* User avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-[7px] border border-gardens-bdr bg-transparent flex items-center justify-center text-gardens-txs hover:bg-gardens-page">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="6" r="3" />
                  <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Signed in as</span>
                  <span className="text-sm font-medium">{user?.email ?? '...'}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); navigate('/dashboard/activity'); }}>
                <ActivityIcon className="mr-2 h-4 w-4" />
                <span>My Activity</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={async (e) => { e.preventDefault(); await handleLogout(); }}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <div
          className={`flex-1 overflow-auto flex flex-col bg-gardens-page ${
            isFullBleed ? '' : 'p-3 sm:p-6'
          }`}
        >
          <AdminProvider>
            <Outlet />
          </AdminProvider>
        </div>
      </div>
    </div>
  );
};
