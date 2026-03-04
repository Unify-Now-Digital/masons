import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '@/shared/lib/supabase';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { LogOut, Activity as ActivityIcon } from 'lucide-react';
import { GmailConnectionStatus } from '@/modules/inbox/components/GmailConnectionStatus';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="h-14 border-b bg-white flex items-center justify-between px-2 sm:px-4">
        <h1 className="ml-2 sm:ml-4 text-sm sm:text-lg font-semibold truncate">Memorial Mason Management</h1>
        <div className="flex items-center gap-2 shrink-0">
          <GmailConnectionStatus />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                <span className="hidden sm:inline">Account</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
      <main className="flex-1 p-3 sm:p-6 bg-slate-50 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
};

