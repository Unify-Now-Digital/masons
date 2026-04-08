import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Home, Inbox, MapPin, Hammer, ListCheck,
  Users, Building2, Landmark, Italic, ScrollText, CreditCard,
  FileText, ChartBar, Bell, MessageSquare, UserCog, Menu, X, Bot, Bug,
} from 'lucide-react';
import { useSidebarLayout } from './SidebarLayoutContext';
import { useAdmin } from './AdminContext';

const staticPages = [
  { title: "Landing", url: "/", icon: Home },
  { title: "Inbox", url: "/dashboard/inbox", icon: Inbox },
  { title: "Map", url: "/dashboard/map", icon: MapPin },
  { title: "Jobs", url: "/dashboard/jobs", icon: Hammer },
  { title: "Orders", url: "/dashboard/orders", icon: ListCheck },
  { title: "People", url: "/dashboard/customers", icon: Users },
  { title: "Companies", url: "/dashboard/companies", icon: Building2 },
  { title: "Products", url: "/dashboard/memorials", icon: Landmark },
  { title: "Inscriptions", url: "/dashboard/inscriptions", icon: Italic },
  { title: "Permits", url: "/dashboard/permit-forms", icon: ScrollText },
  { title: "Permit Agent", url: "/dashboard/permit-agent", icon: Bot },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard },
  { title: "Invoicing", url: "/dashboard/invoicing", icon: FileText },
  { title: "Reporting", url: "/dashboard/reporting", icon: ChartBar },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
  { title: "Team Chat", url: "/dashboard/team", icon: MessageSquare },
  { title: "Workers", url: "/dashboard/workers", icon: UserCog },
];

function buildNavPages(isAdmin: boolean) {
  if (!isAdmin) return staticPages;
  const pages = [...staticPages];
  const monitoring = { title: "Monitoring", url: "/dashboard/sentry-monitor", icon: Bug };
  const reportingIdx = pages.findIndex((p) => p.url === "/dashboard/reporting");
  if (reportingIdx >= 0) pages.splice(reportingIdx + 1, 0, monitoring);
  else pages.push(monitoring);
  return pages;
}

export const ReviewNavToolbar: React.FC = () => {
  const { isAdmin } = useAdmin();
  const navPages = useMemo(() => buildNavPages(isAdmin), [isAdmin]);
  const { collapsed, setCollapsed } = useSidebarLayout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Mobile: floating hamburger + slide-out drawer
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-2 left-2 z-50 bg-slate-900 text-white p-2 rounded-lg shadow-lg"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed left-0 top-0 h-full w-56 z-50 bg-slate-900 text-white flex flex-col shadow-xl">
              <div className="flex items-center justify-between p-3 border-b border-slate-700">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Review Nav
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-1">
                {allPages.map((page) => (
                  <NavLink
                    key={page.url}
                    to={page.url}
                    end={page.url === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <page.icon className="h-4 w-4 flex-shrink-0" />
                    <span>{page.title}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          </>
        )}
      </>
    );
  }

  // Desktop: fixed sidebar
  return (
    <div
      className={`fixed left-0 top-0 h-full z-50 bg-slate-900 text-white flex flex-col transition-all duration-200 shadow-xl ${
        collapsed ? 'w-10' : 'w-[140px]'
      }`}
    >
      <div className="flex items-center justify-between p-2 border-b border-slate-700">
        {!collapsed && (
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Review Nav
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {navPages.map((page) => (
          <NavLink
            key={page.url}
            to={page.url}
            end={page.url === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <page.icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{page.title}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
