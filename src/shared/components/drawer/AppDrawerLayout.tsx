/**
 * AppDrawerLayout - Shared layout for create/edit drawers.
 * Sticky header (title, description, close), scrollable body, sticky footer (Cancel + Primary).
 * Use inside DrawerContent. Width: w-[720px] max-w-[90vw] desktop, full on mobile.
 */
import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { DrawerTitle, DrawerDescription } from '@/shared/components/ui/drawer';
import { PANEL_PRIMARY } from '@/shared/components/mason';

export interface AppDrawerLayoutProps {
  title: string;
  description?: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  /** When 'submit', primary button is type="submit" (form handles it). When 'button', uses onClick. */
  primaryType?: 'button' | 'submit';
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  bodyMaxWidth?: boolean;
  className?: string;
}

export const AppDrawerLayout: React.FC<AppDrawerLayoutProps> = ({
  title,
  description,
  primaryLabel,
  primaryDisabled,
  primaryType = 'button',
  onPrimary,
  secondaryLabel = 'Cancel',
  onSecondary,
  onClose,
  children,
  bodyMaxWidth = true,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-0 w-full max-w-[720px]',
        className
      )}
    >
      <header className="sticky top-0 z-20 shrink-0 border-b border-gardens-bdr bg-gardens-surf px-6 pb-3.5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <DrawerTitle className="truncate font-head text-[22px] font-semibold leading-tight text-gardens-tx">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className="mt-1 text-[13px] text-gardens-txs">{description}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">Details</DrawerDescription>
            )}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gardens-txs hover:bg-gardens-page">
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-gardens-surf2">
        <div className={cn('space-y-3 px-3 py-3', bodyMaxWidth && 'mx-auto w-full max-w-[680px]')}>
          {children}
        </div>
      </div>

      <footer className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-3 border-t border-gardens-bdr bg-gardens-surf px-6 py-3">
        <button type="button" onClick={onSecondary} className="inline-flex h-11 items-center px-2 text-[13px] font-semibold text-gardens-txs hover:text-gardens-tx">
          {secondaryLabel}
        </button>
        <button
          type={primaryType}
          onClick={primaryType === 'button' ? onPrimary : undefined}
          disabled={primaryDisabled}
          className={PANEL_PRIMARY}
        >
          {primaryLabel}
        </button>
      </footer>
    </div>
  );
};
