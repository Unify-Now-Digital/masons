import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { OrgSwitcher } from '@/modules/organizations';
import { useOrganization } from '@/shared/context/OrganizationContext';

/* ── Nav section data ── */
interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  badge?: { count: number; subtle?: boolean };
  ai?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  aiSection?: boolean;
}

const sz = 15; // icon size
const sw = '1.5'; // stroke-width

// Design-prototype IA: three sections only.
// Old pages (Orders, Jobs, Map, Inscriptions, Products, Inbox, Companies,
// Notifications, Payments, Invoicing, Permit Tracker, Permit Forms, Reports,
// Workers, Activity) still exist at their routes but are reached via the
// consolidated pages (Hub → Orders, Logistics → Map, Finance → Invoicing/
// Payments, etc.). Notifications are reachable from the bell in the top bar.
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
        label: 'Priority',
        to: '/dashboard/priority',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.5s1.2 2.5 1.2 4.5c0 1.3-.7 2-.7 2s2-0.5 2-2.5c0 0 2 1.5 2 4.5 0 2.5-2 4.5-4.5 4.5S3.5 13 3.5 10.5C3.5 8 5 6 5 6s.5 1 1.5 1C6.5 6 5 4 5 4s1.5-.5 3-2.5z" />
          </svg>
        ),
      },
      {
        label: 'Logistics',
        to: '/dashboard/logistics',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="5" width="9" height="6" rx="1" />
            <path d="M10 7h3l2 2.5V11h-5V7z" />
            <circle cx="4" cy="12.5" r="1.3" />
            <circle cx="12" cy="12.5" r="1.3" />
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
    ],
  },
  {
    title: 'AI Workflows',
    aiSection: true,
    items: [
      {
        label: 'Inbox',
        to: '/dashboard/enquiry-triage',
        ai: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9l2-5.5h8L14 9v3.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z" />
            <path d="M2 9h3.5l.8 1.5h3.4L10.5 9H14" />
          </svg>
        ),
      },
      {
        label: 'Inscriptions',
        to: '/dashboard/proof-review',
        ai: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 13l2-.5L13 4.5 11.5 3 3 11.5 2.5 13.5 3 13z" />
            <line x1="10" y1="4.5" x2="11.5" y2="6" />
          </svg>
        ),
      },
      {
        label: 'Permits',
        to: '/dashboard/permit-chase',
        ai: true,
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2h5l3 3v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
            <polyline points="9,2 9,5 12,5" />
            <circle cx="8" cy="9.5" r="1.5" />
            <line x1="6" y1="12" x2="10" y2="12" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Communications',
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
        label: 'Team Chat',
        to: '/dashboard/team',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H9L6 13.5V11H3.5A1.5 1.5 0 0 1 2 9.5v-6z" />
          </svg>
        ),
      },
    ],
  },
];

/** Shared sidebar content used by both desktop and mobile */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { organizationName } = useOrganization();

  return (
    <>
      {/* Logo */}
      <div className="px-4 pt-[18px] pb-[14px] flex items-center gap-2.5 border-b border-gardens-sidebar-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gardens-page flex items-center justify-center flex-shrink-0" style={{ color: 'var(--g-logo-text)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 16V8a6 6 0 0 1 12 0v8" />
            <line x1="2" y1="16" x2="16" y2="16" />
          </svg>
        </div>
        <div>
          <div className="font-head text-[17px] font-bold text-gardens-nav-on leading-none tracking-[-0.01em]">
            Mason
          </div>
          <div className="font-body text-[9px] font-medium text-gardens-nav-off uppercase tracking-[0.08em] mt-0.5 truncate">
            {organizationName ?? 'Workspace'}
          </div>
          <OrgSwitcher />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2.5 scrollbar-hide">
        {sections.map((section, si) => (
          <div key={section.title}>
            <div
              className={`text-[9px] font-semibold tracking-[0.1em] uppercase text-gardens-nav-section px-4 flex items-center gap-1.5 ${
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
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group relative flex items-center gap-[9px] py-[7px] px-[14px] mx-2 my-[1px] rounded-[7px] cursor-pointer transition-colors duration-150 ${
                    isActive
                      ? 'bg-gardens-sidebar-active text-gardens-nav-on'
                      : 'text-gardens-nav-off hover:bg-gardens-sidebar-hover hover:text-gardens-nav-on'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-sm bg-gardens-acc" />
                    )}
                    <span className={isActive ? 'opacity-100' : 'opacity-85'}>
                      {item.icon}
                    </span>
                    <span className="text-xs font-medium flex-1">{item.label}</span>
                    {item.ai && !item.badge && (
                      <span
                        className="animate-pulse"
                        style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--g-acc)' }}
                      />
                    )}
                    {item.badge && (
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
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gardens-sidebar-border p-2">
        <NavLink
          to="/dashboard/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative flex items-center gap-[9px] py-[7px] px-2 rounded-[7px] cursor-pointer transition-colors duration-150 mb-0.5 ${
              isActive
                ? 'bg-gardens-sidebar-active text-gardens-nav-on'
                : 'text-gardens-nav-off hover:bg-gardens-sidebar-hover hover:text-gardens-nav-on'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-sm bg-gardens-acc" />
              )}
              <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="2" />
                <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.2 3.2l.85.85M11.95 11.95l.85.85M12.8 3.2l-.85.85M4.05 11.95l-.85.85" />
              </svg>
              <span className="text-xs font-medium">Settings</span>
            </>
          )}
        </NavLink>

        <button
          onClick={() => { navigate('/dashboard/activity'); onNavigate?.(); }}
          className="flex items-center gap-[9px] py-2 px-2 rounded-[7px] cursor-pointer hover:bg-gardens-sidebar-hover w-full"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: 'var(--g-acc-lt)', color: 'var(--g-acc-dk)' }}
          >
            AY
          </div>
          <div className="text-left">
            <div className="text-xs font-medium text-gardens-nav-on">Aylin</div>
            <div className="text-[10px] text-gardens-nav-off mt-px">Office Manager</div>
          </div>
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

  // Close mobile drawer on route change
  useEffect(() => {
    onMobileClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[220px] flex-shrink-0 bg-gardens-sidebar flex-col border-r border-gardens-sidebar-border overflow-hidden">
        <SidebarContent />
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
