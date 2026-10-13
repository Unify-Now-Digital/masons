import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, MoreHorizontal, Bell, LogOut, Activity as ActivityIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { supabase } from '@/shared/lib/supabase';
import { useInboxUnreadCount } from './useInboxUnreadCount';
import { splitRailItems, formatBadgeCount } from './shellRoutes';

/* ── Nav section data ── */
interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  /** Hidden from the sidebar; route stays reachable by direct URL. */
  hidden?: boolean;
  /** Shown only when the role can see aggregate-money UI (canViewFinancials); its route is guarded too. */
  requiresFinancials?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sz = 18; // icon size
const sw = '1.5'; // stroke-width

// Design-prototype IA: three sections.
// Orders is a top-level Work item again (consolidation partially walked back);
// Invoicing folded into Finance → Invoices 2026-07-20 (route now redirects).
// Other pages (Jobs, Map, Inscriptions, Products, Inbox, Companies, Notifications,
// Payments, Permit Tracker, Permit Forms, Reports, Workers, Activity) still exist
// at their routes and are often reached via consolidated pages (Hub, Logistics → Map,
// Finance → Payments, etc.). Notifications are reachable from the bell in the top bar.
//
// C8 (2026-09-03): the `ai` / `aiSection` / `badge` decoration is GONE. `ai` and
// `aiSection` were hardcoded literals on this const — a static "AI Workflows" label,
// never data-driven — rendered as a pulsing var(--g-acc) dot. `animate-pulse` on a
// constant is what made them read as unread/notification state: nothing could ever
// change them. `badge` was declared but never set on any item, so its collapsed corner
// dot and count pill were unreachable. The active-route indicator (the 3px bar, below)
// is the one accent element that IS state-derived — it stays.
const sections: NavSection[] = [
  {
    title: 'Work',
    items: [
      {
        label: 'Hub',
        to: '/dashboard/hub',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8l6-5 6 5v5a1 1 0 0 1-1 1h-3v-4H6v4H3a1 1 0 0 1-1-1V8z" />
          </svg>
        ),
      },
      {
        label: 'Orders',
        to: '/dashboard/orders',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="2.5" width="10" height="11" rx="1.5" />
            <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
          </svg>
        ),
      },
      {
        label: 'Invoicing',
        to: '/dashboard/invoicing',
        // Retired 2026-07-20 — workspace lives in Finance → Invoices; route redirects there.
        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 1.5h5l3 3v10a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5z" />
            <path d="M9 1.5v3h3" />
            <path d="M6 8.5h4M6 11h4" />
          </svg>
        ),
      },
      {
        label: 'Priority',
        to: '/dashboard/priority',
        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.5s1.2 2.5 1.2 4.5c0 1.3-.7 2-.7 2s2-0.5 2-2.5c0 0 2 1.5 2 4.5 0 2.5-2 4.5-4.5 4.5S3.5 13 3.5 10.5C3.5 8 5 6 5 6s.5 1 1.5 1C6.5 6 5 4 5 4s1.5-.5 3-2.5z" />
          </svg>
        ),
      },
      {
        label: 'Finance',
        to: '/dashboard/finance',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="8" cy="5" rx="5" ry="2" />
            <path d="M3 5v3c0 1.1 2.2 2 5 2s5-.9 5-2V5" />
            <path d="M3 8v3c0 1.1 2.2 2 5 2s5-.9 5-2V8" />
          </svg>
        ),
      },
      {
        label: 'Payments',
        to: '/dashboard/payments',
        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4.5" width="12" height="7" rx="1" />
            <line x1="2" y1="7.5" x2="14" y2="7.5" />
            <line x1="4.5" y1="9.5" x2="7.5" y2="9.5" />
          </svg>
        ),
      },
      {
        label: 'Jobs',
        to: '/dashboard/jobs',
        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="10" height="7" rx="1" />
            <path d="M6 6V5a2 2 0 0 1 4 0v1" />
            <line x1="3" y1="9.5" x2="13" y2="9.5" />
          </svg>
        ),
      },
      {
        label: 'Pipeline',
        to: '/dashboard/pipeline',
        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="3" width="3" height="10" rx="0.5" />
            <rect x="6.5" y="5" width="3" height="8" rx="0.5" />
            <rect x="10.5" y="7" width="3" height="6" rx="0.5" />
          </svg>
        ),
      },
      {
        label: 'Reporting',
        to: '/dashboard/reporting',
        requiresFinancials: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="13" x2="13" y2="13" />
            <rect x="4" y="8" width="2" height="5" rx="0.3" />
            <rect x="7" y="5" width="2" height="8" rx="0.3" />
            <rect x="10" y="9" width="2" height="4" rx="0.3" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'AI Workflows',
    items: [
      {
        label: 'Inbox',
        to: '/dashboard/inbox',        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9l2-5.5h8L14 9v3.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z" />
            <path d="M2 9h3.5l.8 1.5h3.4L10.5 9H14" />
          </svg>
        ),
      },
      {
        label: 'Pipeline',
        to: '/dashboard/inquiries',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
            <path d="M5 6.5h6M5 9h4" />
          </svg>
        ),
      },
      {
        label: 'Proof Review',
        to: '/dashboard/proof-review',        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 13l2-.5L13 4.5 11.5 3 3 11.5 2.5 13.5 3 13z" />
            <line x1="10" y1="4.5" x2="11.5" y2="6" />
          </svg>
        ),
      },
      {
        label: 'Inscriptions',
        to: '/dashboard/inscriptions',        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13V5l3 6 3-6v8" />
            <line x1="4.5" y1="10.5" x2="11.5" y2="10.5" />
          </svg>
        ),
      },
      {
        label: 'Permits',
        to: '/dashboard/permit-chase',        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2h5l3 3v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
            <polyline points="9,2 9,5 12,5" />
            <circle cx="8" cy="9.5" r="1.5" />
            <line x1="6" y1="12" x2="10" y2="12" />
          </svg>
        ),
      },
      {
        label: 'Permit Forms',
        to: '/dashboard/permit-forms',        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 2.5h6a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
            <path d="M6.5 2.5v-1.5h3v1.5" />
            <path d="M6 7.5l1.5 1.5L10 6.5" />
            <line x1="6" y1="10.5" x2="10" y2="10.5" />
          </svg>
        ),
      },
      {
        label: 'Permit Tracker',
        to: '/dashboard/permit-tracker',        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="5.5" />
            <polyline points="8,4.5 8,8 10.5,9.5" />
            <circle cx="8" cy="8" r="0.75" fill="currentColor" />
          </svg>
        ),
      },
      {
        label: 'Mapping',
        to: '/dashboard/logistics',        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5z" />
            <circle cx="8" cy="6" r="1.5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Data',
    items: [
      {
        label: 'People',
        to: '/dashboard/customers',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="5.5" r="3" />
            <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
          </svg>
        ),
      },
      {
        label: 'Products',
        to: '/dashboard/memorials',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14V5a4 4 0 0 1 8 0v9" />
            <line x1="3" y1="14" x2="13" y2="14" />
          </svg>
        ),
      },
      {
        label: 'Cemeteries',
        to: '/dashboard/cemeteries',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="10" height="8" rx="0.5" />
            <path d="M6 6V3a2 2 0 0 1 4 0v3" />
            <line x1="8" y1="9" x2="8" y2="11.5" />
          </svg>
        ),
      },
    ],
  },
];


/**
 * Mason UI phase 1: 72px icon rail with labels (mockup inbox-v8 / orders-v7).
 * Inbox (unread badge), Orders, Pipeline, Finance first; every other visible
 * nav item sits under "More". Settings, notifications and the user menu live
 * at the bottom (they moved here from the removed PageShell top header).
 * Visibility rules (hidden / requiresFinancials) are unchanged.
 */
const allItems: NavItem[] = sections.flatMap((s) => s.items);

const isActivePath = (pathname: string, to: string) => pathname === to || pathname.startsWith(to + '/');

const railItemClass = (active: boolean) =>
  cn(
    'relative w-[60px] h-[56px] rounded-xl flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold leading-none transition-colors',
    active
      ? 'bg-gardens-acc-lt text-gardens-acc-dk'
      : 'text-gardens-txs hover:bg-gardens-page hover:text-gardens-tx',
  );

function RailBadge({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span
      className="absolute top-[5px] right-[6px] min-w-[18px] h-[18px] px-[3px] rounded-full bg-gardens-tx text-white text-[11px] font-bold flex items-center justify-center border-2 border-gardens-surf"
      data-testid="rail-badge"
    >
      {value}
    </span>
  );
}

const settingsIcon = (
  <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.2 3.2l.85.85M11.95 11.95l.85.85M12.8 3.2l-.85.85M4.05 11.95l-.85.85" />
  </svg>
);

/** Shared rail content used by both desktop and the mobile drawer. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { role, canViewFinancials, organizationId, organizationName, memberships, setActiveOrganizationId } = useOrganization();
  const [user, setUser] = useState<User | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const unread = formatBadgeCount(useInboxUnreadCount());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const userDisplayName =
    user?.user_metadata?.display_name?.trim() ||
    user?.email ||
    'User';
  const userRoleLabel = role
    ? `${role.charAt(0).toUpperCase()}${role.slice(1)}`
    : 'Member';
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  const { primary, more } = splitRailItems(allItems, !!canViewFinancials);
  const moreActive = more.some((i) => isActivePath(pathname, i.to));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full w-full flex-col items-center py-3 gap-1">
      {/* Logo mark */}
      <div
        className="w-9 h-9 mb-3 rounded-lg bg-gardens-page flex items-center justify-center flex-shrink-0"
        style={{ color: 'var(--g-logo-text)' }}
        title={organizationName ? `Mason · ${organizationName}` : 'Mason'}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 16V8a6 6 0 0 1 12 0v8" />
          <line x1="2" y1="16" x2="16" y2="16" />
        </svg>
      </div>

      <nav aria-label="Main" className="flex flex-col items-center gap-1">
        {primary.map((item) => {
          const active = isActivePath(pathname, item.to);
          const isInbox = item.to === '/dashboard/inbox';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={railItemClass(active)}
              aria-label={isInbox && unread ? `${item.label}, ${unread} unread` : item.label}
            >
              <span aria-hidden className="[&_svg]:w-5 [&_svg]:h-5">{item.icon}</span>
              <span>{item.label}</span>
              {isInbox && <RailBadge value={unread} />}
            </NavLink>
          );
        })}

        {more.length > 0 && (
          <>
            <div className="w-8 h-px bg-gardens-bdr my-1.5" />
            <Popover open={moreOpen} onOpenChange={setMoreOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={railItemClass(moreActive)} aria-label="More pages">
                  <MoreHorizontal className="w-5 h-5" aria-hidden />
                  <span>More</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-56 p-1.5 bg-gardens-surf2">
                <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-gardens-txm-aa">
                  More
                </div>
                {more.map((item) => {
                  const active = isActivePath(pathname, item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => { setMoreOpen(false); onNavigate?.(); }}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium',
                        active ? 'bg-gardens-acc-lt text-gardens-acc-dk' : 'text-gardens-txs hover:bg-gardens-page hover:text-gardens-tx',
                      )}
                    >
                      <span aria-hidden>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </PopoverContent>
            </Popover>
          </>
        )}
      </nav>

      {/* Bottom: notifications, settings, user menu */}
      <div className="mt-auto flex flex-col items-center gap-1">
        <NavLink
          to="/dashboard/notifications"
          onClick={onNavigate}
          className={railItemClass(isActivePath(pathname, '/dashboard/notifications'))}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" aria-hidden />
          <span>Alerts</span>
        </NavLink>
        <NavLink
          to="/dashboard/settings"
          onClick={onNavigate}
          className={railItemClass(isActivePath(pathname, '/dashboard/settings'))}
        >
          <span aria-hidden className="[&_svg]:w-5 [&_svg]:h-5">{settingsIcon}</span>
          <span>Settings</span>
        </NavLink>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={userDisplayName}
              aria-label={`User menu for ${userDisplayName}`}
              className="mt-1.5 w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold hover:ring-2 hover:ring-gardens-bdr2"
              style={{ background: 'var(--g-acc-lt)', color: 'var(--g-acc-dk)' }}
            >
              {userInitial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium truncate">{userDisplayName}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email ?? '...'} · {userRoleLabel}</span>
              </div>
            </DropdownMenuLabel>
            {/* Workspace switch (was OrgSwitcher in the old sidebar header). Same
                setActiveOrganizationId call, rendered as items so no nested menu. */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gardens-txm-aa">
              Workspace
            </DropdownMenuLabel>
            {memberships.length <= 1 ? (
              <div className="px-2 pb-1.5 text-sm text-gardens-txs truncate">{organizationName ?? 'Workspace'}</div>
            ) : (
              memberships.map((m) => (
                <DropdownMenuItem
                  key={m.organizationId}
                  onSelect={() => setActiveOrganizationId(m.organizationId)}
                  className={m.organizationId === organizationId ? 'font-medium' : undefined}
                >
                  {m.organizationId === organizationId ? '✓ ' : ''}{m.name}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); navigate('/dashboard/activity'); onNavigate?.(); }}>
              <ActivityIcon className="mr-2 h-4 w-4" />
              <span>My Activity</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={async (e) => { e.preventDefault(); await handleLogout(); }}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    onMobileClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Desktop rail — fixed 72px (replaces the 56/192 collapse toggle). */}
      <aside
        className="hidden md:flex w-[72px] flex-shrink-0 bg-gardens-surf flex-col border-r border-gardens-bdr overflow-y-auto overflow-x-hidden scrollbar-hide"
        data-testid="app-rail"
      >
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed left-0 top-0 h-full w-[72px] z-50 md:hidden bg-gardens-surf flex flex-col shadow-xl overflow-y-auto">
            <button
              onClick={onMobileClose}
              aria-label="Close navigation"
              className="mx-auto mt-2 p-1 rounded hover:bg-gardens-page text-gardens-txs"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={onMobileClose} />
          </aside>
        </>
      )}
    </>
  );
};

/** Hamburger button for mobile — renders in PageShell's pane title row */
export const MobileMenuButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="md:hidden w-8 h-8 rounded-[7px] border border-gardens-bdr bg-transparent flex items-center justify-center text-gardens-txs hover:bg-gardens-page"
    aria-label="Open navigation"
  >
    <Menu className="h-4 w-4" />
  </button>
);
