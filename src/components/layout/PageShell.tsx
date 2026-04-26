import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
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
import { Button } from '@/shared/components/ui/button';
import { LogOut, Activity } from 'lucide-react';
import { Sidebar, MobileMenuButton } from './Sidebar';
import { AdminProvider, useAdmin } from '@/app/layout/AdminContext';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { CreateOrganizationModal } from '@/modules/organizations';

/** Must render under `AdminProvider` so `useAdmin` is defined. */
function DashboardUserMenu({
  user,
  navigate,
  onLogout,
}: {
  user: User | null;
  navigate: NavigateFunction;
  onLogout: () => Promise<void>;
}) {
  const { isAdmin } = useAdmin();

  return (
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
        {isAdmin ? (
          <>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                navigate('/dashboard/sentry-monitor');
              }}
            >
              <Activity className="mr-2 h-4 w-4" />
              <span>Monitoring</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            navigate('/dashboard/activity');
          }}
        >
          <Activity className="mr-2 h-4 w-4" />
          <span>My Activity</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await onLogout();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Route → topbar title mapping */
const routeTitles: Record<string, string> = {
  hub: 'Hub',
  priority: 'Priority orders',
  logistics: 'Logistics',
  finance: 'Finance',
  'enquiry-triage': 'Enquiry Triage',
  'proof-review': 'Proof Review',
  'permit-chase': 'Permit Chase',
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
  logistics: 'Where jobs are, and how the week drives.',
  finance: 'Balance-chase, AI-detected changes, invoices and payments.',
  'enquiry-triage': 'Inbound messages parsed into draft orders — you approve.',
  'proof-review': 'AI checks the proof against the brief and house style before it leaves.',
  'permit-chase': '5-stage pipeline with dwell-time bars and council chases.',
};

/** Pages that manage their own full-bleed layout (no shell padding). */
const fullBleedRoutes = new Set(['inbox']);

export const PageShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
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
  const isNoMembershipError = organization.error?.message
    ?.toLowerCase()
    .includes('no organization membership');
  const shouldShowErrorMessage = !!organization.error && !isNoMembershipError;

  if (organization.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gardens-page text-gardens-tx">
        <p className="font-body text-sm">Loading workspace…</p>
      </div>
    );
  }

  if (!organization.organizationId || organization.error) {
    return (
      <>
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gardens-page px-6 text-center">
          <p className="font-head text-2xl text-gardens-tx">Welcome to Mason</p>
          <p className="font-body text-sm text-gardens-txm max-w-md">
            Get started by creating your workspace or ask an administrator to add you to an existing organisation.
          </p>
          {shouldShowErrorMessage ? (
            <p className="font-body text-sm text-gardens-red max-w-md">{organization.error?.message}</p>
          ) : null}
          <Button type="button" onClick={() => setCreateOrgOpen(true)}>
            Create organisation
          </Button>
        </div>
        <CreateOrganizationModal open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminProvider>
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

          <DashboardUserMenu user={user} navigate={navigate} onLogout={handleLogout} />
        </header>

        {/* Content */}
        <div
          className={`flex-1 overflow-auto flex flex-col bg-gardens-page ${
            isFullBleed ? '' : 'p-3 sm:p-6'
          }`}
        >
          <Outlet />
        </div>
        </div>
      </AdminProvider>
    </div>
  );
};
