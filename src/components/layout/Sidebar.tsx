import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { OrgSwitcher } from '@/modules/organizations';
import { cn } from '@/shared/lib/utils';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { supabase } from '@/shared/lib/supabase';

/* ── Nav section data ── */
interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  badge?: { count: number; subtle?: boolean };
  ai?: boolean;
  /** Hidden from the sidebar; route stays reachable by direct URL. */
  hidden?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  aiSection?: boolean;
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
    aiSection: true,
    items: [
      {
        label: 'Inbox',
        to: '/dashboard/inbox',
        ai: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9l2-5.5h8L14 9v3.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z" />
            <path d="M2 9h3.5l.8 1.5h3.4L10.5 9H14" />
          </svg>
        ),
      },
      {
        label: 'Inquiries',
        to: '/dashboard/inquiries',
        ai: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
            <path d="M5 6.5h6M5 9h4" />
          </svg>
        ),
      },
      {
        label: 'Proof Review',
        to: '/dashboard/proof-review',
        ai: true,
        hidden: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 13l2-.5L13 4.5 11.5 3 3 11.5 2.5 13.5 3 13z" />
            <line x1="10" y1="4.5" x2="11.5" y2="6" />
          </svg>
        ),
      },
      {
        label: 'Inscriptions',
        to: '/dashboard/inscriptions',
        ai: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13V5l3 6 3-6v8" />
            <line x1="4.5" y1="10.5" x2="11.5" y2="10.5" />
          </svg>
        ),
      },
      {
        label: 'Permits',
        to: '/dashboard/permit-chase',
        ai: true,
        hidden: true,
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
        to: '/dashboard/permit-forms',
        ai: true,
        icon: (
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
        to: '/dashboard/permit-tracker',
        ai: true,
        hidden: true,
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
        to: '/dashboard/logistics',
        ai: true,
        icon: (
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

/** Shared sidebar content used by both desktop and mobile */
function SidebarContent({ onNavigate, collapsed = false, onToggleCollapsed }:
  { onNavigate?: () => void; collapsed?: boolean; onToggleCollapsed?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { role } = useOrganization();
  const [user, setUser] = useState<User | null>(null);

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

  // Same Slot constraint as the nav rows: string className when tooltip-wrapped.
  const settingsActive = pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/');
  const settingsClass = (isActive: boolean) =>
    cn(
      'relative flex items-center gap-[9px] py-2 px-2 rounded-[7px] cursor-pointer transition-colors duration-150 mb-0.5',
      collapsed && 'justify-center',
      isActive
        ? 'bg-gardens-sidebar-active text-gardens-nav-on'
        : 'text-gardens-nav-off hover:bg-gardens-sidebar-hover hover:text-gardens-nav-on'
    );
  const settingsLink = (
    <NavLink
      to="/dashboard/settings"
      onClick={onNavigate}
      className={collapsed ? settingsClass(settingsActive) : (({ isActive }) => settingsClass(isActive))}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-sm bg-gardens-acc" />
          )}
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={collapsed && !isActive ? 'opacity-60' : undefined}>
            <circle cx="8" cy="8" r="2" />
            <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.2 3.2l.85.85M11.95 11.95l.85.85M12.8 3.2l-.85.85M4.05 11.95l-.85.85" />
          </svg>
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {/* Logo */}
      <div className={cn(
        "pt-[18px] pb-[14px] flex items-center gap-2.5 border-b border-gardens-sidebar-border flex-shrink-0",
        collapsed ? "justify-center px-0" : "px-4"
      )}>
        <div className="w-8 h-8 rounded-lg bg-gardens-page flex items-center justify-center flex-shrink-0" style={{ color: 'var(--g-logo-text)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 16V8a6 6 0 0 1 12 0v8" />
            <line x1="2" y1="16" x2="16" y2="16" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <div className="font-head text-[17px] font-bold text-gardens-nav-on leading-none tracking-[-0.01em]">
              Mason
            </div>
            <OrgSwitcher />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2.5 scrollbar-hide">
        {sections.map((section, si) => (
          <div key={section.title}>
            {!collapsed && (
              <div
                className={`text-[10px] font-semibold tracking-[0.1em] uppercase text-gardens-nav-section px-4 flex items-center gap-1.5 ${
                  si === 0 ? 'pt-1.5 pb-[5px]' : 'pt-3.5 pb-[5px]'
                }`}
              >
                <span>{section.title}</span>
                {section.aiSection && (
                  <span
                    className="inline-block animate-pulse"
                    style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--g-acc)' }}
                  />
                )}
              </div>
            )}
            {section.items.filter((item) => !item.hidden).map((item) => {
              // Slot (TooltipTrigger asChild) stringifies a function className, so the
              // tooltip-wrapped (collapsed) branch must receive a plain string.
              const rowClass = (isActive: boolean) =>
                cn(
                  'group relative flex items-center py-2 my-[1px] rounded-[7px] cursor-pointer transition-colors duration-150',
                  collapsed ? 'justify-center px-0 mx-0 gap-0' : 'px-[14px] mx-2 gap-[9px]',
                  isActive
                    ? 'bg-gardens-sidebar-active text-gardens-nav-on'
                    : 'text-gardens-nav-off hover:bg-gardens-sidebar-hover hover:text-gardens-nav-on'
                );
              const isItemActive = pathname === item.to || pathname.startsWith(item.to + '/');
              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={collapsed ? rowClass(isItemActive) : (({ isActive }) => rowClass(isActive))}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className={cn(
                          'absolute top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-sm bg-gardens-acc',
                          collapsed ? 'left-0' : '-left-2'
                        )} />
                      )}
                      <span className={cn(
                        isActive ? 'opacity-100' : collapsed ? 'opacity-60' : 'opacity-85',
                        collapsed && 'relative'
                      )}>
                        {item.icon}
                        {collapsed && item.badge && (
                          <span className="absolute top-0 right-0 w-[7px] h-[7px] rounded-full bg-gardens-acc border-[1.5px] border-gardens-sidebar" />
                        )}
                      </span>
                      {!collapsed && (
                        <span className="text-sm font-medium flex-1">{item.label}</span>
                      )}
                      {!collapsed && item.ai && !item.badge && (
                        <span
                          className="animate-pulse"
                          style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--g-acc)' }}
                        />
                      )}
                      {!collapsed && item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-[2px] rounded-[10px] min-w-[18px] text-center ${
                            item.badge.subtle
                              ? 'bg-gardens-sidebar-active text-gardens-nav-on'
                              : 'bg-gardens-acc text-white'
                          }`}
                        >
                          {item.badge.count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
              return collapsed ? (
                <Tooltip key={item.to} delayDuration={300}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gardens-sidebar-border p-2">
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand' : 'Collapse'}
            className={cn(
              "hidden md:flex items-center gap-[9px] py-2 px-2 rounded-[7px] cursor-pointer hover:bg-gardens-sidebar-hover w-full text-gardens-nav-off hover:text-gardens-nav-on mb-0.5",
              collapsed && "justify-center"
            )}
          >
            <span className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              {collapsed
                ? <PanelLeftOpen className="h-5 w-5" />
                : <PanelLeftClose className="h-5 w-5" />}
            </span>
            {!collapsed && <span className="text-sm font-medium">Collapse</span>}
          </button>
        )}
        {collapsed ? (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          settingsLink
        )}

        <button
          onClick={() => { navigate('/dashboard/activity'); onNavigate?.(); }}
          className={cn(
            "flex items-center gap-[9px] py-2 px-2 rounded-[7px] cursor-pointer hover:bg-gardens-sidebar-hover w-full",
            collapsed && "justify-center"
          )}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: 'var(--g-acc-lt)', color: 'var(--g-acc-dk)' }}
          >
            {userInitial}
          </div>
          {!collapsed && (
            <div className="text-left">
              <div className="text-xs font-medium text-gardens-nav-on">{userDisplayName}</div>
              <div className="text-[10px] text-gardens-nav-off mt-px">{userRoleLabel}</div>
            </div>
          )}
        </button>
      </div>
    </>
  );
}

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const location = useLocation();
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('nav.desktop.collapsed.v1') !== 'false'; }
    catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('nav.desktop.collapsed.v1', String(navCollapsed)); }
    catch { /* ignore */ }
  }, [navCollapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    onMobileClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        onClick={(e) => {
          const target = e.target as HTMLElement;
          // Portaled content (org-switcher menu) bubbles here via the React tree
          // but lives outside the aside in the DOM — ignore it.
          if (!e.currentTarget.contains(target)) return;
          if (target.closest('a, button, input, [role="button"]')) return;
          setNavCollapsed(v => !v);
        }}
        className={cn(
          "hidden md:flex flex-shrink-0 bg-gardens-sidebar flex-col border-r border-gardens-sidebar-border overflow-hidden",
          navCollapsed ? "w-[56px]" : "w-[220px]"
        )}
      >
        <SidebarContent collapsed={navCollapsed} onToggleCollapsed={() => setNavCollapsed(v => !v)} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed left-0 top-0 h-full w-[220px] z-50 md:hidden bg-gardens-sidebar flex flex-col shadow-xl">
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={onMobileClose}
                className="p-1 rounded hover:bg-gardens-sidebar-hover text-gardens-nav-off hover:text-gardens-nav-on"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent onNavigate={onMobileClose} />
          </aside>
        </>
      )}
    </>
  );
};

/** Hamburger button for mobile — renders in PageShell's TopBar */
export const MobileMenuButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="md:hidden w-8 h-8 rounded-[7px] border border-gardens-bdr bg-transparent flex items-center justify-center text-gardens-txs hover:bg-gardens-page"
    aria-label="Open navigation"
  >
    <Menu className="h-4 w-4" />
  </button>
);
