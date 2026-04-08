import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase';

function adminEmailList(): string[] {
  return (import.meta.env.VITE_ADMIN_EMAIL ?? '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

function computeIsAdmin(user: User | null): boolean {
  const current = (user?.email ?? '').trim().toLowerCase();
  if (!current) return false;
  return adminEmailList().includes(current);
}

export interface AdminContextValue {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!cancelled) {
        setUser(u ?? null);
        setIsLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AdminContextValue>(
    () => ({
      user,
      isAdmin: computeIsAdmin(user),
      isLoading,
    }),
    [user, isLoading],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return ctx;
}
