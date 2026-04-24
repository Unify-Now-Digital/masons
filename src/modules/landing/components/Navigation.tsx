import React, { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/shared/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { LogOut, Activity as ActivityIcon } from 'lucide-react';

export const Navigation: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="fixed w-full bg-white/90 backdrop-blur-sm z-50 border-b border-gardens-bdr">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-gardens-blu-dk text-xl font-semibold">Unify<span className="text-gardens-blu-dk">Digital</span></span>
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              <a href="#features" className="text-gardens-tx hover:text-gardens-blu-dk px-3 py-2 text-sm font-medium">
                Features
              </a>
              <a href="#testimonials" className="text-gardens-tx hover:text-gardens-blu-dk px-3 py-2 text-sm font-medium">
                Testimonials
              </a>
              <a href="#pricing" className="text-gardens-tx hover:text-gardens-blu-dk px-3 py-2 text-sm font-medium">
                Pricing
              </a>
              {user ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="ml-4">
                      Account
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
              ) : (
                <Button variant="outline" className="ml-4" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
              )}
              <Button asChild>
                <Link to={user ? '/dashboard' : '/'}>{user ? 'Dashboard' : 'Start Free Trial'}</Link>
              </Button>
            </div>
          </div>
          
          <div className="md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gardens-tx hover:text-gardens-blu hover:bg-gardens-page focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className={`${mobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg
                className={`${mobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:hidden bg-white absolute w-full border-b border-gardens-bdr`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <a 
            href="#features" 
            className="block px-3 py-2 rounded-md text-base font-medium text-gardens-tx hover:text-gardens-blu hover:bg-gardens-page"
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </a>
          <a 
            href="#testimonials" 
            className="block px-3 py-2 rounded-md text-base font-medium text-gardens-tx hover:text-gardens-blu hover:bg-gardens-page"
            onClick={() => setMobileMenuOpen(false)}
          >
            Testimonials
          </a>
          <a 
            href="#pricing" 
            className="block px-3 py-2 rounded-md text-base font-medium text-gardens-tx hover:text-gardens-blu hover:bg-gardens-page"
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </a>
          <div className="pt-4 pb-3 border-t border-gardens-bdr">
            <div className="flex items-center px-5">
              {user ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-center mb-2">
                      Account
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setMobileMenuOpen(false);
                        navigate('/dashboard/activity');
                      }}
                    >
                      <ActivityIcon className="mr-2 h-4 w-4" />
                      <span>My Activity</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={async (event) => {
                        event.preventDefault();
                        setMobileMenuOpen(false);
                        await handleLogout();
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" className="w-full justify-center mb-2" asChild>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
                </Button>
              )}
            </div>
            <div className="flex items-center px-5">
              <Button className="w-full justify-center" asChild>
                <Link to={user ? '/dashboard' : '/'} onClick={() => setMobileMenuOpen(false)}>
                  {user ? 'Dashboard' : 'Start Free Trial'}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
