import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/** Shared header chrome: kicker, Lora name, subject, one action, 44px close. Sticks on a scrolling sheet. */
export const PANEL_HEADER_CLASS = 'sticky top-0 z-20 shrink-0 border-b border-gardens-bdr bg-gardens-surf px-6 pb-3.5 pt-4';

/** The one solid action in a panel. */
export const PANEL_PRIMARY =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gardens-acc px-3.5 text-[13px] font-bold text-white hover:bg-gardens-acc-dk disabled:pointer-events-none disabled:opacity-50';

export const PanelHeader: React.FC<{
  /** Ref · value. 12px, tabular figures, not monospace. */
  kicker?: React.ReactNode;
  name: string;
  /** Subject line under the name. Wraps; never a second title. */
  source?: React.ReactNode;
  /** Ghost controls (edit) that sit beside close. */
  extra?: React.ReactNode;
  /** The one solid action for this panel. Stays in the header on a scrolling sheet. */
  action?: React.ReactNode;
  onClose?: () => void;
}> = ({ kicker, name, source, extra, action, onClose }) => (
  <header data-testid="panel-header" className={PANEL_HEADER_CLASS}>
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1 basis-40">
        {kicker ? <p className="m-0 flex min-w-0 items-center gap-1.5 text-xs font-semibold tabular-nums text-gardens-txm-aa">{kicker}</p> : null}
        <h2 className="m-0 truncate font-head text-[22px] font-semibold leading-tight text-gardens-tx">{name}</h2>
        {source ? <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">{source}</div> : null}
      </div>
      <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
        {action}
        {extra}
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gardens-txs hover:bg-gardens-page">
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
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
