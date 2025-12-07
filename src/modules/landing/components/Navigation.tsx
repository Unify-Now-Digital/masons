
import React, { useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Link } from 'react-router-dom';

export const Navigation: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed w-full bg-white/90 backdrop-blur-sm z-50 border-b border-slate-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-blue-900 text-xl font-semibold">Unify<span className="text-blue-700">Digital</span></span>
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              <a href="#features" className="text-slate-600 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Features
              </a>
              <a href="#testimonials" className="text-slate-600 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Testimonials
              </a>
              <a href="#pricing" className="text-slate-600 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Pricing
              </a>
              <Button variant="outline" className="ml-4">
                Log in
              </Button>
              <Button>
                Start Free Trial
              </Button>
            </div>
          </div>
          
          <div className="md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-700 hover:text-blue-500 hover:bg-slate-100 focus:outline-none"
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

      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:hidden bg-white absolute w-full border-b border-slate-200`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <a 
            href="#features" 
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:text-blue-500 hover:bg-slate-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </a>
          <a 
            href="#testimonials" 
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:text-blue-500 hover:bg-slate-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            Testimonials
          </a>
          <a 
            href="#pricing" 
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:text-blue-500 hover:bg-slate-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </a>
          <div className="pt-4 pb-3 border-t border-slate-200">
            <div className="flex items-center px-5">
              <Button variant="outline" className="w-full justify-center mb-2">
                Log in
              </Button>
            </div>
            <div className="flex items-center px-5">
              <Button className="w-full justify-center">
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
