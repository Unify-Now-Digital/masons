import React from 'react';
import { Outlet } from 'react-router-dom';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="h-14 border-b bg-white flex items-center px-2 sm:px-4">
        <h1 className="ml-2 sm:ml-4 text-sm sm:text-lg font-semibold truncate">Memorial Mason Management</h1>
      </header>
      <main className="flex-1 p-3 sm:p-6 bg-slate-50 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
};

