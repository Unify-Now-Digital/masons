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
import { Sidebar } from './Sidebar';

/* Route → topbar title mapping */
const routeTitles: Record<string, string> = {
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
  activity: 'Activity',
  companies: 'Companies',
  memorials: 'Products',
  inscriptions: 'Inscriptions',
  notifications: 'Notifications',
};

export const PageShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);

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

  // Derive title from current route
  const segment = location.pathname.split('/').filter(Boolean).pop() ?? '';
  const title = routeTitles[segment] ?? 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* TopBar */}
        <header className="h-[52px] flex-shrink-0 bg-gardens-surf border-b border-gardens-bdr flex items-center px-[22px] gap-3.5">
          <div className="font-head text-[19px] font-semibold text-gardens-tx tracking-[-0.01em] flex-1">
            {title}
          </div>

          {/* Search */}
          <div className="flex items-center gap-[7px] bg-gardens-page border border-gardens-bdr rounded-lg px-[11px] py-1.5 w-[220px]">
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
          <button className="w-8 h-8 rounded-[7px] border border-gardens-bdr bg-transparent flex items-center justify-center text-gardens-txs relative hover:bg-gardens-page">
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
        <div className="flex-1 overflow-hidden flex flex-col bg-gardens-page">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
