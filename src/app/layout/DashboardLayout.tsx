import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '@/shared/lib/supabase';
import { useAdmin } from '@/app/layout/AdminContext';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { LogOut, Activity as ActivityIcon } from 'lucide-react';
import { GmailConnectionStatus } from '@/modules/inbox/components/GmailConnectionStatus';
import { WhatsAppConnectionStatus } from '@/modules/inbox/components/WhatsAppConnectionStatus';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAdmin();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen flex flex-col w-full overflow-hidden">
      <header className="h-14 shrink-0 border-b bg-white flex items-center justify-between px-2 sm:px-4">
        <h1 className="ml-2 sm:ml-4 text-sm sm:text-lg font-semibold truncate">Memorial Mason Management</h1>
        <div className="flex items-center gap-2 shrink-0">
          <GmailConnectionStatus />
          <WhatsAppConnectionStatus isAdmin={isAdmin} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                <div className="hidden sm:inline-flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-700">
                    {(user?.email?.charAt(0).toUpperCase() ?? '?')}
                  </div>
                  <span>Account</span>
                </div>
                <span className="sm:hidden">Account</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Signed in as</span>
                  <span className="text-sm font-medium">{user?.email ?? '—'}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  navigate('/dashboard/activity');
                }}
              >
                <ActivityIcon className="mr-2 h-4 w-4" />
                <span>My Activity</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async (event) => {
                  event.preventDefault();
                  await handleLogout();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden p-3 sm:p-6 bg-slate-50">
        <div className="flex-1 min-h-0 min-w-0 overflow-auto flex flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

