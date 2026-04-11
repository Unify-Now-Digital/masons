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
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sz = 15; // icon size
const sw = '1.5'; // stroke-width

const sections: NavSection[] = [
  {
    title: 'Work',
    items: [
      {
        label: 'Orders',
        to: '/dashboard/orders',
        badge: { count: 14, subtle: true },
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="2" width="10" height="12" rx="1.5" />
            <path d="M6 2v.5a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2" />
            <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" />
            <line x1="5.5" y1="10" x2="9" y2="10" />
          </svg>
        ),
      },
      {
        label: 'Jobs',
        to: '/dashboard/jobs',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3.5" width="12" height="11" rx="1.5" />
            <line x1="5" y1="2" x2="5" y2="5" />
            <line x1="11" y1="2" x2="11" y2="5" />
            <line x1="2" y1="7.5" x2="14" y2="7.5" />
            <path d="M6 10.5l1.5 1.5 3-3" />
          </svg>
        ),
      },
      {
        label: 'Map of Jobs',
        to: '/dashboard/map',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5z" />
            <circle cx="8" cy="6" r="1.5" />
          </svg>
        ),
      },
      {
        label: 'Inscriptions',
        to: '/dashboard/inscriptions',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 13.5L6.5 2h3L13 13.5" />
            <line x1="4.5" y1="9.5" x2="11.5" y2="9.5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Catalogue',
    items: [
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
    ],
  },
  {
    title: 'Communications',
    items: [
      {
        label: 'Inbox',
        to: '/dashboard/inbox',
        badge: { count: 23 },
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
            <polyline points="2,3.5 8,9 14,3.5" />
          </svg>
        ),
      },
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
        label: 'Companies',
        to: '/dashboard/companies',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="5" height="10" rx="0.5" />
            <rect x="9" y="2" width="5" height="12" rx="0.5" />
            <line x1="4" y1="6.5" x2="5.5" y2="6.5" />
            <line x1="4" y1="8.5" x2="5.5" y2="8.5" />
            <line x1="4" y1="10.5" x2="5.5" y2="10.5" />
            <line x1="11" y1="4.5" x2="12.5" y2="4.5" />
            <line x1="11" y1="6.5" x2="12.5" y2="6.5" />
            <line x1="11" y1="8.5" x2="12.5" y2="8.5" />
          </svg>
        ),
      },
      {
        label: 'Notifications',
        to: '/dashboard/notifications',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2a3.5 3.5 0 0 0-3.5 3.5C4.5 8.5 3 10 3 10h10s-1.5-1.5-1.5-4.5A3.5 3.5 0 0 0 8 2z" />
            <line x1="6.5" y1="12.5" x2="9.5" y2="12.5" />
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
  {
    title: 'Finance',
    items: [
      {
        label: 'Payments',
        to: '/dashboard/payments',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="12" height="8.5" rx="1.5" />
            <line x1="2" y1="7.5" x2="14" y2="7.5" />
            <line x1="5" y1="10.5" x2="7.5" y2="10.5" />
          </svg>
        ),
      },
      {
        label: 'Invoicing',
        to: '/dashboard/invoicing',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2h5l3 3v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
            <polyline points="9,2 9,5 12,5" />
            <line x1="5.5" y1="8" x2="10.5" y2="8" />
            <line x1="5.5" y1="10.5" x2="9" y2="10.5" />
            <line x1="7" y1="6.5" x2="7.8" y2="6.5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Permits',
        to: '/dashboard/permit-tracker',
        badge: { count: 2 },
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="7" r="3.5" />
            <line x1="4" y1="14" x2="12" y2="14" />
            <line x1="8" y1="10.5" x2="8" y2="14" />
          </svg>
        ),
      },
      {
        label: 'Permit Agent',
        to: '/dashboard/permit-agent',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="7" r="3.5" />
            <path d="M5.5 5.5l5 3-5 3" />
          </svg>
        ),
      },
      {
        label: 'Reports',
        to: '/dashboard/reporting',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,13 2,9 5.5,9 5.5,13" />
            <polyline points="5.5,13 5.5,6 9,6 9,13" />
            <polyline points="9,13 9,3.5 12.5,3.5 12.5,13" />
            <line x1="1.5" y1="13" x2="14.5" y2="13" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Team',
    items: [
      {
        label: 'Workers',
        to: '/dashboard/workers',
        icon: (
          <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 6.5a3 3 0 0 1 6 0H5z" />
            <rect x="4.5" y="6.5" width="7" height="1.5" rx=".5" />
            <circle cx="8" cy="5" r="1.5" />
            <path d="M3 13.5c0-2.5 2-4 5-4s5 1.5 5 4" />
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
      <div className="px-4 pt-[18px] pb-[14px] flex items-center gap-2.5 border-b border-white/[0.08] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gardens-page flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#243D2E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 16V8a6 6 0 0 1 12 0v8" />
            <line x1="2" y1="16" x2="16" y2="16" />
          </svg>
        </div>
        <div>
          <div className="font-head text-[17px] font-bold text-[#F0ECE2] leading-none tracking-[-0.01em]">
            Mason
          </div>
          <div className="font-body text-[9px] font-medium text-white/[0.42] uppercase tracking-[0.08em] mt-0.5 truncate">
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
              className={`text-[9px] font-semibold tracking-[0.1em] uppercase text-white/[0.28] px-4 ${
                si === 0 ? 'pt-1.5 pb-[5px]' : 'pt-3.5 pb-[5px]'
              }`}
            >
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group relative flex items-center gap-[9px] py-[7px] px-[14px] mx-2 my-[1px] rounded-[7px] cursor-pointer transition-colors duration-150 ${
                    isActive
                      ? 'bg-white/[0.11] text-[#F0ECE2]'
                      : 'text-white/[0.42] hover:bg-white/[0.07] hover:text-[#F0ECE2]'
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
                    {item.badge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-[2px] rounded-[10px] min-w-[18px] text-center ${
                          item.badge.subtle
                            ? 'bg-white/[0.12] text-[#F0ECE2]'
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
      <div className="border-t border-white/[0.08] p-2">
        <NavLink
          to="/dashboard/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative flex items-center gap-[9px] py-[7px] px-2 rounded-[7px] cursor-pointer transition-colors duration-150 mb-0.5 ${
              isActive
                ? 'bg-white/[0.11] text-[#F0ECE2]'
                : 'text-white/[0.42] hover:bg-white/[0.07] hover:text-[#F0ECE2]'
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
          className="flex items-center gap-[9px] py-2 px-2 rounded-[7px] cursor-pointer hover:bg-white/[0.07] w-full"
        >
          <div className="w-7 h-7 rounded-full bg-[rgba(194,105,59,0.3)] flex items-center justify-center text-[11px] font-bold text-[#E8A878] flex-shrink-0">
            AY
          </div>
          <div className="text-left">
            <div className="text-xs font-medium text-[#F0ECE2]">Aylin</div>
            <div className="text-[10px] text-white/[0.42] mt-px">Office Manager</div>
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
      <aside className="hidden md:flex w-[220px] flex-shrink-0 bg-gardens-sidebar flex-col border-r border-black/[0.12] overflow-hidden">
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
                className="p-1 rounded hover:bg-white/[0.07] text-white/[0.42] hover:text-white"
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
