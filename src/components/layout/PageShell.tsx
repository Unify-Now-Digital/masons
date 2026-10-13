import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, MobileMenuButton } from './Sidebar';
import { AdminProvider } from '@/app/layout/AdminContext';
import { AiPanelProvider } from '@/shared/context/AiPanelContext';
import { useOrganization, isNoOrganizationMembershipError } from '@/shared/context/OrganizationContext';
import { UniversalSearch } from '@/shared/components/UniversalSearch';
import { AiPanelHost } from '@/shared/components/AiPanelHost';
import { Button } from '@/shared/components/ui/button';
import { CreateOrganizationModal } from '@/modules/organizations';
import { ShellBottomBar } from './ShellBottomBar';
import { routeSubtitles, shellSegment, showsPaneTitle, titleFor } from './shellRoutes';

/** Pages that manage their own full-bleed layout (no shell padding). */
const fullBleedRoutes = new Set(['inbox']);

export const PageShell: React.FC = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const organization = useOrganization();

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
  const title = titleFor(segment);
  const subtitle = routeSubtitles[segment];
  const isFullBleed = fullBleedRoutes.has(segment);
  const showPaneTitle = showsPaneTitle(segment);

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Mason UI phase 1: the 52px top header (title, "−4.2 days" stub, search,
            bell, avatar) is gone. Search + Ask AI moved to ShellBottomBar; the bell
            and user menu moved to the rail bottom (Sidebar.tsx); the page title
            lives in this slim pane title row so no page loses it. */}
        {/* Pages that render their own heading (pagesWithOwnTitle) get no shell title,
            so no title appears twice. */}
        {showPaneTitle && (
        <div
          className="h-11 flex-shrink-0 bg-gardens-page flex items-center gap-2.5 px-3 sm:px-6 border-b border-gardens-bdr/60"
          data-testid="pane-title"
        >
          <h1 className="font-head text-base md:text-[18px] font-semibold text-gardens-tx tracking-[-0.01em] truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <span className="hidden md:block text-[12px] text-gardens-txm-aa truncate min-w-0">
              {subtitle}
            </span>
          )}
        </div>
        )}

        {/* Content */}
        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col bg-gardens-page ${
            isFullBleed ? '' : 'p-3 sm:p-6'
          }`}
        >
          <Outlet />
        </div>

        <ShellBottomBar
          segment={segment}
          onOpenSearch={() => setSearchOpen(true)}
          mobileMenu={<MobileMenuButton onClick={() => setMobileOpen(true)} />}
        />
      </div>

      <UniversalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <AiPanelHost />
    </div>
    </AiPanelProvider>
    </AdminProvider>
  );
};
