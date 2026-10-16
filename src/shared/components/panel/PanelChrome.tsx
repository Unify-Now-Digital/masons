import React from 'react';
import { X } from 'lucide-react';

/** Shared header chrome: kicker, Lora name, subject, one action, 44px close. Sticks on a scrolling sheet. */
export const PANEL_HEADER_CLASS = 'relative sticky top-0 z-20 shrink-0 border-b border-gardens-bdr bg-gardens-surf px-6 pb-3.5 pt-4';

/** The one solid action in a panel. */
export const PANEL_PRIMARY =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gardens-acc px-3.5 text-[13px] font-bold text-white hover:bg-gardens-acc-dk disabled:pointer-events-none disabled:opacity-50';

export const PanelHeader: React.FC<{
  /** Type word above the name. Grey, not a second title. */
  kicker?: React.ReactNode;
  name: string;
  /** Kept so older callers compile. Contact lines belong in the Contact card, not here. */
  source?: React.ReactNode;
  /** Secondary control under the name, beside the primary action. */
  extra?: React.ReactNode;
  /** The one solid action. Sits under the name, never on the name line. */
  action?: React.ReactNode;
  onClose?: () => void;
}> = ({ kicker, name, extra, action, onClose }) => (
  <header data-testid="panel-header" className={PANEL_HEADER_CLASS}>
    {onClose ? (
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-gardens-txs hover:bg-gardens-page">
        <X className="h-5 w-5" aria-hidden />
      </button>
    ) : null}
    <div className={onClose ? 'pr-12' : undefined}>
      {kicker ? <p className="m-0 flex min-w-0 items-center gap-1.5 text-xs font-semibold tabular-nums text-gardens-txm-aa">{kicker}</p> : null}
      <h2 className="m-0 truncate font-head text-[22px] font-semibold leading-tight text-gardens-tx">{name}</h2>
      {(action || extra) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {action}
          {extra}
        </div>
      ) : null}
    </div>
  </header>
);
