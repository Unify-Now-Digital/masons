import React from 'react';
import { cn } from '@/shared/lib/utils';
import { PanelHeader } from './PanelChrome';

/** Full-screen below 1024px, 420px right rail from there. No scrim. */
export const SIDE_PANEL_OVERLAY =
  'fixed inset-0 z-50 flex min-h-0 flex-col bg-gardens-surf2 lg:inset-y-0 lg:left-auto lg:right-0 lg:z-40 lg:w-[420px] lg:border-l lg:border-gardens-bdr';

/** In-flow column. The page grid sets the width (420px). No backdrop, no close. */
export const SIDE_PANEL_DOCK =
  'relative flex h-full min-h-0 min-w-0 flex-col overflow-auto border-l border-gardens-bdr bg-gardens-surf2 text-gardens-tx';

/** Fills a page column. Full-screen sheet below 1024px. */
export const SIDE_PANEL_INLINE =
  'flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-l border-gardens-bdr bg-gardens-surf2 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:bottom-14 max-lg:z-50';

export const SidePanel: React.FC<{
  mode: 'overlay' | 'dock' | 'inline';
  label: string;
  testId?: string;
  className?: string;
  children: React.ReactNode;
  /** When set, the shared serif header is drawn. Omit when children draw their own. */
  kicker?: React.ReactNode;
  name?: string;
  source?: React.ReactNode;
  action?: React.ReactNode;
  extra?: React.ReactNode;
  onClose?: () => void;
}> = ({ mode, label, testId, className, children, kicker, name, source, action, extra, onClose }) => (
  <aside
    role={mode === 'dock' ? undefined : 'dialog'}
    aria-label={label}
    data-testid={testId}
    data-variant={mode === 'dock' ? 'docked' : mode}
    className={cn(mode === 'dock' ? SIDE_PANEL_DOCK : mode === 'inline' ? SIDE_PANEL_INLINE : SIDE_PANEL_OVERLAY, className)}
  >
    {name != null ? (
      <PanelHeader kicker={kicker} name={name} source={source} action={action} extra={extra} onClose={onClose} />
    ) : null}
    {children}
  </aside>
);
