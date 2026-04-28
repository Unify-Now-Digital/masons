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
import { LogOut, Activity as ActivityIcon, Search as SearchIcon } from 'lucide-react';
import { Sidebar, MobileMenuButton } from './Sidebar';
import { AdminProvider } from '@/app/layout/AdminContext';
import { useOrganization, isNoOrganizationMembershipError } from '@/shared/context/OrganizationContext';
import { UniversalSearch } from '@/shared/components/UniversalSearch';
import { TestDataMenu } from '@/shared/components/TestDataMenu';
import { Button } from '@/shared/components/ui/button';
import { CreateOrganizationModal } from '@/modules/organizations';

/* Route → topbar title mapping */
const routeTitles: Record<string, string> = {
  hub: 'Hub',
  priority: 'Priority',
  logistics: 'Mapping',
  cemeteries: 'Cemeteries',
  pipeline: 'Orders pipeline',
  finance: 'Finance',
  'enquiry-triage': 'Inbox',
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

/** Route → topbar subtitle (optional) */
const routeSubtitles: Record<string, string> = {
  hub: 'Pipeline, balances and the state of the book of work.',
  priority: 'AI-flagged and manually-flagged orders that need your attention now.',
  logistics: 'Jobs on a map — route planning and cemetery clustering.',
  finance: 'Balance-chase, AI-detected changes, invoices and payments.',
  'enquiry-triage': 'Inbound messages parsed into draft orders — you approve.',
  'proof-review': 'AI checks the proof against the brief and house style before it leaves.',
  'permit-chase': '5-stage pipeline with dwell-time bars and council chases.',
  pipeline: 'Every open order by stage, with counts and bottlenecks.',
  cemeteries: 'Workload grouped by cemetery — jobs, counts, last install.',
};

/** Pages that manage their own full-bleed layout (no shell padding). */
const fullBleedRoutes = new Set(['inbox']);

export const PageShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const organization = useOrganization();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  // Global ⌘K / Ctrl+K shortcut to open the universal search.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
    const realError =
      organization.error && !isNoOrganizationMembershipError(organization.error)
        ? organization.error
        : null;

    return (
      <>
        <div className="flex h-screen flex-col items-center justify-center gap-6 bg-gardens-page px-6 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="font-head text-xl font-semibold text-gardens-tx">Welcome to Mason</h1>
            <p className="font-body text-sm text-gardens-txm leading-relaxed">
              Get started by creating your workspace or ask an administrator to add you to an existing
              organisation.
            </p>
            {realError && (
              <p className="font-body text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-left">
                {realError.message}
              </p>
            )}
            <Button
              type="button"
              className="mt-2"
              onClick={() => setCreateOrgOpen(true)}
            >
              Create organisation
            </Button>
          </div>
        </div>
        <CreateOrganizationModal open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
      </>
    );
  }

  return (
    <AdminProvider>
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

          {/* Turnaround ribbon — design's signature element. Static stub
              until baseline tracking lands. */}
          <div
            className="hidden lg:flex items-center gap-2.5 px-2.5 py-1 rounded-md flex-shrink-0"
            style={{
              border: '1px solid var(--g-bdr)',
              background: 'var(--g-page)',
            }}
          >
            <span
              className="inline-flex items-center gap-1 px-1.5 h-[18px] rounded-full font-bold"
              style={{
                background: 'rgba(194,105,59,0.1)',
                color: 'var(--g-acc-dk)',
                border: '1px solid rgba(194,105,59,0.25)',
                fontSize: 10,
                letterSpacing: '0.04em',
              }}
            >
              <span
                className="animate-pulse"
                style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--g-acc)' }}
              />
              THIS WEEK
            </span>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-head text-[15px] font-semibold text-gardens-tx tracking-[-0.01em] whitespace-nowrap">
                −4.2 days
              </span>
              <span className="text-[9.5px] text-gardens-txs uppercase tracking-wider whitespace-nowrap">
                avg. turnaround
              </span>
            </div>
          </div>

          {/* Test-data menu (only renders for the Sears Melvin org). */}
          <TestDataMenu />

          {/* Search trigger — opens the universal search palette (⌘K). */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-[7px] bg-gardens-page border border-gardens-bdr rounded-lg px-[11px] py-1.5 w-[220px] text-left hover:border-gardens-bdr2 transition-colors"
            aria-label="Search people, orders, inscriptions"
          >
            <SearchIcon className="h-3.5 w-3.5 text-gardens-txm shrink-0" />
            <span className="flex-1 font-body text-xs text-gardens-txm truncate">
              Search people, orders…
            </span>
            <kbd className="hidden md:inline-flex items-center text-[10px] font-mono text-gardens-txm bg-gardens-surf2 border border-gardens-bdr rounded px-1 py-px">
              ⌘K
            </kbd>
          </button>

          {/* Search icon — mobile-only compact affordance */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="sm:hidden w-8 h-8 rounded-[7px] border border-gardens-bdr bg-transparent flex items-center justify-center text-gardens-txs hover:bg-gardens-page"
            aria-label="Search"
          >
            <SearchIcon className="h-4 w-4" />
          </button>

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
          className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col bg-gardens-page ${
            isFullBleed ? '' : 'p-3 sm:p-6'
          }`}
        >
          <Outlet />
        </div>
      </div>

      <UniversalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
    </AdminProvider>
  );
};
