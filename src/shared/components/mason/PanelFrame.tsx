import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/** Shared header chrome: kicker, Lora name, lead source, one action, 44px close. Sticks on a scrolling sheet. */
export const PANEL_HEADER_CLASS = 'sticky top-0 z-20 shrink-0 border-b border-gardens-bdr bg-gardens-surf px-6 pb-3.5 pt-4';

/** The one solid action in a panel. */
export const PANEL_PRIMARY =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gardens-acc px-3.5 text-[13px] font-bold text-white hover:bg-gardens-acc-dk disabled:pointer-events-none disabled:opacity-50';

export const PanelHeader: React.FC<{
  /** Ref · value. 12px, tabular figures, not monospace. */
  kicker?: React.ReactNode;
  name: string;
  source?: React.ReactNode;
  /** Ghost controls (edit) that sit beside close. */
  extra?: React.ReactNode;
  /** The one solid action for this panel. Stays in the header on a scrolling sheet. */
  action?: React.ReactNode;
  onClose?: () => void;
}> = ({ kicker, name, source, extra, action, onClose }) => (
  <header data-testid="panel-header" className={PANEL_HEADER_CLASS}>
    <div className={cn('min-w-0', onClose && extra ? 'pr-24' : (onClose || extra) && 'pr-12')}>
      {kicker ? <p className="m-0 truncate text-xs font-semibold tabular-nums text-gardens-txm-aa">{kicker}</p> : null}
      <h2 className="m-0 truncate font-head text-[22px] font-semibold leading-tight text-gardens-tx">{name}</h2>
      {source ? <div className="mt-1.5 flex flex-wrap items-center gap-2">{source}</div> : null}
    </div>
    {action ? <div className="mt-3">{action}</div> : null}
    <div className="absolute right-3 top-3 flex items-center">
      {extra}
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-gardens-txs hover:bg-gardens-page">
          <X className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  </header>
);

const OVERLAY =
  'fixed inset-0 z-50 flex min-h-0 flex-col bg-gardens-surf2 lg:inset-y-0 lg:left-auto lg:right-0 lg:z-40 lg:w-[420px] lg:border-l lg:border-gardens-bdr';
const DOCK = 'relative flex h-full min-h-0 min-w-0 flex-col border-l border-gardens-bdr bg-gardens-surf2';

/**
 * Below 1024px the panel is a full-screen sheet.
 * From 1024px it is a right rail. Pages keep the list visible with a matching right margin — no scrim.
 */
export const PanelShell: React.FC<{
  mode: 'dock' | 'overlay';
  label: string;
  testId?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ mode, label, testId, children, className }) => (
  <aside role="dialog" aria-label={label} data-testid={testId} className={cn(mode === 'dock' ? DOCK : OVERLAY, className)}>
    {children}
  </aside>
);
