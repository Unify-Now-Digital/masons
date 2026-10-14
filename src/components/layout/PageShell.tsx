import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, MobileTabBar } from './Sidebar';
import { AdminProvider } from '@/app/layout/AdminContext';
import { AiPanelProvider } from '@/shared/context/AiPanelContext';
import { useOrganization, isNoOrganizationMembershipError } from '@/shared/context/OrganizationContext';
import { UniversalSearch } from '@/shared/components/UniversalSearch';
import { AiPanelHost } from '@/shared/components/AiPanelHost';
import { Button } from '@/shared/components/ui/button';
import { CreateOrganizationModal } from '@/modules/organizations';
import { ShellActionsProvider } from './ShellActions';
import { shellSegment } from './shellRoutes';

/** Pages that manage their own full-bleed layout (no shell padding). */
const fullBleedRoutes = new Set(['inbox']);

export const PageShell: React.FC = () => {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const organization = useOrganization();
  const openSearch = useCallback(() => setSearchOpen(true), []);

  // Global ⌘K / Ctrl+K shortcut to open the universal search.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Derive title + full-bleed check from current route
  const segment = shellSegment(location.pathname);
  const isFullBleed = fullBleedRoutes.has(segment);

  if (organization.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gardens-page text-gardens-tx">
        <p className="font-body text-sm">Loading workspace…</p>
      </div>
    );
  }

  if (!organization.organizationId || organization.error) {
    const realError =
      organization.error && !isNoOrganizationMembershipError(organization.error)
        ? organization.error
        : null;

    return (
      <>
        <div className="flex h-screen flex-col items-center justify-center gap-6 bg-gardens-page px-6 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="font-head text-xl font-semibold text-gardens-tx">Welcome to Mason</h1>
            <p className="font-body text-sm text-gardens-txm leading-relaxed">
              Get started by creating your workspace or ask an administrator to add you to an existing
              organisation.
            </p>
            {realError && (
              <p className="font-body text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-left">
                {realError.message}
              </p>
            )}
            <Button
              type="button"
              className="mt-2"
              onClick={() => setCreateOrgOpen(true)}
            >
              Create organisation
            </Button>
          </div>
        </div>
        <CreateOrganizationModal open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
      </>
    );
  }

  return (
    <AdminProvider>
    <AiPanelProvider>
    <ShellActionsProvider segment={segment} onOpenSearch={openSearch}>
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom)+56px)] md:pb-0">
        {/* Shell v2 (Oct 2026): no page-title row on ANY page. The active page is shown
            by the strongly highlighted rail item (Sidebar.tsx); Search and Ask AI are
            rail items (no floating pill), so nothing covers content. Under 768px the rail is
            a bottom tab bar (MobileTabBar) and content leaves room for it. */}
        {/* Content */}
        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col bg-gardens-page ${
            isFullBleed ? '' : 'p-3 sm:p-4 min-[1440px]:p-6'
          }`}
          data-testid="shell-content"
        >
          <Outlet />
        </div>

      </div>

      <MobileTabBar />
      <UniversalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <AiPanelHost />
    </div>
    </ShellActionsProvider>
    </AiPanelProvider>
    </AdminProvider>
  );
};
